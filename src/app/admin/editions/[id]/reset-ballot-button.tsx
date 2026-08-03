"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resetBallot } from "./actions";

/**
 * Efface le bulletin d'un participant. Un bulletin déposé est verrouillé pour
 * son auteur : c'est la seule façon de corriger une erreur signalée après coup.
 * L'opération est irréversible, d'où la confirmation nominative.
 */
export function ResetBallotButton({
  editionId,
  participantId,
  name,
}: {
  editionId: string;
  participantId: string;
  name: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (
            !window.confirm(
              `Effacer le bulletin de ${name} ? Ses réponses seront perdues et le scrutin lui sera rouvert.`,
            )
          ) {
            return;
          }
          setError(null);
          start(async () => {
            const r = await resetBallot(editionId, participantId);
            if (r.error) setError(r.error);
            else router.refresh();
          });
        }}
        className="text-ivoire-faint font-sans text-xs transition hover:text-red-300 disabled:opacity-50"
      >
        {pending ? "…" : "Effacer"}
      </button>
      {error && <span className="font-sans text-xs text-red-300/90">{error}</span>}
    </span>
  );
}
