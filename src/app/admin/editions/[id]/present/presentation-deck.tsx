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
import { cascadeOf } from "@/lib/editions/reveal-order";
import type { RankGroup } from "@/lib/editions/rank-groups";
import { DRAMA_MAX_ON_STAGE, dramaCatalogueFor } from "@/lib/editions/drama-cards";
import type { DrinkRule } from "@/lib/scoring/types";
import { questionModesFor } from "@/lib/editions/question-modes";
import { ChoiceGlyph, ModeCard, RankingGlyph } from "@/components/question-mode";
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
  return (
    <p className="text-or-400/80 font-sans text-base tracking-[0.4em] uppercase sm:text-lg">
      {children}
    </p>
  );
}

/** Une POSITION du classement → une entrée de cascade. Les ex æquo y arrivent
 *  ensemble : un numéro, une ardoise, plusieurs visages. */
function toEntry(g: RankGroup) {
  return {
    id: g.players[0].playerId,
    rank: g.rank,
    drinks: g.drinks,
    people: g.players.map((p) => ({ id: p.playerId, name: p.name, headshot: p.headshot })),
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

  // Enchaînement : ouverture → tablée → règlement → déboules → catégories → relevé.
  type Slide =
    | { type: "intro" }
    | { type: "players" }
    | { type: "rules" }
    | { type: "dramaGuide" }
    | { type: "category"; cat: Category }
    | { type: "recap" };

  // Les façons de voter présentes ce soir, annoncées au règlement.
  const modes = useMemo(
    () => questionModesFor(categories, edition.drinkRule),
    [categories, edition.drinkRule],
  );

  const catalogue = useMemo(
    () =>
      dramaCatalogueFor(
        categories.map((c) => (c.rule ?? edition.drinkRule) as DrinkRule),
      ),
    [categories, edition.drinkRule],
  );

  const slides = useMemo<Slide[]>(
    () => [
      { type: "intro" },
      // La tablée avant le règlement : on présente les gens avant de dire ce
      // qu'on va leur faire boire.
      ...(recap.length > 0 ? [{ type: "players" as const }] : []),
      { type: "rules" },
      // Et ce qui PEUT tomber, juste après les règles : la salle guette
      // ensuite les déboules au lieu de les découvrir sans contexte.
      ...(catalogue.length > 0 ? [{ type: "dramaGuide" as const }] : []),
      ...categories.map((cat) => ({ type: "category" as const, cat })),
      { type: "recap" },
    ],
    [categories, recap.length, catalogue.length],
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
      const hasPicks = Boolean(sl.cat.picks && sl.cat.picks.length > 0);
      // Pas de clic mort : chaque étape n'existe que si elle a du contenu.
      return 1 + (hasDrama ? 1 : 0) + (hasPicks ? 1 : 0);
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
  const isPlayers = currentSlide?.type === "players";
  const isDramaGuide = currentSlide?.type === "dramaGuide";
  const isRecap = currentSlide?.type === "recap";
  const cat = currentSlide?.type === "category" ? currentSlide.cat : null;
  const cascade = cascadeOf(cat?.players ?? []);
  const { shooters, buildUp, penultimate } = cascade;
  // Le classement de l'entourage est mis en pause : après la cascade, seules
  // les déboules restent.
  const dramaStep = 2;
  // Les flèches viennent APRÈS les déboules, ou à leur place s'il n'y en a pas.
  const picksStep = dramaStep + ((cat?.drama?.length ?? 0) > 0 ? 1 : 0);
  const picks = cat?.picks ?? [];
  // La scène plafonne à quatre déboules : au-delà, la diapositive déborde et
  // se fait couper, et plus personne ne lit rien. Elles arrivent déjà triées
  // par priorité, donc on garde les plus racontables. L'ARCHIVE, elle, les
  // montre toutes — on y lit à son rythme.
  const dramaOnStage = (cat?.drama ?? []).slice(0, DRAMA_MAX_ON_STAGE);
  const noVotes = Boolean(cat && cat.players.length === 0);
  const maxTotal = recap.length ? Math.max(...recap.map((r) => r.total)) : 0;

  const announce = cat
    ? `Catégorie ${cat.index + 1} sur ${categories.length}. ${cat.prompt}` +
      (step >= 1 && shooters.length
        ? `. ${shooters.flatMap((g) => g.players.map((p) => p.name)).join(", ")}.`
        : "") +
      (step === dramaStep && dramaOnStage.length
        ? ` ${dramaOnStage.map((d) => `${d.title}. ${d.detail}`).join(" ")}`
        : "") +
      (step >= picksStep && picks.length
        ? ` Qui a désigné qui. ${picks.map((p) => `${p.voterName} a désigné ${p.targetName}`).join(". ")}.`
        : "")
    : isRecap
      ? "Total des gorgées de la soirée."
      : isRules
        ? `Les règles de la soirée. ${modes.map((m) => `${m.title}. ${m.ballotNote} ${m.drinkNote}`).join(" ")}`
        : isPlayers
          ? `La tablée. ${recap.map((r) => r.name).join(", ")}.`
          : isDramaGuide
            ? `Les déboules possibles. ${catalogue.map((c) => `${c.title}. ${c.blurb}`).join(" ")}`
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
                ? "Total"
                : isRules
                  ? "Règlement"
                  : isPlayers
                    ? "La tablée"
                    : isDramaGuide
                      ? "Déboules"
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
              Cliquez ou appuyez sur → pour ouvrir la cérémonie
            </p>
          </div>
        )}

        {/* Le règlement porte les deux pictogrammes du bulletin : l'assemblée
            reconnaît en séance ce qu'elle a vu en votant, et découvre où tombe
            la charge AVANT le premier verdict plutôt que pendant. */}
        {/* La tablée. On nomme et on montre tout le monde AVANT d'annoncer
            les règles : la salle sait alors de qui on parle toute la soirée. */}
        {isPlayers && (
          <div key="players" className="brunos-fade flex w-full max-w-6xl flex-col items-center gap-10">
            <Kicker>La tablée</Kicker>
            <h2 className="text-ivoire font-display text-5xl leading-tight font-semibold sm:text-6xl">
              {recap.length} nommé{recap.length > 1 ? "s" : ""} ce soir
            </h2>
            <ul className="flex flex-wrap items-start justify-center gap-x-10 gap-y-8">
              {recap.map((r, i) => (
                <li
                  key={r.playerId}
                  className="brunos-rise flex w-40 flex-col items-center gap-3 sm:w-48"
                  style={{ animationDelay: `${i * 110}ms` }}
                >
                  <span className="brunos-aura">
                    <Avatar name={r.name} headshot={r.headshot} size={140} />
                  </span>
                  <span className="text-ivoire font-display text-2xl leading-tight font-semibold sm:text-3xl">
                    {r.name}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {isRules && (
          <div key="rules" className="brunos-fade flex w-full max-w-6xl flex-col items-center gap-10">
            <Kicker>Règlement</Kicker>
            <h2 className="text-ivoire font-display text-5xl leading-tight font-semibold sm:text-6xl">
              Un shooter vaut{" "}
              <span className="text-or-300">{edition.shooterValue} gorgées</span>.
            </h2>

            <div className="flex w-full flex-col gap-6 lg:flex-row">
              {modes.map((m) => (
                <ModeCard
                  key={m.kind}
                  scale="stage"
                  glyph={
                    m.kind === "ranking" ? (
                      <RankingGlyph scale="stage" />
                    ) : (
                      <ChoiceGlyph scale="stage" />
                    )
                  }
                  title={m.title}
                  subtitle={`${m.count} catégorie${m.count > 1 ? "s" : ""}`}
                >
                  <p>{m.ballotNote}</p>
                  <p className="text-ivoire">{m.drinkNote}</p>
                </ModeCard>
              ))}
            </div>

            <p className="text-or-400/60 font-sans text-base tracking-[0.3em] uppercase">
              Que le meilleur perde.
            </p>
          </div>
        )}

        {/* Ce qui PEUT tomber. Annoncé après les règles pour que la salle
            guette les déboules au lieu de les subir sans contexte. Filtré sur
            les règles réellement présentes : on ne promet rien d'impossible. */}
        {isDramaGuide && (
          <div key="dramaGuide" className="brunos-fade flex w-full max-w-6xl flex-col items-center gap-8">
            <Kicker>Les déboules</Kicker>
            <h2 className="text-ivoire font-display text-4xl leading-tight font-semibold sm:text-5xl">
              Ce que les bulletins peuvent trahir
            </h2>
            <ul className="grid w-full gap-4 sm:grid-cols-2">
              {catalogue.map((c, i) => (
                <li
                  key={c.kind}
                  className="brunos-rise brunos-glass border-or-400/20 rounded-2xl border px-6 py-5 text-left"
                  style={{ animationDelay: `${i * 90}ms` }}
                >
                  <p className="text-or-300 font-display text-2xl font-semibold sm:text-3xl">
                    {c.title}
                  </p>
                  <p className="text-ivoire-muted mt-1 font-sans text-lg sm:text-xl">{c.blurb}</p>
                </li>
              ))}
            </ul>
            <p className="text-or-400/60 font-sans text-base tracking-[0.3em] uppercase">
              Elles ne se déclenchent pas toutes. C&apos;est vous qui décidez.
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
                ? "Les Brunos reviennent à"
                : "Le Bruno revient à"
            }
            noVotes={noVotes}
            noVotesLabel="Aucun vote dans cette catégorie."
            renderAvatar={(p, size) => <Avatar name={p.name} headshot={p.headshot} size={size} />}
          >

            {step === dramaStep && dramaOnStage.length > 0 && (
              <div key="drama" className="flex w-full max-w-4xl flex-col items-center gap-5">
                <p className="text-or-400/70 font-sans text-base tracking-[0.4em] uppercase">
                  {dramaOnStage.length > 1 ? "Déboules" : "Déboule"}
                </p>
                {dramaOnStage.map((d, i) => (
                  <div
                    key={`${d.kind}-${i}`}
                    className="brunos-glass brunos-rise border-or-400/30 w-full rounded-2xl border px-6 py-5 text-center"
                    style={{ animationDelay: `${i * 120}ms` }}
                  >
                    <p className="text-or-300 font-display text-3xl font-semibold sm:text-4xl">
                      {d.title}
                    </p>
                    <p className="text-ivoire mt-2 font-sans text-xl sm:text-2xl">{d.detail}</p>
                  </div>
                ))}
              </div>
            )}
            {/* Qui a envoyé qui boire. Le classement complet de chacun serait
                illisible à cinq mètres ; on ne montre que le choix décisif —
                une flèche par votant, vers la personne qu'il a placée du côté
                qui trinque. */}
            {step >= picksStep && picks.length > 0 && (
              <div key="picks" className="flex w-full max-w-5xl flex-col items-center gap-6">
                <p className="text-or-400/70 font-sans text-base tracking-[0.4em] uppercase">
                  Qui a désigné qui
                </p>
                <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-5">
                  {picks.map((pick, i) => (
                    <li
                      key={`${pick.voterName}-${pick.targetPlayerId}`}
                      className="brunos-rise brunos-glass border-or-400/15 flex items-center gap-3 rounded-full border py-2 pr-5 pl-2"
                      style={{ animationDelay: `${i * 110}ms` }}
                    >
                      <Avatar name={pick.voterName} headshot={pick.voterHeadshot} size={48} />
                      <span className="text-or-400/70 font-display text-3xl leading-none">→</span>
                      <Avatar name={pick.targetName} headshot={pick.targetHeadshot} size={48} />
                      <span className="text-ivoire font-sans text-lg sm:text-xl">
                        {pick.targetName}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </AwardCategoryReveal>
        )}

        {isRecap && (
          <div
            key="recap"
            className="brunos-fade flex w-full max-w-4xl flex-col items-center gap-6"
          >
            <Kicker>Total de la soirée</Kicker>
            <h2 className="text-ivoire font-display text-5xl font-semibold sm:text-6xl">
              Consommation totale
            </h2>
            <ol className="mt-2 flex w-full flex-col gap-2">
              {recap.map((r, i) => {
                const champ = r.total === maxTotal && maxTotal > 0;
                return (
                  <li
                    key={r.playerId}
                    className={`brunos-rise brunos-glass flex items-center gap-5 rounded-2xl border px-6 py-4 ${
                      champ ? "border-or-400/45 bg-or-500/10" : "border-or-400/12"
                    }`}
                    style={{ animationDelay: `${i * 70}ms` }}
                  >
                    <span className="text-or-400/60 font-display w-8 text-right text-3xl tabular-nums">
                      {i + 1}
                    </span>
                    <Avatar name={r.name} headshot={r.headshot} size={60} />
                    <span className="text-ivoire flex-1 truncate text-left font-sans text-xl sm:text-2xl">
                      {r.name}
                    </span>
                    {champ && (
                      <span className="text-or-300 hidden shrink-0 font-sans text-base tracking-wide uppercase sm:inline">
                        Plus forte consommation
                      </span>
                    )}
                    <span className="text-or-300 font-display shrink-0 text-4xl tabular-nums sm:text-5xl">
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
                  Cérémonie archivée. La présentation est publique.
                </p>
              ) : (
                <p className="text-ivoire-faint font-sans text-xs tracking-wide uppercase">
                  Aperçu. Passez la cérémonie « En direct » pour pouvoir archiver depuis cet écran.
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
