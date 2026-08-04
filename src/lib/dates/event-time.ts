// Les heures des Brunos sont des heures DE SALLE, pas des instants relatifs.
//
// LE BUG QUE CE MODULE CORRIGE. `<input type="datetime-local">` rend une chaîne
// sans fuseau, du genre « 2026-08-29T20:00 ». `new Date(...)` l'interprète dans
// le fuseau de CELUI QUI EXÉCUTE : UTC sur Vercel à l'écriture, Montréal dans
// le navigateur à la relecture. On saisissait 20 h et on relisait 16 h.
//
// LE MODÈLE. « 20 h » veut dire vingt heures au chalet, point. Ce n'est pas une
// heure à retraduire selon l'endroit d'où l'on regarde : un joueur en voyage en
// Europe doit lire 20 h, l'heure du gala, et non 2 h du matin chez lui. On fixe
// donc le fuseau de l'événement une fois pour toutes, des deux côtés. Effet de
// bord appréciable : rendu serveur et rendu client donnent le même texte, donc
// plus de divergence d'hydratation.

/** Fuseau du gala. Couvre le Québec, heure avancée comprise. */
export const EVENT_TIME_ZONE = "America/Toronto";

/** Décalage du fuseau, en millisecondes, à un instant donné. */
function offsetMs(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EVENT_TIME_ZONE,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  // `hour` peut valoir 24 à minuit selon l'implémentation : le modulo l'aplatit.
  const asIfUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return asIfUtc - at.getTime();
}

/**
 * « 2026-08-29T20:00 » (heure de salle) → instant ISO à stocker.
 *
 * Deux passes : la première estime le décalage à partir d'une lecture naïve, la
 * seconde le corrige. C'est ce qui rend le calcul juste les nuits de changement
 * d'heure, où le décalage de l'instant visé diffère de celui de l'estimation.
 */
export function eventInputToIso(local: string): string | null {
  const m = local.trim().match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  const naive = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
  let ts = naive - offsetMs(new Date(naive));
  ts = naive - offsetMs(new Date(ts));
  return new Date(ts).toISOString();
}

/** Instant ISO → « 2026-08-29T20:00 », pour <input type="datetime-local">. */
export function isoToEventInput(iso: string | null): string {
  if (!iso) return "";
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: EVENT_TIME_ZONE,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  const hour = String(Number(get("hour")) % 24).padStart(2, "0");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}

/** Date lisible, toujours à l'heure du gala. */
export function formatEventDate(iso: string | null): string | null {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  return at.toLocaleDateString("fr-CA", { dateStyle: "long", timeZone: EVENT_TIME_ZONE });
}

/** Date et heure lisibles, toujours à l'heure du gala. */
export function formatEventDateTime(
  iso: string | null,
  style: "long" | "medium" | "short" = "long",
): string | null {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  return at.toLocaleString("fr-CA", {
    dateStyle: style,
    timeStyle: "short",
    timeZone: EVENT_TIME_ZONE,
  });
}
