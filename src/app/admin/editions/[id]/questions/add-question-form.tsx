"use client";

import { useActionState, useEffect, useRef } from "react";
import { addQuestion, type QuestionState } from "./actions";
import { Input, Label, Select, SubmitButton } from "@/components/ui";

const initialState: QuestionState = { error: null };

export function AddQuestionForm({
  editionId,
  editionRule,
}: {
  editionId: string;
  editionRule: "ESCALATION" | "TOP_UNIQUE";
}) {
  const [state, formAction] = useActionState(addQuestion, initialState);
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

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="prompt">Énoncé</Label>
        <Input
          id="prompt"
          name="prompt"
          required
          placeholder="Qui est le plus susceptible de se marier en premier ?"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="format">Format</Label>
          <Select id="format" name="format" defaultValue="ranking">
            <option value="ranking">Classement (tous les joueurs)</option>
            <option value="single_choice">Choix unique (un seul joueur)</option>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="drink_rule">Règle de gorgées</Label>
          <Select id="drink_rule" name="drink_rule" defaultValue={editionRule}>
            <option value="ESCALATION">Escalade (rang = gorgées, dernier cale)</option>
            <option value="TOP_UNIQUE">Top unique (le·la gagnant·e cale)</option>
          </Select>
        </div>
      </div>

      {state.error && <p className="font-sans text-sm text-red-300/90">{state.error}</p>}
      {state.success && <p className="text-or-300 font-sans text-sm">Question ajoutée ✓</p>}

      <SubmitButton className="w-auto">Ajouter la question</SubmitButton>
    </form>
  );
}
