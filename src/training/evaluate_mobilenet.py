
from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd
import torch
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    ConfusionMatrixDisplay,
)

from src.data.mobilenet_dataset import create_mobilenet_loaders
from src.models.mobilenet import create_mobilenet


ROOT = Path(__file__).resolve().parents[2]
MODEL_PATH = ROOT / "models" / "mobilenet_best.pth"
REPORT_PATH = ROOT / "models" / "mobilenet_classification_report.csv"
MATRIX_PATH = ROOT / "models" / "mobilenet_confusion_matrix.png"


def main():
    device = torch.device(
        "mps" if torch.backends.mps.is_available() else "cpu"
    )
    print("Evaluation device:", device)

    loaders, class_to_idx = create_mobilenet_loaders()
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

    y_true = []
    y_pred = []

    with torch.no_grad():
        for images, labels in loaders["test"]:
            images = images.to(device)
            outputs = model(images)
            predictions = outputs.argmax(dim=1).cpu().tolist()

            y_true.extend(labels.tolist())
            y_pred.extend(predictions)

    idx_to_class = {
        index: name for name, index in class_to_idx.items()
    }
    labels = list(range(len(idx_to_class)))
    target_names = [idx_to_class[i] for i in labels]

    report = classification_report(
        y_true,
        y_pred,
        labels=labels,
        target_names=target_names,
        output_dict=True,
        zero_division=0,
    )

    report_df = pd.DataFrame(report).transpose()
    report_df.to_csv(REPORT_PATH)

    print("\n--- Classification Report ---")
    print(
        classification_report(
            y_true,
            y_pred,
            labels=labels,
            target_names=target_names,
            zero_division=0,
        )
    )

    matrix = confusion_matrix(y_true, y_pred, labels=labels)
    display = ConfusionMatrixDisplay(
        confusion_matrix=matrix,
        display_labels=target_names,
    )

    fig, ax = plt.subplots(figsize=(22, 22))
    display.plot(
        ax=ax,
        xticks_rotation=90,
        include_values=False,
        colorbar=False,
    )
    plt.title("MobileNetV2 - Plant Disease Confusion Matrix")
    plt.tight_layout()
    plt.savefig(MATRIX_PATH, dpi=200)
    plt.close(fig)

    print(f"\nClassification report saved: {REPORT_PATH}")
    print(f"Confusion matrix saved: {MATRIX_PATH}")


if __name__ == "__main__":
    main()
