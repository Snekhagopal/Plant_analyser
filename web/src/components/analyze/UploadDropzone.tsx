"use client";

import Image from "next/image";
import { useId, useRef, useState, type DragEvent } from "react";
import { CloudUpload, X } from "lucide-react";

export const ACCEPT = ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";

/** Client-side pre-check only; the server validates every upload again. */
export function precheckFile(file: File, maxMb: number, extensions: string[]): string | null {
  const ext = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "";
  if (!extensions.includes(ext)) return "This type of file can't be used. Please choose a JPG, PNG or WebP photo.";
  if (file.size > maxMb * 1024 * 1024) return `This photo is too large (over ${maxMb} MB). Please choose a smaller photo.`;
  if (file.size === 0) return "This file is empty. Please choose another photo.";
  return null;
}

export default function UploadDropzone({ previewUrl, fileName, onFile, onClear, error, maxMb, sampleNote }: {
  previewUrl: string | null;
  fileName: string | null;
  onFile: (file: File) => void;
  onClear: () => void;
  error?: string | null;
  maxMb: number;
  sampleNote?: string | null;
}) {
  const inputId = useId();
  const errorId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  };

  if (previewUrl) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-leaf-400/30 bg-forest-950/40">
        <div className="relative h-48 w-full sm:h-56">
          <Image src={previewUrl} alt="Selected plant photo" fill unoptimized className="object-contain" />
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-mint-200/10 px-3 py-2 text-xs text-mint-200/80">
          <span className="truncate">{sampleNote ?? fileName}</span>
          <button type="button" onClick={onClear} className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 hover:bg-white/10">
            <X className="size-3.5" aria-hidden /> Remove
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <label htmlFor={inputId}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex h-48 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 text-center transition sm:h-56 ${
          dragging ? "border-leaf-400 bg-leaf-400/10" : error ? "border-rose-300/60 bg-rose-500/5" : "border-mint-200/25 bg-forest-950/30 hover:border-leaf-400/60"
        }`}>
        <CloudUpload className="size-9 text-mint-200" aria-hidden />
        <span className="text-sm text-mint-100">Click to choose a photo, or drag it here</span>
        <span className="text-xs text-mint-200/60">JPG, PNG or WebP (max {maxMb} MB) · leaf close-up or whole plant</span>
      </label>
      <input ref={input} id={inputId} type="file" accept={ACCEPT} className="sr-only" aria-describedby={error ? errorId : undefined}
        aria-label="Photo of your plant or leaf"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
      {error && <p id={errorId} role="alert" className="mt-2 text-sm text-rose-300">{error}</p>}
    </div>
  );
}
