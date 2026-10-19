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

/** One entry per analysis status returned by the backend (invalid_input is shown as a form error). */
export const STATUS_META: Record<string, { label: string; tone: Tone }> = {
  likely_match: { label: "Likely match", tone: "good" },
  uncertain: { label: "Uncertain", tone: "warn" },
  low_quality: { label: "Low image quality", tone: "warn" },
  species_mismatch: { label: "Plant mismatch", tone: "warn" },
  unfamiliar_image: { label: "Unfamiliar image", tone: "warn" },
  possible_non_plant: { label: "May not be a plant", tone: "bad" },
  unsupported_plant: { label: "General symptom check", tone: "info" },
  model_unavailable: { label: "Model unavailable", tone: "bad" },
  analysis_error: { label: "Analysis failed", tone: "bad" },
  invalid_input: { label: "Invalid input", tone: "bad" },
};

export const statusMeta = (status: string) => STATUS_META[status] ?? { label: status, tone: "neutral" as Tone };

/** Assessment states from src/report.py. */
export const STATE_META: Record<string, { label: string; tone: Tone }> = {
  healthy: { label: "Healthy", tone: "good" },
  problem: { label: "Needs attention", tone: "warn" },
  unclear: { label: "Unclear", tone: "neutral" },
  detected: { label: "Found", tone: "warn" },
  not_detected: { label: "Not found", tone: "good" },
  uncertain: { label: "Uncertain", tone: "neutral" },
  not_assessed: { label: "Not assessed", tone: "neutral" },
};

export const stateMeta = (state: string) => STATE_META[state] ?? { label: state, tone: "neutral" as Tone };

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
