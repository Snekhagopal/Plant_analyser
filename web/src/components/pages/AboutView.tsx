"use client";

import { api } from "@/lib/api";
import { Chip, pct } from "@/lib/format";
import { useApi } from "@/lib/useApi";
import { Disclaimer, ErrorBanner, GlassCard, PageHeader, Skeleton } from "@/components/ui";

const STEPS = [
  ["Validation", "File type, size, readability and basic quality: blur, brightness and leaf-coloured area."],
  ["Plant check", "Your plant name is matched against the 14 crops the disease model knows. The app never guesses the plant from the photo."],
  ["Disease check (14 crops)", "A MobileNetV2 fine-tuned on PlantVillage scores 38 classes; scores are temperature-calibrated."],
  ["Reliability checks", "A result counts as a likely match only if it agrees with your plant, passes a confidence threshold, the photo is not unfamiliar to the model, and the Grad-CAM attention is mostly on the leaf. Whole-plant photos are shown as uncertain at most."],
  ["Symptoms and pests", "A zero-shot CLIP ViT-L/14 check describes the visible symptom pattern and flags possible insects or eggs."],
  ["Recommendations", "Conservative, low-risk steps. Watering, nutrient and pest advice relies on your answers. Treatment categories appear only when the evidence supports them, with safety precautions - never brands or doses."],
];

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="glass-tile rounded-xl p-4">
      <p className="text-xs uppercase tracking-wide text-mint-200/65">{label}</p>
      <p className="mt-1 text-2xl font-bold text-mint-100">{value}</p>
      {note && <p className="mt-1 text-xs text-mint-200/65">{note}</p>}
    </div>
  );
}

export default function AboutView() {
  const about = useApi(() => api.about());
  const health = useApi(() => api.health());
  const a = about.data;

  return (
    <>
      <PageHeader eyebrow="About" title="How PlantVision AI works">
        A plant-health assistant that runs on your own computer. It assesses overall health, visible symptoms, possible
        pests and - for 14 crops - diseases, then suggests practical care steps.
      </PageHeader>

      <div className="grid gap-5 lg:grid-cols-3">
        <GlassCard className="p-5 lg:col-span-2" aria-labelledby="how">
          <h2 id="how" className="text-lg font-semibold text-mint-100">The analysis, step by step</h2>
          <ol className="mt-4 space-y-3">
            {STEPS.map(([t, d], i) => (
              <li key={t} className="flex gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-leaf-400/20 text-sm font-bold text-leaf-400">{i + 1}</span>
                <p className="text-sm text-mint-200/85"><strong className="text-mint-100">{t}.</strong> {d}</p>
              </li>
            ))}
          </ol>
        </GlassCard>
        <GlassCard className="p-5" aria-labelledby="status">
          <h2 id="status" className="text-lg font-semibold text-mint-100">Service status</h2>
          {health.loading && <Skeleton className="mt-3 h-24" />}
          {health.error && <div className="mt-3"><ErrorBanner message={health.error} onRetry={health.retry} /></div>}
          {health.data && (
            <ul className="mt-3 space-y-2 text-sm">
              {[
                ["Disease model", health.data.model_loaded],
                ["Pest screen", health.data.pest_screen !== null],
                ["Symptom check", health.data.symptom_check],
                ["History database", health.data.history_available],
              ].map(([label, ok]) => (
                <li key={String(label)} className="flex items-center justify-between">
                  <span className="text-mint-200/85">{label}</span>
                  <Chip tone={ok ? "good" : "bad"}>{ok ? "Available" : "Unavailable"}</Chip>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>
      </div>

      <section className="mt-6" aria-labelledby="perf">
        <h2 id="perf" className="mb-3 text-lg font-semibold text-mint-100">Measured performance</h2>
        {about.loading && <Skeleton className="h-32" />}
        {about.error && <ErrorBanner message={about.error} onRetry={about.retry} />}
        {a && (
          <div className="grid gap-4">
            {a.disease_test && (
              <GlassCard className="p-5" aria-label="Disease model">
                <p className="text-sm font-semibold text-mint-100">Disease model · {String(a.disease_test.dataset)}</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <Stat label="Top-1 accuracy" value={pct(a.disease_test.accuracy as number, 1)} note={`${a.disease_test.images} held-out test images`} />
                  <Stat label="Accuracy when accepted" value={pct(a.disease_test.accuracy_when_accepted as number, 1)} note={`${pct(a.disease_test.accepted_share as number)} of images pass the reliability checks`} />
                  <Stat label="Flagged as unfamiliar" value={pct(a.disease_test.unfamiliar_flag_rate as number, 1)} note="of normal test images" />
                </div>
              </GlassCard>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              {a.symptom_check && (
                <GlassCard className="p-5" aria-label="Symptom check">
                  <p className="text-sm font-semibold text-mint-100">Symptom check · {String(a.symptom_check.dataset)}</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Stat label="Right when clear" value={pct(a.symptom_check.accuracy_when_clear as number)} note={`${pct(a.symptom_check.share_clear as number)} of photos get one clear pattern`} />
                    <Stat label="True pattern in pair" value={pct(a.symptom_check.true_pattern_in_pair as number)} note={`${pct(a.symptom_check.share_two_patterns as number)} of photos get two patterns`} />
                  </div>
                </GlassCard>
              )}
              {a.pest_screen && (
                <GlassCard className="p-5" aria-label="Pest screen">
                  <p className="text-sm font-semibold text-mint-100">Pest screen · IP102 insect-pest photos</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Stat label="Pest photos flagged" value={pct(a.pest_screen.ip102_hit_rate as number)} note={`${a.pest_screen.ip102_test_images} test photos`} />
                    <Stat label="False alarms" value={pct(a.pest_screen.pest_free_flag_rate as number)} note="of pest-free lab leaves" />
                  </div>
                </GlassCard>
              )}
            </div>
            <p className="text-xs text-mint-200/60">
              All figures come from lab photos of single leaves on plain backgrounds (and IP102 for pests). Accuracy on
              real garden photos has not been measured and is likely lower.
            </p>
            <GlassCard className="p-5" aria-labelledby="limits">
              <h2 id="limits" className="text-lg font-semibold text-mint-100">Limitations</h2>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-mint-200/85">{a.limitations.map((l) => <li key={l}>{l}</li>)}</ul>
            </GlassCard>
          </div>
        )}
      </section>

      <GlassCard className="mt-6 p-5" aria-labelledby="credits">
        <h2 id="credits" className="text-lg font-semibold text-mint-100">Data and credits</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-mint-200/85">
          <li>Disease model trained on PlantVillage (Hughes &amp; Salathé). Sample leaves are PlantVillage test images from the
            Hugging Face mirror <code>geraldmc/plantvillage-full</code> (declared CC0-1.0), shown with their dataset labels.</li>
          <li>Pest screen evaluated on IP102 (Wu et al., CVPR 2019).</li>
          <li>Symptom and pest checks use OpenAI&apos;s CLIP ViT-L/14, run locally.</li>
        </ul>
      </GlassCard>
      <div className="mt-6"><Disclaimer /></div>
    </>
  );
}
