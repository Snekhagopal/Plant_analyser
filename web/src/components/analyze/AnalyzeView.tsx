"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, ChevronDown, Loader2, Sparkles } from "lucide-react";
import { api, ApiError, type AnalyzeResponse, type Meta, type PhotoType } from "@/lib/api";
import { sampleAsFile, type SampleLeaf } from "@/lib/samples";
import { ErrorBanner, GlassCard, Skeleton, StepBadge } from "@/components/ui";
import ResultsDashboard from "@/components/results/ResultsDashboard";
import Hero from "./Hero";
import PlantPicker from "./PlantPicker";
import Questionnaire, { answersToContext, type Answers } from "./Questionnaire";
import SampleLeaves from "./SampleLeaves";
import UploadDropzone, { precheckFile } from "./UploadDropzone";

type Errors = { file?: string | null; plant?: string | null; form?: string | null };

export default function AnalyzeView() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [sample, setSample] = useState<SampleLeaf | null>(null);
  const [plant, setPlant] = useState("");
  const [otherName, setOtherName] = useState("");
  const [photoType, setPhotoType] = useState<PhotoType>("leaf");
  const [answers, setAnswers] = useState<Answers>({});
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ data: AnalyzeResponse; at: Date } | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const [metaAttempt, setMetaAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    api.meta()
      .then((m) => { if (live) { setMeta(m); setMetaError(null); } })
      .catch((e: unknown) => { if (live) setMetaError(e instanceof ApiError ? e.message : String(e)); });
    return () => { live = false; };
  }, [metaAttempt]);
  const retryMeta = () => { setMetaError(null); setMetaAttempt((n) => n + 1); };

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const maxMb = meta?.max_upload_mb ?? 10;
  const extensions = meta?.allowed_extensions ?? ["jpeg", "jpg", "png"];
  const isOther = meta ? plant === meta.other_option : false;

  const takeFile = (f: File, fromSample: SampleLeaf | null = null) => {
    const problem = precheckFile(f, maxMb, extensions);
    setErrors((e) => ({ ...e, file: problem, form: null }));
    if (problem) return;
    setFile(f);
    setSample(fromSample);
    setPreview(URL.createObjectURL(f));
  };

  const clearFile = () => { setFile(null); setPreview(null); setSample(null); };

  const pickSample = async (s: SampleLeaf) => {
    try {
      takeFile(await sampleAsFile(s), s);
      setPlant(s.plant);
      setPhotoType("leaf");
      setErrors({});
    } catch {
      setErrors((e) => ({ ...e, file: "The sample image could not be loaded." }));
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const plantName = (isOther ? otherName : plant).trim();
    const next: Errors = {
      file: file ? null : "Please add a photo of your plant or leaf.",
      plant: plantName ? null : (isOther ? "Please type the plant's name." : "Please choose or type your plant's name."),
    };
    setErrors(next);
    setApiError(null);
    if (!file || next.plant) return;
    setBusy(true);
    try {
      const data = await api.analyze({ file, plantName, photoType, context: meta ? answersToContext(meta.questions, answers) : {} });
      setResult({ data, at: new Date() });
      requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (err) {
      if (err instanceof ApiError && (err.status === 422 || err.status === 413)) {
        setErrors({ form: err.message });     // invalid input: shown next to the form, never as a result
      } else {
        setApiError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <Hero />
      {metaError && <ErrorBanner message={metaError} onRetry={retryMeta} />}

      <div className="grid gap-5 lg:grid-cols-3">
        <form onSubmit={submit} noValidate aria-label="Check a plant photo"
          className="glass grid min-w-0 gap-6 rounded-2xl p-5 md:grid-cols-2 lg:col-span-2">
          <div className="min-w-0">
            <div className="mb-4 flex items-start gap-3">
              <StepBadge n={1} />
              <div><h2 className="text-lg font-semibold text-mint-100">Upload a Plant Photo</h2>
                <p className="text-sm text-mint-200/70">Leaf close-up or whole plant</p></div>
            </div>
            <UploadDropzone previewUrl={preview} fileName={file?.name ?? null} onFile={(f) => takeFile(f)} onClear={clearFile}
              error={errors.file} maxMb={maxMb}
              sampleNote={sample ? `Example photo: ${sample.plant} · ${sample.condition}` : null} />
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex items-start gap-3">
              <StepBadge n={2} />
              <div><h2 className="text-lg font-semibold text-mint-100">Plant Information</h2>
                <p className="text-sm text-mint-200/70">Tell us which plant it is</p></div>
            </div>
            {meta ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-1">
                  <PlantPicker options={meta.plants} value={plant} onChange={(v) => { setPlant(v); setErrors((e) => ({ ...e, plant: null })); }}
                    error={isOther ? null : errors.plant} />
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-semibold text-mint-100">What does your photo show?</span>
                    <span className="relative block">
                      <select value={photoType} onChange={(e) => setPhotoType(e.target.value as PhotoType)}
                        className="h-11 w-full appearance-none rounded-xl border border-mint-200/15 bg-forest-950/50 px-3 pr-9 text-sm text-mint-100 focus:border-leaf-400/60 focus:outline-none">
                        {Object.entries(meta.photo_types).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-3.5 size-4 text-mint-200/70" aria-hidden />
                    </span>
                  </label>
                </div>
                {isOther && (
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-semibold text-mint-100">Type the plant&apos;s name <span className="text-rose-300" aria-hidden>*</span></span>
                    <input value={otherName} maxLength={80} onChange={(e) => setOtherName(e.target.value)} placeholder="e.g. Peace lily, Basil, Rose"
                      aria-invalid={!!errors.plant}
                      className="h-11 w-full rounded-xl border border-mint-200/15 bg-forest-950/50 px-3 text-sm text-mint-100 placeholder:text-mint-200/40 focus:border-leaf-400/60 focus:outline-none" />
                    {errors.plant && <span role="alert" className="mt-1.5 block text-sm text-rose-300">{errors.plant}</span>}
                  </label>
                )}
                {photoType === "whole_plant" && (
                  <p className="rounded-lg bg-sky-400/10 px-3 py-2 text-xs text-sky-200">
                    Whole-plant photos are fine for a general check. But the disease check works best on a close-up of one
                    leaf, so with a whole-plant photo any disease result is only a rough guess. For a disease check, take a
                    close-up of one affected leaf.
                  </p>
                )}
                <Questionnaire questions={meta.questions} answers={answers} onChange={setAnswers} />
              </>
            ) : !metaError ? (
              <div className="grid gap-3"><Skeleton className="h-11" /><Skeleton className="h-11" /><Skeleton className="h-11" /></div>
            ) : null}

            {errors.form && <p role="alert" className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{errors.form}</p>}
            <button type="submit" disabled={busy || !meta}
              className="mt-auto inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-mint-200 via-leaf-400 to-lime-glow text-base font-bold text-forest-950 shadow-[0_0_28px_rgba(127,220,106,0.35)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60">
              {busy ? <><Loader2 className="size-5 animate-spin" aria-hidden /> Checking your plant…</> : <><Sparkles className="size-5" aria-hidden /> Check My Plant <ArrowRight className="size-5" aria-hidden /></>}
            </button>
          </div>
        </form>

        <SampleLeaves activeSlug={sample?.slug ?? null} onPick={pickSample} disabled={busy} />
      </div>

      <div ref={resultsRef} className="scroll-mt-20" aria-live="polite" aria-busy={busy}>
        {apiError && <ErrorBanner message={apiError} />}
        {busy && (
          <div className="grid gap-5 lg:grid-cols-3">
            <div className="glass flex flex-col gap-4 rounded-2xl p-5 lg:col-span-2">
              <p className="text-sm text-mint-200/80">Checking your plant… This usually takes a few seconds (the first check after starting the app can take a little longer).</p>
              <div className="grid gap-4 md:grid-cols-3"><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /></div>
              <div className="grid gap-4 md:grid-cols-3"><Skeleton className="h-48" /><Skeleton className="h-48" /><Skeleton className="h-48" /></div>
            </div>
            <div className="flex flex-col gap-5"><Skeleton className="h-56" /><Skeleton className="h-64" /></div>
          </div>
        )}
        {!busy && result && <ResultsDashboard result={result.data} analyzedAt={result.at} />}
        {!busy && !result && !apiError && (
          <GlassCard className="p-6 text-center text-sm text-mint-200/70">
            Your results will appear here: overall health, what the leaves look like, any insects, a disease check for 14
            food crops, and care advice.
          </GlassCard>
        )}
      </div>
    </div>
  );
}
