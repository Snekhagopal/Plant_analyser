"""Set the CLIP pest-screen threshold from validation data.

Run:  python -m src.evaluation.calibrate_pest

PlantVillage has no pest-infested images apart from the spider-mite class, so
we can only control *false alarms*: the threshold is the 99th percentile of
CLIP pest scores on a fixed random sample of 1,000 pest-free validation
images (~1% false-alarm rate on lab photos). The spider-mite validation
images are reported separately as a weak positive check (they show mite
damage, often without visible mites). The test split is not used.

Results are merged into models/calibration.json.
"""

import json
import time

import numpy as np
import pandas as pd
from PIL import Image

from src import config
from src.data.dataset import SPLITS_FILE
from src.inference.pest_screen import ClipPestScreen, CLIP_PROMPTS

SAMPLE_SIZE = 1000
FALSE_ALARM_PERCENTILE = 99.0
BATCH = 16


def scores(screen, paths):
    pest_mask = np.array([p for _, p, _ in CLIP_PROMPTS])
    out = []
    for i in range(0, len(paths), BATCH):
        images = [Image.open(config.ROOT / p).convert("RGB") for p in paths[i:i + BATCH]]
        out.extend(screen.probabilities(images).numpy()[:, pest_mask].sum(1))
        if (i // BATCH) % 10 == 0:
            print(f"  {i + len(images)}/{len(paths)}", flush=True)
    return np.array(out)


def main():
    t0 = time.time()
    screen = ClipPestScreen.from_cache()
    if screen is None:
        raise SystemExit("CLIP model not cached. Run: python -m src.inference.download_models")
    df = pd.read_csv(SPLITS_FILE)
    val = df[df["final_split"] == "validation"]
    mites = val["class_label"].str.contains("Spider_mites")
    clean = val[~mites].sample(SAMPLE_SIZE, random_state=0)

    print("Scoring pest-free validation sample...")
    clean_scores = scores(screen, list(clean["image_path"]))
    threshold = float(np.percentile(clean_scores, FALSE_ALARM_PERCENTILE))
    print("Scoring spider-mite validation images...")
    mite_scores = scores(screen, list(val[mites]["image_path"]))

    clean = clean.assign(score=clean_scores)
    per_class = (clean.assign(flag=clean_scores >= threshold).groupby("class_label")["flag"].mean())
    report = {
        "model": config.PEST_CLIP_MODEL,
        "prompts": [p for p, _, _ in CLIP_PROMPTS],
        "threshold": threshold,
        "pest_free_sample": SAMPLE_SIZE,
        "pest_free_flag_rate": float((clean_scores >= threshold).mean()),
        "pest_free_percentiles": {str(q): float(np.percentile(clean_scores, q)) for q in (50, 90, 95, 99)},
        "classes_most_flagged": {k: float(v) for k, v in per_class.sort_values(ascending=False).head(5).items()},
        "spider_mite_images": int(mites.sum()),
        "spider_mite_flag_rate": float((mite_scores >= threshold).mean()),
        "note": "Hit rate on real pest photos: see pest_screen_ip102_eval (src/evaluation/evaluate_pest.py).",
    }

    with open(config.CALIBRATION_PATH, encoding="utf-8") as f:
        cal = json.load(f)
    imagenet_t = cal["thresholds"].get("pest_screen_threshold_imagenet",
                                       cal["thresholds"].get("pest_screen_threshold"))
    cal["thresholds"]["pest_screen_threshold_imagenet"] = imagenet_t
    cal["thresholds"]["pest_screen_threshold"] = threshold
    cal["pest_screen_report"] = report
    with open(config.CALIBRATION_PATH, "w", encoding="utf-8") as f:
        json.dump(cal, f, indent=2)
    print(json.dumps(report, indent=2))
    print(f"Done in {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
