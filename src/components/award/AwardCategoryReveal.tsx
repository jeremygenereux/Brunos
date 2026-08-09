"use client";

// AwardCategoryReveal — la chorégraphie « remise de prix » d'une catégorie,
// en PODIUM COMPLÈTEMENT INVERSÉ.
//
//   step 0 : la CATÉGORIE est présentée en grand, centrée.
//   step ≥1 : le titre glisse vers le haut, puis :
//             a) le classement se remplit ligne à ligne, MAIS il s'arrête
//                deux positions avant la fin ;
//             b) après un silence, l'avant-dernière position tombe en ligne
//                et — quasi simultanément — le·la SHOOTER surgit en grande
//                face card (le seul portrait mis en avant de la scène).
//   children : contenu additionnel (déboules) sous la cascade.
//
// Pourquoi garder DEUX positions pour la fin : si la liste allait jusqu'à N-1,
// la dernière personne serait devinable par élimination. En dévoilant les deux
// dernières quasi en même temps, le doute tient jusqu'au bout.
//
// L'ORDRE est calculé par l'appelant, climax en dernier — ce qui rend la
// chorégraphie juste quelle que soit la règle de boisson :
//   • ESCALATION → 1re position … dernière (qui cale)
//   • TOP_UNIQUE → dernière position … 1re (qui cale)

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { DUR, EASE } from "./cinematic-motion";
import { CinematicRevealText } from "./CinematicRevealText";
import { AnimatedOrnamentLine } from "./AnimatedOrnamentLine";

/** Une personne à dévoiler. */
export type RevealPerson = { id: string; name: string; headshot: string | null };

/**
 * Une POSITION dans la cascade — pas une personne. Deux ex æquo occupent la
 * même position : un seul numéro, une seule ardoise, plusieurs visages, et ils
 * se dévoilent d'un même geste. Les séparer trahirait l'égalité et laisserait
 * croire à deux verdicts.
 */
export type RevealEntry = {
  id: string;
  rank: number;
  drinks: number;
  people: RevealPerson[];
};

/* ── Rythme de la cascade (secondes) ─────────────────────────────────────
   Un seul endroit pour régler la mise en scène. Les silences sont exprimés
   en temps RÉEL (mesurés après la fin du geste précédent), pas en décalage
   brut — c'est ce qui rend le réglage prévisible.                        */
const CASCADE_START = 0.35;
/** Écart entre deux positions de la liste (elles se chevauchent). */
const ROW_GAP = 1.0;
/** Silence après la liste, avant le duo final — le vrai suspense. */
const PRE_FINALE = 1.6;
/** Décalage entre l'avant-dernière position et le verdict : quasi simultané. */
const NEAR_SIMULTANEOUS = 0.45;

export type AwardCategoryRevealProps = {
  kicker: string;
  prompt: string;
  /** 0 = catégorie seule ; ≥1 = cascade révélée. */
  step: number;
  /** Les positions dévoilées en liste (toutes sauf les deux dernières). */
  buildUp: RevealEntry[];
  /** L'avant-dernière position — dévoilée en ligne, juste avant le verdict. */
  penultimate?: RevealEntry | null;
  /** Le climax : la ou les personnes qui calent (ex æquo possible). */
  shooters: RevealEntry[];
  /** Affiche la cascade. Par défaut = (step ≥ 1). */
  cascadeVisible?: boolean;
  teaser: string;
  noVotes?: boolean;
  noVotesLabel?: string;
  renderAvatar: (person: RevealPerson, size: number) => React.ReactNode;
  children?: React.ReactNode;
};

function gorgees(n: number) {
  return `${n} ${n > 1 ? "gorgées" : "gorgée"}`;
}

export function AwardCategoryReveal({
  kicker,
  prompt,
  step,
  buildUp,
  penultimate,
  shooters,
  cascadeVisible,
  teaser,
  noVotes = false,
  noVotesLabel,
  renderAvatar,
  children,
}: AwardCategoryRevealProps) {
  const reduce = useReducedMotion();
  const revealed = step >= 1;
  const showCascade = (cascadeVisible ?? revealed) && shooters.length > 0;

  const d = (v: number) => (reduce ? 0 : v);

  // Chaîne de temps : chaque geste part de la FIN du précédent + un silence.
  const listEnd = buildUp.length ? CASCADE_START + (buildUp.length - 1) * ROW_GAP + DUR.block : 0;
  const penultDelay = listEnd + PRE_FINALE;
  const climaxDelay = penultimate ? penultDelay + NEAR_SIMULTANEOUS : penultDelay;

  // La liste inclut l'avant-dernière position — même traitement visuel, mais
  // elle n'arrive qu'au moment du duo final.
  const rows: { entry: RevealEntry; delay: number }[] = [
    ...buildUp.map((entry, i) => ({ entry, delay: CASCADE_START + i * ROW_GAP })),
    ...(penultimate ? [{ entry: penultimate, delay: penultDelay }] : []),
  ];

  return (
    <div className="flex w-full max-w-5xl flex-col items-center gap-8 text-center">
      {/* En-tête : glisse vers le haut quand la cascade arrive.
          `layout="position"` (et non `layout`) est essentiel : le layout complet
          anime la TAILLE en appliquant un scale non-uniforme, ce qui déforme /
          étire le texte. En position seule, la boîte ne fait que se déplacer.
          Corollaire : la taille de police reste constante — un changement de
          taille en cours de route produirait un à-coup. */}
      <motion.div
        layout={reduce ? false : "position"}
        transition={{ layout: { duration: DUR.glide, ease: EASE.inOut } }}
        className="flex flex-col items-center gap-4"
      >
        <motion.p
          className="text-or-400/80 font-sans text-sm tracking-[0.4em] uppercase"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, ease: EASE.gentle }}
        >
          {kicker}
        </motion.p>
        {/* Le titre s'estompe une fois la cascade lancée : la hiérarchie
            bascule par l'opacité seule, sans toucher à la géométrie. */}
        <motion.div
          animate={{ opacity: revealed ? 0.72 : 1 }}
          transition={{ duration: DUR.glide, ease: EASE.gentle }}
        >
          <CinematicRevealText
            as="h2"
            splitBy="words"
            blur
            text={prompt}
            className={cn(
              "text-ivoire font-display max-w-4xl font-semibold leading-[1.08]",
              "text-4xl sm:text-6xl",
            )}
          />
        </motion.div>
      </motion.div>

      {/* step 0 : amorce / pas de votes. */}
      {!revealed && !noVotes && (
        <motion.p
          className="text-or-400/70 font-sans text-sm tracking-[0.3em] uppercase"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: EASE.gentle, delay: d(1.4) }}
        >
          {teaser}
        </motion.p>
      )}
      {!revealed && noVotes && noVotesLabel && (
        <motion.p
          className="text-ivoire-muted font-sans text-base"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: d(1) }}
        >
          {noVotesLabel}
        </motion.p>
      )}

      {/* step ≥1 : le classement, puis le verdict. */}
      {showCascade && (
        <div className="flex w-full flex-col items-center gap-9">
          {rows.length > 0 && (
            <ol className="flex w-full max-w-md flex-col gap-1.5">
              {rows.map(({ entry, delay }) => (
                <motion.li
                  key={entry.id}
                  className="brunos-glass border-or-400/12 flex items-stretch gap-3 rounded-xl border px-4 py-2"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: DUR.block, ease: EASE.expoOut, delay: d(delay) }}
                >
                  <span className="flex w-5 shrink-0 items-center justify-end">
                    <span className="text-ivoire-faint font-sans text-sm tabular-nums">
                      {entry.rank}
                    </span>
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
                    {entry.people.map((p) => (
                      <span key={p.id} className="flex items-center gap-3">
                        {renderAvatar(p, 34)}
                        <span className="text-ivoire flex-1 truncate text-left font-sans text-sm">
                          {p.name}
                        </span>
                      </span>
                    ))}
                    {entry.people.length > 1 && (
                      <span className="text-or-400/70 font-sans text-[11px] tracking-wide uppercase">
                        Ex æquo
                      </span>
                    )}
                  </span>
                  {entry.drinks > 0 && (
                    <span className="flex shrink-0 items-center">
                      <span className="text-ivoire-muted font-sans text-sm tabular-nums">
                        {gorgees(entry.drinks)}
                        {entry.people.length > 1 && " chacun"}
                      </span>
                    </span>
                  )}
                </motion.li>
              ))}
            </ol>
          )}

          {/* Le verdict : la seule grande face card de la scène. Elle se
              matérialise (flou qui se dissipe + montée d'échelle) — le geste
              le plus lent et le plus appuyé de toute la présentation. */}
          <div className="flex flex-wrap items-end justify-center gap-12">
            {shooters.flatMap((g) => g.people.map((p) => ({ ...p, group: g }))).map((p, i) => (
              <motion.div
                key={p.id}
                className="flex flex-col items-center gap-4"
                initial={
                  reduce
                    ? { opacity: 0 }
                    : { opacity: 0, scale: 0.8, y: 28, filter: "blur(14px)" }
                }
                animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
                transition={{
                  duration: DUR.winner,
                  ease: EASE.expoOut,
                  delay: d(climaxDelay + i * 0.5),
                }}
              >
                <div className="brunos-aura">{renderAvatar(p, 200)}</div>
                <CinematicRevealText
                  as="span"
                  splitBy="chars"
                  text={p.name}
                  delay={d(climaxDelay + 0.5 + i * 0.5)}
                  className="text-or-300 font-display text-5xl font-semibold sm:text-6xl"
                />
                <motion.span
                  className="text-or-400/85 font-sans text-xs tracking-[0.45em] uppercase"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 1.1, delay: d(climaxDelay + 1.1 + i * 0.5) }}
                >
                  Shooter
                </motion.span>
              </motion.div>
            ))}
          </div>

          <AnimatedOrnamentLine delay={d(climaxDelay + 1.4)} width="min(18rem, 50vw)" />
        </div>
      )}

      {children}
    </div>
  );
}
