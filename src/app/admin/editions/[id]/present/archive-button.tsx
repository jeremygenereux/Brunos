"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { archiveEdition } from "../actions";

export function ArchiveButton({ editionId }: { editionId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function go() {
    setError(null);
    start(async () => {
      const r = await archiveEdition(editionId);
      if (r.error) setError(r.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-center gap-2" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={go}
        disabled={pending}
        className="from-or-300 to-or-600 text-noir-900 hover:from-or-400 hover:to-or-500 rounded-full bg-gradient-to-b px-7 py-3 font-sans text-sm font-semibold shadow-lg transition disabled:opacity-60"
      >
        {pending ? "Archivage…" : "Envoyer à l'archive"}
      </button>
      {error && <p className="font-sans text-xs text-red-300/90">{error}</p>}
    </div>
  );
}
