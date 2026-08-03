import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/user";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Créer un compte" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (await getCurrentUser()) redirect("/account");
  const { next } = await searchParams;

  return (
    <>
      <h1 className="text-ivoire font-display mb-1 text-3xl font-semibold">Créer un compte</h1>
      <p className="text-ivoire-muted mb-6 font-sans text-sm">Création de votre accès.</p>
      <SignupForm next={next} />
    </>
  );
}
