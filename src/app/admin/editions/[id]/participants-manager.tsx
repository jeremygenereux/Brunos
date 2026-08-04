"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setAppleInvite } from "./actions";

/**
 * Une personne conviée à une cérémonie. Elle vient de `players` (nommée) ou de
 * `edition_entourage` (proche d'un joueur) — jamais de `participants`, qui
 * n'existe qu'à partir du moment où un compte est créé et laisserait donc les
 * nouveaux venus sans ligne où coller leur lien.
 */
export type ManagedGuest = {
  personId: string;
  name: string;
  kind: "player" | "jury";
  hasAccount: boolean;
  apple_invite_url: string | null;
};

function Row({ editionId, guest }: { editionId: string; guest: ManagedGuest }) {
  const [url, setUrl] = useState(guest.apple_invite_url ?? "");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  const dirty = url.trim() !== (guest.apple_invite_url ?? "");

  function save() {
    setError(null);
    setSaved(false);
    start(async () => {
      const r = await setAppleInvite(editionId, guest.personId, url);
      if (r.error) setError(r.error);
      else {
        setSaved(true);
        router.refresh();
      }
    });
  }

  return (
    <li className="border-or-400/12 bg-noir-700/40 flex flex-col gap-2 rounded-xl border px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-ivoire font-sans text-sm font-medium">{guest.name}</span>
        <span className="text-ivoire-faint font-sans text-xs">
          {guest.kind === "jury" ? "Entourage" : "Joueur"}
        </span>
        {!guest.hasAccount && (
          <span className="border-or-400/25 text-or-400/80 rounded-full border px-2 py-0.5 font-sans text-[10px] tracking-wide uppercase">
            Sans compte
          </span>
        )}
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

export function ParticipantsManager({
  editionId,
  guests,
}: {
  editionId: string;
  guests: ManagedGuest[];
}) {
  if (guests.length === 0) {
    return (
      <p className="text-ivoire-muted font-sans text-sm">
        Aucun joueur ni proche pour l&apos;instant. Ajoutez des joueurs pour les voir ici.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {guests.map((g) => (
        <Row key={g.personId} editionId={editionId} guest={g} />
      ))}
    </ul>
  );
}
