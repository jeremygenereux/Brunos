"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createAccess, setPersonEmail } from "./actions";

/**
 * Domaine des comptes techniques fabriqués par l'import de l'historique
 * (`scripts/import-edition.mjs`). Ils existent parce que `participants.user_id`
 * est obligatoire, mais leur identifiant ne veut rien dire : il faut pouvoir
 * lui substituer le vrai.
 */
const TECHNICAL_DOMAIN = "@brunos.invalid";

type Access = {
  personId: string;
  /** Identifiant noté en attendant la création du compte. */
  invitedEmail: string;
  /** Identifiant du compte, quand il y en a un. */
  accountEmail?: string;
  hasAccount: boolean;
  /** Au moins une connexion. */
  accountUsed: boolean;
};

/** Ce que l'administration doit comprendre d'un coup d'œil. */
function describe(a: Access): { state: string; hint: string; action: string } {
  if (!a.hasAccount) {
    return {
      state: "Aucun compte",
      hint: "L'identifiant sert à se connecter, rien de plus : aucun courriel n'est envoyé. Choisissez une adresse sur votre domaine, par exemple prenom@brunos.live.",
      action: "Créer l'accès",
    };
  }
  if ((a.accountEmail ?? "").toLowerCase().endsWith(TECHNICAL_DOMAIN)) {
    return {
      state: "Compte technique",
      hint: "Compte créé par l'import de l'historique. Remplacez l'identifiant par le vrai, puis donnez un mot de passe.",
      action: "Donner un mot de passe",
    };
  }
  if (!a.accountUsed) {
    return {
      state: "Compte créé",
      hint: "Le compte existe mais n'a jamais servi. Vous pouvez lui redonner un mot de passe si celui transmis s'est perdu.",
      action: "Nouveau mot de passe",
    };
  }
  return {
    state: "Compte actif",
    hint: "Cette personne s'est déjà connectée. Modifier l'identifiant change son identifiant de connexion.",
    action: "Nouveau mot de passe",
  };
}

const INPUT =
  "border-or-400/20 bg-noir-900/60 text-ivoire focus:border-or-400/60 min-w-0 flex-1 rounded-lg border px-3 py-1.5 font-sans text-sm outline-none";
const BTN =
  "border-or-400/30 text-or-300 hover:bg-noir-900 rounded-lg border px-3 py-1.5 font-sans text-sm transition disabled:cursor-not-allowed disabled:opacity-40";

/**
 * Le mot de passe n'existe qu'ici, et une seule fois : il n'est stocké nulle
 * part en clair et l'API d'auth ne le rendra jamais. D'où le bandeau insistant
 * et le bouton copier.
 */
function PasswordCard({ identifier, password }: { identifier: string; password: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="border-or-400/40 bg-noir-900/70 flex flex-col gap-2 rounded-xl border px-4 py-3">
      <p className="text-or-300 font-sans text-xs tracking-[0.2em] uppercase">
        À transmettre maintenant
      </p>
      <p className="text-ivoire-muted font-sans text-xs">
        Ce mot de passe ne sera plus jamais affiché. Envoyez-le par message ou donnez-le de vive
        voix ; la personne pourra le changer ensuite.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <code className="text-ivoire font-mono text-sm">{identifier}</code>
        <code className="text-or-300 font-mono text-base font-semibold">{password}</code>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(`${identifier}\n${password}`);
            setCopied(true);
          }}
          className={BTN}
        >
          {copied ? "Copié ✓" : "Copier"}
        </button>
      </div>
    </div>
  );
}

export function AccessManager({ access }: { access: Access }) {
  const current = access.hasAccount ? (access.accountEmail ?? "") : access.invitedEmail;
  const [email, setEmail] = useState(current);
  const [savePending, startSave] = useTransition();
  const [createPending, startCreate] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ identifier: string; password: string } | null>(null);
  const router = useRouter();

  const { state, hint, action } = describe(access);
  const dirty = email.trim().toLowerCase() !== current.toLowerCase();

  function save() {
    // Changer l'identifiant d'un compte vivant, c'est changer sa façon de se
    // connecter : on le fait dire à voix haute.
    if (
      access.accountUsed &&
      !confirm(`Changer l'identifiant de ${current} pour ${email.trim()} ?`)
    ) {
      return;
    }
    setError(null);
    setNotice(null);
    const form = new FormData();
    form.set("person_id", access.personId);
    form.set("email", email);
    startSave(async () => {
      const r = await setPersonEmail(form);
      if (r.error) setError(r.error);
      else {
        setNotice("Identifiant enregistré.");
        router.refresh();
      }
    });
  }

  function issue() {
    if (access.accountUsed && !confirm("Remplacer le mot de passe de cette personne ?")) return;
    setError(null);
    setNotice(null);
    startCreate(async () => {
      const r = await createAccess(access.personId);
      if (r.error) setError(r.error);
      else {
        setIssued({ identifier: r.identifier ?? email, password: r.password ?? "" });
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-ivoire-faint font-sans text-xs">
        <span className="text-or-400/80">{state}</span> · {hint}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setNotice(null);
          }}
          placeholder="prenom@brunos.live"
          className={INPUT}
        />
        <button type="button" onClick={save} disabled={savePending || !dirty} className={BTN}>
          {savePending ? "…" : "Enregistrer"}
        </button>
        <button
          type="button"
          onClick={issue}
          disabled={createPending || dirty || !email.trim()}
          title={dirty ? "Enregistrez d'abord l'identifiant" : undefined}
          className={BTN}
        >
          {createPending ? "…" : action}
        </button>
      </div>
      {issued && <PasswordCard identifier={issued.identifier} password={issued.password} />}
      {notice && <p className="text-or-300 font-sans text-xs">{notice}</p>}
      {error && <p className="font-sans text-xs text-red-300/90">{error}</p>}
    </div>
  );
}
