"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { invitePerson, setPersonEmail } from "./actions";

/**
 * Domaine des comptes techniques fabriqués par l'import de l'historique
 * (`scripts/import-edition.mjs`). Ils existent parce que `participants.user_id`
 * est obligatoire, mais aucune boîte ne reçoit rien : il faut pouvoir leur
 * substituer la vraie adresse.
 */
const TECHNICAL_DOMAIN = "@brunos.invalid";

type Access = {
  personId: string;
  /** Courriel noté en attendant l'inscription (aucun compte). */
  invitedEmail: string;
  /** Adresse du compte, quand il y en a un. */
  accountEmail?: string;
  hasAccount: boolean;
  /** Au moins une connexion : l'adresse est un identifiant vivant. */
  accountUsed: boolean;
};

/** Ce que l'administration doit comprendre d'un coup d'œil. */
function describe(a: Access): { state: string; hint: string; send: string } {
  if (!a.hasAccount) {
    return {
      state: "Aucun compte",
      hint: "Cette adresse rattachera le futur compte à cette fiche. Les cérémonies apparaîtront dès l'inscription.",
      send: "Envoyer l'invitation",
    };
  }
  if ((a.accountEmail ?? "").toLowerCase().endsWith(TECHNICAL_DOMAIN)) {
    return {
      state: "Compte technique",
      hint: "Compte créé par l'import de l'historique : cette adresse ne reçoit rien. Inscrivez la vraie adresse, puis envoyez l'accès.",
      send: "Envoyer l'accès",
    };
  }
  if (!a.accountUsed) {
    return {
      state: "Invitation en attente",
      hint: "Le compte existe mais n'a jamais servi. Corrigez l'adresse au besoin, puis relancez.",
      send: "Relancer l'invitation",
    };
  }
  return {
    state: "Compte actif",
    hint: "Cette adresse est son identifiant de connexion. La modifier change l'identifiant du compte. Envoyez ensuite le lien d'accès pour qu'elle puisse se connecter.",
    send: "Renvoyer l'accès",
  };
}

const INPUT =
  "border-or-400/20 bg-noir-900/60 text-ivoire focus:border-or-400/60 min-w-0 flex-1 rounded-lg border px-3 py-1.5 font-sans text-sm outline-none";
const BTN =
  "border-or-400/30 text-or-300 hover:bg-noir-900 rounded-lg border px-3 py-1.5 font-sans text-sm transition disabled:cursor-not-allowed disabled:opacity-40";

export function AccessManager({ access }: { access: Access }) {
  const current = access.hasAccount ? (access.accountEmail ?? "") : access.invitedEmail;
  const [email, setEmail] = useState(current);
  const [savePending, startSave] = useTransition();
  const [sendPending, startSend] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const router = useRouter();

  const { state, hint, send } = describe(access);
  const dirty = email.trim().toLowerCase() !== current.toLowerCase();

  function save() {
    // Changer l'adresse d'un compte vivant, c'est changer son identifiant de
    // connexion : on le fait dire à voix haute.
    if (access.accountUsed && !confirm(`Transférer le compte de ${current} vers ${email.trim()} ?`)) {
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
        setNotice("Adresse enregistrée.");
        router.refresh();
      }
    });
  }

  function sendAccess() {
    setError(null);
    setNotice(null);
    startSend(async () => {
      const r = await invitePerson(access.personId);
      if (r.error) setError(r.error);
      else {
        setNotice("Courriel envoyé.");
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
          placeholder="prenom@exemple.com"
          className={INPUT}
        />
        <button type="button" onClick={save} disabled={savePending || !dirty} className={BTN}>
          {savePending ? "…" : "Enregistrer"}
        </button>
        <button
          type="button"
          onClick={sendAccess}
          disabled={sendPending || dirty || !email.trim()}
          title={dirty ? "Enregistrez d'abord l'adresse" : undefined}
          className={BTN}
        >
          {sendPending ? "Envoi…" : send}
        </button>
      </div>
      {notice && <p className="text-or-300 font-sans text-xs">{notice}</p>}
      {error && <p className="font-sans text-xs text-red-300/90">{error}</p>}
    </div>
  );
}
