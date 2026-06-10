"use client";

import { useState, useTransition } from "react";
import { setPersonRole } from "./actions";
import type { Role } from "@/lib/auth/user";

const ROLES: { value: Role; label: string }[] = [
  { value: "admin", label: "Administrateur" },
  { value: "player", label: "Joueur" },
  { value: "jury", label: "Entourage" },
];

export function RoleSelect({
  personId,
  initial,
  isSelf,
}: {
  personId: string;
  initial: Role;
  isSelf: boolean;
}) {
  const [role, setRole] = useState<Role>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function change(next: Role) {
    const prev = role;
    setRole(next);
    setError(null);
    start(async () => {
      const r = await setPersonRole(personId, next);
      if (r.error) {
        setRole(prev);
        setError(r.error);
      }
    });
  }

  if (isSelf) {
    return <span className="text-ivoire-faint font-sans text-xs">Toi (admin)</span>;
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <select
        value={role}
        disabled={pending}
        onChange={(e) => change(e.target.value as Role)}
        className="border-or-400/20 bg-noir-900/60 text-ivoire focus:border-or-400/60 rounded-lg border px-2 py-1 font-sans text-xs outline-none disabled:opacity-60"
      >
        {ROLES.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
      {error && <span className="text-right text-[11px] text-red-300/90">{error}</span>}
    </div>
  );
}
