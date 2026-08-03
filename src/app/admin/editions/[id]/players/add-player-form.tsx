"use client";

import { useActionState, useEffect, useRef } from "react";
import { addPlayer, type PlayerState } from "./actions";
import { Input, Label, Select, SubmitButton } from "@/components/ui";

const initialState: PlayerState = { error: null };

type BankPerson = { id: string; name: string };

export function AddPlayerForm({
  editionId,
  available,
}: {
  editionId: string;
  available: BankPerson[];
}) {
  const [state, formAction] = useActionState(addPlayer, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="border-or-400/15 bg-noir-700/40 flex flex-col gap-4 rounded-2xl border p-6"
    >
      <input type="hidden" name="edition_id" value={editionId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="person_id">Depuis la banque</Label>
          <Select id="person_id" name="person_id" defaultValue="">
            <option value="">Choisir une personne…</option>
            {available.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">ou nouvelle personne</Label>
          <Input id="name" name="name" placeholder="Prénom Nom" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="headshot">Photo (carré conseillé)</Label>
        <input
          id="headshot"
          name="headshot"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="text-ivoire-muted file:border-or-400/30 file:bg-noir-900/60 file:text-or-300 hover:file:bg-noir-900 w-full font-sans text-sm file:mr-3 file:rounded-md file:border file:px-3 file:py-1.5 file:font-sans file:text-sm"
        />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton className="w-auto">Ajouter à l&apos;édition</SubmitButton>
        {state.error && <p className="font-sans text-sm text-red-300/90">{state.error}</p>}
        {state.success && <p className="text-or-300 font-sans text-sm">Joueur ajouté ✓</p>}
      </div>
    </form>
  );
}
