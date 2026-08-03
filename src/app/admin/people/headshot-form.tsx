"use client";

import { useActionState } from "react";
import { setPersonHeadshot, type PeopleState } from "./actions";

const initialState: PeopleState = { error: null };

/** Portrait de référence : il suit la personne d'une édition à l'autre. */
export function HeadshotForm({ personId, hasPhoto }: { personId: string; hasPhoto: boolean }) {
  const [state, formAction] = useActionState(setPersonHeadshot, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="person_id" value={personId} />
      <input
        type="file"
        name="headshot"
        accept="image/png,image/jpeg,image/webp"
        required
        className="text-ivoire-faint file:border-or-400/30 file:text-or-300 hover:file:bg-noir-900 max-w-[13rem] font-sans text-xs file:mr-3 file:cursor-pointer file:rounded-lg file:border file:bg-transparent file:px-3 file:py-1.5 file:font-sans file:text-xs"
      />
      <button
        type="submit"
        className="border-or-400/30 text-or-300 hover:bg-noir-900 rounded-lg border px-3 py-1.5 font-sans text-sm transition"
      >
        {hasPhoto ? "Changer la photo" : "Ajouter une photo"}
      </button>
      {state.success && <span className="text-or-300 font-sans text-xs">Photo enregistrée ✓</span>}
      {state.error && <span className="font-sans text-xs text-red-300/90">{state.error}</span>}
    </form>
  );
}
