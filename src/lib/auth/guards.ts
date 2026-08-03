import { redirect } from "next/navigation";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/user";

/** Require a signed-in user; redirect to /login otherwise. */
export async function requireUser(): Promise<CurrentUser> {
  const current = await getCurrentUser();
  if (!current) redirect("/login");
  return current;
}

/** Require an admin; redirect to /login (no session) or /account (not admin). */
export async function requireAdmin(): Promise<CurrentUser> {
  const current = await getCurrentUser();
  if (!current) redirect("/login");
  if (!current.administers) redirect("/account");
  return current;
}

/**
 * Réserve un écran au super-admin. La création d'un cercle et sa suppression
 * n'appartiennent à personne d'autre : un administrateur de cercle gère le
 * sien, il n'en fabrique pas de nouveaux.
 */
export async function requireSuperAdmin(): Promise<CurrentUser> {
  const current = await getCurrentUser();
  if (!current) redirect("/login");
  if (current.role !== "super_admin") redirect("/admin");
  return current;
}
