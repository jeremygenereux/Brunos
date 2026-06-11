"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteEdition } from "./actions";

export function DeleteEditionButton({
  editionId,
  name,
  redirectTo,
  compact = false,
}: {
  editionId: string;
  name: string;
  redirectTo?: string;
  compact?: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function go() {
    if (
      !window.confirm(
        `Supprimer définitivement « ${name} » ? Joueurs, questions, votes et résultats de cette édition seront effacés. Irréversible.`,
      )
    ) {
      return;
    }
    setError(null);
    start(async () => {
      const r = await deleteEdition(editionId);
      if (r.error) setError(r.error);
      else {
        router.push(redirectTo ?? "/admin/editions");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={go}
        disabled={pending}
        className={`rounded-lg border border-red-400/30 font-sans text-red-300/90 transition hover:bg-red-500/10 disabled:opacity-60 ${
          compact ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"
        }`}
      >
        {pending ? "Suppression…" : compact ? "Supprimer" : "Supprimer l'édition"}
      </button>
      {error && <p className="font-sans text-xs text-red-300/90">{error}</p>}
    </div>
  );
}
