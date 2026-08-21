import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icons";

export function AuthScaffold({
  children,
  eyebrow,
  title,
  description,
}: {
  children: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <main className="grid min-h-screen bg-paper lg:grid-cols-[0.92fr_1.08fr]">
      <section className="relative hidden min-h-screen overflow-hidden bg-forest p-10 text-white lg:flex lg:flex-col xl:p-14">
        <div className="soft-noise absolute inset-0 opacity-60" />
        <div className="absolute -left-24 top-1/3 h-80 w-80 rounded-full bg-lime/10 blur-3xl" />
        <Link href="/" className="relative inline-flex items-center gap-3 self-start font-display text-xl font-semibold">
          <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-lime text-forest"><Icon name="leaf" className="h-5 w-5" /></span>
          NutriCare
        </Link>

        <div className="relative my-auto max-w-lg py-16">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-lime/65">A healthier routine, held together</p>
          <blockquote className="mt-7 font-display text-4xl font-semibold leading-[1.08] tracking-[-0.035em] xl:text-5xl">
            “The best nutrition plan is the one that fits into real life.”
          </blockquote>

          <div className="mt-10 rounded-[26px] border border-white/10 bg-white/[0.06] p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div><p className="text-xs font-semibold text-white/45">Weekly rhythm</p><p className="mt-1 text-lg font-semibold">You&apos;re building momentum</p></div>
              <span className="rounded-full bg-lime px-3 py-1.5 text-xs font-bold text-forest">6 day streak</span>
            </div>
            <div className="mt-6 flex items-end gap-2">
              {[48, 70, 58, 82, 72, 94, 76].map((height, index) => (
                <div key={index} className="flex-1">
                  <div className="rounded-full bg-white/10" style={{ height: `${height}px` }}>
                    <div className="h-full rounded-full bg-lime/60" style={{ opacity: 0.45 + index * 0.07 }} />
                  </div>
                  <p className="mt-2 text-center text-[9px] font-semibold text-white/28">{['M','T','W','T','F','S','S'][index]}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="relative text-xs text-white/30">Your information stays in your account and under your control.</p>
      </section>

      <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-10 sm:px-8 lg:px-12">
        <div className="grid-wash pointer-events-none absolute inset-0" />
        <div className="relative w-full max-w-[470px]">
          <Link href="/" className="mb-10 inline-flex items-center gap-2 font-display text-lg font-semibold text-ink lg:hidden">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-forest text-lime"><Icon name="leaf" className="h-4 w-4" /></span>
            NutriCare
          </Link>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-sage">{eyebrow}</p>
          <h1 className="mt-3 font-display text-4xl font-semibold leading-tight tracking-[-0.04em] text-ink sm:text-5xl">{title}</h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-ink/55">{description}</p>
          <div className="mt-8">{children}</div>
        </div>
      </section>
    </main>
  );
}
