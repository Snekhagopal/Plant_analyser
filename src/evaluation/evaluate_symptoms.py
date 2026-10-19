"""Evaluate the zero-shot symptom screen and set its "clear pattern" threshold.

Run:  python -m src.evaluation.evaluate_symptoms     (~25 min on CPU the first time, then seconds)

1. CLIP ViT-L/14 image embeddings are extracted for a fixed sample of
   PlantVillage images (``train`` split: ~600 per symptom group, spread evenly
   over its classes; ``test`` split: 25 per class) and cached.
2. The zero-shot screen (src/inference/symptom_screen.py) uses no PlantVillage
   training, so every image is effectively from an unseen plant. Its
   threshold is the lowest top-probability at which accuracy on the *train*
   sample reaches TARGET_ACCURACY. Below it, the top two patterns are reported
   together when their summed probability reaches the pair threshold, chosen
   so the true pattern is one of the two on the train sample at least
   TARGET_PAIR_ACCURACY of the time. All reported numbers use the *test* sample.
3. Baseline kept for the record: a logistic-regression probe trained on the
   embeddings, scored leave-one-species-out (trained on 13 host plants, tested
   on the 14th). It learned species shortcuts (e.g. squash -> mildew) and was
   rejected; see README.

Results are merged into models/calibration.json ("symptom_screen_report" and
thresholds.symptom_clear_threshold).
"""

import json
import time

import numpy as np
import pandas as pd
import torch
from PIL import Image
from sklearn.linear_model import LogisticRegression

from src import config
from src.data.dataset import SPLITS_FILE
from src.inference.pest_screen import ClipPestScreen
from src.inference.symptom_screen import SYMPTOMS, SymptomScreen, symptom_of

CACHE = config.DATA_DIR / "calibration_cache" / "clip_symptom_embeddings.npz"
TRAIN_PER_SYMPTOM = 600
TEST_PER_CLASS = 25
BATCH = 16
TARGET_ACCURACY = 0.80
TARGET_PAIR_ACCURACY = 0.85
CLASSES = list(SYMPTOMS)
CLASSES_ARR = np.array(CLASSES)


def sample() -> pd.DataFrame:
    df = pd.read_csv(SPLITS_FILE)
    df = df.assign(symptom=df["class_label"].map(symptom_of)).dropna(subset=["symptom"])
    parts = []
    train = df[df["final_split"] == "train"]
    for symptom, g in train.groupby("symptom"):
        per_class = TRAIN_PER_SYMPTOM // g["class_label"].nunique()
        parts.append(g.sample(frac=1, random_state=0).groupby("class_label").head(per_class))
    test = df[df["final_split"] == "test"]
    parts.append(test.sample(frac=1, random_state=0).groupby("class_label").head(TEST_PER_CLASS))
    return pd.concat(parts).reset_index(drop=True)


def embeddings(screen: ClipPestScreen, paths: list[str]) -> np.ndarray:
    out = []
    for i in range(0, len(paths), BATCH):
        images = [Image.open(config.ROOT / p).convert("RGB") for p in paths[i:i + BATCH]]
        out.append(screen.embed(images).numpy())
        if (i // BATCH) % 20 == 0:
            print(f"  {i + len(images)}/{len(paths)}", flush=True)
    return np.concatenate(out)


def recall(y_true, y_pred) -> dict:
    return {c: float((y_pred[y_true == c] == c).mean()) for c in CLASSES if (y_true == c).any()}


def summary(y_true, y_pred) -> dict:
    r = recall(y_true, y_pred)
    return {"accuracy": float((y_pred == y_true).mean()), "balanced_accuracy": float(np.mean(list(r.values()))),
            "recall_by_symptom": r}


def loso_probe_baseline(emb, y, is_train, hosts) -> dict:
    """Rejected approach: probe trained on other plants, tested on the held-out plant."""
    pred = np.empty(len(y), dtype=object)
    for host in np.unique(hosts):
        held = hosts == host
        tr, te = is_train & ~held, ~is_train & held
        model = LogisticRegression(C=1.0, max_iter=5000, class_weight="balanced").fit(emb[tr], y[tr])
        pred[te] = model.predict(emb[te])
    return summary(y[~is_train], pred[~is_train].astype(str))


def main():
    t0 = time.time()
    clip = ClipPestScreen.from_cache()
    if clip is None:
        raise SystemExit("CLIP model not cached. Run: python -m src.inference.download_models")
    df = sample()
    if CACHE.exists() and list(np.load(CACHE)["paths"]) == list(df["image_path"]):
        emb = np.load(CACHE)["emb"]
    else:
        print(f"Embedding {len(df)} images...")
        emb = embeddings(clip, list(df["image_path"]))
        np.savez(CACHE, emb=emb, paths=np.array(df["image_path"], dtype=str))

    y = df["symptom"].to_numpy()
    is_train = (df["final_split"] == "train").to_numpy()
    hosts = df["host"].to_numpy()

    screen = SymptomScreen(clip, threshold=0.0)
    probs = screen.probabilities(emb)
    pred, conf = CLASSES_ARR[probs.argmax(1)], probs.max(1)

    threshold = 0.0
    for t in np.arange(0.0, 1.0, 0.01):
        kept = is_train & (conf >= t)
        if kept.any() and (pred[kept] == y[kept]).mean() >= TARGET_ACCURACY:
            threshold = round(float(t), 2)
            break

    order = np.argsort(-probs, axis=1)
    top2 = probs[np.arange(len(probs)), order[:, 0]] + probs[np.arange(len(probs)), order[:, 1]]
    in_top2 = (CLASSES_ARR[order[:, 0]] == y) | (CLASSES_ARR[order[:, 1]] == y)
    pair_threshold = 1.0
    for t in np.arange(threshold, 1.0, 0.01):
        mixed = is_train & (conf < threshold) & (top2 >= t)
        if mixed.any() and in_top2[mixed].mean() >= TARGET_PAIR_ACCURACY:
            pair_threshold = round(float(t), 2)
            break

    te = ~is_train
    clear = te & (conf >= threshold)
    mixed = te & (conf < threshold) & (top2 >= pair_threshold)
    report = {
        "model": config.PEST_CLIP_MODEL,
        "method": "zero-shot prompt ensemble (no PlantVillage training)",
        "test_images": int(te.sum()),
        "test": summary(y[te], pred[te]),
        "test_accuracy_by_plant": {h: float((pred[te & (hosts == h)] == y[te & (hosts == h)]).mean())
                                   for h in sorted(np.unique(hosts))},
        "threshold": threshold,
        "test_share_clear": float(clear.sum() / te.sum()),
        "test_accuracy_when_clear": float((pred[clear] == y[clear]).mean()),
        "pair_threshold": pair_threshold,
        "test_share_two_patterns": float(mixed.sum() / te.sum()),
        "test_true_pattern_in_pair": float(in_top2[mixed].mean()),
        "test_share_no_clear_pattern": float((te & ~clear & ~mixed).sum() / te.sum()),
        "rejected_trained_probe_leave_one_species_out": loso_probe_baseline(emb, y, is_train, hosts),
        "note": "PlantVillage lab photos only; real garden photos will likely score lower. Prompts were "
                "written once after the trained probe failed, not tuned on the test sample.",
    }
    with open(config.CALIBRATION_PATH, encoding="utf-8") as f:
        cal = json.load(f)
    cal["thresholds"]["symptom_clear_threshold"] = threshold
    cal["thresholds"]["symptom_pair_threshold"] = pair_threshold
    cal["symptom_screen_report"] = report
    with open(config.CALIBRATION_PATH, "w", encoding="utf-8") as f:
        json.dump(cal, f, indent=2)
    print(json.dumps(report, indent=2))
    print(f"Done in {time.time() - t0:.0f}s")


if __name__ == "__main__":
    torch.set_grad_enabled(False)
    main()
