
import pandas as pd
from torch.utils.data import DataLoader
from torchvision import transforms
from torchvision.models import MobileNet_V2_Weights

from src.data.dataset import PlantDataset, SPLITS_FILE

IMAGE_SIZE = 128
BATCH_SIZE = 32

weights = MobileNet_V2_Weights.DEFAULT

mobilenet_transform = transforms.Compose([
    transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=weights.transforms().mean,
        std=weights.transforms().std,
    ),
])


def create_mobilenet_loaders():
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
            transform=mobilenet_transform,
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
    print("Testing MobileNetV2 data loader...")

    loaders, class_to_idx = create_mobilenet_loaders()
    images, labels = next(iter(loaders["train"]))

    print("Number of classes:", len(class_to_idx))
    print("Image batch shape:", images.shape)
    print("Label batch shape:", labels.shape)
    print("MobileNetV2 data loader test passed!")
