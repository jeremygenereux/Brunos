"use client";

// Aperçu public de la chorégraphie du mode présentation (mêmes composants que
// le vrai deck). Montre les DEUX règles : ESCALATION (le·la dernier·ère cale)
// et TOP_UNIQUE (le·la gagnant·e cale). Clic / → pour avancer.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AwardCategoryReveal,
  CinematicRevealText,
  ReactiveParticles,
  type RevealEntry,
} from "@/components/award";

type Demo = {
  prompt: string;
  rule: "ESCALATION" | "TOP_UNIQUE";
  buildUp: RevealEntry[];
  penultimate: RevealEntry;
  shooters: RevealEntry[];
};

const CATS: Demo[] = [
  {
    prompt: "Le plus susceptible de disparaître à 23 h",
    rule: "ESCALATION",
    // 1re → dernière position ; les DEUX dernières sont gardées pour le climax.
    buildUp: [
      { id: "alex", name: "Alex", headshot: null, rank: 1, drinks: 1 },
      { id: "jordan", name: "Jordan", headshot: null, rank: 2, drinks: 2 },
      { id: "noa", name: "Noa", headshot: null, rank: 3, drinks: 3 },
      { id: "sam", name: "Sam", headshot: null, rank: 4, drinks: 4 },
    ],
    penultimate: { id: "robin", name: "Robin", headshot: null, rank: 5, drinks: 5 },
    shooters: [{ id: "camille", name: "Camille", headshot: null, rank: 6, drinks: 8 }],
  },
  {
    prompt: "La meilleure mauvaise idée de l'année",
    rule: "TOP_UNIQUE",
    // Ici le·la gagnant·e cale : on descend de la dernière position vers la 1re.
    buildUp: [
      { id: "noa2", name: "Noa", headshot: null, rank: 5, drinks: 0 },
      { id: "camille2", name: "Camille", headshot: null, rank: 4, drinks: 0 },
      { id: "sam2", name: "Sam", headshot: null, rank: 3, drinks: 0 },
    ],
    penultimate: { id: "robin2", name: "Robin", headshot: null, rank: 2, drinks: 0 },
    shooters: [
      { id: "alex2", name: "Alex", headshot: null, rank: 1, drinks: 8 },
      { id: "jordan2", name: "Jordan", headshot: null, rank: 1, drinks: 8 },
    ],
  },
];

type Slide = { type: "intro" } | { type: "category"; index: number } | { type: "recap" };

function Avatar({ name, size }: { name: string; size: number }) {
  return (
    <div
      className="bg-noir-700 text-or-400/80 border-or-400/25 font-display flex items-center justify-center rounded-full border"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function AwardShowcasePage() {
  const slides = useMemo<Slide[]>(
    () => [
      { type: "intro" },
      ...CATS.map((_, i) => ({ type: "category" as const, index: i })),
      { type: "recap" },
    ],
    [],
  );
  const lastSlide = slides.length - 1;
  const [pos, setPos] = useState({ slide: 0, step: 0 });
  const { slide, step } = pos;

  const maxStepOf = useCallback((s: number) => (slides[s]?.type === "category" ? 1 : 0), [slides]);

  const advance = useCallback(() => {
    setPos((p) => {
      if (p.step < maxStepOf(p.slide)) return { slide: p.slide, step: p.step + 1 };
      if (p.slide < lastSlide) return { slide: p.slide + 1, step: 0 };
      return { slide: 0, step: 0 };
    });
  }, [lastSlide, maxStepOf]);

  const back = useCallback(() => {
    setPos((p) => {
      if (p.step > 0) return { slide: p.slide, step: p.step - 1 };
      if (p.slide > 0) return { slide: p.slide - 1, step: maxStepOf(p.slide - 1) };
      return p;
    });
  }, [maxStepOf]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (["ArrowRight", " ", "Enter"].includes(e.key)) {
        e.preventDefault();
        advance();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        back();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance, back]);

  const current = slides[slide];
  const cat = current.type === "category" ? CATS[current.index] : null;

  return (
    <div
      onClick={advance}
      className="bg-noir-900 text-ivoire fixed inset-0 z-50 cursor-pointer overflow-hidden select-none"
    >
      <div className="brunos-stage-glow" />
      <ReactiveParticles pulseKey={`${slide}-${step}`} />

      <div className="relative z-0 flex h-full w-full flex-col items-center justify-center px-8 text-center">
        {current.type === "intro" && (
          <div key="intro" className="flex flex-col items-center gap-6">
            <CinematicRevealText
              as="p"
              splitBy="words"
              text="Les Brunos · 2025"
              className="text-or-400/80 font-sans text-sm tracking-[0.4em] uppercase"
            />
            <CinematicRevealText
              as="h1"
              splitBy="words"
              blur
              delay={0.3}
              text="La Cérémonie"
              className="text-ivoire font-display text-6xl leading-tight font-semibold sm:text-8xl"
            />
            <p className="text-ivoire-faint mt-6 font-sans text-sm">
              Cliquez ou appuyez sur → pour commencer
            </p>
          </div>
        )}

        {cat && (
          <AwardCategoryReveal
            key={`cat-${slide}`}
            kicker={`Catégorie ${current.type === "category" ? current.index + 1 : 1} · ${cat.rule}`}
            prompt={cat.prompt}
            step={step}
            buildUp={cat.buildUp}
            penultimate={cat.penultimate}
            shooters={cat.shooters}
            teaser={
              cat.shooters.length > 1
                ? "… et les Brunos reviennent à …"
                : "… et le Bruno revient à …"
            }
            renderAvatar={(p, size) => <Avatar name={p.name} size={size} />}
          />
        )}

        {current.type === "recap" && (
          <div key="recap" className="brunos-fade flex flex-col items-center gap-5">
            <CinematicRevealText
              as="p"
              splitBy="words"
              text="La note de la soirée"
              className="text-or-400/80 font-sans text-sm tracking-[0.4em] uppercase"
            />
            <CinematicRevealText
              as="h2"
              splitBy="words"
              blur
              delay={0.3}
              text="Qui a le plus bu"
              className="text-ivoire font-display text-5xl font-semibold sm:text-6xl"
            />
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-6 z-10 flex justify-center">
        <span className="text-ivoire-faint font-sans text-xs tracking-[0.3em] uppercase">
          ← → pour naviguer
        </span>
      </div>
    </div>
  );
}
