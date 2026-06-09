import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser, type Role } from "@/lib/auth/user";
import { signOut } from "@/app/(auth)/actions";
import { SubmitButton } from "@/components/ui";

export const metadata: Metadata = { title: "Mon compte" };

const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrateur",
  player: "Joueur",
  jury: "Jury / Entourage",
};

export default async function AccountPage() {
  const current = await getCurrentUser();
  if (!current) redirect("/login");

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="border-or-400/20 bg-noir-700/60 w-full max-w-md rounded-2xl border p-8 shadow-2xl backdrop-blur-xl">
        <p className="text-or-400/80 font-sans text-xs tracking-[0.3em] uppercase">Mon compte</p>
        <h1 className="text-ivoire font-display mt-2 text-3xl font-semibold">Bienvenue</h1>

        <dl className="mt-6 space-y-4 font-sans text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-ivoire-muted">Courriel</dt>
            <dd className="text-ivoire">{current.user.email}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-ivoire-muted">Rôle</dt>
            <dd className="text-or-300">{ROLE_LABEL[current.role]}</dd>
          </div>
        </dl>

        <form action={signOut} className="mt-8">
          <SubmitButton>Se déconnecter</SubmitButton>
        </form>
      </div>
    </main>
  );
}
