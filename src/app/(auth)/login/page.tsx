import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/user";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/account");

  return (
    <>
      <h1 className="text-ivoire font-display mb-1 text-3xl font-semibold">Connexion</h1>
      <p className="text-ivoire-muted mb-6 font-sans text-sm">Accède à ton espace Brunos.</p>
      <LoginForm />
    </>
  );
}
