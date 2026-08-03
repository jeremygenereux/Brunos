// Tokens de motion partagés. Parti pris : LENT et lourd. On s'aligne sur
// l'expo-out déjà utilisé dans globals.css (cubic-bezier(0.16, 1, 0.3, 1)).

import type { Transition } from "framer-motion";

type Bezier = [number, number, number, number];

export const EASE = {
  /** Arrivée posée, prestige (identique au deck d'origine). */
  expoOut: [0.16, 1, 0.3, 1] as Bezier,
  /** Plus douce encore, pour les fondus lents. */
  gentle: [0.22, 1, 0.36, 1] as Bezier,
  /** Va-et-vient (déplacements de « caméra »). */
  inOut: [0.83, 0, 0.17, 1] as Bezier,
} as const;

/** Durées (secondes). Volontairement longues — c'est une cérémonie. */
export const DUR = {
  segment: 1.4,
  block: 1.7,
  /** L'avant-dernière position — un faux climax, déjà solennel. */
  penult: 2.1,
  /** Le vrai climax : volontairement le geste le plus long de la scène. */
  winner: 2.8,
  glide: 1.1,
} as const;

/** Cadence d'apparition par segment selon le découpage. Lente. */
export const STAGGER = {
  chars: 0.055,
  words: 0.14,
  lines: 0.22,
} as const;

export const SPRING_SOFT: Transition = {
  type: "spring",
  stiffness: 90,
  damping: 24,
  mass: 1.1,
};
