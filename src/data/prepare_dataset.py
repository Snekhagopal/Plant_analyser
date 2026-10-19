from datasets import load_dataset
from pathlib import Path
from collections import Counter
import csv
import re

ROOT = Path(__file__).resolve().parents[2]
IMAGE_DIR = ROOT / "data" / "raw"
METADATA = ROOT / "data" / "plant_metadata.csv"

def safe_name(value):
    return re.sub(r"[^a-zA-Z0-9_.-]", "_", str(value))

def prepare_dataset():
    print("Loading ALL plant species...")

    dataset = load_dataset(
        "geraldmc/plantvillage-full",
        split="train",
        streaming=True,
        token=False,
    )

    counts = Counter()
    saved = 0
    skipped = 0

    with open(METADATA, "w", newline="", encoding="utf-8") as f:
        fields = [
            "image_path", "class_label", "host", "disease",
            "split", "leaf_id", "leaf_grouped"
        ]
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()

        for index, sample in enumerate(dataset):
            host = str(sample.get("host", "Unknown"))
            label = str(sample.get("class_label", "Unknown"))
            split = str(sample.get("split", "")).lower()
            image = sample.get("image")

            if split not in {"train", "test"} or image is None:
                skipped += 1
                continue

            path = (
                IMAGE_DIR / split / safe_name(label)
                / f"image_{index:07d}.jpg"
            )
            path.parent.mkdir(parents=True, exist_ok=True)

            try:
                image.convert("RGB").save(path, "JPEG", quality=95)

                writer.writerow({
                    "image_path": str(path.relative_to(ROOT)),
                    "class_label": label,
                    "host": host,
                    "disease": str(sample.get("disease", "")),
                    "split": split,
                    "leaf_id": str(sample.get("leaf_id", "")),
                    "leaf_grouped": str(sample.get("leaf_grouped", "")),
                })

                counts[(split, host, label)] += 1
                saved += 1

                if saved % 500 == 0:
                    print(f"Saved {saved} images across all plants...")

            except Exception as exc:
                skipped += 1
                print(f"Skipped record {index}: {exc}")

    print(f"\nFinished. Images saved: {saved}; skipped: {skipped}")
    print("\nImages per plant and class:")

    for (split, host, label), count in sorted(counts.items()):
        print(f"{split:5} | {host:20} | {label:45} | {count}")

    print(f"\nMetadata: {METADATA}")
    print(f"Image directory: {IMAGE_DIR}")

if __name__ == "__main__":
    prepare_dataset()
