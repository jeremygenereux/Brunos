"use client";

import { useActionState, useEffect, useRef } from "react";
import { addPlayer, type PlayerState } from "./actions";
import { Input, Label, SubmitButton } from "@/components/ui";

const initialState: PlayerState = { error: null };

export function AddPlayerForm({ editionId }: { editionId: string }) {
  const [state, formAction] = useActionState(addPlayer, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="border-or-400/15 bg-noir-700/40 flex flex-col gap-4 rounded-2xl border p-6 sm:flex-row sm:items-end"
    >
      <input type="hidden" name="edition_id" value={editionId} />

      <div className="flex flex-1 flex-col gap-1.5">
        <Label htmlFor="name">Nom du joueur</Label>
        <Input id="name" name="name" required placeholder="Jérémy" />
      </div>

      <div className="flex flex-1 flex-col gap-1.5">
        <Label htmlFor="headshot">Photo (carré conseillé)</Label>
        <input
          id="headshot"
          name="headshot"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="text-ivoire-muted file:border-or-400/30 file:bg-noir-900/60 file:text-or-300 hover:file:bg-noir-900 w-full font-sans text-sm file:mr-3 file:rounded-md file:border file:px-3 file:py-1.5 file:font-sans file:text-sm"
        />
      </div>

      <SubmitButton className="w-auto">Ajouter</SubmitButton>

      {state.error && <p className="font-sans text-sm text-red-300/90 sm:w-full">{state.error}</p>}
      {state.success && <p className="text-or-300 font-sans text-sm sm:w-full">Joueur ajouté ✓</p>}
    </form>
  );
}
