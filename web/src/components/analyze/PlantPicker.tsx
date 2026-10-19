"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown, Sprout } from "lucide-react";
import type { PlantOption } from "@/lib/api";

/**
 * Searchable plant selector (the plant name is required; the app never guesses it from the photo).
 * Users can pick from the list or keep any typed name, as in the Streamlit app.
 */
export default function PlantPicker({ options, value, onChange, error }: {
  options: PlantOption[];
  value: string;
  onChange: (name: string) => void;
  error?: string | null;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const [open, setOpen] = useState(false);
  const [typing, setTyping] = useState(false);   // filter only while the user is typing
  const [active, setActive] = useState(0);
  const wrapper = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    return typing && q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options;
  }, [options, value, typing]);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (!wrapper.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const choose = (name: string) => { onChange(name); setTyping(false); setOpen(false); };
  const selected = options.find((o) => o.name === value);

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter" && open && filtered[active]) { e.preventDefault(); choose(filtered[active].name); }
    else if (e.key === "Escape") setOpen(false);
  };

  return (
    <div ref={wrapper} className="relative">
      <label htmlFor={id} className="mb-1.5 flex items-center justify-between gap-2 text-sm font-semibold text-mint-100">
        <span>Plant name <span className="text-rose-300" aria-hidden>*</span></span>
        {selected && (selected.disease_check
          ? <span className="rounded-full bg-leaf-400/15 px-2 py-0.5 text-[10px] font-semibold text-leaf-400">Disease check</span>
          : <span className="rounded-full bg-sky-400/15 px-2 py-0.5 text-[10px] font-semibold text-sky-300">General check</span>)}
      </label>
      <div className={`flex items-center gap-2 rounded-xl border bg-forest-950/50 px-3 ${error ? "border-rose-300/60" : "border-mint-200/15 focus-within:border-leaf-400/60"}`}>
        <Sprout className="size-5 shrink-0 text-leaf-400" aria-hidden />
        <input id={id} role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list" required
          aria-activedescendant={open && filtered[active] ? `${id}-opt-${active}` : undefined}
          aria-invalid={!!error} autoComplete="off" placeholder="Search plants…"
          value={value}
          onChange={(e) => { onChange(e.target.value); setTyping(true); setOpen(true); setActive(0); }}
          onFocus={() => setOpen(true)} onKeyDown={onKey}
          className="h-11 w-full bg-transparent text-sm text-mint-100 placeholder:text-mint-200/40 focus:outline-none" />
        <button type="button" tabIndex={-1} aria-label="Show plants" onClick={() => setOpen((o) => !o)}>
          <ChevronDown className="size-4 text-mint-200/70" aria-hidden />
        </button>
      </div>
      {error && <p role="alert" className="mt-1.5 text-sm text-rose-300">{error}</p>}
      {open && (
        <ul id={listId} role="listbox"
          className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-xl border border-mint-200/15 bg-forest-900/95 p-1 shadow-2xl backdrop-blur-xl">
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-sm text-mint-200/70">Not in our list - we&apos;ll use &ldquo;{value}&rdquo; and give general advice.</li>
          )}
          {filtered.map((o, i) => (
            <li key={o.name} id={`${id}-opt-${i}`} role="option" aria-selected={o.name === value}
              onMouseDown={(e) => { e.preventDefault(); choose(o.name); }} onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm ${i === active ? "bg-leaf-400/15 text-mint-100" : "text-mint-200/85"}`}>
              {o.name}
              {o.disease_check && <span className="rounded-full bg-leaf-400/15 px-2 py-0.5 text-[10px] font-semibold text-leaf-400">Disease check</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
