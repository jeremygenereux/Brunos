// Briques cinématiques du mode présentation des Brunos — sobres, lentes,
// posées par-dessus la direction artistique existante (or sur noir).
//
//   AwardCategoryReveal  — catégorie → (glisse en haut) → podium inversé
//   CinematicRevealText  — révélation typographique par masque (mots/lettres/lignes)
//   ReactiveParticles    — poussière dorée réactive (curseur + bloom au reveal)
//   AnimatedOrnamentLine — ligne dorée qui s'étire depuis le centre

export { AwardCategoryReveal } from "./AwardCategoryReveal";
export type { AwardCategoryRevealProps, RevealEntry } from "./AwardCategoryReveal";
export { CinematicRevealText, type CinematicRevealTextProps } from "./CinematicRevealText";
export { ReactiveParticles, type ReactiveParticlesProps } from "./ReactiveParticles";
export { AnimatedOrnamentLine, type AnimatedOrnamentLineProps } from "./AnimatedOrnamentLine";
export { EASE, DUR, STAGGER, SPRING_SOFT } from "./cinematic-motion";
