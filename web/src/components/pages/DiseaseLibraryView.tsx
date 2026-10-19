"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { api, type LibraryCondition } from "@/lib/api";
import { Chip, type Tone } from "@/lib/format";
import { useApi } from "@/lib/useApi";
import { ErrorBanner, GlassCard, PageHeader, Skeleton } from "@/components/ui";

const CATEGORY_TONE: Record<string, Tone> = {
  "Fungal disease": "warn", "Bacterial disease": "bad", "Viral disease": "bad",
  "Water-mould (oomycete) disease": "bad", "Pest damage (mites)": "info", Healthy: "good",
};

function List({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-leaf-400">{title}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-mint-200/85">{items.map((i) => <li key={i}>{i}</li>)}</ul>
    </div>
  );
}

function ConditionCard({ c }: { c: LibraryCondition }) {
  return (
    <article id={c.label} className="glass scroll-mt-24 rounded-2xl p-5 target:ring-2 target:ring-leaf-400">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-mint-100">{c.name}</h3>
          <p className="text-xs text-mint-200/65">{c.crop}{c.cause ? ` · ${c.cause}` : ""}</p>
        </div>
        <Chip tone={CATEGORY_TONE[c.category] ?? "neutral"}>{c.category}</Chip>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <List title="Signs to look for" items={c.symptoms} />
        <List title="What to check" items={c.inspect} />
        <List title="Prevention" items={c.prevention} />
      </div>
      {c.escalate && <p className="mt-4 rounded-lg bg-amber-400/10 px-3 py-2 text-sm text-amber-100/90">When to get help: {c.escalate}</p>}
    </article>
  );
}

export default function DiseaseLibraryView() {
  const { data, error, loading, retry } = useApi(() => api.conditions());
  const [crop, setCrop] = useState("All crops");
  const [query, setQuery] = useState("");
  const [showHealthy, setShowHealthy] = useState(false);

  const crops = useMemo(() => ["All crops", ...Array.from(new Set((data ?? []).map((c) => c.crop))).sort()], [data]);
  const shown = useMemo(() => (data ?? []).filter((c) => (crop === "All crops" || c.crop === crop)
    && (showHealthy || c.category !== "Healthy")
    && `${c.name} ${c.crop} ${c.category}`.toLowerCase().includes(query.trim().toLowerCase())), [data, crop, query, showHealthy]);

  // Deep links (e.g. "Learn more" from a result) point at a condition's anchor.
  useEffect(() => {
    if (!data || !window.location.hash) return;
    const id = decodeURIComponent(window.location.hash.slice(1));
    document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, [data]);

  return (
    <>
      <PageHeader eyebrow="Plant Diseases" title="Diseases We Can Check For">
        Information about every problem the disease check can recognise on 14 food crops: the signs to look for, what to
        check on your plant, how to prevent it and when to ask an expert.
      </PageHeader>
      {error && <ErrorBanner message={error} onRetry={retry} />}
      {loading && <div className="grid gap-4"><Skeleton className="h-40" /><Skeleton className="h-40" /></div>}
      {data && (
        <>
          <GlassCard className="mb-5 flex flex-col gap-3 p-4 sm:flex-row sm:items-center" aria-label="Filters">
            <label className="flex flex-1 items-center gap-2 rounded-xl border border-mint-200/15 bg-forest-950/50 px-3">
              <Search className="size-4 text-mint-200/60" aria-hidden /><span className="sr-only">Search conditions</span>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search conditions…"
                className="h-10 w-full bg-transparent text-sm text-mint-100 placeholder:text-mint-200/40 focus:outline-none" />
            </label>
            <label className="text-sm"><span className="sr-only">Crop</span>
              <select value={crop} onChange={(e) => setCrop(e.target.value)}
                className="h-10 rounded-xl border border-mint-200/15 bg-forest-950/60 px-3 text-mint-100">
                {crops.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-mint-200/85">
              <input type="checkbox" checked={showHealthy} onChange={(e) => setShowHealthy(e.target.checked)} className="accent-lime-400" />
              Show healthy-leaf entries
            </label>
          </GlassCard>
          <p className="mb-3 text-sm text-mint-200/65">Showing {shown.length} of {data.length} entries</p>
          <div className="grid gap-4">{shown.map((c) => <ConditionCard key={c.label} c={c} />)}</div>
          <p className="mt-6 text-xs text-mint-200/55">
            Short summaries to help you get started. Conditions and allowed treatments differ from place to place, so check
            with a local plant expert before acting.
          </p>
        </>
      )}
    </>
  );
}
