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
  if (current.role !== "admin") redirect("/account");
  return current;
}
