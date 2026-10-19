
from pathlib import Path

import pandas as pd
from sklearn.model_selection import train_test_split

ROOT = Path(__file__).resolve().parents[2]
METADATA_PATH = ROOT / "data" / "plant_metadata.csv"
OUTPUT_PATH = ROOT / "data" / "splits.csv"

def main():
    df = pd.read_csv(METADATA_PATH)

    # Keep the original test set separate.
    train_df = df[df["split"] == "train"].copy()
    test_df = df[df["split"] == "test"].copy()

    # Split original training data into train and validation.
    train_part, val_part = train_test_split(
        train_df,
        test_size=0.15,
        random_state=42,
        stratify=train_df["class_label"],
    )

    train_part = train_part.copy()
    val_part = val_part.copy()
    test_df = test_df.copy()

    train_part["final_split"] = "train"
    val_part["final_split"] = "validation"
    test_df["final_split"] = "test"

    result = pd.concat(
        [train_part, val_part, test_df],
        ignore_index=True,
    )

    result.to_csv(OUTPUT_PATH, index=False)

    print("Dataset splits created!")
    print("\nImage counts:")
    print(result["final_split"].value_counts())

    print("\nClasses:", result["class_label"].nunique())
    print("\nClass counts per split:")
    print(
        result.groupby(
            ["final_split", "class_label"]
        ).size().unstack(fill_value=0)
    )

    print("\nSaved to:", OUTPUT_PATH)

if __name__ == "__main__":
    main()
