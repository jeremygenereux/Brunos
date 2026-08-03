"use client";

import { useActionState } from "react";
import { setInitialPassword, type WelcomeState } from "./actions";
import { Input, Label, SubmitButton } from "@/components/ui";

const initialState: WelcomeState = { error: null };

export function WelcomeForm() {
  const [state, formAction] = useActionState(setInitialPassword, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Choisis ton mot de passe</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="8 caractères minimum"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirm">Confirme-le</Label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>
      {state.error && <p className="font-sans text-sm text-red-300/90">{state.error}</p>}
      <SubmitButton>Entrer</SubmitButton>
    </form>
  );
}
