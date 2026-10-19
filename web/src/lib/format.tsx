import { Fragment, type ReactNode } from "react";

/** Render the API's `**bold**` markers as <strong>; everything else stays plain text (never HTML). */
export function Bold({ text }: { text: string }): ReactNode {
  return text.split("**").map((part, i) =>
    i % 2 ? <strong key={i} className="font-semibold text-mint-100">{part}</strong> : <Fragment key={i}>{part}</Fragment>,
  );
}

export const pct = (v: number | null | undefined, digits = 0) =>
  v === null || v === undefined ? "—" : `${(v * 100).toFixed(digits)}%`;

export type Tone = "good" | "warn" | "bad" | "info" | "neutral";

export const TONE_CLASSES: Record<Tone, string> = {
  good: "bg-leaf-400/20 text-leaf-400 ring-leaf-400/40",
  warn: "bg-amber-400/15 text-amber-300 ring-amber-300/40",
  bad: "bg-rose-500/15 text-rose-300 ring-rose-300/40",
  info: "bg-sky-400/15 text-sky-300 ring-sky-300/40",
  neutral: "bg-white/5 text-mint-200/80 ring-white/15",
};

/**
 * Plain-language label and one-line explanation for every result type the backend returns
 * (keyed by the API's stable `status` code; invalid_input is shown as a form error).
 */
export const STATUS_META: Record<string, { label: string; tone: Tone; help: string }> = {
  likely_match: { label: "Likely match", tone: "good",
    help: "This is the app's best match for your photo. It is a good lead, not a confirmed diagnosis." },
  uncertain: { label: "Not sure", tone: "warn",
    help: "The app isn't sure enough to name one problem. Use the checks below to narrow it down before doing anything." },
  low_quality: { label: "Photo not clear enough", tone: "warn",
    help: "The photo is too dark, too bright or blurry, so this result is only a rough guess. A clearer photo will help." },
  species_mismatch: { label: "Plant doesn't match", tone: "warn",
    help: "The photo doesn't look like the plant you chose. Check the plant name, or try a clearer photo of one leaf." },
  unfamiliar_image: { label: "Couldn't recognize this photo", tone: "warn",
    help: "This photo looks very different from the photos the app learned from, so it won't guess a disease." },
  possible_non_plant: { label: "May not be a plant", tone: "bad",
    help: "We couldn't find much leaf in this photo. Try a close-up of one leaf." },
  unsupported_plant: { label: "General leaf check", tone: "info",
    help: "We don't have a disease check for this plant, so we describe what the leaf looks like instead." },
  model_unavailable: { label: "Disease check unavailable", tone: "bad",
    help: "The disease check isn't running right now, so only general advice is shown." },
  analysis_error: { label: "Something went wrong", tone: "bad",
    help: "We couldn't check this photo. Please try again, or use a different photo." },
  invalid_input: { label: "Please check the form", tone: "bad", help: "" },
};

export const statusMeta = (status: string) => STATUS_META[status] ?? { label: status, tone: "neutral" as Tone, help: "" };

/** Plain labels for the four health-summary states (src/report.py). */
export const STATE_META: Record<string, { label: string; tone: Tone }> = {
  healthy: { label: "Looks healthy", tone: "good" },
  problem: { label: "Needs attention", tone: "warn" },
  unclear: { label: "Not sure", tone: "neutral" },
  detected: { label: "Found", tone: "warn" },
  not_detected: { label: "None found", tone: "good" },
  uncertain: { label: "Not sure", tone: "neutral" },
  not_assessed: { label: "Not checked", tone: "neutral" },
};

export const stateMeta = (state: string) => STATE_META[state] ?? { label: state, tone: "neutral" as Tone };

/**
 * Plain titles for the advice sections, keyed by the API's stable section `key`. Sections whose
 * backend title carries specific information (treatment, care guide, pests found) keep it.
 */
const SECTION_TITLES: Record<string, string> = {
  actions: "What to do now",
  symptoms: "What the leaf looks like (photo check)",
  inspect: "What to look for on your plant",
  disease: "Simple steps to limit spread",
  watering: "Watering",
  nutrients: "Feeding and leaf colour",
  prevention: "Keeping your plant healthy",
  expert: "When to ask an expert",
  questions: "Questions that would help us give better advice",
  limitations: "Things to keep in mind",
};

export const sectionTitle = (s: { key: string; title: string }) => {
  if (s.key === "pests") return s.title.startsWith("Pests (detected") ? "Possible insects or eggs in your photo" : "Insects and other pests";
  return SECTION_TITLES[s.key] ?? s.title;
};

/**
 * Plain versions of fixed, technical advice sentences from the API (exact matches only; the backend
 * text is unchanged because the Streamlit app and Python tests share it). Anything else is shown as-is.
 */
const PLAIN_SENTENCES: Record<string, string> = {
  "Image-based predictions are not definitive diagnoses. Confirm with a local agricultural extension service, plant clinic or plant pathologist before taking costly or irreversible action.":
    "A result from a photo is not a confirmed diagnosis. Check with a local plant expert (for example a plant clinic or agricultural advice service) before doing anything costly or that can't be undone.",
  "The model was trained on PlantVillage images (single leaves photographed on plain backgrounds); accuracy on real garden or field photos is unmeasured and likely lower than the reported test accuracy.":
    "The app learned from photos of single leaves on plain backgrounds. We haven't measured how often it is right on everyday garden photos - it is likely to be lower than in our tests.",
  "Confidence scores are temperature-calibrated on validation data, but they are not the probability that the diagnosis is correct for your plant.":
    "The percentage shows how strongly the app leans towards an answer. It is not the chance that the answer is correct for your plant.",
  "This photo check describes what the leaf looks like. It is separate from the disease model's result above and does not name a disease.":
    "This photo check describes what the leaf looks like. It is separate from the disease check above and does not name a disease.",
  "For a disease check, upload a close-up of one affected leaf: the disease model was trained on leaf close-ups, so whole-plant photos cannot give a reliable disease result.":
    "For a disease check, take a close-up of one affected leaf. The disease check learned from leaf close-ups, so whole-plant photos can't give a reliable disease result.",
};

export const plainText = (text: string) => PLAIN_SENTENCES[text] ?? text;

export function Chip({ tone, children, className = "" }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${TONE_CLASSES[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function formatDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
