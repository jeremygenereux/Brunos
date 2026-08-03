"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { invitePerson } from "./actions";

export function InviteButton({
  personId,
  disabled,
  label,
}: {
  personId: string;
  /** Pas de courriel noté : rien à envoyer. */
  disabled: boolean;
  label: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const router = useRouter();

  function send() {
    setError(null);
    setSent(false);
    start(async () => {
      const r = await invitePerson(personId);
      if (r.error) setError(r.error);
      else {
        setSent(true);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={send}
        disabled={pending || disabled}
        title={disabled ? "Note d'abord un courriel d'invitation" : undefined}
        className="border-or-400/30 text-or-300 hover:bg-noir-900 rounded-lg border px-3 py-1.5 font-sans text-sm transition disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? "Envoi…" : label}
      </button>
      {sent && <span className="text-or-300 font-sans text-xs">Invitation envoyée ✓</span>}
      {error && <span className="font-sans text-xs text-red-300/90">{error}</span>}
    </div>
  );
}
