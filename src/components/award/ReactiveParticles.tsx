"use client";

// ReactiveParticles — poussière dorée sur <canvas>, transparente (se pose
// PAR-DESSUS le fond existant du deck, sans le remplacer). Réactions visibles :
//   • répulsion : les grains s'écartent doucement du curseur,
//   • bloom : à chaque changement de `pulseKey` (= un reveal), une poussée vers
//     le haut + un éclat qui retombe lentement.
// Sprite pré-rendu (drawImage) plutôt que shadowBlur → fluide. Respecte
// prefers-reduced-motion (poussière figée, aucune réaction).

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export type ReactiveParticlesProps = {
  density?: number;
  /** Change cette clé pour déclencher un bloom (ex. `${slide}-${step}`). */
  pulseKey?: React.Key;
  className?: string;
};

type Dust = {
  x: number;
  y: number;
  r: number;
  baseAlpha: number;
  driftY: number;
  wander: number;
  phase: number;
  vx: number;
  vy: number;
};

export function ReactiveParticles({ density = 70, pulseKey, className }: ReactiveParticlesProps) {
  const reduce = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const partsRef = useRef<Dust[]>([]);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const bloomRef = useRef(0);

  // Pointeur (répulsion).
  useEffect(() => {
    if (reduce) return;
    function onMove(e: PointerEvent) {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    }
    function onLeave() {
      mouseRef.current = { x: -9999, y: -9999 };
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
    };
  }, [reduce]);

  // Bloom au reveal : poussée vers le haut + éclat.
  useEffect(() => {
    if (reduce || pulseKey === undefined) return;
    bloomRef.current = 1;
    for (const p of partsRef.current) {
      p.vy -= 1.4 + Math.random() * 1.2;
      p.vx += (Math.random() - 0.5) * 1.2;
    }
  }, [pulseKey, reduce]);

  // Boucle de rendu.
  useEffect(() => {
    const canvasEl = canvasRef.current;
    const hostEl = canvasEl?.parentElement;
    const ctx2d = canvasEl?.getContext("2d");
    if (!canvasEl || !hostEl || !ctx2d) return;
    const view: HTMLCanvasElement = canvasEl;
    const host: HTMLElement = hostEl;
    const context: CanvasRenderingContext2D = ctx2d;

    // Sprite doux pré-rendu (bokeh).
    const sprite = document.createElement("canvas");
    sprite.width = 32;
    sprite.height = 32;
    const sctx = sprite.getContext("2d");
    if (sctx) {
      const g = sctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      g.addColorStop(0, "rgba(252, 234, 178, 1)");
      g.addColorStop(0.35, "rgba(240, 210, 120, 0.55)");
      g.addColorStop(1, "rgba(240, 210, 120, 0)");
      sctx.fillStyle = g;
      sctx.fillRect(0, 0, 32, 32);
    }

    let raf = 0;
    let w = 0;
    let h = 0;
    const R = 150; // rayon de répulsion

    function seed() {
      partsRef.current = Array.from({ length: density }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.7 + 0.6,
        baseAlpha: Math.random() * 0.45 + 0.12,
        driftY: -(Math.random() * 0.12 + 0.02),
        wander: Math.random() * 0.25 + 0.05,
        phase: Math.random() * Math.PI * 2,
        vx: 0,
        vy: 0,
      }));
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = host.clientWidth;
      h = host.clientHeight;
      view.width = Math.max(1, Math.floor(w * dpr));
      view.height = Math.max(1, Math.floor(h * dpr));
      view.style.width = `${w}px`;
      view.style.height = `${h}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    }

    function frame(t: number) {
      context.clearRect(0, 0, w, h);
      const bloom = bloomRef.current;
      const mouse = mouseRef.current;
      for (const p of partsRef.current) {
        // Répulsion curseur.
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.hypot(dx, dy);
        if (dist < R && dist > 0.001) {
          const force = (1 - dist / R) * 0.9;
          p.vx += (dx / dist) * force;
          p.vy += (dy / dist) * force;
        }
        // Friction + dérive de fond.
        p.vx *= 0.9;
        p.vy *= 0.9;
        p.x += p.vx + Math.sin(p.phase + t * 0.0004) * p.wander;
        p.y += p.vy + p.driftY;
        // Enroulement aux bords.
        if (p.y < -8) {
          p.y = h + 8;
          p.x = Math.random() * w;
        } else if (p.y > h + 8) {
          p.y = -8;
        }
        if (p.x < -8) p.x = w + 8;
        else if (p.x > w + 8) p.x = -8;

        const twinkle = 0.6 + 0.4 * Math.sin(p.phase + t * 0.001 * p.wander * 4);
        const alpha = Math.min(1, p.baseAlpha * twinkle * (1 + bloom * 1.6));
        const size = p.r * (4 + bloom * 2.5);
        context.globalAlpha = alpha;
        context.drawImage(sprite, p.x - size, p.y - size, size * 2, size * 2);
      }
      context.globalAlpha = 1;
      bloomRef.current *= 0.95;
      if (bloomRef.current < 0.01) bloomRef.current = 0;
      if (!reduce) raf = requestAnimationFrame(frame);
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    if (reduce) frame(0);
    else raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [density, reduce]);

  return (
    <div aria-hidden="true" className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
