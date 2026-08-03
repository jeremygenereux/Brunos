"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setCircleAdmin } from "./actions";

/**
 * Désigne ou révoque un administrateur de cercle.
 *
 * Le retrait du dernier administrateur est refusé en base : on remonte le
 * message tel quel plutôt que de dupliquer la règle ici, pour qu'il n'existe
 * qu'un seul endroit où elle soit vraie.
 */
export function AdminToggle({
  circleId,
  userId,
  isAdmin,
  label,
}: {
  circleId: string;
  userId: string;
  isAdmin: boolean;
  label: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <span className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          start(async () => {
            const r = await setCircleAdmin(circleId, userId, !isAdmin);
            if (r.error) setError(r.error);
            else router.refresh();
          });
        }}
        className={`rounded-lg border px-3 py-1.5 font-sans text-xs transition disabled:opacity-50 ${
          isAdmin
            ? "border-or-400/45 text-or-300 hover:bg-noir-900"
            : "border-or-400/20 text-ivoire-muted hover:text-or-300"
        }`}
      >
        {pending ? "…" : isAdmin ? `Retirer ${label}` : `Nommer ${label}`}
      </button>
      {error && <span className="font-sans text-xs text-red-300/90">{error}</span>}
    </span>
  );
}
