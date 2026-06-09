"use client";

import { useActionState } from "react";
import Link from "next/link";
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
          placeholder="toi@exemple.com"
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

      <p className="text-ivoire-muted text-center font-sans text-sm">
        Pas de compte ?{" "}
        <Link href="/signup" className="text-or-400 hover:text-or-300">
          Créer un compte
        </Link>
      </p>
    </form>
  );
}
