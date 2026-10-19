"use client";

import { useId, useState } from "react";
import { ChevronDown, ClipboardList } from "lucide-react";
import type { Question } from "@/lib/api";

export type Answers = Record<string, string | string[]>;

/** Answers worth sending: chosen symptoms plus any question not left at its first ("Not sure / skip") option. */
export function answersToContext(questions: Question[], answers: Answers): Record<string, unknown> {
  const ctx: Record<string, unknown> = {};
  for (const q of questions) {
    const v = answers[q.field];
    if (q.multiple ? Array.isArray(v) && v.length : v && v !== q.options[0]) ctx[q.field] = v;
  }
  return ctx;
}

/** Optional symptoms and care conditions (same questions and options as the Streamlit app). */
export default function Questionnaire({ questions, answers, onChange }: {
  questions: Question[];
  answers: Answers;
  onChange: (a: Answers) => void;
}) {
  const [open, setOpen] = useState(false);
  const panel = useId();
  const answered = Object.keys(answersToContext(questions, answers)).length;
  const set = (field: string, value: string | string[]) => onChange({ ...answers, [field]: value });

  return (
    <div className="rounded-xl border border-mint-200/10 bg-forest-950/30">
      <button type="button" aria-expanded={open} aria-controls={panel} onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm">
        <span className="flex items-center gap-2 text-mint-100">
          <ClipboardList className="size-4 text-leaf-400" aria-hidden />
          Optional: tell us more about your plant
          {answered > 0 && <span className="rounded-full bg-leaf-400/15 px-2 text-xs text-leaf-400">{answered} answered</span>}
        </span>
        <ChevronDown className={`size-4 text-mint-200/70 transition ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <div id={panel} className="grid gap-4 border-t border-mint-200/10 p-4">
          <p className="text-xs text-mint-200/70">
            Your answers help with watering, feeding and insect advice - a photo can&apos;t show how wet the soil is or how the roots look.
          </p>
          {questions.map((q) => q.multiple ? (
            <fieldset key={q.field}>
              <legend className="mb-2 text-sm font-medium text-mint-100">{q.label}</legend>
              <div className="flex flex-wrap gap-2">
                {q.options.map((opt) => {
                  const list = (answers[q.field] as string[] | undefined) ?? [];
                  const on = list.includes(opt);
                  return (
                    <label key={opt} className={`cursor-pointer rounded-full px-3 py-1 text-xs ring-1 transition ${on ? "bg-leaf-400/20 text-leaf-400 ring-leaf-400/50" : "text-mint-200/80 ring-mint-200/20 hover:ring-mint-200/40"}`}>
                      <input type="checkbox" className="sr-only" checked={on}
                        onChange={() => set(q.field, on ? list.filter((x) => x !== opt) : [...list, opt])} />
                      {opt}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ) : null)}
          <div className="grid gap-3 sm:grid-cols-2">
            {questions.filter((q) => !q.multiple).map((q) => (
              <label key={q.field} className="text-sm">
                <span className="mb-1 block text-mint-200/85">{q.label}</span>
                <select value={(answers[q.field] as string) ?? q.options[0]} onChange={(e) => set(q.field, e.target.value)}
                  className="h-10 w-full rounded-lg border border-mint-200/15 bg-forest-950/60 px-2 text-mint-100 focus:border-leaf-400/60 focus:outline-none">
                  {q.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
