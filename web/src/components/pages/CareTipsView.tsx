"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Bug, Droplets, Leaf, Search, Sun } from "lucide-react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { ErrorBanner, GlassCard, PageHeader, Skeleton } from "@/components/ui";

export default function CareTipsView() {
  const { data, error, loading, retry } = useApi(() => api.careGroups());
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const groups = useMemo(() => (data ?? []).filter((g) => !q || g.label.toLowerCase().includes(q)
    || g.plants.some((p) => p.toLowerCase().includes(q))), [data, q]);

  return (
    <>
      <PageHeader eyebrow="Care Tips" title="Care Basics by Plant Type">
        Simple watering, light and pest advice for each type of plant. Tip: before watering, push a finger 3-5 cm into the
        soil - a photo can&apos;t show whether the soil is dry.
      </PageHeader>
      {error && <ErrorBanner message={error} onRetry={retry} />}
      {loading && <div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-64" /><Skeleton className="h-64" /></div>}
      {data && (
        <>
          <label className="mb-5 flex max-w-md items-center gap-2 rounded-xl border border-mint-200/15 bg-forest-950/50 px-3">
            <Search className="size-4 text-mint-200/60" aria-hidden /><span className="sr-only">Find a plant or plant type</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a plant or plant type…"
              className="h-10 w-full bg-transparent text-sm text-mint-100 placeholder:text-mint-200/40 focus:outline-none" />
          </label>
          {groups.length === 0 && <p className="text-sm text-mint-200/70">Nothing matches &ldquo;{query}&rdquo;.</p>}
          <div className="grid gap-4 md:grid-cols-2">
            {groups.map((g) => (
              <GlassCard key={g.key} as="article" className="p-5" aria-labelledby={`group-${g.key}`}>
                <h2 id={`group-${g.key}`} className="text-lg font-semibold text-mint-100">{g.label}</h2>
                <dl className="mt-3 grid gap-3 text-sm">
                  {[
                    { icon: Droplets, t: "Watering", v: g.watering },
                    { icon: Sun, t: "Light", v: g.light },
                    { icon: Bug, t: "Common pests", v: g.pests },
                    { icon: Leaf, t: "Common problems", v: g.problems },
                  ].map(({ icon: I, t, v }) => (
                    <div key={t} className="flex gap-2.5">
                      <I className="mt-0.5 size-4 shrink-0 text-leaf-400" aria-hidden />
                      <div><dt className="font-medium text-mint-100">{t}</dt><dd className="text-mint-200/80">{v}</dd></div>
                    </div>
                  ))}
                </dl>
                <ul className="mt-4 flex flex-wrap gap-1.5" aria-label={`Plants in ${g.label}`}>
                  {g.plants.map((p) => (
                    <li key={p}>
                      <Link href={`/plant-guide?name=${encodeURIComponent(p)}`}
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs ring-1 ${q && p.toLowerCase().includes(q) ? "bg-leaf-400/20 text-leaf-400 ring-leaf-400/50" : "text-mint-200/80 ring-mint-200/20 hover:ring-leaf-400/50"}`}>
                        {p}
                      </Link>
                    </li>
                  ))}
                </ul>
              </GlassCard>
            ))}
          </div>
        </>
      )}
    </>
  );
}
