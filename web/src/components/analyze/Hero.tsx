import Image from "next/image";
import { Bug, Flower2, Leaf, ScanEye, ShieldCheck, Sparkles, Sprout } from "lucide-react";
import { HERO_IMAGE } from "@/lib/brand";

const FEATURES = [
  { icon: Bug, title: "Disease", sub: "Check" },
  { icon: ScanEye, title: "Insect", sub: "Check" },
  { icon: ShieldCheck, title: "Care", sub: "Advice" },
  { icon: Flower2, title: "See What", sub: "Was Checked" },
];

export default function Hero() {
  return (
    <section aria-labelledby="hero-title"
      className="relative isolate overflow-hidden rounded-3xl border border-mint-200/10 px-6 pb-10 pt-8 sm:px-10 lg:min-h-[400px] lg:pb-14">
      {/* Backdrop: the generated hero photo when available, otherwise a botanical gradient. */}
      {HERO_IMAGE ? (
        <Image src={HERO_IMAGE} alt="" fill priority
          sizes="(min-width: 1024px) calc(100vw - 18rem), 100vw"
          className="-z-20 object-cover object-[72%_62%]" />
      ) : (
        <div aria-hidden className="absolute inset-0 -z-20 bg-[radial-gradient(520px_340px_at_78%_18%,rgba(214,255,150,0.30),transparent_65%),radial-gradient(700px_420px_at_70%_60%,rgba(52,160,90,0.45),transparent_70%),linear-gradient(115deg,#04150c_0%,#0a2d1a_45%,#145a30_75%,#0d3a20_100%)]">
          <Leaf className="absolute right-[18%] top-6 size-48 rotate-12 text-leaf-400/20" />
          <Leaf className="absolute right-[4%] top-24 size-36 -rotate-45 text-emerald-300/15" />
          <Sprout className="absolute bottom-0 right-[30%] size-40 text-leaf-500/15" />
        </div>
      )}
      {/* Dark-green fade for text contrast: full-width on small screens (text covers the plant),
          left-to-right on wide screens so the plant stays bright on the right. */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-forest-950/75 md:bg-transparent md:bg-gradient-to-r md:from-forest-950/95 md:via-forest-950/75 md:via-50% md:to-transparent md:to-80% xl:via-forest-950/65 xl:via-40% xl:to-70%" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-1/3 bg-gradient-to-t from-forest-950/70 to-transparent" />

      <p className="hidden rotate-[-8deg] font-script text-3xl leading-tight text-mint-100/90 [text-shadow:0_2px_12px_rgba(0,0,0,0.7)] xl:absolute xl:right-10 xl:top-14 xl:block">
        Green Plants<br />Brighter Tomorrows
      </p>

      <div className="max-w-2xl">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-leaf-400/40 bg-leaf-400/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-leaf-400">
          <Sparkles className="size-3.5" aria-hidden /> AI Plant Doctor
        </span>
        <h1 id="hero-title" className="mt-4 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
          <span className="block bg-gradient-to-r from-white to-mint-200 bg-clip-text text-transparent">Healthy Plants</span>
          <span className="text-gradient block">Happier Days</span>
        </h1>
        <p className="mt-4 max-w-xl text-base text-mint-100/90 sm:text-lg">
          Take a photo of a leaf or your whole plant to check its health. We check for diseases on 14 food crops, and
          for leaf problems and insects on 140+ plants, with care advice for each.
        </p>
        <ul className="mt-6 grid grid-cols-2 gap-4 sm:flex sm:flex-wrap sm:gap-8">
          {FEATURES.map(({ icon: I, title, sub }) => (
            <li key={title} className="flex items-center gap-2.5">
              <span className="grid size-10 place-items-center rounded-full bg-leaf-400/15 text-leaf-400 ring-1 ring-leaf-400/30">
                <I className="size-5" aria-hidden />
              </span>
              <span className="text-sm leading-tight"><span className="block font-semibold text-mint-100">{title}</span>
                <span className="text-mint-200/70">{sub}</span></span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
