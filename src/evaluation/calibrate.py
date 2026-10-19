"""Fit uncertainty components and write models/calibration.json + models/ood_stats.npz.

Run:  python -m src.evaluation.calibrate [--device cpu|mps]

Defaults to CPU: on the development Mac, long MPS runs intermittently hung
inside Metal (waitUntilCompleted never returned).

Data usage (to avoid test-set leakage):
  * training split   -> Mahalanobis class means / covariance
  * validation split -> temperature, confidence threshold, OOD threshold,
                        image-quality and pest-screen false-alarm thresholds
  * test split       -> evaluated ONCE at the end for reporting only; no value
                        computed on it is fed back into any threshold.
If you re-run this script after changing the selection rules, re-tuning has
effectively looked at the test report; record that in the README.
"""

from __future__ import annotations

import argparse
import json
import time

import cv2

import numpy as np
import pandas as pd
import torch
from PIL import Image
from torch.utils.data import DataLoader, Dataset

from src import config
from src.data.dataset import SPLITS_FILE
from src.inference.model import forward_with_features, load_mobilenet_checkpoint, pooled_features
from src.inference.ood import MahalanobisScorer
from src.inference.pest_screen import ARTHROPOD_CLASS_INDICES, PestScreen
from src.inference.predictor import PEST_SCREEN_SIZE
from src.utils.preprocessing import assess_quality, build_transform

TARGET_SELECTIVE_ACCURACY = 0.97   # accuracy required among "confident" predictions
OOD_PERCENTILE = 97.5              # ~2.5% of in-distribution validation images flagged
QUALITY_PERCENTILE = 1.0           # quality rules may flag at most ~1% of validation images
PEST_PERCENTILE = 99.5
CACHE_DIR = config.DATA_DIR / "calibration_cache"  # delete to force re-extraction


def _worker_init(_):
    # OpenCV's and torch's thread pools can deadlock inside spawned DataLoader
    # workers on macOS; each worker is single-threaded instead.
    cv2.setNumThreads(0)
    torch.set_num_threads(1)


class EvalDataset(Dataset):
    def __init__(self, df, class_to_idx, transform, pest_transform=None, with_quality=False):
        self.df = df.reset_index(drop=True)
        self.class_to_idx = class_to_idx
        self.transform = transform
        self.pest_transform = pest_transform
        self.with_quality = with_quality

    def __len__(self):
        return len(self.df)

    def __getitem__(self, i):
        row = self.df.iloc[i]
        image = Image.open(config.ROOT / row["image_path"]).convert("RGB")
        item = {"x": self.transform(image), "y": self.class_to_idx[row["class_label"]]}
        if self.pest_transform is not None:
            item["x224"] = self.pest_transform(image)
        if self.with_quality:
            q = assess_quality(image, config.DEFAULT_THRESHOLDS)
            item["quality"] = torch.tensor([q.brightness, q.blur_variance, q.vegetation_fraction])
        return item


@torch.no_grad()
def run(model, loader, device, pest=None):
    out = {"logits": [], "feats": [], "y": [], "pest": [], "quality": []}
    for i, batch in enumerate(loader):
        if i % 20 == 0:
            print(f"  batch {i}/{len(loader)}", flush=True)
        logits, feats = forward_with_features(model, batch["x"].to(device))
        out["logits"].append(logits.cpu())
        out["feats"].append(feats.cpu())
        out["y"].append(batch["y"])
        if pest is not None and "x224" in batch:
            f224 = pooled_features(model, batch["x224"].to(device))
            probs = torch.softmax(pest.head(f224), 1)
            out["pest"].append(probs[:, ARTHROPOD_CLASS_INDICES].sum(1).cpu())
        if "quality" in batch:
            out["quality"].append(batch["quality"])
    return {k: torch.cat(v).numpy() for k, v in out.items() if v}


def fit_temperature(logits: np.ndarray, y: np.ndarray) -> float:
    lg, yt = torch.tensor(logits, dtype=torch.float64), torch.tensor(y)
    log_t = torch.zeros(1, dtype=torch.float64, requires_grad=True)
    opt = torch.optim.LBFGS([log_t], lr=0.1, max_iter=200)

    def closure():
        opt.zero_grad()
        loss = torch.nn.functional.cross_entropy(lg / log_t.exp(), yt)
        loss.backward()
        return loss

    opt.step(closure)
    return float(log_t.detach().exp())


def softmax(logits, t=1.0):
    z = logits / t
    z = z - z.max(1, keepdims=True)
    e = np.exp(z)
    return e / e.sum(1, keepdims=True)


def ece(probs, y, bins=15):
    conf, pred = probs.max(1), probs.argmax(1)
    edges = np.linspace(0, 1, bins + 1)
    total = 0.0
    for lo, hi in zip(edges[:-1], edges[1:]):
        m = (conf > lo) & (conf <= hi)
        if m.any():
            total += m.mean() * abs((pred[m] == y[m]).mean() - conf[m].mean())
    return float(total)


def choose_confidence_threshold(probs, y, target):
    conf, correct = probs.max(1), probs.argmax(1) == y
    for t in np.round(np.arange(0.30, 0.996, 0.01), 2):
        m = conf >= t
        if m.sum() >= 50 and correct[m].mean() >= target:
            return float(t)
    return 0.99


def selective(probs, y, t):
    conf, correct = probs.max(1), probs.argmax(1) == y
    m = conf >= t
    return {"coverage": float(m.mean()), "accuracy_on_accepted": float(correct[m].mean()) if m.any() else None}


def main():
    t0 = time.time()
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--device", default="cpu", choices=["cpu", "mps"])
    args = parser.parse_args()
    device = torch.device(args.device)
    print("Device:", device)
    loaded = load_mobilenet_checkpoint(config.MOBILENET_CHECKPOINT, device)
    model, names = loaded.model, loaded.class_names
    class_to_idx = {n: i for i, n in enumerate(names)}

    df = pd.read_csv(SPLITS_FILE)
    if sorted(df["class_label"].unique()) != names:
        raise SystemExit("splits.csv labels do not match checkpoint class mapping")

    tf = build_transform(loaded.image_size, loaded.mean, loaded.std)
    tf224 = build_transform(PEST_SCREEN_SIZE, loaded.mean, loaded.std)
    pest = PestScreen.from_cache(device)

    def loader(split, **kw):
        ds = EvalDataset(df[df["final_split"] == split], class_to_idx, tf, **kw)
        return DataLoader(ds, batch_size=128, num_workers=4, worker_init_fn=_worker_init)

    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    def cached(split, make):
        """Extracted features are cached so a re-run only repeats the cheap fitting."""
        path = CACHE_DIR / f"{split}.npz"
        if path.exists():
            print(f"Using cached {split} features: {path}")
            with np.load(path) as data:
                return dict(data)
        out = make()
        np.savez(path, **out)
        return out

    print("Extracting training features...")
    train = cached("train", lambda: run(model, loader("train"), device))
    print(f"  {len(train['y'])} images ({time.time() - t0:.0f}s)")
    print("Extracting validation features...")
    val = cached("validation", lambda: run(
        model, loader("validation", pest_transform=tf224 if pest else None, with_quality=True), device, pest))
    print(f"  {len(val['y'])} images ({time.time() - t0:.0f}s)")

    # ---- fit on train / validation only ----
    temperature = fit_temperature(val["logits"], val["y"])
    val_probs = softmax(val["logits"], temperature)
    conf_t = choose_confidence_threshold(val_probs, val["y"], TARGET_SELECTIVE_ACCURACY)

    scorer = MahalanobisScorer.fit(train["feats"], train["y"], len(names))
    val_ood = scorer.score(val["feats"])
    ood_t = float(np.percentile(val_ood, OOD_PERCENTILE))
    scorer.save(config.OOD_STATS_PATH)

    d = config.DEFAULT_THRESHOLDS
    qb, qblur, qveg = val["quality"].T
    thresholds = {
        "temperature": temperature,
        "confidence_threshold": conf_t,
        "ood_threshold": ood_t,
        "plant_mass_threshold": d["plant_mass_threshold"],
        # Calibration may only relax the hand-set defaults, never tighten them.
        "brightness_min": float(min(d["brightness_min"], np.percentile(qb, QUALITY_PERCENTILE / 2))),
        "brightness_max": float(max(d["brightness_max"], np.percentile(qb, 100 - QUALITY_PERCENTILE / 2))),
        "blur_min_variance": float(min(d["blur_min_variance"], np.percentile(qblur, QUALITY_PERCENTILE))),
        "vegetation_min_fraction": float(min(d["vegetation_min_fraction"], np.percentile(qveg, QUALITY_PERCENTILE))),
        "pest_screen_threshold": float(max(d["pest_screen_threshold"], np.percentile(val["pest"], PEST_PERCENTILE)))
        if pest else d["pest_screen_threshold"],
    }
    val_report = {
        "accuracy": float((val_probs.argmax(1) == val["y"]).mean()),
        "ece_uncalibrated": ece(softmax(val["logits"]), val["y"]),
        "ece_temperature_scaled": ece(val_probs, val["y"]),
        "selective": selective(val_probs, val["y"], conf_t),
        "ood_flag_rate": float((val_ood > ood_t).mean()),
        "low_vegetation_flag_rate": float((qveg < thresholds["vegetation_min_fraction"]).mean()),
        "blur_flag_rate": float((qblur < thresholds["blur_min_variance"]).mean()),
        "pest_flag_rate": float((val["pest"] >= thresholds["pest_screen_threshold"]).mean()) if pest else None,
    }

    # ---- final one-shot test evaluation (reporting only) ----
    print("Evaluating on test split (report only)...")
    test = cached("test", lambda: run(model, loader("test", pest_transform=tf224 if pest else None), device, pest))
    test_probs = softmax(test["logits"], temperature)
    test_ood = scorer.score(test["feats"])
    test_report = {
        "n": int(len(test["y"])),
        "accuracy": float((test_probs.argmax(1) == test["y"]).mean()),
        "ece_uncalibrated": ece(softmax(test["logits"]), test["y"]),
        "ece_temperature_scaled": ece(test_probs, test["y"]),
        "selective": selective(test_probs, test["y"], conf_t),
        "ood_flag_rate": float((test_ood > ood_t).mean()),
        "pest_flag_rate": float((test["pest"] >= thresholds["pest_screen_threshold"]).mean()) if pest else None,
    }

    result = {
        "created_with": "python -m src.evaluation.calibrate",
        "notes": "Thresholds fitted on train/validation only. Test metrics are reporting-only.",
        "thresholds": thresholds,
        "validation_report": val_report,
        "test_report": test_report,
    }
    with open(config.CALIBRATION_PATH, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)
    print(json.dumps(result, indent=2))
    print(f"Done in {time.time() - t0:.0f}s -> {config.CALIBRATION_PATH}")


if __name__ == "__main__":
    main()
