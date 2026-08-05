"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addQuestion, type QuestionState } from "./actions";
import { Input, Label, Select, SubmitButton } from "@/components/ui";
import { DRINK_RULE_HINT } from "@/lib/editions/drink-rule";

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
  const entourage = format === "entourage";
  // Un choix unique n'a qu'une conséquence possible : la personne désignée boit.
  const choixUnique = format === "single_choice";

  // On vide l'énoncé mais on GARDE le format : l'écriture se fait par séries,
  // et repartir sur « classement » après chaque question entourage obligerait
  // à le resélectionner à chaque fois.
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
          placeholder={
            entourage
              ? "Il est du genre à ramener tout le monde à la maison après la fermeture des bars"
              : "Qui est le plus susceptible de se marier en premier ?"
          }
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
            <option value="entourage">Entourage (note de 1 à 10)</option>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="drink_rule">Règle de gorgées</Label>
          {choixUnique ? (
            <>
              <input type="hidden" name="drink_rule" value="TOP_UNIQUE" />
              <p className="border-or-400/15 bg-noir-800/60 text-ivoire-muted rounded-lg border px-3 py-2.5 font-sans text-sm">
                La personne désignée cale. Il n&apos;y a rien d&apos;autre à décider.
              </p>
            </>
          ) : (
            <Select
              id="drink_rule"
              name="drink_rule"
              defaultValue={entourage ? "ESCALATION_INVERSE" : editionRule}
              key={entourage ? "entourage" : "standard"}
            >
              {entourage ? (
                <>
                  <option value="ESCALATION_INVERSE">{DRINK_RULE_HINT.ESCALATION_INVERSE}</option>
                  <option value="TOP_UNIQUE">{DRINK_RULE_HINT.TOP_UNIQUE}</option>
                </>
              ) : (
                <>
                  <option value="ESCALATION">{DRINK_RULE_HINT.ESCALATION}</option>
                  <option value="TOP_UNIQUE">{DRINK_RULE_HINT.TOP_UNIQUE}</option>
                </>
              )}
            </Select>
          )}
        </div>
      </div>

      {entourage && (
        <p className="border-or-400/20 bg-noir-800/60 text-ivoire-muted rounded-xl border px-4 py-3 font-sans text-xs leading-relaxed">
          Cette question n&apos;apparaît pas dans le bulletin des joueurs. Chaque proche note SON
          joueur de 1 à 10 depuis son lien personnel. On moyenne les notes reçues par chaque nommé,
          on classe les moyennes, et la plus haute cale. Un joueur dont aucun proche n&apos;a voté
          reste hors classement : il ne peut ni gagner ni boire sur cette question.
        </p>
      )}

      {state.error && <p className="font-sans text-sm text-red-300/90">{state.error}</p>}
      {state.success && <p className="text-or-300 font-sans text-sm">Question ajoutée ✓</p>}

      <SubmitButton className="w-auto">Ajouter la question</SubmitButton>
    </form>
  );
}
