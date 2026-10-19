"use client";

import Link from "next/link";
import { useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { api, ApiError, type HistoryDetail } from "@/lib/api";
import { Bold, Chip, formatDate, pct, plainText, statusMeta } from "@/lib/format";
import { useApi } from "@/lib/useApi";
import { EmptyState, ErrorBanner, GlassCard, PageHeader, Skeleton } from "@/components/ui";

function download(record: HistoryDetail) {
  const blob = new Blob([JSON.stringify(record, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement("a"), { href: url, download: `plantvision-past-check-${record.id}.json` }).click();
  URL.revokeObjectURL(url);
}

function Detail({ id, onDeleted }: { id: number; onDeleted: () => void }) {
  const { data, error, loading, retry } = useApi(() => api.historyItem(id), String(id));
  const [confirm, setConfirm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const remove = async () => {
    try { await api.deleteHistoryItem(id); onDeleted(); }
    catch (e) { setActionError(e instanceof ApiError ? e.message : "We couldn't delete this check. Please try again."); }
  };

  if (loading) return <Skeleton className="h-80" />;
  if (error || !data) return <ErrorBanner message={error ?? "Not found."} onRetry={retry} />;
  const m = statusMeta(data.status);
  return (
    <GlassCard className="p-5" aria-labelledby="record-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="record-title" className="text-xl font-bold text-mint-100">{data.plant_name}</h2>
          <p className="text-sm text-mint-200/70">{formatDate(data.created_at)} · #{data.id}</p>
        </div>
        <Chip tone={m.tone}>{m.label}</Chip>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-mint-100/90"><Bold text={(data.recommendations.summary as string | undefined) ?? data.summary} /></p>
      <div className="mt-4 grid gap-2">
        {((data.recommendations.sections as { title: string; items: string[] }[] | undefined) ?? []).map((s) => (
          <details key={s.title} className="rounded-xl border border-mint-200/10 bg-forest-950/30 px-4 py-3">
            <summary className="cursor-pointer text-sm font-semibold text-mint-100">{s.title}</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-mint-200/85">{s.items.map((i) => <li key={i}><Bold text={plainText(i)} /></li>)}</ul>
          </details>
        ))}
      </div>
      {actionError && <p role="alert" className="mt-3 text-sm text-rose-300">{actionError}</p>}
      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" onClick={() => download(data)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-leaf-400/40 bg-leaf-400/10 px-3 py-2 text-sm font-medium text-leaf-400 hover:bg-leaf-400/20">
          <Download className="size-4" aria-hidden /> Save as file
        </button>
        {confirm ? (
          <>
            <button type="button" onClick={remove} className="rounded-lg bg-rose-500/80 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-500">Confirm delete</button>
            <button type="button" onClick={() => setConfirm(false)} className="rounded-lg px-3 py-2 text-sm text-mint-200 hover:bg-white/5">Cancel</button>
          </>
        ) : (
          <button type="button" onClick={() => setConfirm(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300/30 px-3 py-2 text-sm text-rose-200 hover:bg-rose-500/10">
            <Trash2 className="size-4" aria-hidden /> Delete this check
          </button>
        )}
      </div>
    </GlassCard>
  );
}

export default function HistoryView() {
  const [version, setVersion] = useState(0);
  const { data, error, loading, retry } = useApi(() => api.history(), String(version));
  const [selected, setSelected] = useState<number | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);

  const reload = () => { setSelected(null); setVersion((v) => v + 1); };
  const clearAll = async () => {
    try { await api.clearHistory(); setClearOpen(false); setUnderstood(false); reload(); }
    catch (e) { setClearError(e instanceof ApiError ? e.message : "We couldn't delete your past checks. Please try again."); }
  };
  const current = selected ?? data?.[0]?.id ?? null;

  return (
    <>
      <PageHeader eyebrow="Past Checks" title="Previous Plant Checks">
        Every check is saved automatically, on this computer only. Your photos are never saved - only the plant name, the
        result and the advice.
      </PageHeader>
      {loading && <div className="grid gap-4 lg:grid-cols-3"><Skeleton className="h-96" /><Skeleton className="h-96 lg:col-span-2" /></div>}
      {error && <ErrorBanner message={error} onRetry={retry} />}
      {data && data.length === 0 && (
        <EmptyState title="No plant checks yet">
          Your results will be saved here after each check. <Link href="/" className="font-semibold text-leaf-400">Check a plant →</Link>
        </EmptyState>
      )}
      {data && data.length > 0 && (
        <div className="grid gap-5 lg:grid-cols-3">
          <GlassCard className="p-3" aria-label="Saved checks">
            <ul className="max-h-[70vh] space-y-1 overflow-auto">
              {data.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => setSelected(r.id)} aria-current={current === r.id}
                    className={`w-full rounded-xl px-3 py-2.5 text-left transition ${current === r.id ? "bg-leaf-400/15 ring-1 ring-leaf-400/40" : "hover:bg-white/5"}`}>
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-mint-100">{r.plant_name}</span>
                      <Chip tone={statusMeta(r.status).tone}>{statusMeta(r.status).label}</Chip>
                    </span>
                    <span className="mt-0.5 block text-xs text-mint-200/70">
                      {formatDate(r.created_at)}{r.condition_name ? ` · ${r.condition_name}` : ""}{r.confidence !== null ? ` · score ${pct(r.confidence)}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-3 border-t border-mint-200/10 pt-3">
              {clearOpen ? (
                <div className="space-y-2 text-sm">
                  <label className="flex items-start gap-2 text-mint-200/85">
                    <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} className="mt-1 accent-rose-400" />
                    I understand this permanently deletes all {data.length} saved checks.
                  </label>
                  {clearError && <p role="alert" className="text-rose-300">{clearError}</p>}
                  <div className="flex gap-2">
                    <button type="button" disabled={!understood} onClick={clearAll}
                      className="rounded-lg bg-rose-500/80 px-3 py-1.5 font-semibold text-white disabled:opacity-40">Delete all</button>
                    <button type="button" onClick={() => setClearOpen(false)} className="rounded-lg px-3 py-1.5 text-mint-200 hover:bg-white/5">Cancel</button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setClearOpen(true)} className="text-sm text-rose-200/80 hover:text-rose-200">Delete all past checks…</button>
              )}
            </div>
          </GlassCard>
          <div className="lg:col-span-2">{current !== null && <Detail key={current} id={current} onDeleted={reload} />}</div>
        </div>
      )}
    </>
  );
}
