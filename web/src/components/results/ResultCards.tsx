"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  Activity, Bug, Camera, CircleAlert, Eye, Gauge, HeartPulse, Lightbulb, Maximize2, ScanSearch, Sprout, X,
} from "lucide-react";
import type { AnalyzeResponse, Assessment } from "@/lib/api";
import { Bold, Chip, pct, stateMeta, statusMeta } from "@/lib/format";

type R = AnalyzeResponse;

function Tile({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`glass-tile relative overflow-hidden rounded-2xl p-4 ${className}`}>{children}</div>;
}

function TileHead({ icon: I, title }: { icon: typeof Activity; title: string }) {
  return (
    <p className="flex items-center gap-2 text-sm font-semibold text-mint-100">
      <span className="grid size-8 place-items-center rounded-full bg-leaf-400/15 text-leaf-400"><I className="size-4" aria-hidden /></span>
      {title}
    </p>
  );
}

export function ConfidenceRing({ value }: { value: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 80 80" className="size-24 shrink-0" role="img" aria-label={`Score ${pct(value)}`}>
      <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(196,245,210,0.12)" strokeWidth="7" />
      <circle cx="40" cy="40" r={r} fill="none" stroke="url(#ring)" strokeWidth="7" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, value)))} transform="rotate(-90 40 40)" />
      <defs><linearGradient id="ring" x1="0" x2="1"><stop offset="0" stopColor="#7fdc6a" /><stop offset="1" stopColor="#b8f36b" /></linearGradient></defs>
      <text x="40" y="46" textAnchor="middle" className="fill-mint-100 text-[17px] font-bold">{pct(value)}</text>
    </svg>
  );
}

/** Top row: three cards whose content depends on what the backend returned. */
export function HeadlineCards({ r }: { r: R }) {
  const status = statusMeta(r.status);
  if (r.prediction) {
    const p = r.prediction;
    return (
      <div className="grid gap-4 md:grid-cols-3">
        <Tile>
          <TileHead icon={Sprout} title="Prediction" />
          <Chip tone={status.tone} className="mt-3">{status.label}</Chip>
          <p className="mt-2 text-xl font-bold text-mint-100">{p.name}</p>
          <p className="text-sm text-mint-200/75">{p.category}{p.cause ? ` (${p.cause})` : ""}</p>
        </Tile>
        <Tile>
          <TileHead icon={Gauge} title="Model confidence" />
          <div className="mt-2 flex flex-col items-center gap-2 2xl:flex-row 2xl:items-center">
            <ConfidenceRing value={p.score} />
            <p className="text-xs leading-relaxed text-mint-200/75">
              Calibrated model score for this class - how strongly the model&apos;s output favours it, <strong className="text-mint-100">not</strong> the
              probability that the diagnosis is correct.
            </p>
          </div>
        </Tile>
        <Tile>
          <TileHead icon={Activity} title="Possible condition" />
          <p className="mt-3 text-xl font-bold text-mint-100">{p.name}</p>
          <p className="text-sm text-mint-200/75">{p.category ?? "Condition"}</p>
          {r.status !== "likely_match" && (
            <p className="mt-2 text-xs text-amber-200/90">Not reliable enough to act on yet - confirm with the checks below.</p>
          )}
        </Tile>
      </div>
    );
  }
  if (r.symptom?.is_primary) {
    const s = r.symptom;
    return (
      <div className="grid gap-4 md:grid-cols-3">
        <Tile>
          <TileHead icon={Eye} title="Visible symptom pattern" />
          <Chip tone={status.tone} className="mt-3">{status.label}</Chip>
          <p className="mt-2 text-lg font-bold text-mint-100">{r.report.symptoms.headline}</p>
          <p className="text-sm text-mint-200/75">What the leaf looks like - not a disease name.</p>
        </Tile>
        <Tile>
          <TileHead icon={Gauge} title="Symptom-check score" />
          <div className="mt-2 flex flex-col items-center gap-2 2xl:flex-row 2xl:items-center">
            <ConfidenceRing value={s.score} />
            <p className="text-xs leading-relaxed text-mint-200/75">
              Score of the closest pattern. It is <strong className="text-mint-100">not</strong> the probability that the pattern is correct.
            </p>
          </div>
        </Tile>
        <Tile>
          <TileHead icon={ScanSearch} title="Disease check" />
          <p className="mt-3 text-lg font-bold text-mint-100">No disease model for {r.plant.input}</p>
          <p className="text-sm text-mint-200/75">Disease checks cover 14 crops. The exact disease cannot be named.</p>
        </Tile>
      </div>
    );
  }
  return (
    <Tile className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-amber-400/15 text-amber-300"><CircleAlert className="size-6" aria-hidden /></span>
      <div>
        <Chip tone={status.tone}>{status.label}</Chip>
        {!r.summary.includes(r.message) && <p className="mt-2 text-sm leading-relaxed text-mint-100/90">{r.message}</p>}
        <p className="mt-2 text-sm text-mint-100/90">No disease or symptom result is shown as reliable for this photo.</p>
        {["species_mismatch", "unfamiliar_image", "possible_non_plant"].includes(r.status) && (
          <p className="mt-2 text-sm text-mint-200/75">
            Tip: one leaf filling most of the frame, in daylight, against a plain background works best.
          </p>
        )}
      </div>
    </Tile>
  );
}

const ASSESSMENT_ICONS = { health: HeartPulse, symptoms: Eye, pests: Bug, disease: Activity } as const;

export function AssessmentRow({ r }: { r: R }) {
  const items: Assessment[] = [r.report.health, r.report.symptoms, r.report.pests, r.report.disease];
  return (
    <ul className="grid gap-3 sm:grid-cols-2" aria-label="Health assessments">
      {items.map((a) => {
        const I = ASSESSMENT_ICONS[a.key as keyof typeof ASSESSMENT_ICONS] ?? Activity;
        const m = stateMeta(a.state);
        return (
          <li key={a.key} className="glass-tile rounded-xl p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-mint-200/70">
                <I className="size-3.5" aria-hidden />{a.title}
              </span>
              <Chip tone={m.tone}>{m.label}</Chip>
            </div>
            <p className="mt-1.5 text-sm font-semibold text-mint-100">{a.headline}</p>
            {a.details[0] && <p className="mt-0.5 line-clamp-3 text-xs text-mint-200/70">{a.details[0]}</p>}
          </li>
        );
      })}
    </ul>
  );
}

function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  return (
    <div role="dialog" aria-modal="true" aria-label={alt} className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" onClick={onClose}>
      <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-4 rounded-full bg-white/10 p-2"><X className="size-5" aria-hidden /></button>
      {/* eslint-disable-next-line @next/next/no-img-element -- data URL from the API */}
      <img src={src} alt={alt} className="max-h-[90vh] max-w-[95vw] rounded-xl object-contain" />
    </div>
  );
}

function ImagePanel({ title, icon: I, src, alt, children }: { title: string; icon: typeof Camera; src?: string | null; alt: string; children?: ReactNode }) {
  const [zoom, setZoom] = useState(false);
  return (
    <Tile className="p-3">
      <p className="mb-2 flex items-center gap-2 px-1 text-sm font-semibold text-mint-100"><I className="size-4 text-leaf-400" aria-hidden />{title}</p>
      {src ? (
        <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-forest-950">
          <Image src={src} alt={alt} fill unoptimized className="object-cover" />
          <button type="button" onClick={() => setZoom(true)} aria-label={`Enlarge ${title}`}
            className="absolute right-2 top-2 rounded-lg bg-forest-950/70 p-1.5 text-mint-100 hover:bg-forest-950">
            <Maximize2 className="size-4" aria-hidden />
          </button>
          {zoom && <Lightbox src={src} alt={alt} onClose={() => setZoom(false)} />}
        </div>
      ) : (
        <div className="grid aspect-[4/3] place-items-center rounded-xl border border-dashed border-mint-200/15 p-4 text-center text-sm text-mint-200/70">
          {children}
        </div>
      )}
    </Tile>
  );
}

export function ImagesAndMeaning({ r }: { r: R }) {
  const label = r.photo_type === "whole_plant" ? "Your Uploaded Plant Photo" : "Your Uploaded Leaf Photo";
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <ImagePanel title={label} icon={Camera} src={r.images.photo} alt="Your uploaded photo" />
      <ImagePanel title="AI Attention Map (Grad-CAM)" icon={ScanSearch} src={r.images.gradcam}
        alt="Grad-CAM heatmap: warm colours mark regions that most influenced the model's score">
        {r.images.gradcam_note ?? "No heatmap for this result."}
      </ImagePanel>
      <WhatThisMeans r={r} />
      {r.images.gradcam && (
        <p className="text-xs text-mint-200/60 md:col-span-3">
          Warm colours mark regions that most influenced the model&apos;s score. A heatmap explains what the model looked at;
          it does not prove the prediction is right.
          {r.images.leaf_attention !== null && r.images.leaf_attention !== undefined && ` ${pct(r.images.leaf_attention)} of the attention falls on the leaf.`}
        </p>
      )}
    </div>
  );
}

function WhatThisMeans({ r }: { r: R }) {
  let body: ReactNode;
  let link: { href: string; label: string } | null = null;
  if (r.prediction) {
    const p = r.prediction;
    body = (
      <>
        <p><strong className="text-mint-100">{p.name}</strong> is a {p.category?.toLowerCase() ?? "condition"}{p.cause ? `, caused by ${p.cause.charAt(0).toLowerCase()}${p.cause.slice(1)}` : ""}.</p>
        {(p.symptoms ?? []).length > 0 && (
          <><p className="mt-2 text-mint-100">Typical signs:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">{(p.symptoms ?? []).slice(0, 3).map((s) => <li key={s}>{s}</li>)}</ul></>
        )}
      </>
    );
    link = p.category === "Healthy"
      ? { href: `/plant-guide?name=${encodeURIComponent(r.plant.matched_species ?? r.plant.input)}`, label: "Care guide" }
      : { href: `/disease-library#${encodeURIComponent(p.label)}`, label: "Learn more" };
  } else if (r.symptom) {
    const s = r.symptom;
    const described = r.report.symptoms.details.slice(0, s.patterns.length);   // one description per pattern
    body = (
      <>
        {s.patterns.length ? <ul className="list-disc space-y-1 pl-4">{described.map((d) => <li key={d}>{d}</li>)}</ul>
          : <p>The photo check could not single out a clear pattern.</p>}
        <p className="mt-2">This describes the leaf&apos;s appearance; many causes can produce the same pattern.</p>
      </>
    );
    link = { href: `/plant-guide?name=${encodeURIComponent(r.plant.input)}`, label: "Care guide" };
  } else {
    body = <p>No reliable result could be produced for this photo, so nothing is shown as a diagnosis. Follow the steps on the right.</p>;
  }
  return (
    <Tile>
      <TileHead icon={Lightbulb} title="What this means" />
      <div className="mt-3 text-sm leading-relaxed text-mint-200/80">{body}</div>
      {link && (
        <Link href={link.href} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-leaf-400 hover:text-lime-glow">
          {link.label} →
        </Link>
      )}
    </Tile>
  );
}

export function StatusBanner({ r }: { r: R }) {
  const m = statusMeta(r.status);
  return (
    <div className="glass-tile rounded-2xl p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone={m.tone}>{r.status_label}</Chip>
        {r.photo_type === "whole_plant" && <Chip tone="info">Whole-plant photo</Chip>}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-mint-100/90"><Bold text={r.summary} /></p>
      {r.warnings.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-amber-200/90">
          {r.warnings.map((w) => <li key={w} className="flex gap-1.5"><CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />{w}</li>)}
        </ul>
      )}
    </div>
  );
}
