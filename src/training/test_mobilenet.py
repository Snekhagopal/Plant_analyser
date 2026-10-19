
from pathlib import Path

import torch
from torch import nn

from src.data.mobilenet_dataset import create_mobilenet_loaders
from src.models.mobilenet import create_mobilenet


ROOT = Path(__file__).resolve().parents[2]
MODEL_PATH = ROOT / "models" / "mobilenet_best.pth"


def main():
    device = torch.device(
        "mps" if torch.backends.mps.is_available() else "cpu"
    )
    print("Testing device:", device)

    loaders, class_to_idx = create_mobilenet_loaders()
    test_loader = loaders["test"]

    checkpoint = torch.load(
        MODEL_PATH,
        map_location=device,
        weights_only=True,
    )

    model = create_mobilenet(
        num_classes=len(class_to_idx)
    ).to(device)

    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()

    criterion = nn.CrossEntropyLoss()
    total_loss = 0.0
    correct = 0
    total = 0

    with torch.no_grad():
        for images, labels in test_loader:
            images = images.to(device)
            labels = labels.to(device)

            outputs = model(images)
            loss = criterion(outputs, labels)

            total_loss += loss.item() * labels.size(0)
            correct += (
                outputs.argmax(dim=1) == labels
            ).sum().item()
            total += labels.size(0)

    print("\n--- MobileNetV2 Test Results ---")
    print(f"Test loss: {total_loss / total:.4f}")
    print(f"Test accuracy: {100 * correct / total:.2f}%")
    print(f"Test images evaluated: {total}")


if __name__ == "__main__":
    main()
