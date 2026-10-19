
from pathlib import Path

import pandas as pd
import torch
from PIL import Image
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms

ROOT = Path(__file__).resolve().parents[2]
SPLITS_FILE = ROOT / "data" / "splits.csv"

IMAGE_SIZE = 128
BATCH_SIZE = 32

# Preprocessing for our Custom CNN
image_transform = transforms.Compose([
    transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=(0.5, 0.5, 0.5),
        std=(0.5, 0.5, 0.5),
    ),
])


class PlantDataset(Dataset):
    def __init__(self, dataframe, class_to_idx, transform=None):
        self.dataframe = dataframe.reset_index(drop=True)
        self.class_to_idx = class_to_idx
        self.transform = transform

    def __len__(self):
        return len(self.dataframe)

    def __getitem__(self, index):
        row = self.dataframe.iloc[index]

        image_path = ROOT / row["image_path"]
        image = Image.open(image_path).convert("RGB")

        if self.transform:
            image = self.transform(image)

        label = self.class_to_idx[row["class_label"]]

        return image, torch.tensor(label, dtype=torch.long)


def create_loaders():
    df = pd.read_csv(SPLITS_FILE)

    classes = sorted(df["class_label"].unique())
    class_to_idx = {
        name: index for index, name in enumerate(classes)
    }

    loaders = {}

    for split in ["train", "validation", "test"]:
        split_df = df[df["final_split"] == split]

        dataset = PlantDataset(
            split_df,
            class_to_idx,
            transform=image_transform,
        )

        loaders[split] = DataLoader(
            dataset,
            batch_size=BATCH_SIZE,
            shuffle=(split == "train"),
            num_workers=0,
        )

        print(f"{split}: {len(dataset)} images")

    return loaders, class_to_idx


if __name__ == "__main__":
    loaders, class_to_idx = create_loaders()
    images, labels = next(iter(loaders["train"]))

    print("\nNumber of classes:", len(class_to_idx))
    print("Image batch shape:", images.shape)
    print("Label batch shape:", labels.shape)
    print("Custom CNN data loader test passed!")
