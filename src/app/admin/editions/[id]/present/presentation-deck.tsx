"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type {
  Category,
  PresentEdition,
  RankRow,
  RecapRow,
} from "@/lib/editions/presentation-types";
import { ArchiveButton } from "./archive-button";

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
  const slideCount = categories.length + 2; // intro + categories + recap
  const lastSlide = slideCount - 1;
  const [pos, setPos] = useState({ slide: 0, step: 0 });
  const { slide, step } = pos;
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const isCategory = slide >= 1 && slide <= categories.length;
  const maxStepOf = useCallback(
    (s: number) => (s >= 1 && s <= categories.length ? 2 : 0),
    [categories.length],
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

  const cat = isCategory ? categories[slide - 1] : null;
  const isRecap = slide === lastSlide;
  const winners = cat ? cat.players.filter((p) => p.isWinner) : [];
  const noVotes = Boolean(cat && cat.players.length === 0);
  const maxTotal = recap.length ? Math.max(...recap.map((r) => r.total)) : 0;

  const announce = cat
    ? `Catégorie ${cat.index + 1} sur ${categories.length}. ${cat.prompt}` +
      (step >= 1 && winners.length ? `. ${winners.map((w) => w.name).join(", ")}.` : "")
    : isRecap
      ? "Récapitulatif de la soirée."
      : `${edition.name}.`;

  return (
    <div
      ref={containerRef}
      onClick={advance}
      className="bg-noir-900 text-ivoire fixed inset-0 z-50 cursor-pointer overflow-hidden select-none"
    >
      <div className="brunos-stage-glow" />
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
            {cat ? `${cat.index + 1} / ${categories.length}` : isRecap ? "Récap" : "Ouverture"}
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
        {slide === 0 && (
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

        {cat && (
          <div
            key={`cat-${cat.questionId}`}
            className="flex w-full max-w-5xl flex-col items-center gap-8"
          >
            <div className="flex flex-col items-center gap-3">
              <Kicker>Catégorie {cat.index + 1}</Kicker>
              <h2 className="text-ivoire font-display max-w-3xl text-4xl leading-tight font-semibold sm:text-5xl">
                {cat.prompt}
              </h2>
            </div>

            {step === 0 && !noVotes && (
              <p className="text-or-400/70 brunos-fade font-sans text-sm tracking-[0.3em] uppercase">
                {winners.length > 1
                  ? "… et les Brunos reviennent à …"
                  : "… et le Bruno revient à …"}
              </p>
            )}

            {noVotes && (
              <p className="brunos-fade text-ivoire-muted font-sans text-base">
                Personne n&apos;a voté dans cette catégorie 🤷
              </p>
            )}

            {step >= 1 && winners.length > 0 && (
              <div
                key={`winner-${cat.questionId}`}
                className="brunos-winner flex flex-col items-center gap-4"
              >
                <div className="flex flex-wrap items-center justify-center gap-8">
                  {winners.map((w) => (
                    <div key={w.playerId} className="flex flex-col items-center gap-3">
                      <Avatar name={w.name} headshot={w.headshot} size={150} />
                      <span className="text-or-300 font-display text-3xl font-semibold sm:text-4xl">
                        {w.name}
                      </span>
                    </div>
                  ))}
                </div>
                <span className="text-ivoire-faint font-sans text-xs tracking-[0.3em] uppercase">
                  {winners.length > 1 ? "Remportent la catégorie" : "Remporte la catégorie"}
                </span>
              </div>
            )}

            {step >= 2 && cat.players.length > 0 && (
              <div
                key="full"
                className={`grid w-full gap-8 ${
                  cat.jury.length > 0 ? "sm:grid-cols-2" : "sm:grid-cols-1"
                }`}
              >
                <RankColumn title="Classement des joueurs" rows={cat.players} showDrinks />
                {cat.jury.length > 0 && (
                  <RankColumn
                    title="Classement de l'entourage"
                    rows={cat.jury}
                    showDrinks={false}
                  />
                )}
              </div>
            )}
          </div>
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

function RankColumn({
  title,
  rows,
  showDrinks,
}: {
  title: string;
  rows: RankRow[];
  showDrinks: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-or-400/70 mb-1 font-sans text-xs tracking-[0.25em] uppercase">{title}</p>
      <ol className="flex flex-col gap-1.5">
        {rows.map((r, i) => {
          const shooter = showDrinks && Boolean(r.isShooter);
          return (
            <li
              key={r.playerId}
              className={`brunos-rise brunos-glass flex items-center gap-3 rounded-xl border px-4 py-2.5 ${
                shooter ? "border-or-400/45 bg-or-500/10" : "border-or-400/12"
              }`}
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <span className="text-ivoire-faint w-5 text-right font-sans text-sm tabular-nums">
                {r.finalRank}
              </span>
              <Avatar name={r.name} headshot={r.headshot} size={36} />
              <span className="text-ivoire flex-1 text-left font-sans text-sm">{r.name}</span>
              {showDrinks && (
                <span
                  className={`font-sans text-sm tabular-nums ${
                    shooter ? "text-or-300" : "text-ivoire-muted"
                  }`}
                >
                  {shooter ? "🥃 " : ""}
                  {r.drinks}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
