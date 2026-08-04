// Disposition des portraits sur l'écran d'ouverture du bulletin.

/** Nombre maximal de visages sur une rangée. Au-delà, ils deviennent illisibles. */
const MAX_PAR_RANGEE = 4;

/**
 * Répartit N joueurs en rangées ÉQUILIBRÉES.
 *
 * Le retour à la ligne automatique posait six visages sur la première rangée et
 * abandonnait le septième, seul, sur la suivante. Un découpage par tranches
 * pleines ne règle rien : treize joueurs donneraient 4 + 4 + 4 + 1.
 *
 * On calcule donc le nombre de rangées nécessaire, puis on étale l'effectif
 * dessus en distribuant le reste une unité à la fois. Sept donnent 4 + 3, treize
 * donnent 4 + 3 + 3 + 3, et aucune rangée n'est jamais laissée avec un seul
 * visage tant qu'il y a de quoi la garnir.
 */
export function rangeesDe(count: number): number[] {
  if (count <= 0) return [];
  const rangees = Math.ceil(count / MAX_PAR_RANGEE);
  const base = Math.floor(count / rangees);
  const reste = count % rangees;
  return Array.from({ length: rangees }, (_, i) => base + (i < reste ? 1 : 0));
}

