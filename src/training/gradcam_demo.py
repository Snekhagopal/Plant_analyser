
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from torchvision import transforms
from torchvision.models import MobileNet_V2_Weights
from pytorch_grad_cam import GradCAM
from pytorch_grad_cam.utils.model_targets import ClassifierOutputTarget
from pytorch_grad_cam.utils.image import show_cam_on_image

from src.models.mobilenet import create_mobilenet


ROOT = Path(__file__).resolve().parents[2]
MODEL_PATH = ROOT / "models" / "mobilenet_best.pth"
OUTPUT_PATH = ROOT / "models" / "gradcam_result.jpg"

# Change this to the path of a real plant leaf image.
IMAGE_PATH = ROOT / "data" / "image.png"

IMAGE_SIZE = 128


def main():
    device = torch.device(
        "mps" if torch.backends.mps.is_available() else "cpu"
    )

    checkpoint = torch.load(
        MODEL_PATH,
        map_location=device,
        weights_only=True,
    )

    class_to_idx = checkpoint["class_to_idx"]
    idx_to_class = {
        index: name for name, index in class_to_idx.items()
    }

    model = create_mobilenet(
        num_classes=len(class_to_idx)
    ).to(device)

    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()

    if not IMAGE_PATH.exists():
        raise FileNotFoundError(
            f"Add a leaf image at: {IMAGE_PATH}"
        )

    original = Image.open(IMAGE_PATH).convert("RGB")
    resized = original.resize((IMAGE_SIZE, IMAGE_SIZE))

    rgb_image = np.asarray(resized).astype(np.float32) / 255.0

    weights = MobileNet_V2_Weights.DEFAULT
    input_transform = transforms.Compose([
        transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=weights.transforms().mean,
            std=weights.transforms().std,
        ),
    ])

    input_tensor = input_transform(original).unsqueeze(0).to(device)
    input_tensor.requires_grad_(True)

    # Use the final convolutional feature map for Grad-CAM.
    target_layers = [model.features[-1]]

    with GradCAM(
        model=model,
        target_layers=target_layers,
    ) as cam:
        # Predict the class without disabling gradients globally.
        with torch.enable_grad():
            output = model(input_tensor)
            probabilities = torch.softmax(output, dim=1)[0]
            predicted_idx = int(probabilities.argmax().item())

        grayscale_cam = cam(
            input_tensor=input_tensor,
            targets=[ClassifierOutputTarget(predicted_idx)],
        )[0]

    visualization = show_cam_on_image(
        rgb_image,
        grayscale_cam,
        use_rgb=True,
    )

    Image.fromarray(visualization).save(OUTPUT_PATH)

    print("Predicted class:", idx_to_class[predicted_idx])
    print(f"Confidence: {probabilities[predicted_idx].item() * 100:.2f}%")
    print("Grad-CAM image saved:", OUTPUT_PATH)


if __name__ == "__main__":
    main()
