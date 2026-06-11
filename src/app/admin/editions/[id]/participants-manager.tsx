"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setAppleInvite } from "./actions";

export type ManagedParticipant = {
  id: string;
  name: string;
  kind: "player" | "jury";
  apple_invite_url: string | null;
};

function Row({ p }: { p: ManagedParticipant }) {
  const [url, setUrl] = useState(p.apple_invite_url ?? "");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  const dirty = url.trim() !== (p.apple_invite_url ?? "");

  function save() {
    setError(null);
    setSaved(false);
    start(async () => {
      const r = await setAppleInvite(p.id, url);
      if (r.error) setError(r.error);
      else {
        setSaved(true);
        router.refresh();
      }
    });
  }

  return (
    <li className="border-or-400/12 bg-noir-700/40 flex flex-col gap-2 rounded-xl border px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="text-ivoire font-sans text-sm font-medium">{p.name}</span>
        <span className="text-ivoire-faint font-sans text-xs">
          {p.kind === "jury" ? "Entourage" : "Joueur"}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setSaved(false);
          }}
          placeholder="https://invites.apple.com/…"
          className="border-or-400/20 bg-noir-900/60 text-ivoire focus:border-or-400/60 min-w-0 flex-1 rounded-lg border px-3 py-1.5 font-sans text-sm outline-none"
        />
        <button
          type="button"
          onClick={save}
          disabled={pending || !dirty}
          className="border-or-400/30 text-or-300 hover:bg-noir-900 rounded-lg border px-3 py-1.5 font-sans text-sm transition disabled:opacity-40"
        >
          {pending ? "…" : "Enregistrer"}
        </button>
        {saved && <span className="text-or-300 font-sans text-xs">✓</span>}
      </div>
      {error && <p className="font-sans text-xs text-red-300/90">{error}</p>}
    </li>
  );
}

export function ParticipantsManager({ participants }: { participants: ManagedParticipant[] }) {
  if (participants.length === 0) {
    return (
      <p className="text-ivoire-muted font-sans text-sm">
        Personne n&apos;a encore rejoint l&apos;édition (partage le lien d&apos;invitation).
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {participants.map((p) => (
        <Row key={p.id} p={p} />
      ))}
    </ul>
  );
}
