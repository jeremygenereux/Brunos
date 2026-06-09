"use client";

import { useActionState, useState } from "react";
import { joinEdition, type JoinState } from "./actions";
import { Input, Label, Select, SubmitButton } from "@/components/ui";

const initialState: JoinState = { error: null };

type Player = { id: string; display_name: string };

export function JoinForm({ token, players }: { token: string; players: Player[] }) {
  const [state, formAction] = useActionState(joinEdition, initialState);
  const [kind, setKind] = useState<"player" | "jury">("player");

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="token" value={token} />

      <fieldset className="flex flex-col gap-2">
        <legend className="text-ivoire-muted mb-1 font-sans text-xs tracking-wider uppercase">
          Tu participes comme
        </legend>
        <label className="border-or-400/20 bg-noir-900/40 flex cursor-pointer items-start gap-3 rounded-lg border p-3">
          <input
            type="radio"
            name="kind"
            value="player"
            checked={kind === "player"}
            onChange={() => setKind("player")}
            className="mt-1 accent-[var(--or-500)]"
          />
          <span className="font-sans text-sm">
            <span className="text-ivoire">Joueur</span>
            <span className="text-ivoire-muted block text-xs">
              Tu es nominé : ton vote est officiel et tu peux devoir boire.
            </span>
          </span>
        </label>
        <label className="border-or-400/20 bg-noir-900/40 flex cursor-pointer items-start gap-3 rounded-lg border p-3">
          <input
            type="radio"
            name="kind"
            value="jury"
            checked={kind === "jury"}
            onChange={() => setKind("jury")}
            className="mt-1 accent-[var(--or-500)]"
          />
          <span className="font-sans text-sm">
            <span className="text-ivoire">Jury / entourage</span>
            <span className="text-ivoire-muted block text-xs">
              Tu votes pour le drame, mais ça ne fait boire personne.
            </span>
          </span>
        </label>
      </fieldset>

      {kind === "jury" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="linked_player">Tu es proche de quel joueur ?</Label>
            <Select id="linked_player" name="linked_player" required defaultValue="">
              <option value="" disabled>
                Choisir un joueur…
              </option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.display_name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="relation">Ton lien</Label>
            <Input id="relation" name="relation" required placeholder="Mère de Raphaël" />
          </div>
        </div>
      )}

      {state.error && <p className="font-sans text-sm text-red-300/90">{state.error}</p>}

      <SubmitButton>Rejoindre l&apos;édition</SubmitButton>
    </form>
  );
}
