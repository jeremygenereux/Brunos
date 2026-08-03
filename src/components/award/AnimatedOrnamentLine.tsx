"use client";

// AnimatedOrnamentLine — une fine ligne dorée qui s'étire depuis le centre,
// avec un losange (diamant) art-déco optionnel qui éclôt au milieu et deux
// pointes lumineuses aux extrémités. scaleX depuis le centre = transform pur,
// donc fluide. Respecte prefers-reduced-motion.

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { EASE } from "./cinematic-motion";

export type AnimatedOrnamentLineProps = {
  /** Largeur max de la ligne (CSS). */
  width?: number | string;
  /** Délai avant l'étirement (s). */
  delay?: number;
  /** Affiche le losange central. */
  diamond?: boolean;
  className?: string;
};

export function AnimatedOrnamentLine({
  width = "min(22rem, 60vw)",
  delay = 0,
  diamond = true,
  className,
}: AnimatedOrnamentLineProps) {
  const reduce = useReducedMotion();

  const lineTransition = reduce
    ? { duration: 0 }
    : { duration: 1.3, ease: EASE.expoOut, delay };
  const dotTransition = reduce
    ? { duration: 0 }
    : { duration: 0.7, ease: EASE.expoOut, delay: delay + 0.4 };
  const diamondTransition = reduce
    ? { duration: 0 }
    : { duration: 0.8, ease: EASE.expoOut, delay: delay + 0.35 };

  return (
    <div
      aria-hidden="true"
      className={cn("relative flex h-4 items-center justify-center", className)}
      style={{ width }}
    >
      {/* Lueur d'accompagnement sous la ligne */}
      <motion.div
        className="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2"
        style={{
          background:
            "radial-gradient(60% 100% at 50% 50%, color-mix(in oklab, var(--or-400) 45%, transparent), transparent 75%)",
          filter: "blur(5px)",
        }}
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 0.8 }}
        transition={lineTransition}
      />
      {/* La ligne fine */}
      <motion.div
        className="h-px w-full origin-center"
        style={{
          background:
            "linear-gradient(90deg, transparent, color-mix(in oklab, var(--or-300) 90%, transparent) 50%, transparent)",
        }}
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={lineTransition}
      />
      {/* Pointes lumineuses aux extrémités */}
      {[0, 1].map((side) => (
        <motion.span
          key={side}
          className="absolute top-1/2 h-1 w-1 -translate-y-1/2 rounded-full"
          style={{
            [side === 0 ? "left" : "right"]: 0,
            background: "var(--or-300)",
            boxShadow: "0 0 8px 1px color-mix(in oklab, var(--or-400) 80%, transparent)",
          }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={dotTransition}
        />
      ))}
      {/* Losange central */}
      {diamond && (
        <motion.span
          className="absolute top-1/2 left-1/2 h-2 w-2"
          style={{
            background: "linear-gradient(135deg, var(--or-300), var(--or-600))",
            boxShadow: "0 0 10px 1px color-mix(in oklab, var(--or-400) 70%, transparent)",
            translateX: "-50%",
            translateY: "-50%",
            rotate: "45deg",
          }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={diamondTransition}
        />
      )}
    </div>
  );
}
