
from pathlib import Path

import torch
from torch import nn
from torch.optim import Adam
from tqdm import tqdm

from src.data.mobilenet_dataset import create_mobilenet_loaders
from src.models.mobilenet import create_mobilenet


ROOT = Path(__file__).resolve().parents[2]
MODEL_DIR = ROOT / "models"
MODEL_PATH = MODEL_DIR / "mobilenet_best.pth"

EPOCHS = 5
LEARNING_RATE = 0.001


def run_epoch(model, loader, criterion, device, optimizer=None):
    training = optimizer is not None

    if training:
        model.train()
        # Keep the frozen pretrained feature extractor in evaluation mode.
        model.features.eval()
    else:
        model.eval()

    total_loss = 0.0
    correct = 0
    total = 0

    context = torch.enable_grad() if training else torch.no_grad()

    with context:
        for images, labels in tqdm(loader, leave=False):
            images = images.to(device)
            labels = labels.to(device)

            if training:
                optimizer.zero_grad()

            outputs = model(images)
            loss = criterion(outputs, labels)

            if training:
                loss.backward()
                optimizer.step()

            total_loss += loss.item() * labels.size(0)
            correct += (
                outputs.argmax(dim=1) == labels
            ).sum().item()
            total += labels.size(0)

    return total_loss / total, correct / total


def main():
    torch.manual_seed(42)

    device = torch.device(
        "mps" if torch.backends.mps.is_available() else "cpu"
    )
    print("Training device:", device)

    loaders, class_to_idx = create_mobilenet_loaders()

    model = create_mobilenet(
        num_classes=len(class_to_idx)
    ).to(device)

    criterion = nn.CrossEntropyLoss()

    # Train only the new classification layer.
    optimizer = Adam(
        model.classifier.parameters(),
        lr=LEARNING_RATE,
    )

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    best_val_accuracy = 0.0

    for epoch in range(EPOCHS):
        print(f"\nEpoch {epoch + 1}/{EPOCHS}")

        train_loss, train_accuracy = run_epoch(
            model, loaders["train"], criterion,
            device, optimizer,
        )

        val_loss, val_accuracy = run_epoch(
            model, loaders["validation"], criterion,
            device,
        )

        print(f"Train loss: {train_loss:.4f}")
        print(f"Train accuracy: {train_accuracy * 100:.2f}%")
        print(f"Validation loss: {val_loss:.4f}")
        print(f"Validation accuracy: {val_accuracy * 100:.2f}%")

        if val_accuracy > best_val_accuracy:
            best_val_accuracy = val_accuracy

            torch.save(
                {
                    "model_state_dict": model.state_dict(),
                    "class_to_idx": class_to_idx,
                    "image_size": 128,
                    "best_validation_accuracy": best_val_accuracy,
                    "normalization_mean": list(
                        loaders["train"].dataset.transform.transforms[-1].mean
                    ),
                    "normalization_std": list(
                        loaders["train"].dataset.transform.transforms[-1].std
                    ),
                },
                MODEL_PATH,
            )

            print("Saved best MobileNetV2 checkpoint.")

    print("\nMobileNetV2 training complete!")
    print(
        f"Best validation accuracy: "
        f"{best_val_accuracy * 100:.2f}%"
    )
    print(f"Checkpoint: {MODEL_PATH}")


if __name__ == "__main__":
    main()
