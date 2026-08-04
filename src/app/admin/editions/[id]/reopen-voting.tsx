"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reopenVoting } from "./actions";
import { eventInputToIso, isoToEventInput } from "@/lib/dates/event-time";

/**
 * Réouverture du scrutin, même après échéance ou verrouillage.
 *
 * Laisser l'échéance vide rouvre sans limite de temps : c'est le réglage le
 * plus sûr quand on rouvre en urgence pour corriger un problème.
 */
export function ReopenVoting({
  editionId,
  currentDeadline,
  resultsAreFrozen,
}: {
  editionId: string;
  currentDeadline: string | null;
  resultsAreFrozen: boolean;
}) {
  const [deadline, setDeadline] = useState(isoToEventInput(currentDeadline));
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const router = useRouter();

  return (
    <div className="border-or-400/12 mt-5 flex flex-col gap-3 rounded-xl border px-4 py-3">
      <p className="text-ivoire-muted font-sans text-xs">
        Rouvrir le scrutin pour corriger un problème. Une échéance vide rouvre sans limite de temps.
        {resultsAreFrozen && (
          <>
            {" "}
            Les classements déjà figés resteront en place : pensez à les recompiler ensuite.
          </>
        )}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="datetime-local"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          className="border-or-400/20 bg-noir-900/60 text-ivoire focus:border-or-400/60 rounded-lg border px-3 py-1.5 font-sans text-sm outline-none"
        />
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!window.confirm("Rouvrir le scrutin pour cette cérémonie ?")) return;
            setError(null);
            setDone(false);
            start(async () => {
              const r = await reopenVoting(
                editionId,
                deadline ? eventInputToIso(deadline) : null,
              );
              if (r.error) setError(r.error);
              else {
                setDone(true);
                router.refresh();
              }
            });
          }}
          className="border-or-400/30 text-or-300 hover:bg-noir-900 rounded-lg border px-4 py-2 font-sans text-sm transition disabled:opacity-50"
        >
          {pending ? "Réouverture…" : "Rouvrir le scrutin"}
        </button>
        {done && <span className="text-or-300 font-sans text-xs">Scrutin rouvert ✓</span>}
        {error && <span className="font-sans text-xs text-red-300/90">{error}</span>}
      </div>
    </div>
  );
}
