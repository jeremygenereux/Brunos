"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type {
  Category,
  PresentEdition,
  RankRow,
  RecapRow,
} from "@/lib/editions/presentation-types";
import { ArchiveButton } from "./archive-button";
import { ReactiveParticles, AwardCategoryReveal } from "@/components/award";

export type { Category, RankRow, RecapRow };

function Avatar({ name, headshot, size }: { name: string; headshot: string | null; size: number }) {
  if (headshot) {
    return (
      <Image
        src={headshot}
        alt={name}
        width={size}
        height={size}
        className="border-or-400/30 shrink-0 rounded-full border object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="bg-noir-700 text-or-400/70 border-or-400/20 font-display flex shrink-0 items-center justify-center rounded-full border"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function Kicker({ children }: { children: React.ReactNode }) {
  return <p className="text-or-400/80 font-sans text-sm tracking-[0.4em] uppercase">{children}</p>;
}

/**
 * Podium COMPLÈTEMENT inversé : tout le classement, position par position,
 * ordonné pour que la ou les personnes qui CALENT arrivent en dernier (climax).
 * Dérivé du flag `isShooter`, déjà calculé selon la règle EFFECTIVE de la
 * question (`drink_rule_override` inclus) — donc juste dans les deux règles :
 *   • ESCALATION → le shooter est le·la dernier·ère : 1re position … dernière.
 *   • TOP_UNIQUE → le shooter est le·la gagnant·e : dernière position … 1re.
 * `players` arrive trié par finalRank croissant.
 */
function cascadeOf(players: RankRow[]) {
  const shooters = players.filter((p) => p.isShooter);
  if (shooters.length === 0)
    return { shooters: [], buildUp: [], penultimate: null, shooterIsLast: false };
  const shooterIsLast = shooters[shooters.length - 1].finalRank === players.length;
  const rest = players.filter((p) => !p.isShooter);
  const ordered = shooterIsLast ? rest : [...rest].reverse();
  // On RÉSERVE l'avant-dernière position pour le climax : si la liste allait
  // jusqu'au bout, la dernière personne serait devinable par élimination.
  const penultimate = ordered.length > 0 ? ordered[ordered.length - 1] : null;
  const buildUp = ordered.slice(0, -1);
  return { shooters, buildUp, penultimate, shooterIsLast };
}

/** RankRow → entrée de cascade pour le composant de révélation. */
function toEntry(p: RankRow) {
  return {
    id: p.playerId,
    name: p.name,
    headshot: p.headshot,
    rank: p.finalRank,
    drinks: p.drinks,
  };
}

export function PresentationDeck({
  edition,
  categories,
  recap,
  backHref,
}: {
  edition: PresentEdition;
  categories: Category[];
  recap: RecapRow[];
  backHref?: string;
}) {
  const quitHref = backHref ?? `/admin/editions/${edition.id}`;

  // Typed slide deck: intro → rules → categories → recap.
  type Slide =
    | { type: "intro" }
    | { type: "rules" }
    | { type: "category"; cat: Category }
    | { type: "recap" };
  const slides = useMemo<Slide[]>(
    () => [
      { type: "intro" },
      { type: "rules" },
      ...categories.map((cat) => ({ type: "category" as const, cat })),
      { type: "recap" },
    ],
    [categories],
  );
  const lastSlide = slides.length - 1;

  const [pos, setPos] = useState({ slide: 0, step: 0 });
  const { slide, step } = pos;
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Étapes d'une catégorie : 0 = énoncé, 1 = cascade (classement + climax),
  // 2 = déboules SI elles existent — pas de clic mort.
  const maxStepOf = useCallback(
    (s: number) => {
      const sl = slides[s];
      if (sl?.type !== "category") return 0;
      if (sl.cat.players.length === 0) return 0;
      const hasDrama = Boolean(sl.cat.drama && sl.cat.drama.length > 0);
      return 1 + (hasDrama ? 1 : 0);
    },
    [slides],
  );

  const advance = useCallback(() => {
    setPos((p) => {
      const max = maxStepOf(p.slide);
      if (p.step < max) return { slide: p.slide, step: p.step + 1 };
      if (p.slide < lastSlide) return { slide: p.slide + 1, step: 0 };
      return p;
    });
  }, [lastSlide, maxStepOf]);

  const back = useCallback(() => {
    setPos((p) => {
      if (p.step > 0) return { slide: p.slide, step: p.step - 1 };
      if (p.slide > 0) return { slide: p.slide - 1, step: maxStepOf(p.slide - 1) };
      return p;
    });
  }, [maxStepOf]);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else el.requestFullscreen?.();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Let focused controls (Quitter, Archive, prev/next, fullscreen) keep
      // their native keyboard activation — don't hijack Enter/Space from them.
      const t = e.target;
      if (t instanceof HTMLElement && t.closest("button, a, input, select, textarea")) return;
      if (["ArrowRight", " ", "ArrowDown", "PageDown", "Enter"].includes(e.key)) {
        e.preventDefault();
        advance();
      } else if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(e.key)) {
        e.preventDefault();
        back();
      } else if (e.key === "f" || e.key === "F") {
        toggleFullscreen();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance, back, toggleFullscreen]);

  useEffect(() => {
    function onFs() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const currentSlide = slides[slide];
  const isIntro = currentSlide?.type === "intro";
  const isRules = currentSlide?.type === "rules";
  const isRecap = currentSlide?.type === "recap";
  const cat = currentSlide?.type === "category" ? currentSlide.cat : null;
  const cascade = cascadeOf(cat?.players ?? []);
  const { shooters, buildUp, penultimate } = cascade;
  // Le classement de l'entourage est mis en pause : après la cascade, seules
  // les déboules restent.
  const dramaStep = 2;
  const noVotes = Boolean(cat && cat.players.length === 0);
  const maxTotal = recap.length ? Math.max(...recap.map((r) => r.total)) : 0;

  const announce = cat
    ? `Catégorie ${cat.index + 1} sur ${categories.length}. ${cat.prompt}` +
      (step >= 1 && shooters.length ? `. ${shooters.map((w) => w.name).join(", ")}.` : "") +
      (step >= dramaStep && cat.drama
        ? ` ${cat.drama.map((d) => `${d.title}. ${d.detail}`).join(" ")}`
        : "")
    : isRecap
      ? "Récapitulatif de la soirée."
      : isRules
        ? "Les règles de la soirée."
        : `${edition.name}.`;

  return (
    <div
      ref={containerRef}
      onClick={advance}
      className="bg-noir-900 text-ivoire fixed inset-0 z-50 cursor-pointer overflow-hidden select-none"
    >
      <div className="brunos-stage-glow" />
      <ReactiveParticles pulseKey={`${slide}-${step}`} />
      <div className="sr-only" aria-live="polite" role="status">
        {announce}
      </div>

      {/* Top bar */}
      <div
        className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-6 py-4"
        onClick={(e) => e.stopPropagation()}
      >
        <Link
          href={quitHref}
          className="text-ivoire-faint hover:text-or-300 font-sans text-xs tracking-wide uppercase transition"
        >
          ✕ Quitter
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-ivoire-faint font-sans text-xs tracking-widest tabular-nums">
            {cat
              ? `${cat.index + 1} / ${categories.length}`
              : isRecap
                ? "Récap"
                : isRules
                  ? "Règles"
                  : "Ouverture"}
          </span>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="text-ivoire-faint hover:text-or-300 font-sans text-xs tracking-wide uppercase transition"
          >
            {isFullscreen ? "Fenêtré" : "Plein écran"}
          </button>
        </div>
      </div>

      {/* Stage */}
      <div className="relative z-0 flex h-full w-full flex-col items-center justify-center px-8 text-center">
        {isIntro && (
          <div key="intro" className="brunos-fade flex flex-col items-center gap-5">
            <Kicker>Les Brunos {edition.year}</Kicker>
            <h1 className="text-ivoire font-display text-6xl leading-tight font-semibold sm:text-7xl">
              {edition.name}
            </h1>
            {edition.venueName && (
              <p className="text-ivoire-muted font-sans text-lg">{edition.venueName}</p>
            )}
            <p className="text-ivoire-faint mt-6 font-sans text-sm">
              Cliquez ou appuyez sur → pour commencer
            </p>
          </div>
        )}

        {isRules && (
          <div key="rules" className="brunos-fade flex max-w-2xl flex-col items-center gap-6">
            <Kicker>Les règles</Kicker>
            <h2 className="text-ivoire font-display text-4xl leading-tight font-semibold sm:text-5xl">
              {edition.drinkRule === "TOP_UNIQUE"
                ? "Le ou la gagnant·e cale."
                : "Plus bas tu finis, plus tu bois."}
            </h2>
            <p className="text-ivoire-muted font-sans text-lg leading-relaxed">
              {edition.drinkRule === "TOP_UNIQUE" ? (
                <>
                  Pour chaque catégorie, seul·e le·la gagnant·e descend un shooter — soit{" "}
                  <span className="text-or-300">{edition.shooterValue} gorgées</span>. Les ex æquo
                  trinquent ensemble.
                </>
              ) : (
                <>
                  Pour chaque catégorie, on boit selon son rang : 1 gorgée pour la 1re place, 2 pour
                  la 2e, et ainsi de suite. Le·la dernier·ère cale un shooter —{" "}
                  <span className="text-or-300">{edition.shooterValue} gorgées</span>.
                </>
              )}
            </p>
            <p className="text-or-400/60 font-sans text-sm tracking-[0.2em] uppercase">
              Que le meilleur perde 🥃
            </p>
          </div>
        )}

        {cat && (
          <AwardCategoryReveal
            key={`cat-${cat.questionId}`}
            kicker={`Catégorie ${cat.index + 1}`}
            prompt={cat.prompt}
            step={step}
            buildUp={buildUp.map(toEntry)}
            penultimate={penultimate ? toEntry(penultimate) : null}
            shooters={shooters.map(toEntry)}
            cascadeVisible={step >= 1 && step < dramaStep}
            teaser={
              shooters.length > 1
                ? "… et les Brunos reviennent à …"
                : "… et le Bruno revient à …"
            }
            noVotes={noVotes}
            noVotesLabel="Personne n'a voté dans cette catégorie 🤷"
            renderAvatar={(p, size) => <Avatar name={p.name} headshot={p.headshot} size={size} />}
          >

            {step >= dramaStep && cat.drama && cat.drama.length > 0 && (
              <div key="drama" className="flex w-full max-w-2xl flex-col items-center gap-4">
                <p className="text-or-400/70 font-sans text-xs tracking-[0.4em] uppercase">
                  {cat.drama.length > 1 ? "Déboules" : "Déboule"}
                </p>
                {cat.drama.map((d, i) => (
                  <div
                    key={`${d.kind}-${i}`}
                    className="brunos-glass brunos-rise border-or-400/30 w-full rounded-2xl border px-6 py-5 text-center"
                    style={{ animationDelay: `${i * 120}ms` }}
                  >
                    <p className="text-or-300 font-display text-2xl font-semibold">{d.title}</p>
                    <p className="text-ivoire mt-1 font-sans text-base">{d.detail}</p>
                  </div>
                ))}
              </div>
            )}
          </AwardCategoryReveal>
        )}

        {isRecap && (
          <div
            key="recap"
            className="brunos-fade flex w-full max-w-2xl flex-col items-center gap-6"
          >
            <Kicker>La note de la soirée</Kicker>
            <h2 className="text-ivoire font-display text-5xl font-semibold">Qui a le plus bu</h2>
            <ol className="mt-2 flex w-full flex-col gap-2">
              {recap.map((r, i) => {
                const champ = r.total === maxTotal && maxTotal > 0;
                return (
                  <li
                    key={r.playerId}
                    className={`brunos-rise brunos-glass flex items-center gap-4 rounded-2xl border px-5 py-3 ${
                      champ ? "border-or-400/45 bg-or-500/10" : "border-or-400/12"
                    }`}
                    style={{ animationDelay: `${i * 70}ms` }}
                  >
                    <span className="text-ivoire-faint w-6 text-right font-sans tabular-nums">
                      {i + 1}
                    </span>
                    <Avatar name={r.name} headshot={r.headshot} size={44} />
                    <span className="text-ivoire flex-1 text-left font-sans">{r.name}</span>
                    {champ && (
                      <span className="text-or-300 font-sans text-xs tracking-wide uppercase">
                        🥃 Champion des gorgées
                      </span>
                    )}
                    <span className="text-or-300 font-display text-2xl tabular-nums">
                      {r.total}
                    </span>
                  </li>
                );
              })}
            </ol>
            <div className="mt-6">
              {edition.state === "LIVE" ? (
                <ArchiveButton editionId={edition.id} />
              ) : edition.state === "ARCHIVED" ? (
                <p className="text-ivoire-faint font-sans text-xs tracking-wide uppercase">
                  Édition archivée — présentation publique
                </p>
              ) : (
                <p className="text-ivoire-faint font-sans text-xs tracking-wide uppercase">
                  Aperçu — passez l&apos;édition « En direct » pour archiver depuis ici
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div
        className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-between px-6 py-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={back}
          disabled={slide === 0 && step === 0}
          className="text-ivoire-faint hover:text-or-300 font-sans text-sm transition disabled:opacity-30"
        >
          ← Précédent
        </button>
        <span className="text-ivoire-faint font-sans text-xs tracking-widest">
          ← → pour naviguer · F plein écran
        </span>
        <button
          type="button"
          onClick={advance}
          disabled={slide === lastSlide && step === maxStepOf(slide)}
          className="text-or-300 hover:text-or-400 font-sans text-sm transition disabled:opacity-30"
        >
          Suivant →
        </button>
      </div>
    </div>
  );
}

// NOTE : le composant RankColumn (colonnes de classement joueurs / entourage)
// a été retiré — la cascade dévoile désormais le classement des joueurs, et
// l'affichage de l'entourage est mis en pause. Récupérable via git si besoin.
