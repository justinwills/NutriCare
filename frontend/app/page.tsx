import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/Icons";
import { CinematicJourney } from "@/components/landing/CinematicJourney";
import { ScrollReveal } from "@/components/landing/ScrollReveal";

const FEATURES: { icon: IconName; eyebrow: string; title: string; copy: string }[] = [
  {
    icon: "scan",
    eyebrow: "01 · Capture",
    title: "Receipt to pantry, in moments.",
    copy: "Scan a receipt or order screenshot. NutriCare turns it into a pantry you can review and trust.",
  },
  {
    icon: "meal",
    eyebrow: "02 · Understand",
    title: "Meals connected to what you own.",
    copy: "Log what you eat while quantities update automatically, so your pantry always reflects real life.",
  },
  {
    icon: "doctor",
    eyebrow: "03 · Care",
    title: "Targets that travel with you.",
    copy: "Personal and clinical nutrition targets stay visible, actionable, and easier to discuss with your care team.",
  },
];

function Brand() {
  return (
    <Link href="/" className="inline-flex items-center gap-2.5 font-display text-xl font-semibold tracking-[-0.02em] text-ink">
      <span className="grid h-9 w-9 place-items-center rounded-[13px] bg-forest text-lime">
        <Icon name="leaf" className="h-[18px] w-[18px]" />
      </span>
      NutriCare
    </Link>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-paper">
      <div className="grid-wash pointer-events-none absolute inset-x-0 top-0 h-[760px]" />

      <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
        <Brand />
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="#how-it-works" className="hidden px-3 py-2 text-sm font-semibold text-ink/58 transition hover:text-ink sm:block">
            How it works
          </Link>
          <Link href="/login" className="px-3 py-2 text-sm font-semibold text-ink/70 transition hover:text-ink">
            Log in
          </Link>
          <Link
            href="/register"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-forest px-4 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(21,53,42,0.16)] transition hover:-translate-y-0.5 hover:bg-forest/92 sm:px-5"
          >
            Get started
          </Link>
        </div>
      </nav>

      <section className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 pb-20 pt-12 sm:px-8 sm:pt-16 lg:grid-cols-[0.93fr_1.07fr] lg:px-10 lg:pb-28 lg:pt-20">
        <ScrollReveal className="relative z-10 max-w-2xl">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-sage/20 bg-white/70 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-sage shadow-sm backdrop-blur">
            <Icon name="sparkles" className="h-3.5 w-3.5" />
            Food clarity, every day
          </div>
          <h1 className="font-display text-[clamp(3.45rem,7vw,6.9rem)] font-semibold leading-[0.89] tracking-[-0.065em] text-ink">
            Know your food.
            <span className="mt-1 block text-sage">Care for yourself.</span>
          </h1>
          <p className="mt-7 max-w-xl text-base leading-7 text-ink/62 sm:text-lg sm:leading-8">
            A calmer way to manage your pantry, log meals, and stay aligned with the nutrition targets that matter to you.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/register"
              className="group inline-flex min-h-13 items-center justify-center gap-3 rounded-2xl bg-clay px-6 text-sm font-bold text-white shadow-[0_12px_32px_rgba(231,101,69,0.22)] transition hover:-translate-y-0.5 hover:bg-clay/92"
            >
              Start your pantry
              <Icon name="arrow" className="h-4 w-4 transition group-hover:translate-x-1" />
            </Link>
            <Link
              href="#how-it-works"
              className="inline-flex min-h-13 items-center justify-center rounded-2xl border border-border-warm bg-white/75 px-6 text-sm font-bold text-ink shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
            >
              See how it works
            </Link>
          </div>
          <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-xs font-semibold text-ink/52">
            {['Receipt scanning', 'Smart alerts', 'Clinical targets'].map((item) => (
              <span key={item} className="inline-flex items-center gap-2">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-sage/10 text-sage">
                  <Icon name="check" className="h-3 w-3" />
                </span>
                {item}
              </span>
            ))}
          </div>
        </ScrollReveal>

        <ScrollReveal className="relative mx-auto w-full max-w-[620px] lg:mx-0" delay={130}>
          <div className="absolute -left-12 top-10 h-48 w-48 rounded-full bg-lime/65 blur-3xl" />
          <div className="absolute -right-8 bottom-8 h-44 w-44 rounded-full bg-clay/15 blur-3xl" />
          <div className="relative rotate-[1.5deg] rounded-[34px] border border-white/80 bg-forest p-3 shadow-[0_35px_90px_rgba(21,53,42,0.22)] sm:p-4">
            <div className="soft-noise overflow-hidden rounded-[25px] bg-[#edf1e8] p-4 sm:p-6">
              <div className="mb-7 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink/38">Today&apos;s pantry</p>
                  <p className="mt-1 font-display text-2xl font-semibold text-ink">Good afternoon, Maya</p>
                </div>
                <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-forest shadow-sm">
                  <Icon name="leaf" className="h-5 w-5" />
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-[1.15fr_0.85fr]">
                <div className="rounded-[22px] bg-white p-4 shadow-[0_12px_40px_rgba(23,37,30,0.07)]">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-semibold text-ink/48">Pantry health</p>
                      <p className="mt-1 font-display text-4xl font-semibold tracking-[-0.04em] text-ink">82%</p>
                    </div>
                    <span className="rounded-full bg-lime px-2.5 py-1 text-[10px] font-bold text-forest">Looking fresh</span>
                  </div>
                  <div className="mt-6 flex h-24 items-end gap-2" aria-hidden="true">
                    {[42, 66, 54, 82, 70, 91, 82].map((height, index) => (
                      <span key={index} className="flex-1 rounded-t-full bg-sage/16" style={{ height: `${height}%` }}>
                        <span className="block h-full rounded-t-full bg-sage" style={{ opacity: 0.52 + index * 0.06 }} />
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 flex justify-between text-[9px] font-semibold uppercase tracking-wider text-ink/30">
                    <span>Mon</span><span>Today</span>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <div className="rounded-[22px] bg-lime p-4 text-forest">
                    <Icon name="scan" className="h-6 w-6" />
                    <p className="mt-8 text-xs font-semibold text-forest/55">Quick action</p>
                    <p className="mt-1 font-display text-xl font-semibold leading-tight">Scan a receipt</p>
                  </div>
                  <div className="rounded-[22px] bg-clay p-4 text-white">
                    <p className="text-xs font-semibold text-white/65">Next expiring</p>
                    <div className="mt-3 flex items-center gap-3">
                      <span className="text-3xl" aria-hidden="true">🥬</span>
                      <div><p className="font-semibold">Baby spinach</p><p className="text-[11px] text-white/65">2 days left</p></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2.5">
                {[
                  ['14', 'items tracked'],
                  ['3', 'meals today'],
                  ['0', 'urgent alerts'],
                ].map(([value, label]) => (
                  <div key={label} className="rounded-2xl border border-border-warm/70 bg-white/65 px-3 py-3">
                    <p className="font-display text-xl font-semibold text-ink">{value}</p>
                    <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-ink/36">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="float-slow absolute -bottom-6 -left-2 hidden w-48 rounded-2xl border border-white bg-white/92 p-3 shadow-[0_18px_50px_rgba(23,37,30,0.14)] backdrop-blur sm:block">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-sage/10 text-sage"><Icon name="check" className="h-5 w-5" /></span>
              <div><p className="text-xs font-bold text-ink">Meal logged</p><p className="mt-0.5 text-[10px] text-ink/45">Pantry updated for you</p></div>
            </div>
          </div>
        </ScrollReveal>
      </section>

      <CinematicJourney />

      <section id="how-it-works" className="relative bg-forest px-5 py-20 text-white sm:px-8 lg:py-28">
        <div className="soft-noise absolute inset-0 opacity-50" />
        <div className="relative mx-auto max-w-7xl">
          <div className="mb-12 grid gap-5 lg:grid-cols-2 lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-lime/70">One connected rhythm</p>
              <h2 className="mt-4 max-w-xl font-display text-4xl font-semibold leading-[1.02] tracking-[-0.04em] sm:text-5xl lg:text-6xl">
                Less tracking. More understanding.
              </h2>
            </div>
            <p className="max-w-lg text-base leading-7 text-white/55 lg:justify-self-end">
              NutriCare connects the small actions—shopping, cooking, eating—into a useful picture of your everyday nutrition.
            </p>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            {FEATURES.map((feature, index) => (
              <article key={feature.title} className={`group rounded-[26px] border p-6 transition duration-300 hover:-translate-y-1 ${index === 1 ? 'border-lime/20 bg-lime text-forest' : 'border-white/10 bg-white/[0.055]'}`}>
                <div className="flex items-center justify-between">
                  <p className={`text-[10px] font-bold uppercase tracking-[0.17em] ${index === 1 ? 'text-forest/48' : 'text-white/38'}`}>{feature.eyebrow}</p>
                  <span className={`grid h-11 w-11 place-items-center rounded-2xl ${index === 1 ? 'bg-forest text-lime' : 'bg-white/8 text-lime'}`}>
                    <Icon name={feature.icon} className="h-5 w-5" />
                  </span>
                </div>
                <h3 className="mt-14 max-w-xs font-display text-2xl font-semibold leading-tight tracking-[-0.02em]">{feature.title}</h3>
                <p className={`mt-4 text-sm leading-6 ${index === 1 ? 'text-forest/62' : 'text-white/48'}`}>{feature.copy}</p>
              </article>
            ))}
          </div>

          <div className="mt-16 flex flex-col items-start justify-between gap-6 border-t border-white/10 pt-8 sm:flex-row sm:items-center">
            <div><p className="font-display text-2xl font-semibold">Ready to make food feel simpler?</p><p className="mt-1 text-sm text-white/45">Set up your free NutriCare account in a minute.</p></div>
            <Link href="/register" className="group inline-flex min-h-12 items-center gap-3 rounded-2xl bg-white px-5 text-sm font-bold text-forest transition hover:-translate-y-0.5">
              Create your account <Icon name="arrow" className="h-4 w-4 transition group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
