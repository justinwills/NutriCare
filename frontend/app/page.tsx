import Image from "next/image";
import Link from "next/link";
import { CinematicJourney } from "@/components/landing/CinematicJourney";
import { ScrollReveal } from "@/components/landing/ScrollReveal";
import { Icon } from "@/components/ui/Icons";

const FEATURES = [
  {
    number: "01",
    label: "Pantry intelligence",
    title: "Your groceries, finally in motion.",
    copy: "Scan a receipt and NutriCare turns the static list into a living pantry—quantities, freshness, and the next useful action included.",
  },
  {
    number: "02",
    label: "Effortless logging",
    title: "Meals become part of the picture.",
    copy: "Log what you eat without maintaining two separate systems. Pantry stock and daily nutrition move together automatically.",
  },
  {
    number: "03",
    label: "Personal care",
    title: "Health targets that feel human.",
    copy: "Keep personal and clinician-set goals visible in everyday language, ready for the decisions you are making right now.",
  },
];

function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className={`film-brand ${light ? "film-brand-light" : ""}`} aria-label="NutriCare home">
      <span className="film-brand-mark"><Icon name="leaf" className="h-4 w-4" /></span>
      <span>NutriCare</span>
    </Link>
  );
}

export default function Home() {
  return (
    <main className="film-home">
      <section className="film-hero" aria-labelledby="hero-title">
        <Image
          src="/images/nutricare-hero.png"
          alt="A person preparing avocado toast with fresh greens in a warm home kitchen"
          fill
          preload
          quality={95}
          sizes="100vw"
          className="film-hero-image"
        />
        <div className="film-hero-shade" />
        <div className="film-grain" />

        <nav className="film-nav" aria-label="Main navigation">
          <Brand light />
          <div className="film-nav-center">
            <Link href="#story">Story</Link>
            <Link href="#system">System</Link>
            <Link href="#care">Care</Link>
          </div>
          <div className="film-nav-actions">
            <Link href="/login">Log in</Link>
            <Link href="/register" className="film-nav-cta">Begin <Icon name="arrow" className="h-3.5 w-3.5" /></Link>
          </div>
        </nav>

        <div className="film-hero-copy">
          <p className="film-kicker"><span /> Pantry · Meals · Care</p>
          <h1 id="hero-title" className="film-hero-title">
            <span>Eat with</span>
            <span><em>intention.</em></span>
          </h1>
        </div>

        <div className="film-hero-foot">
          <p>One living system for the food you buy,<br />the meals you make, and the care you need.</p>
          <Link href="#story" className="film-scroll-cue">
            <span>Scroll to enter</span>
            <i aria-hidden="true" />
          </Link>
          <p className="film-hero-index">NC / 2026<br />Everyday nutrition</p>
        </div>
      </section>

      <div className="film-marquee" aria-hidden="true">
        <div>
          <span>KNOW WHAT YOU HAVE</span><i>✳</i><span>MAKE WHAT YOU NEED</span><i>✳</i><span>CARE FOR WHAT MATTERS</span><i>✳</i>
          <span>KNOW WHAT YOU HAVE</span><i>✳</i><span>MAKE WHAT YOU NEED</span><i>✳</i><span>CARE FOR WHAT MATTERS</span><i>✳</i>
        </div>
      </div>

      <section className="film-motion-interlude" aria-label="The everyday in motion">
        <div className="film-motion-shade" />
        <div className="film-grain" />
        <div className="film-motion-copy">
          <h2>MAKE THE<br /><em>EVERYDAY</em><br />VISIBLE.</h2>
        </div>
        <div className="film-motion-foot"><span>SHOPPING → COOKING → EATING</span></div>
      </section>

      <section id="story" className="film-manifesto">
        <ScrollReveal className="film-manifesto-copy">
          <p className="film-manifesto-lead">Food is never just a number.</p>
          <h2>IT&apos;S A LIVING<br />STORY OF <em>YOU.</em></h2>
          <p className="film-manifesto-note">NutriCare follows the whole rhythm—from the receipt in your hand to the meal on your table—so useful insight appears without turning life into admin.</p>
        </ScrollReveal>

        <ScrollReveal className="film-still" delay={120}>
          <Image
            src="/images/nutricare-pantry.png"
            alt="Fresh pantry ingredients arranged on a terracotta table"
            fill
            quality={95}
            sizes="(max-width: 900px) 94vw, 74vw"
            className="film-still-image"
          />
        </ScrollReveal>
      </section>

      <CinematicJourney />

      <section id="care" className="film-features">
        <div className="film-feature-intro">
          <ScrollReveal><h2>Quiet technology.<br /><em>Useful care.</em></h2></ScrollReveal>
          <ScrollReveal delay={100}><p>NutriCare stays in the background until the moment it can help. No dashboards for the sake of dashboards. Just the next clear move.</p></ScrollReveal>
        </div>
        <div className="film-feature-list">
          {FEATURES.map((feature, index) => (
            <ScrollReveal className="film-feature-row" delay={index * 80} key={feature.number}>
              <span className="film-feature-number">{feature.number}</span>
              <div><p>{feature.label}</p><h3>{feature.title}</h3></div>
              <p className="film-feature-copy">{feature.copy}</p>
              <span className="film-feature-arrow"><Icon name="arrow" className="h-5 w-5" /></span>
            </ScrollReveal>
          ))}
        </div>
      </section>

      <section className="film-outro">
        <Image
          src="/images/nutricare-table.png"
          alt="Two people sharing a nourishing meal around a warmly lit table"
          fill
          quality={95}
          sizes="100vw"
          className="film-outro-image"
        />
        <div className="film-outro-shade" />
        <div className="film-grain" />
        <div className="film-outro-copy">
          <p>THE NEXT MEAL STARTS HERE</p>
          <h2>MAKE FOOD<br /><em>FEEL SIMPLE.</em></h2>
          <Link href="/register" className="film-primary-link">Start your pantry <Icon name="arrow" className="h-4 w-4" /></Link>
        </div>
        <div className="film-outro-foot"><Brand light /><span>Designed for everyday care.</span><span>© 2026 NutriCare</span></div>
      </section>
    </main>
  );
}
