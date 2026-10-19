import type { ComponentType, ReactNode } from "react";
import { AlertTriangle, Loader2, RotateCcw, Sprout } from "lucide-react";

type Icon = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

export function GlassCard({ children, className = "", as: Tag = "section", ...rest }:
  { children: ReactNode; className?: string; as?: "section" | "div" | "article"; "aria-labelledby"?: string }) {
  return <Tag className={`glass rounded-2xl ${className}`} {...rest}>{children}</Tag>;
}

export function IconBubble({ icon: I, className = "" }: { icon: Icon; className?: string }) {
  return (
    <span className={`grid size-10 shrink-0 place-items-center rounded-full bg-leaf-400/15 text-leaf-400 ring-1 ring-leaf-400/30 ${className}`}>
      <I className="size-5" aria-hidden />
    </span>
  );
}

export function CardTitle({ icon, title, subtitle, id, action }:
  { icon?: Icon; title: string; subtitle?: ReactNode; id?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        {icon && <IconBubble icon={icon} />}
        <div>
          <h2 id={id} className="text-base font-semibold text-mint-100 sm:text-lg">{title}</h2>
          {subtitle && <p className="text-sm text-mint-200/70">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function StepBadge({ n }: { n: number }) {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-mint-200 to-leaf-400 text-base font-bold text-forest-900 shadow-[0_0_18px_rgba(127,220,106,0.45)]">
      {n}
    </span>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-sm text-mint-200/80">
      <Loader2 className="size-4 animate-spin" aria-hidden /> {label}
    </span>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-white/5 ${className}`} aria-hidden />;
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-rose-300/30 bg-rose-500/10 p-4 text-sm text-rose-100 sm:flex-row sm:items-center sm:justify-between">
      <span className="flex items-start gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />{message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry}
          className="inline-flex items-center gap-1.5 self-start rounded-lg border border-rose-200/30 px-3 py-1.5 font-medium hover:bg-rose-400/10">
          <RotateCcw className="size-3.5" aria-hidden /> Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-mint-200/20 px-6 py-10 text-center">
      <Sprout className="size-8 text-leaf-400" aria-hidden />
      <p className="font-semibold text-mint-100">{title}</p>
      {children && <div className="max-w-md text-sm text-mint-200/70">{children}</div>}
    </div>
  );
}

export function PageHeader({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <header className="mb-6">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-leaf-400">{eyebrow}</p>
      <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-mint-100 sm:text-4xl">{title}</h1>
      {children && <div className="mt-2 max-w-3xl text-mint-200/75">{children}</div>}
    </header>
  );
}

export function Disclaimer() {
  return (
    <p className="rounded-2xl border border-amber-300/20 bg-amber-400/5 p-4 text-xs leading-relaxed text-amber-100/80">
      <strong className="text-amber-200">This is not a diagnosis.</strong> Results from photos can be wrong, especially when
      a photo looks different from the photos the app learned from. Before using any chemical product, check with a local
      plant expert (for example a plant clinic, garden centre or agricultural advice service), and always follow the
      product label and local rules.
    </p>
  );
}
