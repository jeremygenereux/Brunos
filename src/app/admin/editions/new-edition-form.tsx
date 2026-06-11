"use client";

import { useActionState, useEffect, useRef } from "react";
import { createEdition, type EditionFormState } from "./actions";
import { Input, Label, Select, Textarea, SubmitButton } from "@/components/ui";

const initialState: EditionFormState = { error: null };

export function NewEditionForm({ defaultYear }: { defaultYear: number }) {
  const [state, formAction] = useActionState(createEdition, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="border-or-400/15 bg-noir-700/40 grid grid-cols-1 gap-4 rounded-2xl border p-6 sm:grid-cols-2"
    >
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="name">Nom de l&apos;édition</Label>
        <Input id="name" name="name" required placeholder="Les Brunos 2026" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="year">Année</Label>
        <Input id="year" name="year" type="number" min={2001} defaultValue={defaultYear} required />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="event_at">Date et heure</Label>
        <Input id="event_at" name="event_at" type="datetime-local" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="venue_name">Nom du lieu</Label>
        <Input id="venue_name" name="venue_name" placeholder="Le Salon Doré" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="venue_address">Adresse</Label>
        <Input id="venue_address" name="venue_address" placeholder="123 rue du Gala, Montréal" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="drink_rule">Règle de consommation</Label>
        <Select id="drink_rule" name="drink_rule" defaultValue="ESCALATION">
          <option value="ESCALATION">Escalade par classement</option>
          <option value="TOP_UNIQUE">Top unique</option>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="shooter_value">Valeur d&apos;un shooter (gorgées)</Label>
        <Input
          id="shooter_value"
          name="shooter_value"
          type="number"
          min={0.5}
          step={0.5}
          defaultValue={8}
        />
      </div>

      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="description">Description / indications</Label>
        <Textarea id="description" name="description" placeholder="Indications pour les invités…" />
      </div>

      {state.error && (
        <p className="font-sans text-sm text-red-300/90 sm:col-span-2">{state.error}</p>
      )}
      {state.success && (
        <p className="text-or-300 font-sans text-sm sm:col-span-2">Édition créée ✓</p>
      )}

      <div className="sm:col-span-2">
        <SubmitButton>Créer l&apos;édition</SubmitButton>
      </div>
    </form>
  );
}
