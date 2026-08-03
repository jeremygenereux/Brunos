"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPersonKind } from "./actions";

type Kind = "player" | "jury";

/** Joueur (peut être nommé) ou proche (vote, mais n'est jamais nommé). */
export function KindSelect({ personId, initial }: { personId: string; initial: Kind }) {
  const [kind, setKind] = useState<Kind>(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={kind}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value as Kind;
          const prev = kind;
          setKind(next);
          setError(null);
          start(async () => {
            const r = await setPersonKind(personId, next);
            if (r.error) {
              setKind(prev);
              setError(r.error);
            } else router.refresh();
          });
        }}
        className="border-or-400/20 bg-noir-900/60 text-ivoire focus:border-or-400/60 rounded-lg border px-2 py-1 font-sans text-xs outline-none disabled:opacity-60"
      >
        <option value="player">Joueur</option>
        <option value="jury">Proche</option>
      </select>
      {error && <span className="font-sans text-xs text-red-300/90">{error}</span>}
    </div>
  );
}
