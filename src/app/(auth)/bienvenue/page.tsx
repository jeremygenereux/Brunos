import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/user";
import { WelcomeForm } from "./welcome-form";

export const metadata: Metadata = { title: "Bienvenue" };

/**
 * Atterrissage du lien d'invitation. /auth/confirm a déjà validé le jeton et
 * ouvert la session ; il ne reste qu'à poser un mot de passe. Sans session, le
 * lien est expiré ou déjà consommé.
 */
export default async function BienvenuePage() {
  const current = await getCurrentUser();
  if (!current) redirect("/login?error=invitation");

  return (
    <>
      <p className="text-or-400/80 font-sans text-xs tracking-[0.3em] uppercase">Bienvenue</p>
      <h1 className="text-ivoire font-display mt-2 mb-1 text-3xl font-semibold">
        {current.name ? `Salut, ${current.name}` : "Salut"}
      </h1>
      <p className="text-ivoire-muted mb-6 font-sans text-sm">
        Dernière étape : choisis un mot de passe pour accéder à ton espace Brunos.
      </p>
      <WelcomeForm />
    </>
  );
}
