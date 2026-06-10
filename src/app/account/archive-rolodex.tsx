"use client";

import { useState } from "react";
import Link from "next/link";

export type RolodexEdition = { id: string; name: string; year: number };

const CARD_H = 84; // px
const STACK_STEP = 34; // overlap offset

export function ArchiveRolodex({ editions }: { editions: RolodexEdition[] }) {
  const [hover, setHover] = useState<number | null>(null);

  if (editions.length === 0) {
    return (
      <p className="text-ivoire-faint font-sans text-sm">
        L&apos;archive se remplira après la première soirée.
      </p>
    );
  }

  const height = CARD_H + (editions.length - 1) * STACK_STEP + 16;

  return (
    <div className="relative" style={{ height }}>
      {editions.map((e, i) => {
        const active = hover === i;
        const tilt = i % 2 === 0 ? -1.5 : 1.5;
        return (
          <Link
            key={e.id}
            href={`/archive/${e.id}`}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover((h) => (h === i ? null : h))}
            onFocus={() => setHover(i)}
            onBlur={() => setHover((h) => (h === i ? null : h))}
            className={`group absolute inset-x-0 flex items-center justify-between gap-3 rounded-2xl border px-5 transition-all duration-300 ease-out ${
              active
                ? "border-or-400/50 bg-noir-600/80 z-40 shadow-[0_22px_50px_-20px_rgba(0,0,0,0.85)]"
                : "border-or-400/15 bg-noir-700/60"
            }`}
            style={{
              top: i * STACK_STEP,
              height: CARD_H,
              zIndex: active ? 40 : i,
              transform: active
                ? "translateY(-10px) scale(1.03) rotate(0deg)"
                : `rotate(${tilt}deg)`,
              backdropFilter: "blur(10px)",
            }}
          >
            <div className="flex flex-col">
              <span className="text-ivoire font-display text-xl leading-tight font-semibold">
                {e.name}
              </span>
              <span
                className={`font-sans text-xs transition-opacity ${
                  active ? "text-or-300 opacity-100" : "text-ivoire-faint opacity-70"
                }`}
              >
                {active ? "Voir les résultats →" : "Édition archivée"}
              </span>
            </div>
            <span className="text-or-400/50 group-hover:text-or-300 font-display text-2xl tabular-nums transition">
              {e.year}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
