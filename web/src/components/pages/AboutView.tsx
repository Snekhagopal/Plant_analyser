"use client";

import { api } from "@/lib/api";
import { Chip, pct, plainText } from "@/lib/format";
import { useApi } from "@/lib/useApi";
import { Disclaimer, ErrorBanner, GlassCard, PageHeader, Skeleton } from "@/components/ui";

// [step, plain explanation, technical name for the curious]
const STEPS: [string, string, string][] = [
  ["Photo check", "We check the file, and whether the photo is too dark, too bright, blurry, or shows hardly any leaf.", ""],
  ["Your plant", "You tell us which plant it is - the app never guesses the plant from the photo. We see whether it is one of the 14 food crops we can check for diseases.", ""],
  ["Disease check (14 crops)", "A computer-vision model that learned from thousands of leaf photos compares your photo with 38 kinds of leaves (healthy or with a specific problem).", "MobileNetV2 trained on PlantVillage, with calibrated scores"],
  ["Safety checks", "We only call a result a likely match if it fits the plant you chose, the app is sure enough, the photo looks like the photos it learned from, and it was looking at the leaf. Whole-plant photos are never more than a rough guess.", "confidence threshold, out-of-distribution check, Grad-CAM attention check"],
  ["Leaf and insect check", "A second model describes what the leaf looks like (spots, powdery coating, rust-coloured spots, patchy yellowing) and looks for insects or eggs. It works for any plant.", "zero-shot CLIP ViT-L/14"],
  ["Advice", "Simple, low-risk steps first. Watering, feeding and insect advice is based on your answers. Treatment products are only mentioned when the result supports it, always with safety advice - never brand names or amounts.", ""],
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
        A plant-health helper that runs on your own computer. It looks at your photo for signs of good or poor health,
        leaf problems and insects - and, for 14 food crops, specific diseases - then suggests practical care steps.
      </PageHeader>

      <div className="grid gap-5 lg:grid-cols-3">
        <GlassCard className="p-5 lg:col-span-2" aria-labelledby="how">
          <h2 id="how" className="text-lg font-semibold text-mint-100">What happens when you check a plant</h2>
          <ol className="mt-4 space-y-3">
            {STEPS.map(([t, d, tech], i) => (
              <li key={t} className="flex gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-leaf-400/20 text-sm font-bold text-leaf-400">{i + 1}</span>
                <p className="text-sm text-mint-200/85"><strong className="text-mint-100">{t}.</strong> {d}
                  {tech && <span className="mt-0.5 block text-xs text-mint-200/50">Technical name: {tech}</span>}</p>
              </li>
            ))}
          </ol>
        </GlassCard>
        <GlassCard className="p-5" aria-labelledby="status">
          <h2 id="status" className="text-lg font-semibold text-mint-100">Is everything working?</h2>
          {health.loading && <Skeleton className="mt-3 h-24" />}
          {health.error && <div className="mt-3"><ErrorBanner message={health.error} onRetry={health.retry} /></div>}
          {health.data && (
            <ul className="mt-3 space-y-2 text-sm">
              {[
                ["Disease check", health.data.model_loaded],
                ["Insect check", health.data.pest_screen !== null],
                ["Leaf check", health.data.symptom_check],
                ["Saved past checks", health.data.history_available],
              ].map(([label, ok]) => (
                <li key={String(label)} className="flex items-center justify-between">
                  <span className="text-mint-200/85">{label}</span>
                  <Chip tone={ok ? "good" : "bad"}>{ok ? "Working" : "Not available"}</Chip>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>
      </div>

      <section className="mt-6" aria-labelledby="perf">
        <h2 id="perf" className="mb-3 text-lg font-semibold text-mint-100">How often is it right? (tested results)</h2>
        {about.loading && <Skeleton className="h-32" />}
        {about.error && <ErrorBanner message={about.error} onRetry={about.retry} />}
        {a && (
          <div className="grid gap-4">
            {a.disease_test && (
              <GlassCard className="p-5" aria-label="Disease check">
                <p className="text-sm font-semibold text-mint-100">Disease check · tested on {String(a.disease_test.images)} lab photos of single leaves it had never seen</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <Stat label="Right first time" value={pct(a.disease_test.accuracy as number, 1)} note="of test photos got the correct answer" />
                  <Stat label="Right when sure enough" value={pct(a.disease_test.accuracy_when_accepted as number, 1)} note={`correct when its score was high enough to answer (${pct(a.disease_test.accepted_share as number)} of photos)`} />
                  <Stat label="Marked “couldn't recognize”" value={pct(a.disease_test.unfamiliar_flag_rate as number, 1)} note="of normal test photos" />
                </div>
              </GlassCard>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              {a.symptom_check && (
                <GlassCard className="p-5" aria-label="Leaf check">
                  <p className="text-sm font-semibold text-mint-100">Leaf check · tested on {String(a.symptom_check.test_images)} lab photos of single leaves</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Stat label="Right when it gives one answer" value={pct(a.symptom_check.accuracy_when_clear as number)} note={`${pct(a.symptom_check.share_clear as number)} of photos got one clear answer`} />
                    <Stat label="Right answer among two" value={pct(a.symptom_check.true_pattern_in_pair as number)} note={`when it named two possible patterns (${pct(a.symptom_check.share_two_patterns as number)} of photos)`} />
                  </div>
                </GlassCard>
              )}
              {a.pest_screen && (
                <GlassCard className="p-5" aria-label="Insect check">
                  <p className="text-sm font-semibold text-mint-100">Insect check · tested on {String(a.pest_screen.ip102_test_images)} photos of crop pests</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Stat label="Insect photos spotted" value={pct(a.pest_screen.ip102_hit_rate as number)} note="of photos that showed pests" />
                    <Stat label="False alarms" value={pct(a.pest_screen.pest_free_flag_rate as number)} note="of insect-free lab leaves were flagged" />
                  </div>
                </GlassCard>
              )}
            </div>
            <p className="text-xs text-mint-200/60">
              These numbers come from test photos: single leaves on plain backgrounds (and a public set of crop-pest photos for
              insects). We haven&apos;t measured how often it is right on everyday garden photos - it is likely to be lower.
            </p>
            <GlassCard className="p-5" aria-labelledby="limits">
              <h2 id="limits" className="text-lg font-semibold text-mint-100">Things to keep in mind</h2>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-mint-200/85">{a.limitations.map((l) => <li key={l}>{plainText(l)}</li>)}</ul>
            </GlassCard>
          </div>
        )}
      </section>

      <GlassCard className="mt-6 p-5" aria-labelledby="credits">
        <h2 id="credits" className="text-lg font-semibold text-mint-100">Credits (technical)</h2>
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
