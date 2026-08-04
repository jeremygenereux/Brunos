import { Avatar } from "@/components/avatar";
import { RoleSelect } from "./role-select";
import { KindSelect } from "./kind-select";
import { AccessManager } from "./access-manager";
import { HeadshotForm } from "./headshot-form";
import { renamePerson, deletePerson } from "./actions";
import { AdminToggle } from "../cercles/admin-toggle";
import { AffiliateButton } from "./affiliate-button";
import type { Role } from "@/lib/auth/user";

export type PersonView = {
  id: string;
  name: string;
  kind: "player" | "jury";
  headshot: string | null;
  editions: number;
  invitedEmail: string;
  account: { role: Role; userId: string } | null;
  accountEmail?: string;
  /** Compte réellement utilisé (au moins une connexion). */
  accountUsed: boolean;
  isSelf: boolean;
  /** Administre le cercle en cours. */
  isCircleAdmin: boolean;
  /** Fiche sans cercle : elle attend un rattachement. */
  unaffiliated: boolean;
};

const INPUT =
  "border-or-400/20 bg-noir-900/60 text-ivoire focus:border-or-400/60 rounded-lg border px-3 py-1.5 font-sans text-sm outline-none";
const BTN =
  "border-or-400/30 text-or-300 hover:bg-noir-900 rounded-lg border px-3 py-1.5 font-sans text-sm transition";

/** Statut du compte, en une ligne lisible. */
function AccountStatus({ p }: { p: PersonView }) {
  if (p.account && p.accountUsed) {
    return (
      <>
        <span className="text-or-300">Compte actif</span>
        {p.accountEmail ? ` · ${p.accountEmail}` : ""}
      </>
    );
  }
  if (p.account) {
    return (
      <>
        <span className="text-or-400/80">Compte créé</span>
        {p.accountEmail ? ` · ${p.accountEmail}` : ""}
      </>
    );
  }
  if (p.invitedEmail)
    return <span className="text-or-400/80">Accès à créer · {p.invitedEmail}</span>;
  return <span className="text-ivoire-faint">Aucun compte</span>;
}

export function PersonCard({
  person,
  circleId,
  circleName,
}: {
  person: PersonView;
  circleId: string | null;
  circleName: string;
}) {
  return (
    <li className="border-or-400/12 bg-noir-700/40 flex flex-col gap-3 rounded-2xl border px-5 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <Avatar name={person.name} headshot={person.headshot} size={44} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-ivoire font-sans font-medium">{person.name}</span>
          <span className="text-ivoire-faint font-sans text-xs">
            <AccountStatus p={person} />
            {" · "}
            {person.editions} cérémonie{person.editions > 1 ? "s" : ""}
          </span>
        </div>
        {person.account && (
          <RoleSelect personId={person.id} initial={person.account.role} isSelf={person.isSelf} />
        )}
      </div>

      <details>
        <summary className="text-ivoire-faint hover:text-or-300 w-fit cursor-pointer font-sans text-xs transition">
          Modifier
        </summary>

        <div className="mt-4 flex flex-col gap-4">
          <Field label="Nom et type">
            <form action={renamePerson} className="flex items-center gap-2">
              <input type="hidden" name="person_id" value={person.id} />
              <input name="name" defaultValue={person.name} required className={INPUT} />
              <button type="submit" className={BTN}>
                Renommer
              </button>
            </form>
            <KindSelect personId={person.id} initial={person.kind} />
          </Field>

          <Field label="Accès">
            <AccessManager
              access={{
                personId: person.id,
                invitedEmail: person.invitedEmail,
                accountEmail: person.accountEmail,
                hasAccount: Boolean(person.account),
                accountUsed: person.accountUsed,
              }}
            />
          </Field>

          {/* L'administration d'un cercle se délègue à quelqu'un qui a déjà un
              compte : circle_admins référence auth.users, pas la fiche. */}
          {circleId && !person.unaffiliated && (
            <Field
              label="Administration"
              hint={
                person.account
                  ? `Un administrateur gère les cérémonies, le répertoire et les scrutins de « ${circleName} ».`
                  : "Cette personne doit d'abord disposer d'un compte."
              }
            >
              {person.account ? (
                <AdminToggle
                  circleId={circleId}
                  userId={person.account.userId}
                  isAdmin={person.isCircleAdmin}
                  label="administrateur"
                />
              ) : (
                <span className="text-ivoire-faint font-sans text-xs">
                  Invitez-la, puis revenez ici.
                </span>
              )}
            </Field>
          )}

          {circleId && person.unaffiliated && (
            <Field
              label="Rattachement"
              hint="Cette fiche n'appartient à aucun cercle : elle ne voit rien et n'apparaît dans aucun répertoire."
            >
              <AffiliateButton
                personId={person.id}
                circleId={circleId}
                circleName={circleName}
              />
            </Field>
          )}

          <Field label="Portrait" hint="Conservé d'une cérémonie à l'autre.">
            <HeadshotForm personId={person.id} hasPhoto={Boolean(person.headshot)} />
          </Field>

          <Field label="Retirer">
            <form action={deletePerson}>
              <input type="hidden" name="person_id" value={person.id} />
              <button
                type="submit"
                disabled={person.editions > 0}
                title={
                  person.editions > 0
                    ? "Retirez cette personne de toutes les cérémonies avant de la supprimer"
                    : undefined
                }
                className="rounded-lg border border-red-400/20 px-3 py-1.5 font-sans text-sm text-red-300/80 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Supprimer
              </button>
            </form>
          </Field>
        </div>
      </details>
    </li>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-or-400/70 font-sans text-[11px] tracking-[0.2em] uppercase">
        {label}
      </span>
      {hint && <span className="text-ivoire-faint font-sans text-xs">{hint}</span>}
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}
