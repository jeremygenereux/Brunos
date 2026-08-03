"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { selectCircle } from "./circle-actions";
import type { CircleOption } from "@/lib/editions/circle";

/**
 * Bascule d'un cercle à l'autre.
 *
 * Avec un seul cercle, un menu déroulant n'apporterait rien : on affiche
 * simplement son nom, pour que l'admin sache toujours où il travaille.
 */
export function CircleSwitcher({
  circles,
  currentId,
}: {
  circles: CircleOption[];
  currentId: string | null;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  if (circles.length === 0) return null;

  const current = circles.find((c) => c.id === currentId) ?? circles[0];

  if (circles.length === 1) {
    return (
      <span
        className="border-or-400/20 text-or-300/90 rounded-full border px-3 py-1 font-sans text-xs"
        title="Cercle administré"
      >
        {current.name}
      </span>
    );
  }

  return (
    <span className="flex items-center gap-2">
      <select
        value={current.id}
        disabled={pending}
        aria-label="Cercle administré"
        onChange={(e) => {
          const next = e.target.value;
          setError(null);
          start(async () => {
            const r = await selectCircle(next);
            if (r.error) setError(r.error);
            else router.refresh();
          });
        }}
        className="border-or-400/25 bg-noir-900/60 text-or-300 focus:border-or-400/60 rounded-full border px-3 py-1 font-sans text-xs outline-none disabled:opacity-60"
      >
        {circles.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      {error && <span className="font-sans text-xs text-red-300/90">{error}</span>}
    </span>
  );
}
