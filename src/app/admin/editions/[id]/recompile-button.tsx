"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recompileEdition } from "./actions";

/**
 * Recalcule les classements figés depuis les bulletins actuels.
 *
 * Utile dès qu'une donnée d'entrée a bougé après le verrouillage : valeur d'un
 * shooter, règle de consommation, sélection des questions, bulletin corrigé.
 */
export function RecompileButton({ editionId }: { editionId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const router = useRouter();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          setDone(false);
          start(async () => {
            const r = await recompileEdition(editionId);
            if (r.error) setError(r.error);
            else {
              setDone(true);
              router.refresh();
            }
          });
        }}
        className="border-or-400/30 text-or-300 hover:bg-noir-900 rounded-lg border px-4 py-2 font-sans text-sm transition disabled:opacity-50"
      >
        {pending ? "Recalcul…" : "Recompiler les résultats"}
      </button>
      {done && <span className="text-or-300 font-sans text-xs">Résultats à jour ✓</span>}
      {error && <span className="font-sans text-xs text-red-300/90">{error}</span>}
    </div>
  );
}
