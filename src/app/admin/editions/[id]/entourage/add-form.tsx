"use client";

import { useActionState, useEffect, useRef } from "react";
import { addEntourage, type EntourageState } from "./actions";
import { Input, Label, Select, SubmitButton } from "@/components/ui";

const initialState: EntourageState = { error: null };

export function AddEntourageForm({
  editionId,
  candidates,
  players,
}: {
  editionId: string;
  candidates: { id: string; name: string }[];
  players: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState(addEntourage, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  if (candidates.length === 0) {
    return (
      <p className="border-or-400/10 text-ivoire-muted rounded-2xl border border-dashed px-6 py-8 text-center font-sans text-sm">
        Tous les proches du répertoire sont déjà rattachés. Inscrivez une nouvelle personne de
        type « Proche » au répertoire pour en ajouter d&apos;autres.
      </p>
    );
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="border-or-400/15 bg-noir-700/40 grid gap-4 rounded-2xl border p-6 sm:grid-cols-2"
    >
      <input type="hidden" name="edition_id" value={editionId} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="person_id">Proche</Label>
        <Select id="person_id" name="person_id" required defaultValue="">
          <option value="" disabled>
            Choisir…
          </option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="linked_player_id">Rattaché à</Label>
        <Select id="linked_player_id" name="linked_player_id" required defaultValue="">
          <option value="" disabled>
            Choisir…
          </option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="relation_label">Lien</Label>
        <Input
          id="relation_label"
          name="relation_label"
          required
          placeholder="Mère de Raphaël"
          maxLength={80}
        />
      </div>

      <SubmitButton className="w-auto">Rattacher à la cérémonie</SubmitButton>
      {state.error && <p className="font-sans text-sm text-red-300/90 sm:col-span-2">{state.error}</p>}
      {state.success && (
        <p className="text-or-300 font-sans text-sm sm:col-span-2">Ajouté ✓</p>
      )}
    </form>
  );
}
