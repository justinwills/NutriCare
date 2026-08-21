"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Icon } from "@/components/ui/Icons";
import { ScrollReveal } from "@/components/landing/ScrollReveal";

const STEPS = [
  {
    eyebrow: "01 / Capture",
    title: "Turn receipts into a living pantry.",
    copy: "A quick scan turns the noisy part of grocery shopping into a clear list you can trust.",
    icon: "scan" as const,
  },
  {
    eyebrow: "02 / Understand",
    title: "See what needs your attention.",
    copy: "Stock levels, freshness, and the next useful action stay visible without asking you to dig.",
    icon: "pantry" as const,
  },
  {
    eyebrow: "03 / Care",
    title: "Make meals part of the picture.",
    copy: "Log a meal and watch your pantry, progress, and care targets move together.",
    icon: "meal" as const,
  },
];

function ReceiptScene() {
  return (
    <div className="journey-receipt">
      <div className="journey-receipt-top"><span>GROCERY CO.</span><span>JUL 08</span></div>
      <div className="journey-receipt-line journey-receipt-line-wide" />
      {[["Baby spinach", "$4.80"], ["Sourdough", "$6.20"], ["Avocado", "$3.60"], ["Greek yoghurt", "$7.40"]].map(([label, price], index) => (
        <div key={label} className="journey-receipt-item" style={{ "--item-delay": `${index * 90}ms` } as CSSProperties}>
          <span>{label}</span><span>{price}</span>
        </div>
      ))}
      <div className="journey-receipt-line" />
      <div className="journey-receipt-total"><span>TOTAL</span><strong>$22.00</strong></div>
      <div className="journey-scan-line" aria-hidden="true" />
    </div>
  );
}

function PantryScene() {
  return (
    <div className="journey-pantry-scene">
      <div className="journey-scene-header"><span>MY PANTRY</span><span className="journey-live-dot">LIVE</span></div>
      <div className="journey-pantry-score"><div><span>Pantry health</span><strong>82%</strong></div><span className="journey-fresh-pill">Looking fresh</span></div>
      <div className="journey-pantry-items">
        {[['🥬', 'Baby spinach', '2 days'], ['🥑', 'Avocado', '4 days'], ['🍞', 'Sourdough', '6 days'], ['🥣', 'Greek yoghurt', '8 days']].map(([emoji, name, days]) => (
          <div className="journey-pantry-item" key={name}><span className="journey-food-emoji">{emoji}</span><span><strong>{name}</strong><small>{days} left</small></span><Icon name="check" className="h-4 w-4" /></div>
        ))}
      </div>
      <div className="journey-stock"><span>Pantry stocked</span><span>82%</span><div><i /></div></div>
    </div>
  );
}

function MealScene() {
  return (
    <div className="journey-meal-scene">
      <div className="journey-scene-header"><span>MEAL LOGGED</span><span>12:42 PM</span></div>
      <div className="journey-meal-title"><span className="journey-meal-icon"><Icon name="meal" className="h-5 w-5" /></span><div><span>Lunch</span><strong>Green goddess toast</strong></div><span className="journey-check"><Icon name="check" className="h-4 w-4" /></span></div>
      <div className="journey-nutrition-row"><div><strong>428</strong><span>calories</span></div><div><strong>18g</strong><span>protein</span></div><div><strong>34g</strong><span>carbs</span></div></div>
      <div className="journey-nutrition-bars"><div><span>Energy</span><i><b style={{ width: "72%" }} /></i><small>72%</small></div><div><span>Protein</span><i><b style={{ width: "48%" }} /></i><small>48%</small></div><div><span>Balance</span><i><b style={{ width: "86%" }} /></i><small>86%</small></div></div>
      <p className="journey-meal-note"><Icon name="sparkles" className="h-3.5 w-3.5" /> Pantry updated automatically</p>
    </div>
  );
}

export function CinematicJourney() {
  const [activeStep, setActiveStep] = useState(0);
  const stepRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) {
          const nextStep = Number((visible.target as HTMLElement).dataset.step);
          if (!Number.isNaN(nextStep)) setActiveStep(nextStep);
        }
      },
      { threshold: [0.2, 0.45, 0.7], rootMargin: "-20% 0px -35%" }
    );

    stepRefs.current.forEach((step) => step && observer.observe(step));
    return () => observer.disconnect();
  }, []);

  return (
    <section className="journey-section relative overflow-hidden bg-forest px-5 py-20 text-white sm:px-8 lg:px-10 lg:py-28" aria-label="How NutriCare works">
      <div className="journey-glow journey-glow-one" />
      <div className="journey-glow journey-glow-two" />
      <div className="soft-noise absolute inset-0 opacity-60" />
      <div className="relative mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.83fr_1.17fr] lg:gap-20">
        <div className="relative z-10">
          <ScrollReveal>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-lime/70">A living food system</p>
            <h2 className="mt-4 max-w-lg font-display text-4xl font-semibold leading-[0.98] tracking-[-0.045em] sm:text-5xl lg:text-6xl">From receipt to rhythm.</h2>
            <p className="mt-5 max-w-md text-base leading-7 text-white/52">The small moments connect themselves. Scroll to see how NutriCare turns a grocery run into a clearer day.</p>
          </ScrollReveal>

          <div className="journey-steps mt-10 lg:mt-24">
            {STEPS.map((step, index) => (
              <div
                key={step.eyebrow}
                ref={(element) => { stepRefs.current[index] = element; }}
                data-step={index}
                className={`journey-step ${activeStep === index ? "is-active" : ""}`}
              >
                <div className="journey-step-marker"><span>{String(index + 1).padStart(2, "0")}</span></div>
                <div className="journey-step-content"><p>{step.eyebrow}</p><h3>{step.title}</h3><span>{step.copy}</span></div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative order-first lg:order-last">
          <div className="journey-stage-sticky">
            <div className={`journey-stage journey-stage-${activeStep}`}>
              <div className="journey-stage-orb" />
              <div className="journey-stage-topline"><span><i /> NUTRICARE / SYSTEM VIEW</span><span>SCROLL TO EXPLORE</span></div>
              <div className="journey-stage-content">
                <div className="journey-stage-label"><Icon name={STEPS[activeStep].icon} className="h-4 w-4" /><span>{STEPS[activeStep].eyebrow}</span></div>
                <div className="journey-scene" key={activeStep}>
                  {activeStep === 0 && <ReceiptScene />}
                  {activeStep === 1 && <PantryScene />}
                  {activeStep === 2 && <MealScene />}
                </div>
              </div>
              <div className="journey-stage-footer"><span>01</span><div><i className={activeStep >= 0 ? "is-on" : ""} /><i className={activeStep >= 1 ? "is-on" : ""} /><i className={activeStep >= 2 ? "is-on" : ""} /></div><span>03</span></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
