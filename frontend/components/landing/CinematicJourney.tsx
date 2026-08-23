"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { Icon } from "@/components/ui/Icons";

const STEPS = [
  {
    number: "01",
    word: "CAPTURE",
    eyebrow: "A receipt becomes a beginning",
    title: "Bring the pantry to life.",
    copy: "One scan recognises what came home, how much you have, and where each ingredient belongs.",
  },
  {
    number: "02",
    word: "CONNECT",
    eyebrow: "Ingredients become possibilities",
    title: "See the next good move.",
    copy: "Freshness, stock, and meal context come together so the useful choice rises above the noise.",
  },
  {
    number: "03",
    word: "CARE",
    eyebrow: "Everyday choices become insight",
    title: "Keep care in the rhythm.",
    copy: "Meals and clinician-set targets stay connected—clear enough to act on and simple enough to live with.",
  },
];

const STAGE_IMAGES = [
  "/images/nutricare-connect.png",
  "/images/nutricare-care.png",
  "/images/nutricare-table.png",
];

function ReceiptVisual() {
  return (
    <div className="film-scene film-receipt-scene">
      <div className="film-receipt-head"><span>NUTRICARE SCAN</span><span>LIVE</span></div>
      <div className="film-receipt-title"><span>Grocery receipt</span><strong>04 items found</strong></div>
      <div className="film-receipt-items">
        {["Baby spinach", "Sourdough", "Avocado", "Greek yoghurt"].map((item, index) => (
          <div key={item}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item}</strong><Icon name="check" className="h-4 w-4" /></div>
        ))}
      </div>
      <div className="film-scan-beam" aria-hidden="true" />
    </div>
  );
}

function PantryVisual() {
  const reducedMotion = useReducedMotion();
  const markerPulse = reducedMotion ? { opacity: 1 } : { opacity: [0.72, 1, 0.72] };
  const markerPulseTransition = reducedMotion ? { duration: 0 } : { duration: 3.6, repeat: Infinity, ease: "easeInOut" as const };

  return (
    <motion.div
      className="film-orbit-scene"
      initial={reducedMotion ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.7, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="film-orbit-head"><span>LIVE PANTRY / 07:32</span><span><i /> SYNCED</span></div>
      <motion.div
        className="film-orbit-count"
        initial={reducedMotion ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.8, delay: reducedMotion ? 0 : 0.12, ease: [0.22, 1, 0.36, 1] }}
      >
        <strong>14</strong><span>ingredients<br />in motion</span>
      </motion.div>
      <div className="film-orbit-map" aria-hidden="true">
        <div className="film-orbit-path" />
        <span className="film-orbit-signal film-orbit-signal-a" />
        <span className="film-orbit-signal film-orbit-signal-b" />
        <span className="film-orbit-signal film-orbit-signal-c" />
        <motion.div className="film-orbit-marker film-orbit-marker-a" animate={markerPulse} transition={{ ...markerPulseTransition, delay: 0.1 }}><i /><span>SPINACH</span><small>2D LEFT</small></motion.div>
        <motion.div className="film-orbit-marker film-orbit-marker-b" animate={markerPulse} transition={{ ...markerPulseTransition, delay: 0.7 }}><i /><span>AVOCADO</span><small>4D LEFT</small></motion.div>
        <motion.div className="film-orbit-marker film-orbit-marker-c" animate={markerPulse} transition={{ ...markerPulseTransition, delay: 1.3 }}><i /><span>SOURDOUGH</span><small>6D LEFT</small></motion.div>
      </div>
      <div className="film-orbit-foot"><span>FRESHNESS MAP</span><div><i /><b /></div><strong>82%</strong></div>
    </motion.div>
  );
}

function CareVisual() {
  return (
    <div className="film-scene film-care-scene">
      <div className="film-care-ring"><span><strong>86</strong>%</span><i /></div>
      <div className="film-care-copy"><span>TODAY&apos;S RHYTHM</span><h4>Right on track.</h4><p>Lunch moved your protein target forward and updated your pantry automatically.</p></div>
      <div className="film-care-stats"><span><strong>428</strong> KCAL</span><span><strong>18G</strong> PROTEIN</span><span><strong>0</strong> ALERTS</span></div>
    </div>
  );
}

export function CinematicJourney() {
  const [activeStep, setActiveStep] = useState(0);
  const stepRefs = useRef<Array<HTMLElement | null>>([]);
  const journeyRef = useRef<HTMLElement | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: journeyRef, offset: ["start end", "end start"] });
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 90, damping: 26, mass: 0.35 });
  const stageImageY = useTransform(smoothProgress, [0, 1], ["-3%", "3%"]);
  const stageWordX = useTransform(smoothProgress, [0, 0.5, 1], ["-1.5%", "0%", "1.5%"]);
  // Keep the camera move subtle so the 1536px source photography is not
  // visibly enlarged on desktop displays.
  const stageBaseScale = [1.01, 1.03, 1.05][activeStep];
  const stageImageScale = useTransform(smoothProgress, [0, 1], [stageBaseScale, stageBaseScale + 0.02]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const next = Number((visible.target as HTMLElement).dataset.step);
        if (!Number.isNaN(next)) setActiveStep(next);
      },
      { threshold: [0.2, 0.4, 0.6, 0.8], rootMargin: "-20% 0px -20% 0px" }
    );

    stepRefs.current.forEach((step) => step && observer.observe(step));
    return () => observer.disconnect();
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <section ref={journeyRef} id="system" className="film-journey" aria-label="The NutriCare system">
      <div className="film-journey-heading"><p>THREE SMALL MOMENTS</p><h2>ONE CONNECTED<br /><em>SYSTEM.</em></h2></div>

      <div className="film-journey-grid">
        <div className="film-journey-steps">
          {STEPS.map((step, index) => (
            <article
              key={step.number}
              ref={(element) => { stepRefs.current[index] = element; }}
              data-step={index}
              className={`film-journey-step ${activeStep === index ? "is-active" : ""}`}
            >
              <span className="film-journey-number">{step.number}</span>
              <div className="film-journey-step-content">
                <p className="film-journey-eyebrow">{step.eyebrow}</p>
                <h3 className="film-journey-title">{step.title}</h3>
                <p className="film-journey-copy">{step.copy}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="film-stage-wrap">
          <motion.div className={`film-stage film-stage-${activeStep}`}>
            <AnimatePresence initial={false} mode="sync">
              <motion.div
                key={`image-${activeStep}`}
                className="film-stage-image-motion"
                initial={prefersReducedMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={prefersReducedMotion ? undefined : { opacity: 0 }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.8, ease: [0.22, 1, 0.36, 1] }}
                style={{ y: prefersReducedMotion ? 0 : stageImageY, scale: prefersReducedMotion ? 1 : stageImageScale }}
              >
                <Image src={STAGE_IMAGES[activeStep]} alt="" fill quality={95} sizes="(max-width: 900px) 100vw, 58vw" className="film-stage-image" />
              </motion.div>
            </AnimatePresence>
            <div className="film-stage-shade" />
            <div className="film-grain" />
            <AnimatePresence initial={false} mode="wait">
              <motion.div
                key={`word-${activeStep}`}
                className="film-stage-word"
                initial={prefersReducedMotion ? false : { opacity: 0, y: "0.6em", letterSpacing: "0.02em" }}
                animate={{ opacity: 1, y: 0, letterSpacing: "-0.08em" }}
                exit={prefersReducedMotion ? undefined : { opacity: 0, y: "-0.25em" }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.75, ease: [0.22, 1, 0.36, 1] }}
                style={{ x: prefersReducedMotion ? 0 : stageWordX }}
              >
                {STEPS[activeStep].word}
              </motion.div>
            </AnimatePresence>
            <AnimatePresence initial={false} mode="wait">
              <motion.div
                key={`scene-${activeStep}`}
                className="film-stage-content"
                initial={prefersReducedMotion ? false : { opacity: 0, y: 28, scale: 0.96, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                exit={prefersReducedMotion ? undefined : { opacity: 0, y: -18, scale: 1.02, filter: "blur(4px)" }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.65, ease: [0.22, 1, 0.36, 1] }}
              >
                {activeStep === 0 && <ReceiptVisual />}
                {activeStep === 1 && <PantryVisual />}
                {activeStep === 2 && <CareVisual />}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
      </section>
    </MotionConfig>
  );
}
