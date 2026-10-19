# 🌱 AI Plant Health Assistant

A local, offline Streamlit app that analyses a photo of a plant leaf together with the **plant name you
provide**. It reports a possible condition, explains how reliable that prediction is, shows a Grad-CAM heatmap,
and gives conservative next steps. It covers diseases, visible pests, watering and nutrients, without claiming
more than the evidence supports.

> **Not a diagnostic tool.** Predictions come from a model trained on lab-style PlantVillage photos. They are
> hints to investigate, not confirmed diagnoses. Confirm important findings with a local agricultural extension
> service, plant clinic or plant pathologist.

---

## Contents
1. [Features](#features)
2. [Quick start](#quick-start)
3. [Example workflow](#example-workflow)
4. [Architecture](#architecture)
5. [How a result is decided](#how-a-result-is-decided)
6. [Supported plants and classes](#supported-plants-and-classes)
7. [Model, dataset and results](#model-dataset-and-results)
8. [Grad-CAM](#grad-cam)
9. [Limitations](#limitations)
10. [Testing](#testing)
11. [Future improvements](#future-improvements)

---

## Features

| Area | What it does |
|---|---|
| **Plant name (required)** | Searchable selector of **144 popular plants** (houseplants, herbs, vegetables, fruits, flowers, trees, field crops, including common Indian names such as *tulsi, brinjal, bhindi, money plant*) plus "Other / Not listed" and free text. Entries marked *disease check* are the 14 crops the disease model knows. The app never infers the plant name from the photo. |
| **Image checks** | File type (JPG/JPEG/PNG), size (≤ 10 MB), corrupt/truncated files, minimum resolution, brightness, blur and the share of leaf-coloured area. |
| **Disease model** | The existing MobileNetV2 checkpoint (`models/mobilenet_best.pth`) with its exact training-time class mapping, 128 px resize and ImageNet normalisation. |
| **Uncertainty handling** | Temperature-calibrated scores, a confidence threshold, a plant/prediction consistency check, and a Mahalanobis out-of-distribution (OOD) detector. |
| **Grad-CAM** | Heatmap overlay shown beside the original image, computed only when a usable prediction exists. |
| **Recommendations** | Structured, conservative advice: immediate actions, what to inspect, disease, watering, pest and nutrient guidance, prevention, when to consult an expert, and limitations. |
| **Questionnaire** | Optional symptoms, soil moisture, watering frequency, drainage, light, weather, fertiliser, visible insects and which leaves are affected. |
| **Symptom check (every plant)** | For the 130 plants without a disease model (e.g. hibiscus, rose, money plant) and "Other", zero-shot CLIP reports the **visible symptom pattern**: no obvious symptoms, leaf spots / blight, powdery mildew, rust, or mosaic / yellowing (or two of them when it cannot separate them). It gives pattern-specific inspection and care steps. It never names a specific disease. See [results](#symptom-check-on-plants-it-has-never-seen). |
| **Pest screen** | Zero-shot **CLIP ViT-L/14**, run locally, flags *possible* insects or eggs on the leaf (whiteflies, aphids, mealybugs, scale, mites, caterpillars) for every plant. A flagged photo is never given a confident disease result. It does not identify species. |
| **Care guides** | Group-level care guidance (watering, light, common pests and problems) for all 144 plants, plus short plant-specific notes. |
| **History** | Local SQLite (`data/history.db`) with review, JSON download, per-entry delete and delete-all. Images and free text are never stored. |

## Quick start

```bash
# 1. Activate the existing environment (Python 3.11)
source ~/plant-health-env/bin/activate        # adjust the path if your venv lives elsewhere

# 2. Install dependencies (already present in plant-health-env)
pip install -r requirements.txt

# 3. (Optional, one-off) regenerate calibration + OOD statistics - ~45 min on CPU.
#    CPU is the default because long MPS runs hung inside Metal on the dev Mac;
#    `--device mps` is faster when it works.
python -m src.evaluation.calibrate

# 3b. (One-off) download the CLIP pest-screen model (~1.7 GB, free, no token).
#     Without it the app falls back to a much weaker ImageNet insect screen.
python -m src.inference.download_models
python -m src.evaluation.calibrate_pest   # optional: re-derive its threshold (~15 min)
python -m src.evaluation.evaluate_pest    # optional: hit rate on IP102 pest photos (~80 min, needs IP102)
python -m src.evaluation.evaluate_symptoms  # optional: re-measure the symptom check (~25 min first run)

# 4. Run the app
streamlit run app.py

# 4b. Or run the HTTP API (used by the upcoming web frontend); docs at http://localhost:8000/docs
uvicorn api.main:app --port 8000

# 5. Run the tests
python -m pytest
```

The app needs no API keys, tokens or internet access. `models/calibration.json` and `models/ood_stats.npz` are
already generated. If they are missing, the app falls back to default thresholds and disables the OOD check.
The generic insect screen uses torchvision's ImageNet MobileNetV2 weights from the local torch cache
(`~/.cache/torch/hub/checkpoints/mobilenet_v2-*.pth`). If that file is absent, the screen is skipped; it is never
downloaded at runtime.

## Example workflow

1. Open **🔍 Analyze** and upload a close-up photo of one affected leaf.
2. Type or pick the plant name, e.g. *Tomato*. For a plant that isn't listed, pick *Other / Not listed* and type
   its name.
3. Optionally open **symptoms and care conditions**, e.g. *Spots or lesions*, soil *Evenly moist*.
4. Click **Analyze plant**. The results show:
   - a **status banner** (e.g. *Likely match*, *Uncertain*, *Image may not match the selected plant*,
     *Plant not supported*),
   - your photo next to the **Grad-CAM heatmap**,
   - the possible condition and its calibrated **model score**,
   - **What to do next**: actions, inspection steps, watering/pest/nutrient guidance, prevention, when to call
     an expert, and limitations.
5. Review or delete past results in **🕘 History**. **ℹ️ About the model** lists the measured metrics and
   supported classes.

## Architecture

```
app.py                         Streamlit entry point (layout, session state, caching)
api/                           FastAPI backend over src/service.py (one analysis at a time)
  main.py                      endpoints: analyze, meta, history, plants, about, health
  schemas.py, serialize.py     Pydantic schemas; images as JPEG data URLs
src/
  config.py                    paths, upload limits, default thresholds
  service.py                   run_full_analysis(): analysis -> recommendations -> Grad-CAM -> history
  report.py                    four assessments (health, symptoms, pests, disease) for the UIs
  plants/
    catalog.py                 species/classes derived from checkpoint labels; name & alias matching
    conditions.py              reference info for all 38 classes (symptoms, inspection, prevention, escalation)
    care_profiles.py           144 popular plants -> care groups (watering, light, pests, problems, notes)
  utils/preprocessing.py       upload validation, quality metrics, training-identical transform
  inference/
    model.py                   checkpoint loading + compatibility checks, feature extraction
    predictor.py               PlantDiseasePredictor: calibrated scores, OOD score, pest screen
    ood.py                     Mahalanobis OOD scorer
    pest_screen.py             CLIP ViT-L/14 zero-shot pest screen (ImageNet-head fallback)
    symptom_screen.py          plant-agnostic symptom probe on the same CLIP embedding
    download_models.py         one-off CLIP download (the app never downloads)
    analysis.py                decision logic -> AnalysisResult + Status
  explainability/gradcam.py    Grad-CAM (pytorch-grad-cam) with failure containment
  recommendations/
    context.py                 questionnaire schema (CareContext)
    assessments.py             watering / nutrient / pest assessments from answers
    engine.py                  builds the structured Recommendation
    symptoms.py                conservative advice per symptom pattern
  database/history.py          SQLite HistoryStore
  ui/components.py, styles.py  rendering helpers and botanical theme
  evaluation/calibrate.py      fits temperature, thresholds and OOD statistics (train/val only)
  evaluation/calibrate_pest.py sets the CLIP pest threshold from pest-free validation images
  evaluation/evaluate_pest.py  measures the pest screen's hit rate on IP102 field photos
  evaluation/evaluate_symptoms.py sets the symptom-check thresholds and measures its accuracy
  data/, models/, training/    original dataset, model and training code (unchanged apart from
                               create_mobilenet(pretrained=False) for offline loading)
tests/                         pytest suite (mocks + real-model smoke tests + Streamlit AppTest)
```

## How a result is decided

```
upload ─► validate file ─► quality checks ─► leaf-colour check ─► plant supported? ─► model ─► consistency/OOD ─► status
```

| Status | When | Disease shown? | Grad-CAM |
|---|---|---|---|
| **Likely match** | Supported plant, top-1 class belongs to that plant, calibrated score ≥ threshold, not OOD, good quality | Yes, as a *prediction* | Yes |
| **Uncertain** | As above but below threshold, top-1 is another species while most of the score still falls on the selected plant's classes, or the species has only one class | Yes, marked uncertain | Yes |
| **Low quality** | Dark, washed-out or blurry photo | Tentative | Yes |
| **Uncertain (pests)** | The pest screen flags insects or eggs in the photo. The disease model never saw pest-infested leaves, so its suggestion is shown only as unreliable (except the spider-mite class) | Marked unreliable | Yes |
| **Uncertain (attention)** | Less than 30 % of the Grad-CAM weight falls on the leaf | Marked uncertain | Yes |
| **Image may not match plant** | < 50 % of the model's score falls on the selected plant's classes | No | No |
| **Unfamiliar image** | Mahalanobis distance above the validation-derived threshold | No (the guesses are listed under *Model details* as unreliable) | No |
| **May not be a plant** | Very little leaf-coloured area | No | No |
| **General symptom check** | Plant name not among the 14 species (CLIP available) | No; the *symptom pattern* is shown instead | No |
| **Plant not supported** | Plant name not among the 14 species and CLIP not downloaded | No; general guidance only | No |
| **Invalid input** | Missing plant name, missing/corrupt/oversized/unsupported file | — | — |

Notes:
- **Plant matching** is exact on normalised names plus a small list of unambiguous aliases (e.g. *maize → Corn*,
  *capsicum → Bell pepper*). Fuzzy matching is deliberately avoided: "peppermint" must not become "bell pepper".
- **Restricted prediction.** For a supported plant, the displayed condition is the best class *of that
  plant*. A class from another species never appears as the diagnosis.
- **Species with incomplete coverage** get explicit warnings. *Blueberry, Raspberry, Soybean*: healthy class
  only. *Orange*: citrus greening only, no healthy class. *Squash*: powdery mildew only. For these single-class
  species the result is never shown as "Likely", because the model has no alternative to compare against.

## Plants with a disease check

All 144 plants in the selector get pest screening, a care guide and an analysis of the photo. The other 130
plants get the general [symptom check](#symptom-check-on-plants-it-has-never-seen). Only these 14 have a
plant-specific disease model:

| Plant | Classes |
|---|---|
| Apple | Apple scab, Black rot, Cedar apple rust, healthy |
| Blueberry | healthy *(no disease classes)* |
| Cherry (incl. sour) | Powdery mildew, healthy |
| Corn (maize) | Cercospora / Gray leaf spot, Common rust, Northern leaf blight, healthy |
| Grape | Black rot, Esca (black measles), Leaf blight (Isariopsis leaf spot), healthy |
| Orange | Huanglongbing / citrus greening *(no healthy class)* |
| Peach | Bacterial spot, healthy |
| Bell pepper | Bacterial spot, healthy |
| Potato | Early blight, Late blight, healthy |
| Raspberry | healthy *(no disease classes)* |
| Soybean | healthy *(no disease classes)* |
| Squash | Powdery mildew *(no healthy class)* |
| Strawberry | Leaf scorch, healthy |
| Tomato | Bacterial spot, Early blight, Late blight, Leaf mold, Septoria leaf spot, Spider mites, Target spot, Yellow leaf curl virus, Mosaic virus, healthy |

## Model, dataset and results

- **Dataset:** PlantVillage-derived (`geraldmc/plantvillage-full`), 38 classes / 14 species. The original train
  split was divided 85/15 (stratified, seed 42) into **36,852 train / 6,504 validation** images. The original
  **10,948-image test split** was held out.
- **Custom CNN** (`models/cnn_best.pth`, 3 conv blocks, 128 px): **85.73 %** test accuracy. Kept for reference; not
  used by the app.
- **MobileNetV2** (`models/mobilenet_best.pth`, ImageNet-pretrained, frozen features, new 38-class head, 128 px,
  5 epochs): **94.38 %** test accuracy (best validation accuracy 95.17 %). Per-class results are in
  `models/mobilenet_classification_report.csv` and `models/mobilenet_confusion_matrix.png`. The weakest classes
  are Tomato early blight (recall 0.56), Potato healthy (recall 0.63) and Tomato leaf mold (recall 0.79).

### Calibration and uncertainty (`python -m src.evaluation.calibrate`)

| Metric | Validation (6,504) | Test (10,948, report only) |
|---|---|---|
| Top-1 accuracy | 95.17 % | **94.38 %** (matches the original evaluation, confirming the app's preprocessing) |
| Expected calibration error, raw softmax | 0.0115 | 0.0063 |
| Expected calibration error, temperature-scaled (T = 0.904) | 0.0035 | 0.0042 |
| "Likely" threshold (calibrated score ≥ **0.61**): coverage | 96.0 % | 95.5 % |
| Accuracy on predictions above that threshold | 97.0 % (target) | 96.5 % |
| Images flagged unfamiliar (Mahalanobis > **67.8**) | 2.5 % (by design) | 2.7 % |
| Images flagged by the insect screen (false alarms, threshold 0.37) | 0.5 % | 0.5 % |
| Images flagged low leaf-colour / blurry | 0.06 % / 0.25 % | — |

**Sanity check on two non-PlantVillage photos** (not used for tuning):

| Photo | Raw model output | OOD score (threshold 67.8) | App result |
|---|---|---|---|
| `data/image.png` (peace lily, an unsupported species) | 86 % Corn gray leaf spot | 58.7 (94th validation percentile), **not flagged** | Entered as "Peace lily" → *Plant not supported*; as "Tomato" → *Image may not match plant*; as "Corn" → ⚠️ *Likely gray leaf spot* |
| `data/sample_leaf.jpg` (leaf with dark spots) | 96 % Peach bacterial spot | 62.2 (96th percentile), not flagged | as "Tomato" → *mismatch*; as "Peach" → *Likely bacterial spot* |

So the OOD detector alone did **not** catch these real-world photos. The mandatory, accurate plant name is the
main safeguard. A user who enters the wrong supported plant can still get a confident but wrong answer.
Lowering the OOD threshold to catch these two photos would flag about 6 % of normal images; it was not tuned on
them.

**How the data was used.** Temperature, confidence threshold, OOD threshold and the quality/pest false-alarm
thresholds were fitted on the **validation** split. The Mahalanobis class statistics come from the **training**
split. The **test** split was evaluated once, after all values were fixed, for the report above. No test-set
number was fed back into any threshold. Re-running the script after changing its rules would be a form of test
leakage; if you do so, record it.

> All of these numbers are **PlantVillage test-set metrics**: single leaves, plain backgrounds, controlled
> lighting. They are **not** estimates of accuracy on real garden or field photos, which is unmeasured and
> very likely lower.

### Symptom check on plants it has never seen

The 130 plants without a disease model (and "Other") get a **general symptom check**. Zero-shot CLIP ViT-L/14
compares the photo with 3–4 text descriptions per pattern. It uses the same image embedding as the pest
screen, so it costs no extra model pass. Measured with `src/evaluation/evaluate_symptoms.py` on 925 PlantVillage
test photos, none of which were used to build it:

| Result shown | Share of photos | How often right |
|---|---|---|
| One clear pattern (top score ≥ 0.58) | 65 % | 83 % |
| Two patterns ("signs of both", top two ≥ 0.74) | 22 % | the true pattern is one of the two 91 % of the time |
| "No clear pattern" | 13 % | — |

Recall per pattern: no obvious symptoms 68 %, leaf spots / blight 76 %, powdery mildew 74 %, rust 46 %,
mosaic / yellowing 68 %. Both thresholds were picked on *train*-split photos.

**What was tried and rejected.** A logistic-regression probe trained on CLIP embeddings reached 92 % on crops it
had seen. Tested *leave-one-species-out* (trained on 13 crops, tested on the 14th, which is the situation for
a hibiscus), it recognised **0 % of mildew and rust and 1 % of mosaic**. Each of those patterns comes from only
2–3 crops in PlantVillage, so the probe learned "squash → mildew" instead of what mildew looks like. Removing
the species directions from the embedding and calibrating the zero-shot scores did not beat plain zero-shot.

> Caveats: all numbers are on lab photos of single leaves; real garden photos will be harder. Even PlantVillage
> crops are "unseen" to zero-shot CLIP, but they are not hibiscus or roses. The prompts were written once, after
> the trained probe failed, and were not tuned on the test photos. The check describes what a leaf looks
> like; one pattern has many possible causes, so the app gives inspection steps, not treatments.

### Pest screen on real pest photos (IP102)

[IP102](https://github.com/xpwu95/IP102) (Wu et al., CVPR 2019) has ~75k field and web photos of 102 insect
pests of 8 crops. `src/evaluation/evaluate_pest.py` scores a fixed sample of 20 images per class, using the IP102
*val* split to study the threshold and the *test* split for the number below. The threshold was **not** changed
(it is still set only from pest-free PlantVillage leaves).

| Threshold 0.677 | Value |
|---|---|
| IP102 test photos flagged (2,040 images, every one shows a pest) | **83.1 %** |
| By crop | Alfalfa 89 %, Beet 89 %, Mango 90 %, Wheat 89 %, Vitis 84 %, Corn 83 %, Citrus 81 %, **Rice 68 %** |
| Pest-free PlantVillage leaves flagged (1,000 validation images) | 1.0 % |

Trade-off on IP102 *val*: allowing 0.5 / 1 / 2 / 5 / 10 % false alarms gives 81 / 82 / 85 / 86 / 89 % hits.
The gain from relaxing the threshold is small, and every false alarm downgrades a disease result to
*Uncertain*, so 0.677 was kept.

**Most often missed:** mites and scale insects that look like leaf texture (grape erineum mite *Colomerus
vitis* 25 %, citrus rust mite 45 %, armoured scales 35–50 %), and soil or stem pests photographed off the leaf
(paddy stem maggot 35 %, mole cricket 50 %, wireworm 55 %). **Always caught:** aphids, large beetles and
caterpillars (100 %).

> IP102 photos usually show the insect prominently, often away from a leaf. The 83 % figure is therefore
> likely **optimistic** for small insects on a home-garden leaf. False alarms were measured only on lab photos;
> the false-alarm rate on cluttered real-world photos is unmeasured.

## Grad-CAM

Grad-CAM weights the last convolutional block of MobileNetV2 (`model.features[-1]`, 1280 channels, 4×4 at 128 px)
by the gradient of the selected class score. The resulting heatmap is upsampled onto your original photo.
**Warm regions influenced the score most; they do not prove the prediction is correct.** A model can attend to
the right lesion and still name the wrong disease, or focus on background artefacts.

Implementation notes: the feature weights are frozen (`requires_grad=False`), so the input tensor is set to
require gradients. Without that, the target layer receives no gradients. The original demo script did this; the
app version is tested for it. Grad-CAM runs only for *Likely / Uncertain / Low quality* results. Any failure
appears as a message, and the rest of the page still renders.

**Attention check.** The app measures what share of the heatmap falls on leaf-coloured pixels. On 400 validation
images, predictions with under 30 % of the weight on the leaf (3.3 % of images) were only 69 % accurate, against
95 % for the rest, so such results are downgraded from *Likely* to *Uncertain*. This check does not catch every
bad prediction: on the whitefly photo, 77 % of the weight was on the leaf.

## Limitations

**Unknown plants and diseases**
- The classifier can only output one of 38 labels. Given a plant or disease it has never seen, it still
  produces a label, often with a high score. For example, a peace-lily leaf (`data/image.png`) gets 82 % "Corn
  gray leaf spot" from the raw model.
- Mitigations: the mandatory plant name (unsupported plants get no disease label), the plant/prediction
  consistency check, the confidence threshold and the Mahalanobis OOD detector. **Threshold-based rejection
  alone cannot reliably catch unfamiliar inputs:** softmax confidence is often high on OOD images.
- The OOD detector's threshold flags about 2.5 % of normal validation images by design. Its detection rate on
  real OOD photos is **unmeasured**, because no labelled OOD set exists. Expect two failure modes: real-world
  photos of supported plants flagged as unfamiliar (cluttered backgrounds), and some unfamiliar leaves passing
  as familiar.
- The leaf-colour check is a heuristic. Green non-plant objects pass it; red or purple foliage may fail it.

**Recommendations**
- Advice is conservative. **Treatment categories** (e.g. "a fungicide labelled for apple scab on apple",
  "insecticidal soap or horticultural oil" for soft-bodied insects) appear only for a *likely* disease match, or
  phrased as "after confirming the cause" for uncertain results, pests, and mildew/rust seen by the symptom check.
  They always come with a safety block (label, local regulations, registration, protective equipment,
  pollinators). The app never names brands, never gives doses or rates, and never suggests a product from
  yellowing or dryness alone; fertiliser is mentioned only as "if a soil test confirms a deficiency".
- **Whole-plant photos** are accepted, but the disease model was trained on leaf close-ups, so their disease
  result is shown as *uncertain* at most, with a request for a leaf close-up.
- **Watering:** a photo cannot show soil moisture. Watering conclusions come only from your questionnaire
  answers and are phrased as possibilities. With no answers, the app says there is not enough information.
- **Nutrients:** yellowing has many causes. The app explains patterns to check and recommends a soil test; it
  never asserts a specific deficiency.
- **Pests:** there is no labelled pest dataset in this project, so pest screening uses **zero-shot CLIP
  ViT-L/14**. Its threshold (0.677) is the 99th percentile of 1,000 pest-free validation leaves, so about 1 % of
  normal lab photos are flagged; squash powdery mildew is flagged most (10 %). On 2,040 **IP102** pest photos
  it flags **83 %** ([details](#pest-screen-on-real-pest-photos-ip102)); it misses tiny mites and scale insects
  most often, and that figure is likely optimistic for small insects on garden leaves. It recognises
  *visible insects and eggs*, not damage: only 0.5 % of PlantVillage spider-mite *damage* images were flagged.
  It cannot name the species; the app asks for a close-up and recommends confirmation.
- **What was tried and rejected for pests:** (1) the ImageNet insect classes scored the whitefly photo at only 0.10,
  missing it; (2) a hand-crafted "pale speck" detector could not separate the whitefly photo from ordinary leaf
  texture, scoring it below the median pest-free leaf; (3) CLIP ViT-B/32 rated healthy soybean leaves as more
  "insect-like" than the whitefly photo. Only ViT-L/14 separated them.
- **Plants without a disease model** (130 plants and "Other") get the general symptom check plus a care guide.
  The check reports a visible pattern, not a disease, and is weakest on rust (46 % recall). The care guides are
  general guidance for the plant type.
- Disease reference content is a summary for orientation. Local conditions, regulations and registered
  treatments vary; consult local experts.

**Other**
- Model scores are temperature-calibrated on validation data. Even so, they are not the probability that a
  diagnosis is correct for your plant.
- History stores only time, plant name, status, condition, score and the recommendation text, in a local
  unencrypted SQLite file.

## Testing

```bash
python -m pytest            # whole suite (~1 min)
```

Covered: supported/unsupported/missing plant names; invalid, corrupt, truncated and oversized images; real
checkpoint loading and the class mapping; index→label mapping; valid-image inference; plant-class compatibility;
confidence-threshold boundaries; OOD, species-mismatch, low-quality and non-plant paths; recommendations for every
class; evidence-gated treatment categories with no brands or doses; whole-plant photos never *likely*; API endpoints; watering advice not overstating the photo; SQLite insert/retrieve/delete/
error handling; Grad-CAM success, failure containment and hook clean-up; end-to-end robustness on odd images
with the real model; and Streamlit `AppTest` rendering and validation messages. Most tests use a mocked
predictor; tests that need `models/mobilenet_best.pth` are skipped automatically if it is missing.

## Future improvements

- Collect a small, labelled set of **real-world photos** (including unsupported plants) to measure field
  accuracy and the OOD detection rate honestly.
- Fine-tune deeper MobileNetV2 layers with strong augmentation (backgrounds, lighting) to narrow the lab-to-field
  gap.
- Add a dedicated **plant / non-plant** model, and fine-tune a pest detector on IP102 (the zero-shot CLIP screen
  already flags 83 % of IP102 test photos but misses most mites and scale insects).
- Add healthy classes for Orange and Squash and disease classes for Blueberry, Raspberry and Soybean.
- Conformal prediction sets in place of a single threshold, giving coverage guarantees.
- Region-specific advice content reviewed by extension specialists.
