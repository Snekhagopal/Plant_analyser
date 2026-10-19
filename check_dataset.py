from datasets import load_dataset

print("Loading PlantVillage image dataset...")

dataset = load_dataset(
    "geraldmc/plantvillage-full",
    split="train",
    streaming=True,
    token=False,
)

sample = next(iter(dataset))

print("\nDataset access successful!")
print("Columns:", list(sample.keys()))

for key, value in sample.items():
    if hasattr(value, "size") and key == "image":
        print("Image size:", value.size)
    else:
        print(f"{key}: {str(value)[:200]}")
