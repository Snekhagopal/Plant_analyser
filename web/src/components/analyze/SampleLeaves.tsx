"use client";

import Image from "next/image";
import { useState } from "react";
import { ArrowRight, Leaf } from "lucide-react";
import { GlassCard, CardTitle } from "@/components/ui";
import { SAMPLE_LEAVES, type SampleLeaf } from "@/lib/samples";

/** Real, labelled PlantVillage test images. Choosing one only fills in the form; nothing is pre-computed. */
export default function SampleLeaves({ activeSlug, onPick, disabled }: {
  activeSlug: string | null;
  onPick: (s: SampleLeaf) => void;
  disabled?: boolean;
}) {
  const [all, setAll] = useState(false);
  const shown = all ? SAMPLE_LEAVES : SAMPLE_LEAVES.slice(0, 5);
  return (
    <GlassCard className="flex h-full min-w-0 flex-col p-5" aria-labelledby="samples-title">
      <CardTitle id="samples-title" icon={Leaf} title="Sample Leaves" subtitle="Try a real example photo"
        action={
          <button type="button" onClick={() => setAll((a) => !a)}
            className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-leaf-400 hover:text-lime-glow">
            {all ? "Show less" : "View all"} <ArrowRight className="size-4" aria-hidden />
          </button>
        } />
      <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-3 xl:grid-cols-5">
        {shown.map((s) => (
          <li key={s.slug}>
            <button type="button" disabled={disabled} onClick={() => onPick(s)} aria-pressed={activeSlug === s.slug}
              className={`group w-full rounded-xl p-1 text-center transition disabled:opacity-50 ${activeSlug === s.slug ? "bg-leaf-400/20 ring-2 ring-leaf-400" : "hover:bg-white/5"}`}>
              <span className="relative block aspect-square overflow-hidden rounded-lg ring-1 ring-mint-200/15">
                <Image src={s.src} alt={`${s.plant} leaf labelled ${s.condition.toLowerCase()}`} fill sizes="120px"
                  className="object-cover transition group-hover:scale-105" />
              </span>
              <span className="mt-1.5 block text-xs font-semibold text-mint-100">{s.plant}</span>
              <span className="block text-[11px] leading-tight text-mint-200/65">{s.condition}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-auto pt-3 text-[11px] leading-snug text-mint-200/55">
        Real photos from a public plant-photo collection, labelled with the problem each one shows. The app never saw
        them while learning. Picking one fills in the form - press Check My Plant to run the real check.
      </p>
    </GlassCard>
  );
}
