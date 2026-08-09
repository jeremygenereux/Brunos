"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addQuestion, type QuestionState } from "./actions";
import { Input, Label, Select, SubmitButton } from "@/components/ui";
import { DRINK_RULE_EXAMPLE, DRINK_RULE_HINT } from "@/lib/editions/drink-rule";

const initialState: QuestionState = { error: null };

export function AddQuestionForm({
  editionId,
  editionRule,
}: {
  editionId: string;
  editionRule: "ESCALATION" | "TOP_UNIQUE";
}) {
  const [state, formAction] = useActionState(addQuestion, initialState);
  const [format, setFormat] = useState("ranking");
  const formRef = useRef<HTMLFormElement>(null);

  // Un choix unique n'a qu'une conséquence possible : la personne désignée
  // cale. Proposer « perdant boit » là-dessus n'avait aucun sens et c'est ce
  // qui a produit des classements où une seule personne buvait.
  const choixUnique = format === "single_choice";

  // Le défaut d'un classement ne peut pas être TOP_UNIQUE : cette valeur ne
  // s'applique plus qu'aux désignations.
  const defautClassement = editionRule === "ESCALATION" ? "ESCALATION" : "ESCALATION_INVERSE";

  // On vide l'énoncé mais on GARDE le format : l'écriture se fait par séries.
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
          <Select
            id="format"
            name="format"
            value={format}
            onChange={(e) => setFormat(e.target.value)}
          >
            <option value="ranking">Classement (tous les joueurs)</option>
            <option value="single_choice">Choix unique (un seul joueur)</option>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="drink_rule">Règle de gorgées</Label>
          {choixUnique ? (
            <>
              <input type="hidden" name="drink_rule" value="TOP_UNIQUE" />
              <p className="border-or-400/15 bg-noir-800/60 text-ivoire-muted rounded-lg border px-3 py-2.5 font-sans text-sm">
                {DRINK_RULE_HINT.TOP_UNIQUE}
              </p>
            </>
          ) : (
            <Select id="drink_rule" name="drink_rule" defaultValue={defautClassement}>
              <option value="ESCALATION_INVERSE">{DRINK_RULE_HINT.ESCALATION_INVERSE}</option>
              <option value="ESCALATION">{DRINK_RULE_HINT.ESCALATION}</option>
            </Select>
          )}
        </div>
      </div>

      {!choixUnique && (
        <p className="border-or-400/20 bg-noir-800/60 text-ivoire-muted rounded-xl border px-4 py-3 font-sans text-xs leading-relaxed">
          Sur un classement, <strong className="text-ivoire">tout le monde boit</strong> selon son
          rang. Le sens ne dépend que de la tournure de l&apos;énoncé, et fait toujours boire la
          même personne. {DRINK_RULE_EXAMPLE.ESCALATION_INVERSE} fait caler le premier ;{" "}
          {DRINK_RULE_EXAMPLE.ESCALATION.toLowerCase()} fait caler le dernier.
        </p>
      )}

      {state.error && <p className="font-sans text-sm text-red-300/90">{state.error}</p>}
      {state.success && <p className="text-or-300 font-sans text-sm">Question ajoutée ✓</p>}

      <SubmitButton className="w-auto">Ajouter la question</SubmitButton>
    </form>
  );
}
