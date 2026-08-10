"use client";

import { useActionState, useRef, useState } from "react";
import { setPersonHeadshot, type PeopleState } from "./actions";

const initialState: PeopleState = { error: null };

/** Côté le plus long d'un portrait, en pixels. */
const COTE_MAX = 1200;

/**
 * Réduit la photo AVANT l'envoi.
 *
 * Une action serveur passe par la plateforme d'hébergement, qui refuse les
 * corps de requête volumineux — et le refus arrive avant le code applicatif,
 * donc sous forme de page d'erreur brute plutôt que de message. Une photo
 * prise au téléphone dépasse largement ce seuil ; en local, où il n'y a pas de
 * plateforme devant, le même geste passait sans broncher.
 *
 * Redimensionner ici supprime le problème à la source, et un portrait de
 * 1200 px reste très au-delà de ce que la scène affiche (200 px).
 *
 * Renvoie le fichier d'origine si le navigateur ne sait pas décoder l'image :
 * mieux vaut tenter l'envoi que bloquer sur une conversion.
 */
async function reduire(file: File): Promise<File> {
  if (typeof createImageBitmap !== "function") return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

  const facteur = Math.min(1, COTE_MAX / Math.max(bitmap.width, bitmap.height));
  const largeur = Math.round(bitmap.width * facteur);
  const hauteur = Math.round(bitmap.height * facteur);

  const canvas = document.createElement("canvas");
  canvas.width = largeur;
  canvas.height = hauteur;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, largeur, hauteur);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.85),
  );
  if (!blob) return file;
  // Une photo déjà légère et bien dimensionnée n'a rien à gagner au passage.
  if (blob.size >= file.size && facteur === 1) return file;
  return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
}

/** Portrait de référence : il suit la personne d'une édition à l'autre. */
export function HeadshotForm({ personId, hasPhoto }: { personId: string; hasPhoto: boolean }) {
  const [state, formAction] = useActionState(setPersonHeadshot, initialState);
  const inputRef = useRef<HTMLInputElement>(null);
  const [prepare, setPrepare] = useState(false);

  // On remplace le fichier choisi par sa version réduite dès la sélection : le
  // formulaire part ensuite normalement, sans intercepter la soumission.
  async function onChange() {
    const input = inputRef.current;
    const file = input?.files?.[0];
    if (!input || !file) return;
    setPrepare(true);
    try {
      const reduit = await reduire(file);
      if (reduit !== file) {
        const dt = new DataTransfer();
        dt.items.add(reduit);
        input.files = dt.files;
      }
    } finally {
      setPrepare(false);
    }
  }

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="person_id" value={personId} />
      <input
        ref={inputRef}
        type="file"
        name="headshot"
        accept="image/png,image/jpeg,image/webp"
        required
        onChange={onChange}
        className="text-ivoire-faint file:border-or-400/30 file:text-or-300 hover:file:bg-noir-900 max-w-[13rem] font-sans text-xs file:mr-3 file:cursor-pointer file:rounded-lg file:border file:bg-transparent file:px-3 file:py-1.5 file:font-sans file:text-xs"
      />
      <button
        type="submit"
        disabled={prepare}
        className="border-or-400/30 text-or-300 hover:bg-noir-900 rounded-lg border px-3 py-1.5 font-sans text-sm transition disabled:opacity-50"
      >
        {prepare ? "Préparation…" : hasPhoto ? "Changer la photo" : "Ajouter une photo"}
      </button>
      {state.success && <span className="text-or-300 font-sans text-xs">Photo enregistrée ✓</span>}
      {state.error && <span className="font-sans text-xs text-red-300/90">{state.error}</span>}
    </form>
  );
}
