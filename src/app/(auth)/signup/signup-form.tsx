"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUp, type AuthState } from "@/app/(auth)/actions";
import { Input, Label, SubmitButton } from "@/components/ui";

const initialState: AuthState = { error: null };

export function SignupForm() {
  const [state, formAction] = useActionState(signUp, initialState);

  if (state.success) {
    return (
      <p className="text-ivoire-muted text-center font-sans text-sm">
        Presque ! Vérifie ta boîte courriel pour confirmer ton inscription, puis{" "}
        <Link href="/login" className="text-or-400 hover:text-or-300">
          connecte-toi
        </Link>
        .
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="display_name">Nom affiché</Label>
        <Input
          id="display_name"
          name="display_name"
          type="text"
          autoComplete="name"
          placeholder="Jérémy"
        />
      </div>
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
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>

      {state.error && <p className="font-sans text-sm text-red-300/90">{state.error}</p>}

      <SubmitButton>Créer mon compte</SubmitButton>

      <p className="text-ivoire-muted text-center font-sans text-sm">
        Déjà inscrit ?{" "}
        <Link href="/login" className="text-or-400 hover:text-or-300">
          Se connecter
        </Link>
      </p>
    </form>
  );
}
