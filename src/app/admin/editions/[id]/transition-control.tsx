"use client";

import { useActionState } from "react";
import { transitionEdition, type ActionState } from "./actions";
import { Input, Label, SubmitButton } from "@/components/ui";
import type { EditionState } from "@/lib/editions/state-machine";

const initialState: ActionState = { error: null };

export function TransitionControl({
  editionId,
  nextStateValue,
  label,
  note,
  askDeadline,
}: {
  editionId: string;
  nextStateValue: EditionState;
  label: string;
  note: string | null;
  askDeadline: boolean;
}) {
  const [state, formAction] = useActionState(transitionEdition, initialState);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(note ? `${label} ?\n\n${note}` : `${label} ?`)) {
          e.preventDefault();
        }
      }}
      className="border-or-400/15 bg-noir-700/40 flex flex-col gap-4 rounded-2xl border p-6"
    >
      <input type="hidden" name="edition_id" value={editionId} />
      <input type="hidden" name="next_state" value={nextStateValue} />

      {askDeadline && (
        <div className="flex max-w-xs flex-col gap-1.5">
          <Label htmlFor="vote_deadline">Date limite de vote (optionnel)</Label>
          <Input id="vote_deadline" name="vote_deadline" type="datetime-local" />
        </div>
      )}

      {note && <p className="text-ivoire-muted font-sans text-sm">{note}</p>}
      {state.error && <p className="font-sans text-sm text-red-300/90">{state.error}</p>}

      <SubmitButton className="w-auto">{label} →</SubmitButton>
    </form>
  );
}
