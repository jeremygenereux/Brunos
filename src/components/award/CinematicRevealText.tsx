"use client";

// CinematicRevealText — révélation typographique par masque (clipping vertical).
// Le texte est découpé en mots / lettres / lignes ; chaque segment monte
// lentement depuis sous un masque, avec un léger flou qui se dissipe (poids,
// pas de flash). Aucun balayage lumineux.
//
// Accessibilité : texte complet via aria-label, segments visuels aria-hidden.
// Repli plat (fondu) si prefers-reduced-motion.

import { Fragment } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { DUR, EASE, STAGGER } from "./cinematic-motion";

type SplitMode = "chars" | "words" | "lines";
type AsTag = "h1" | "h2" | "h3" | "p" | "span" | "div";

export type CinematicRevealTextProps = {
  text: string;
  splitBy?: SplitMode;
  as?: AsTag;
  /** Délai de base avant le 1er segment (s). */
  delay?: number;
  /** Cadence entre segments (s). Par défaut selon `splitBy`. */
  stagger?: number;
  /** Léger flou qui se dissipe (recommandé pour les gros titres). */
  blur?: boolean;
  className?: string;
  style?: React.CSSProperties;
};

// `custom` = délai absolu (s) du segment.
function makeVariants(blur: boolean): Variants {
  return {
    hidden: { y: "115%", opacity: 0, filter: blur ? "blur(12px)" : "blur(0px)" },
    visible: (delaySec: number) => ({
      y: "0%",
      opacity: 1,
      filter: "blur(0px)",
      transition: { duration: DUR.segment, ease: EASE.expoOut, delay: delaySec },
    }),
  };
}

function Clip({ children, block = false }: { children: React.ReactNode; block?: boolean }) {
  return (
    <span
      style={{
        display: block ? "block" : "inline-block",
        overflow: "hidden",
        verticalAlign: "bottom",
        paddingBottom: "0.16em",
        marginBottom: "-0.16em",
      }}
    >
      {children}
    </span>
  );
}

export function CinematicRevealText({
  text,
  splitBy = "words",
  as = "div",
  delay = 0,
  stagger,
  blur = false,
  className,
  style,
}: CinematicRevealTextProps) {
  const reduce = useReducedMotion();
  const Tag = motion[as];
  const step = stagger ?? STAGGER[splitBy];
  const variants = makeVariants(blur && !reduce);

  if (reduce) {
    const Plain = motion[as];
    return (
      <Plain
        className={className}
        style={style}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay }}
      >
        {text}
      </Plain>
    );
  }

  let key = 0;
  let content: React.ReactNode;

  if (splitBy === "lines") {
    const lines = text.split("\n");
    content = lines.map((line, i) => (
      <Clip key={key++} block>
        <motion.span style={{ display: "block" }} variants={variants} custom={delay + i * step}>
          {line || " "}
        </motion.span>
      </Clip>
    ));
  } else if (splitBy === "words") {
    const words = text.split(" ");
    content = words.map((word, i) => (
      <Fragment key={key++}>
        <Clip>
          <motion.span
            style={{ display: "inline-block" }}
            variants={variants}
            custom={delay + i * step}
          >
            {word}
          </motion.span>
        </Clip>
        {i < words.length - 1 ? " " : null}
      </Fragment>
    ));
  } else {
    const words = text.split(" ");
    let idx = 0;
    content = words.map((word, wi) => (
      <Fragment key={key++}>
        <span style={{ display: "inline-flex", whiteSpace: "nowrap" }}>
          {Array.from(word).map((ch) => {
            const d = delay + idx * step;
            idx += 1;
            return (
              <Clip key={key++}>
                <motion.span style={{ display: "inline-block" }} variants={variants} custom={d}>
                  {ch}
                </motion.span>
              </Clip>
            );
          })}
        </span>
        {wi < words.length - 1 ? " " : null}
      </Fragment>
    ));
  }

  return (
    <Tag
      aria-label={text}
      className={className}
      style={style}
      initial="hidden"
      animate="visible"
    >
      <span aria-hidden="true">{content}</span>
    </Tag>
  );
}
