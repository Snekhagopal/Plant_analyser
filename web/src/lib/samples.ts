/**
 * Real sample leaves from the PlantVillage *test* split (never used to train the
 * model), copied from data/raw/test by a fixed random draw - not hand-picked.
 * Source: Hugging Face mirror geraldmc/plantvillage-full (declared CC0-1.0);
 * PlantVillage by Hughes & Salathé.
 *
 * `datasetLabel` is the dataset's own label. Choosing a sample only fills in the
 * photo and plant name; the result always comes from the real analysis.
 */
export type SampleLeaf = {
  slug: string;
  src: string;
  plant: string;        // a name offered by the plant selector
  condition: string;    // dataset label, shown as-is
  datasetLabel: string;
};

const s = (slug: string, plant: string, condition: string, datasetLabel: string): SampleLeaf => ({
  slug, src: `/samples/${slug}.jpg`, plant, condition, datasetLabel,
});

export const SAMPLE_LEAVES: SampleLeaf[] = [
  s("tomato-early-blight", "Tomato", "Early blight", "Tomato___Early_blight"),
  s("potato-late-blight", "Potato", "Late blight", "Potato___Late_blight"),
  s("corn-common-rust", "Corn (maize)", "Common rust", "Corn_(maize)___Common_rust_"),
  s("grape-black-rot", "Grape", "Black rot", "Grape___Black_rot"),
  s("tomato-healthy", "Tomato", "Healthy", "Tomato___healthy"),
  s("apple-cedar-apple-rust", "Apple", "Cedar apple rust", "Apple___Cedar_apple_rust"),
  s("bell-pepper-bacterial-spot", "Bell pepper", "Bacterial spot", "Pepper,_bell___Bacterial_spot"),
  s("squash-powdery-mildew", "Squash", "Powdery mildew", "Squash___Powdery_mildew"),
];

export async function sampleAsFile(sample: SampleLeaf): Promise<File> {
  const res = await fetch(sample.src);
  if (!res.ok) throw new Error("Sample image could not be loaded.");
  return new File([await res.blob()], `${sample.slug}.jpg`, { type: "image/jpeg" });
}
