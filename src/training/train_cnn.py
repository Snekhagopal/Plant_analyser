
from pathlib import Path

import torch
from torch import nn
from torch.optim import Adam
from tqdm import tqdm

from src.data.dataset import create_loaders
from src.models.cnn import PlantCNN

ROOT = Path(__file__).resolve().parents[2]
MODEL_DIR = ROOT / "models"
MODEL_PATH = MODEL_DIR / "cnn_best.pth"

EPOCHS = 10
LEARNING_RATE = 0.001


def run_epoch(model, loader, criterion, device, optimizer=None):
    training = optimizer is not None
    model.train() if training else model.eval()

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
            correct += (outputs.argmax(dim=1) == labels).sum().item()
            total += labels.size(0)

    return total_loss / total, correct / total


def main():
    torch.manual_seed(42)

    device = torch.device(
        "mps" if torch.backends.mps.is_available()
        else "cpu"
    )

    print("Training device:", device)

    loaders, class_to_idx = create_loaders()

    model = PlantCNN(num_classes=len(class_to_idx)).to(device)

    criterion = nn.CrossEntropyLoss()
    optimizer = Adam(model.parameters(), lr=LEARNING_RATE)

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    best_val_accuracy = 0.0

    for epoch in range(EPOCHS):
        train_loss, train_accuracy = run_epoch(
            model, loaders["train"], criterion, device, optimizer
        )

        val_loss, val_accuracy = run_epoch(
            model, loaders["validation"], criterion, device
        )

        print(
            f"Epoch {epoch + 1}/{EPOCHS} | "
            f"Train loss: {train_loss:.4f} | "
            f"Train accuracy: {train_accuracy:.2%} | "
            f"Validation loss: {val_loss:.4f} | "
            f"Validation accuracy: {val_accuracy:.2%}"
        )

        if val_accuracy > best_val_accuracy:
            best_val_accuracy = val_accuracy

            torch.save(
                {
                    "model_state_dict": model.state_dict(),
                    "class_to_idx": class_to_idx,
                    "image_size": 128,
                    "normalization_mean": [0.5, 0.5, 0.5],
                    "normalization_std": [0.5, 0.5, 0.5],
                    "best_validation_accuracy": best_val_accuracy,
                },
                MODEL_PATH,
            )

            print("Saved best CNN checkpoint.")

    print(f"\nBest validation accuracy: {best_val_accuracy:.2%}")
    print("Checkpoint:", MODEL_PATH)


if __name__ == "__main__":
    main()
