"use client";

import { useActionState, useEffect, useRef } from "react";
import { createPerson, type PeopleState } from "./actions";
import { Input, Label, Select, SubmitButton } from "@/components/ui";

const initialState: PeopleState = { error: null };

export function CreatePersonForm() {
  const [state, formAction] = useActionState(createPerson, initialState);
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
      <div className="flex flex-1 flex-col gap-1.5">
        <Label htmlFor="name">Ajouter une personne à la banque</Label>
        <Input id="name" name="name" required placeholder="Prénom Nom" />
      </div>
      <div className="flex flex-1 flex-col gap-1.5">
        <Label htmlFor="email">Courriel d&apos;invitation (optionnel)</Label>
        <Input id="email" name="email" type="email" placeholder="prenom@exemple.com" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="kind">Type</Label>
        <Select id="kind" name="kind" defaultValue="player">
          <option value="player">Joueur</option>
          <option value="jury">Proche</option>
        </Select>
      </div>
      <SubmitButton className="w-auto">Ajouter</SubmitButton>
      {state.error && <p className="font-sans text-sm text-red-300/90 sm:w-full">{state.error}</p>}
      {state.success && <p className="text-or-300 font-sans text-sm sm:w-full">Ajouté ✓</p>}
    </form>
  );
}
