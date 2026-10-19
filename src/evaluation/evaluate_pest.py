"""Measure the CLIP pest screen's hit rate on real pest photos (IP102).

Run:  python -m src.evaluation.evaluate_pest [--per-class 20]

IP102 (Wu et al., CVPR 2019) has ~75k field photos of 102 insect pests of
8 crops. Download it once into data/external/ip102/ (ip102_v1.1.tar +
classes.txt from the authors' Google Drive, linked at github.com/xpwu95/IP102)
and extract the tar there.

A fixed stratified sample (``--per-class`` images per class) is drawn from the
IP102 *val* split to study the hit-rate / false-alarm trade-off, and from the
*test* split for the reported number. False alarms come from the same 1,000
pest-free PlantVillage validation images used by calibrate_pest. Every IP102
image counts as a positive, although some show adult insects away from any
plant. The app threshold is NOT changed; results are merged into
models/calibration.json under "pest_screen_ip102_eval".
"""

import argparse
import json
import time
from pathlib import Path

import numpy as np
import pandas as pd
from PIL import Image

from src import config
from src.data.dataset import SPLITS_FILE
from src.evaluation.calibrate_pest import SAMPLE_SIZE, scores as plantvillage_scores
from src.inference.pest_screen import ClipPestScreen, CLIP_PROMPTS

IP102_DIR = config.DATA_DIR / "external" / "ip102"
CACHE = config.DATA_DIR / "calibration_cache" / "pest_scores.npz"
BATCH = 16
FALSE_ALARM_TARGETS = (0.5, 1.0, 2.0, 5.0, 10.0)   # percent of pest-free leaves flagged

# Class-index ranges per crop, from the IP102 paper (classes.txt order).
CROPS = [("Rice", 0, 13), ("Corn", 14, 26), ("Wheat", 27, 35), ("Beet", 36, 43),
         ("Alfalfa", 44, 56), ("Vitis", 57, 72), ("Citrus", 73, 91), ("Mango", 92, 101)]


def crop_of(label: int) -> str:
    return next(name for name, lo, hi in CROPS if lo <= label <= hi)


def find_root(base: Path) -> Path:
    for split_file in base.rglob("test.txt"):
        if (split_file.parent / "images").is_dir():
            return split_file.parent
    raise SystemExit(f"IP102 not found under {base}; extract ip102_v1.1.tar there first")


def load_split(root: Path, split: str, per_class: int) -> pd.DataFrame:
    df = pd.read_csv(root / f"{split}.txt", sep=" ", names=["file", "label"], dtype={"file": str})
    df = df.sample(frac=1, random_state=0).groupby("label").head(per_class).sort_values("label")
    return df.assign(path=[str(root / "images" / f) for f in df["file"]], crop=df["label"].map(crop_of))


def ip102_scores(screen, paths):
    pest_mask = np.array([p for _, p, _ in CLIP_PROMPTS])
    out = np.full(len(paths), np.nan)
    for i in range(0, len(paths), BATCH):
        images, idx = [], []
        for j, p in enumerate(paths[i:i + BATCH]):
            try:
                images.append(Image.open(p).convert("RGB"))
                idx.append(i + j)
            except OSError:
                pass                                  # a few IP102 files are unreadable
        if images:
            out[idx] = screen.probabilities(images).numpy()[:, pest_mask].sum(1)
        if (i // BATCH) % 20 == 0:
            print(f"  {i + BATCH}/{len(paths)}", flush=True)
    return out


def cached(key: str, compute):
    store = dict(np.load(CACHE)) if CACHE.exists() else {}
    if key not in store:
        store[key] = compute()
        np.savez(CACHE, **store)
    return store[key]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--per-class", type=int, default=20)
    args = ap.parse_args()
    t0 = time.time()
    screen = ClipPestScreen.from_cache()
    if screen is None:
        raise SystemExit("CLIP model not cached. Run: python -m src.inference.download_models")
    root = find_root(IP102_DIR)
    with open(config.CALIBRATION_PATH, encoding="utf-8") as f:
        cal = json.load(f)
    threshold = cal["thresholds"]["pest_screen_threshold"]

    df = pd.read_csv(SPLITS_FILE)
    val = df[df["final_split"] == "validation"]
    clean = val[~val["class_label"].str.contains("Spider_mites")].sample(SAMPLE_SIZE, random_state=0)
    print("Scoring pest-free PlantVillage sample...")
    clean_scores = cached("plantvillage_clean", lambda: plantvillage_scores(screen, list(clean["image_path"])))

    splits = {}
    for split in ("val", "test"):
        sample = load_split(root, split, args.per_class)
        print(f"Scoring IP102 {split} sample ({len(sample)} images)...")
        s = cached(f"ip102_{split}_{args.per_class}", lambda: ip102_scores(screen, list(sample["path"])))
        splits[split] = sample.assign(score=s).dropna(subset=["score"])

    v, t = splits["val"], splits["test"]
    tradeoff = []
    for fa in FALSE_ALARM_TARGETS:
        thr = float(np.percentile(clean_scores, 100 - fa))
        tradeoff.append({"pest_free_flag_rate": fa / 100, "threshold": thr,
                         "ip102_val_hit_rate": float((v["score"] >= thr).mean())})

    hit = t["score"] >= threshold
    report = {
        "dataset": "IP102 v1.1 (Wu et al., CVPR 2019)",
        "per_class": args.per_class,
        "threshold": threshold,
        "test_images": int(len(t)),
        "test_hit_rate": float(hit.mean()),
        "test_hit_rate_by_crop": {k: float(x) for k, x in hit.groupby(t["crop"]).mean().items()},
        "test_score_percentiles": {str(q): float(np.percentile(t["score"], q)) for q in (10, 25, 50, 75, 90)},
        "pest_free_flag_rate": float((clean_scores >= threshold).mean()),
        "tradeoff_on_val": tradeoff,
        "note": "Every IP102 image counts as a positive; some show insects away from plants.",
    }
    names = (root.parent / "classes.txt") if (root.parent / "classes.txt").exists() else IP102_DIR / "classes.txt"
    if names.exists():
        lines = [l.split(maxsplit=1)[-1].strip() for l in names.read_text().splitlines() if l.strip()]
        per = hit.groupby(t["label"]).mean().sort_values()
        report["test_least_detected_classes"] = {lines[i]: float(x) for i, x in per.head(8).items()}
        report["test_most_detected_classes"] = {lines[i]: float(x) for i, x in per.tail(5).items()}

    cal["pest_screen_ip102_eval"] = report
    with open(config.CALIBRATION_PATH, "w", encoding="utf-8") as f:
        json.dump(cal, f, indent=2)
    print(json.dumps(report, indent=2))
    print(f"Done in {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
