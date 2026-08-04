"use client";

import { useActionState } from "react";
import { signIn, type AuthState } from "@/app/(auth)/actions";
import { Input, Label, SubmitButton } from "@/components/ui";

const initialState: AuthState = { error: null };

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState(signIn, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Courriel</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="vous@exemple.com"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Mot de passe</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      {state.error && <p className="font-sans text-sm text-red-300/90">{state.error}</p>}

      <SubmitButton>Se connecter</SubmitButton>

      {/* Aucun lien vers /signup ici : les accès sont attribués par
          l'organisateur. La route existe toujours, mais elle sert au parcours
          entourage, qui n'y arrive que par un lien d'invitation. */}
      <p className="text-ivoire-muted text-center font-sans text-sm">
        Vos identifiants vous sont remis par l&apos;organisateur.
      </p>
    </form>
  );
}
