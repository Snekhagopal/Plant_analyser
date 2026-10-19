"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, Bug, Droplets, Leaf, Search, Sun } from "lucide-react";
import { api } from "@/lib/api";
import { Chip } from "@/lib/format";
import { useApi } from "@/lib/useApi";
import { ErrorBanner, GlassCard, PageHeader, Skeleton } from "@/components/ui";

function Guide({ name }: { name: string }) {
  const { data, error, loading, retry } = useApi(() => api.plant(name), name);
  if (loading) return <Skeleton className="h-96" />;
  if (error || !data) return <ErrorBanner message={error ?? "Not found."} onRetry={retry} />;
  const care = data.care;
  return (
    <GlassCard className="p-5 sm:p-6" aria-labelledby="guide-title">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="guide-title" className="text-2xl font-bold text-mint-100">{data.name}</h2>
        {data.disease_check ? <Chip tone="good">Disease check</Chip> : <Chip tone="info">General check &amp; care guide</Chip>}
      </div>
      {care && <p className="mt-1 text-sm text-mint-200/70">{care.group}</p>}
      {care?.note && <p className="mt-3 rounded-xl bg-leaf-400/10 p-3 text-sm text-mint-100/90">{care.note}</p>}
      {care && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            { icon: Droplets, title: "Watering", text: care.watering },
            { icon: Sun, title: "Light", text: care.light },
            { icon: Bug, title: "Common pests", text: care.pests },
            { icon: Leaf, title: "Common problems", text: care.problems },
          ].map(({ icon: I, title, text }) => (
            <div key={title} className="glass-tile flex gap-3 rounded-xl p-4">
              <I className="mt-0.5 size-6 shrink-0 text-leaf-400" aria-hidden />
              <div><p className="font-semibold text-mint-100">{title}</p><p className="mt-1 text-sm text-mint-200/80">{text}</p></div>
            </div>
          ))}
        </div>
      )}
      {care && <p className="mt-3 text-xs text-mint-200/55">General advice for this type of plant - not a diagnosis.</p>}
      {data.coverage_warning && (
        <p className="mt-4 flex gap-2 rounded-xl bg-amber-400/10 p-3 text-sm text-amber-100/90">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />{data.coverage_warning}
        </p>
      )}
      {data.conditions.length > 0 && (
        <div className="mt-6">
          <h3 className="font-semibold text-mint-100">Problems we can check for on {data.name}</h3>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {data.conditions.map((c) => (
              <li key={c.label}>
                <Link href={`/disease-library#${encodeURIComponent(c.label)}`}
                  className="glass-tile block rounded-xl p-3 hover:ring-1 hover:ring-leaf-400/40">
                  <span className="block font-medium text-mint-100">{c.name}</span>
                  <span className="text-xs text-mint-200/70">{c.category}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!data.disease_check && (
        <p className="mt-6 text-sm text-mint-200/75">
          We don&apos;t have a disease check for {data.name}. A plant check describes what the leaves look like (for example
          spots, a powdery coating, rust-coloured spots or patchy yellowing), looks for insects, and gives you this care guide.
        </p>
      )}
    </GlassCard>
  );
}

export default function PlantGuideView({ initialName }: { initialName: string | null }) {
  const { data: meta, error, loading, retry } = useApi(() => api.meta());
  const [query, setQuery] = useState("");
  const [onlyDisease, setOnlyDisease] = useState(false);
  const [chosen, setChosen] = useState<string | null>(initialName);

  const plants = useMemo(() => (meta?.plants ?? []).filter((p) => p.name !== meta?.other_option
    && (!onlyDisease || p.disease_check) && p.name.toLowerCase().includes(query.trim().toLowerCase())), [meta, query, onlyDisease]);
  const selected = chosen ?? plants[0]?.name ?? null;

  const choose = (name: string) => {
    setChosen(name);
    window.history.replaceState(null, "", `?name=${encodeURIComponent(name)}`);
  };

  return (
    <>
      <PageHeader eyebrow="Plant Guide" title="Care guides for 140+ plants">
        Watering, light, common pests and problems for each type of plant. Plants marked <em>Disease check</em> are the 14
        food crops we can check for specific diseases.
      </PageHeader>
      {error && <ErrorBanner message={error} onRetry={retry} />}
      {loading && <div className="grid gap-4 lg:grid-cols-3"><Skeleton className="h-[70vh]" /><Skeleton className="h-96 lg:col-span-2" /></div>}
      {meta && (
        <div className="grid gap-5 lg:grid-cols-3">
          <GlassCard className="p-3" aria-label="Plants">
            <label className="flex items-center gap-2 rounded-xl border border-mint-200/15 bg-forest-950/50 px-3">
              <Search className="size-4 text-mint-200/60" aria-hidden />
              <span className="sr-only">Search plants</span>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search plants…"
                className="h-10 w-full bg-transparent text-sm text-mint-100 placeholder:text-mint-200/40 focus:outline-none" />
            </label>
            <label className="mt-2 flex items-center gap-2 px-1 text-xs text-mint-200/80">
              <input type="checkbox" checked={onlyDisease} onChange={(e) => setOnlyDisease(e.target.checked)} className="accent-lime-400" />
              Only plants with a disease check
            </label>
            <ul className="mt-2 max-h-[65vh] space-y-0.5 overflow-auto">
              {plants.map((p) => (
                <li key={p.name}>
                  <button type="button" onClick={() => choose(p.name)} aria-current={selected === p.name}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${selected === p.name ? "bg-leaf-400/15 text-mint-100" : "text-mint-200/85 hover:bg-white/5"}`}>
                    {p.name}
                    {p.disease_check && <span className="text-[10px] font-semibold text-leaf-400">Disease check</span>}
                  </button>
                </li>
              ))}
              {plants.length === 0 && <li className="px-3 py-4 text-sm text-mint-200/70">No plants match &ldquo;{query}&rdquo;.</li>}
            </ul>
          </GlassCard>
          <div className="lg:col-span-2">{selected && <Guide key={selected} name={selected} />}</div>
        </div>
      )}
    </>
  );
}
