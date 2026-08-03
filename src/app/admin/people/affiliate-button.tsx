"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { affiliatePerson } from "../cercles/actions";

/** Rattache une fiche orpheline au cercle en cours d'administration. */
export function AffiliateButton({
  personId,
  circleId,
  circleName,
}: {
  personId: string;
  circleId: string;
  circleName: string;
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
            const r = await affiliatePerson(personId, circleId);
            if (r.error) setError(r.error);
            else router.refresh();
          });
        }}
        className="border-or-400/30 text-or-300 hover:bg-noir-900 rounded-lg border px-3 py-1.5 font-sans text-sm transition disabled:opacity-50"
      >
        {pending ? "…" : `Rattacher à « ${circleName} »`}
      </button>
      {error && <span className="font-sans text-xs text-red-300/90">{error}</span>}
    </span>
  );
}
