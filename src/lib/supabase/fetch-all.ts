/**
 * Lecture paginée : ramène TOUTES les lignes, sans se faire tronquer.
 *
 * POURQUOI. PostgREST plafonne chaque réponse à `db.max_rows` (1000 chez nous,
 * voir `supabase/config.toml`). Ce plafond est SILENCIEUX : au-delà, la requête
 * réussit et rend mille lignes arbitraires, sans erreur ni avertissement. Une
 * édition de 40 catégories à 7 nommés et 7 votants produit près de 2000
 * réponses de vote — de quoi fausser un classement figé sans que rien ne le
 * signale.
 *
 * DEUX RÈGLES pour que la pagination soit juste :
 *   • un ORDRE STABLE (la clé primaire) — sans `order by`, Postgres n'a aucune
 *     obligation de rendre les lignes dans le même ordre d'une page à l'autre,
 *     et on récolterait des doublons doublés d'oublis ;
 *   • on avance de ce qu'on a REÇU, pas de ce qu'on a demandé, et on ne
 *     s'arrête que sur une page vide. Le code reste donc juste même si le
 *     plafond du serveur change.
 */

type Page<T> = { data: T[] | null; error: { message: string } | null };

export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<Page<T>>,
  pageSize = 1000,
): Promise<{ data: T[]; error: string | null }> {
  const out: T[] = [];
  for (let from = 0; ; ) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) return { data: [], error: error.message };
    const batch = data ?? [];
    if (batch.length === 0) return { data: out, error: null };
    out.push(...batch);
    from += batch.length;
  }
}
