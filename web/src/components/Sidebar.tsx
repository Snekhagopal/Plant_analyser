"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BookOpen, Bug, HeartHandshake, History, Info, Leaf, Menu, ScanSearch, Sprout, X } from "lucide-react";
import { PRODUCT_NAME, TAGLINE } from "@/lib/brand";

export const NAV = [
  { href: "/", label: "Check a Plant", icon: ScanSearch },
  { href: "/history", label: "Past Checks", icon: History },
  { href: "/plant-guide", label: "Plant Guide", icon: BookOpen },
  { href: "/care-tips", label: "Care Tips", icon: HeartHandshake },
  { href: "/disease-library", label: "Plant Diseases", icon: Bug },
  { href: "/about", label: "About", icon: Info },
];

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label={`${PRODUCT_NAME} home`}>
      <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-leaf-400 to-emerald-600 shadow-[0_0_20px_rgba(127,220,106,0.35)]">
        <Leaf className="size-6 text-forest-950" aria-hidden />
      </span>
      <span>
        <span className="block text-xl font-extrabold tracking-tight text-mint-100">{PRODUCT_NAME}</span>
        <span className="block whitespace-nowrap text-[10.5px] text-mint-200/70">{TAGLINE}</span>
      </span>
    </Link>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <ul className="flex flex-col gap-1.5">
      {NAV.map(({ href, label, icon: I }) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <li key={href}>
            <Link href={href} onClick={onNavigate} aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
                active
                  ? "bg-gradient-to-r from-leaf-500/35 to-emerald-700/25 text-mint-100 ring-1 ring-leaf-400/40 shadow-[0_0_24px_rgba(92,201,77,0.18)]"
                  : "text-mint-200/80 hover:bg-white/5 hover:text-mint-100"
              }`}>
              <I className="size-5" aria-hidden /> {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function SpeciesCard() {
  return (
    <div className="glass rounded-2xl p-4">
      <Sprout className="size-7 text-leaf-400" aria-hidden />
      <p className="mt-3 text-2xl font-extrabold text-mint-100">14</p>
      <p className="text-sm font-semibold text-mint-100">Food crops with a disease check</p>
      <p className="mt-1 text-xs text-mint-200/70">Leaf, insect and care help for 140+ plants</p>
    </div>
  );
}

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  return (
    <>
      {/* Desktop: fixed left navigation */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col justify-between border-r border-mint-200/10 bg-forest-950/70 px-4 py-6 backdrop-blur-xl lg:flex">
        <div className="flex flex-col gap-8">
          <Logo />
          <nav aria-label="Main"><NavLinks /></nav>
        </div>
        <SpeciesCard />
      </aside>

      {/* Mobile / tablet: top bar with a drawer */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-mint-200/10 bg-forest-950/80 px-4 py-3 backdrop-blur-xl lg:hidden">
        <Logo />
        <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open}
          className="rounded-lg p-2 text-mint-100 hover:bg-white/5">
          <Menu className="size-6" aria-hidden />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col justify-between bg-forest-900 px-4 py-6 shadow-2xl">
            <div className="flex flex-col gap-8">
              <div className="flex items-center justify-between">
                <Logo />
                <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="rounded-lg p-2 hover:bg-white/5">
                  <X className="size-5" aria-hidden />
                </button>
              </div>
              <nav aria-label="Main"><NavLinks onNavigate={() => setOpen(false)} /></nav>
            </div>
            <SpeciesCard />
          </div>
        </div>
      )}
    </>
  );
}
