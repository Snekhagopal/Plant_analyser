"use client";

import Link from "next/link";
import { useEffect, useState, type ComponentType } from "react";
import {
  AlertTriangle, ArrowRight, BookOpen, Bug, ClipboardCheck, Clock, Download, Droplets, Eye, FlaskConical, HelpCircle,
  Leaf, ListChecks, ShieldCheck, Sprout, Stethoscope, Sun, Users,
} from "lucide-react";
import { api, type AnalyzeResponse, type PlantGuide, type Section } from "@/lib/api";
import { Bold, formatDate, pct } from "@/lib/format";
import { CardTitle, Disclaimer, GlassCard, Skeleton } from "@/components/ui";
import { AssessmentRow, HeadlineCards, ImagesAndMeaning, StatusBanner } from "./ResultCards";

type Icon = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

const SECTION_ICONS: Record<string, Icon> = {
  actions: ListChecks, pests: Bug, symptoms: Eye, inspect: Stethoscope, care: Leaf, disease: ShieldCheck,
  treatment: FlaskConical, watering: Droplets, nutrients: Sprout, prevention: ShieldCheck, expert: Users,
  questions: HelpCircle, limitations: AlertTriangle,
};

function downloadReport(r: AnalyzeResponse) {
  const { images: _images, ...report } = r; // keep the file small: no embedded images
  void _images;
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: `plantvision-analysis-${r.history_id ?? "result"}.json` });
  a.click();
  URL.revokeObjectURL(url);
}

function NextSteps({ section }: { section: Section | undefined }) {
  const [all, setAll] = useState(false);
  const items = section?.items ?? [];
  const shown = all ? items : items.slice(0, 3);
  return (
    <GlassCard className="p-5" aria-labelledby="steps-title">
      <CardTitle id="steps-title" icon={ClipboardCheck} title="Recommended Next Steps" />
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-mint-200/70">No immediate actions were returned for this result.</p>
      ) : (
        <ol className="mt-4 space-y-2.5">
          {shown.map((item, i) => (
            <li key={item} className="glass-tile flex gap-3 rounded-xl p-3 text-sm text-mint-100/90">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-mint-200 to-leaf-400 text-sm font-bold text-forest-900">{i + 1}</span>
              <span className="pt-0.5"><Bold text={item} /></span>
            </li>
          ))}
        </ol>
      )}
      {items.length > 3 && (
        <button type="button" onClick={() => setAll((a) => !a)} className="mt-3 text-sm font-medium text-leaf-400 hover:text-lime-glow">
          {all ? "Show fewer" : `Show all ${items.length} steps`}
        </button>
      )}
    </GlassCard>
  );
}

function CareGuideCard({ plant }: { plant: string }) {
  const [guide, setGuide] = useState<PlantGuide | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    api.plant(plant).then((g) => live && setGuide(g)).catch(() => live && setGuide(null));
    return () => { live = false; };
  }, [plant]);

  if (guide === null || (guide && !guide.care)) return null;   // no care profile for this name
  const tiles = guide?.care ? [
    { icon: Droplets, title: "Watering", text: guide.care.watering },
    { icon: Sun, title: "Light", text: guide.care.light },
    { icon: Bug, title: "Common Pests", text: guide.care.pests },
    { icon: Leaf, title: "Common Problems", text: guide.care.problems },
  ] : [];
  return (
    <GlassCard className="p-5" aria-labelledby="care-title">
      <CardTitle id="care-title" icon={BookOpen} title={`Care Guide for ${guide?.name ?? plant}`}
        action={guide && (
          <Link href={`/plant-guide?name=${encodeURIComponent(guide.name)}`} className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-leaf-400 hover:text-lime-glow">
            View Full Guide <ArrowRight className="size-4" aria-hidden />
          </Link>
        )} />
      {guide === undefined ? (
        <div className="mt-4 grid grid-cols-2 gap-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : (
        <>
          {guide.care?.note && <p className="mt-3 text-sm text-mint-200/80">{guide.care.note}</p>}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {tiles.map(({ icon: I, title, text }) => (
              <div key={title} className="glass-tile flex gap-3 rounded-xl p-3">
                <I className="mt-0.5 size-6 shrink-0 text-leaf-400" aria-hidden />
                <div><p className="text-sm font-semibold text-mint-100">{title}</p><p className="mt-0.5 text-xs leading-relaxed text-mint-200/75">{text}</p></div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-mint-200/55">General guidance for {guide.care?.group.toLowerCase()}s, not a diagnosis from your photo.</p>
        </>
      )}
    </GlassCard>
  );
}

/** Expanded by default: actions, treatment options, and pests found in the photo. */
const startsOpen = (s: Section) =>
  s.key === "actions" || s.key === "treatment" || (s.key === "pests" && s.title.startsWith("Pests (detected"));

function FullReport({ sections }: { sections: Section[] }) {
  return (
    <GlassCard className="p-5" aria-labelledby="report-title">
      <CardTitle id="report-title" icon={ListChecks} title="Full care plan"
        subtitle="Every section returned by the analysis. Treatment options appear only when the evidence supports them." />
      <div className="mt-4 grid gap-2">
        {sections.filter((s) => s.items.length).map((s) => {
          const I = SECTION_ICONS[s.key] ?? ListChecks;
          const highlight = s.key === "treatment";
          return (
            <details key={s.key + s.title} open={startsOpen(s)}
              className={`group rounded-xl border px-4 py-3 ${highlight ? "border-amber-300/30 bg-amber-400/5" : "border-mint-200/10 bg-forest-950/30"}`}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold text-mint-100">
                <span className="flex items-center gap-2"><I className={`size-4 ${highlight ? "text-amber-300" : "text-leaf-400"}`} aria-hidden />{s.title}</span>
                <span className="text-xs text-mint-200/60 group-open:hidden">{s.items.length}</span>
              </summary>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-mint-200/85">
                {s.items.map((item) => <li key={item}><Bold text={item} /></li>)}
              </ul>
            </details>
          );
        })}
      </div>
    </GlassCard>
  );
}

function ModelDetails({ r }: { r: AnalyzeResponse }) {
  const d = r.model_details;
  if (!d && r.pests.score === null) return null;
  return (
    <details className="rounded-2xl border border-mint-200/10 bg-forest-950/30 px-4 py-3">
      <summary className="cursor-pointer text-sm font-semibold text-mint-100">Model details</summary>
      {d && (
        <div className="mt-3">
          <p className="text-xs text-mint-200/70">
            {r.prediction ? "Scores for this plant's classes" : "What the model would have guessed (not reliable for this image)"}
          </p>
          <ul className="mt-2 space-y-2">
            {(r.prediction ? [{ label: r.prediction.label, name: r.prediction.name, species: r.plant.matched_species ?? "", score: r.prediction.score }, ...r.prediction.alternatives] : d.top_k).map((x) => (
              <li key={x.label} className="text-xs">
                <div className="flex justify-between text-mint-200/85"><span>{x.name} ({x.species})</span><span>{pct(x.score, 1)}</span></div>
                <div className="mt-1 h-1.5 rounded-full bg-white/10"><div className="h-full rounded-full bg-leaf-400" style={{ width: `${Math.max(1, x.score * 100)}%` }} /></div>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-3 text-xs text-mint-200/60">
        {d?.plant_mass !== null && d?.plant_mass !== undefined && `Share of score on ${r.plant.matched_species} classes: ${pct(d.plant_mass)} · `}
        {d?.unfamiliarity_score !== null && d?.unfamiliarity_score !== undefined && `Unfamiliarity score: ${d.unfamiliarity_score.toFixed(1)}${d.unfamiliar ? " (above threshold)" : " (within training range)"} · `}
        {r.pests.score !== null && `Pest-screen score (${r.pests.method === "clip" ? "CLIP" : r.pests.method}): ${r.pests.score.toFixed(2)}`}
      </p>
    </details>
  );
}

export default function ResultsDashboard({ result: r, analyzedAt }: { result: AnalyzeResponse; analyzedAt: Date }) {
  const actions = r.recommendations.find((s) => s.key === "actions");
  return (
    <div className="grid gap-5 lg:grid-cols-3" id="results">
      <GlassCard className="flex flex-col gap-4 p-5 lg:col-span-2" aria-labelledby="results-title">
        <CardTitle id="results-title" icon={Leaf} title="Analysis Results"
          subtitle="Here's what the analysis found in your plant photo."
          action={
            <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
              <span className="hidden items-center gap-1 text-xs text-mint-200/70 sm:inline-flex"><Clock className="size-3.5" aria-hidden />Analyzed on {formatDate(analyzedAt.toISOString())}</span>
              <button type="button" onClick={() => downloadReport(r)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-leaf-400/40 bg-leaf-400/10 px-3 py-1.5 text-sm font-medium text-leaf-400 hover:bg-leaf-400/20">
                <Download className="size-4" aria-hidden /> Download report
              </button>
            </div>
          } />
        <StatusBanner r={r} />
        <HeadlineCards r={r} />
        <AssessmentRow r={r} />
        <ImagesAndMeaning r={r} />
        {r.history_error && <p className="text-xs text-amber-200">The result could not be saved to history: {r.history_error}</p>}
      </GlassCard>
      <div className="flex flex-col gap-5">
        <NextSteps section={actions} />
        <CareGuideCard plant={r.plant.input} />
      </div>
      <div className="flex flex-col gap-4 lg:col-span-3">
        <FullReport sections={r.recommendations} />
        <ModelDetails r={r} />
        <Disclaimer />
      </div>
    </div>
  );
}
