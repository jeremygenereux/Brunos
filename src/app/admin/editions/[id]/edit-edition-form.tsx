"use client";

import { useActionState } from "react";
import { updateEdition, type ActionState } from "./actions";
import { Input, Label, Select, Textarea, SubmitButton } from "@/components/ui";

type EditionInput = {
  id: string;
  name: string;
  year: number;
  event_at: string | null;
  venue_name: string | null;
  venue_address: string | null;
  description: string | null;
  drink_rule: string;
  shooter_value: number;
};

/** ISO timestamp -> value for <input type="datetime-local"> in local time. */
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

const initialState: ActionState = { error: null };

export function EditEditionForm({ edition }: { edition: EditionInput }) {
  const [state, formAction] = useActionState(updateEdition, initialState);

  return (
    <form
      action={formAction}
      className="border-or-400/15 bg-noir-700/40 grid grid-cols-1 gap-4 rounded-2xl border p-6 sm:grid-cols-2"
    >
      <input type="hidden" name="edition_id" value={edition.id} />

      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="name">Nom</Label>
        <Input id="name" name="name" required defaultValue={edition.name} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="year">Année</Label>
        <Input
          id="year"
          name="year"
          type="number"
          min={2001}
          required
          defaultValue={edition.year}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="event_at">Date et heure</Label>
        <Input
          id="event_at"
          name="event_at"
          type="datetime-local"
          defaultValue={toLocalInput(edition.event_at)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="venue_name">Nom du lieu</Label>
        <Input id="venue_name" name="venue_name" defaultValue={edition.venue_name ?? ""} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="venue_address">Adresse</Label>
        <Input id="venue_address" name="venue_address" defaultValue={edition.venue_address ?? ""} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="drink_rule">Règle de consommation</Label>
        <Select id="drink_rule" name="drink_rule" defaultValue={edition.drink_rule}>
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
          defaultValue={edition.shooter_value}
        />
      </div>

      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" defaultValue={edition.description ?? ""} />
      </div>

      {state.error && (
        <p className="font-sans text-sm text-red-300/90 sm:col-span-2">{state.error}</p>
      )}
      {state.success && <p className="text-or-300 font-sans text-sm sm:col-span-2">Enregistré ✓</p>}

      <div className="sm:col-span-2">
        <SubmitButton className="w-auto">Enregistrer</SubmitButton>
      </div>
    </form>
  );
}
