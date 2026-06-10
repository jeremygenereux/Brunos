import "server-only";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

export type DrinkerStat = {
  personId: string;
  name: string;
  headshot: string | null;
  totalDrinks: number;
  titleCount: number;
  editionCount: number;
};

export type ArchiveStats = {
  drinkers: DrinkerStat[];
  editionsCount: number;
};

type ResultRow = {
  question_id: string;
  player_id: string;
  borda_score: number | null;
  vote_count: number | null;
  final_rank: number;
  drinks: number;
};

/**
 * Winners per question, using the SAME tie-aware predicate as the
 * presentation deck (a player wins if their primary score equals the top
 * row's). This keeps lifetime "titres" consistent with who the reveal crowns:
 * on a genuine tie for 1st, every co-winner is credited — not just the lone
 * hash-tie-broken final_rank === 1 row.
 */
function winnersByQuestion(rows: ResultRow[]): Map<string, Set<string>> {
  const byQuestion = new Map<string, ResultRow[]>();
  for (const r of rows) {
    const list = byQuestion.get(r.question_id) ?? [];
    list.push(r);
    byQuestion.set(r.question_id, list);
  }
  const winners = new Map<string, Set<string>>();
  for (const [questionId, qrows] of byQuestion) {
    const top =
      qrows.find((r) => r.final_rank === 1) ??
      [...qrows].sort((a, b) => a.final_rank - b.final_rank)[0];
    if (!top) continue;
    const isRanking = top.borda_score !== null;
    const set = new Set<string>();
    for (const r of qrows) {
      const win = isRanking ? r.borda_score === top.borda_score : r.vote_count === top.vote_count;
      if (win) set.add(r.player_id);
    }
    winners.set(questionId, set);
  }
  return winners;
}

/**
 * Cross-edition leaderboard, aggregated in memory over the `results` the
 * viewer may read. RLS already restricts `results` to ARCHIVED editions the
 * viewer participated in, so the board is naturally scoped to "galas you were
 * part of" (admins see everything). Identity persists across editions via
 * players.person_id → people. editionCount counts editions the person has a
 * frozen result in.
 */
export async function loadArchiveStats(supabase: Client): Promise<ArchiveStats> {
  const { data: editions } = await supabase
    .from("editions")
    .select("id, year")
    .eq("state", "ARCHIVED");
  const yearByEdition = new Map((editions ?? []).map((e) => [e.id, e.year]));

  const { data: results } = await supabase
    .from("results")
    .select("question_id, player_id, borda_score, vote_count, final_rank, drinks")
    .eq("audience", "players");

  const { data: questions } = await supabase.from("questions").select("id, edition_id");
  const editionByQuestion = new Map((questions ?? []).map((q) => [q.id, q.edition_id]));

  const { data: players } = await supabase
    .from("players")
    .select("id, person_id, edition_id, headshot_url");
  const personByPlayer = new Map((players ?? []).map((p) => [p.id, p.person_id]));

  const { data: people } = await supabase.from("people").select("id, display_name");
  const nameByPerson = new Map((people ?? []).map((p) => [p.id, p.display_name]));

  // Only count rows belonging to archived editions (RLS already enforces this).
  const archived = (results ?? [])
    .map((r) => ({ ...r, drinks: Number(r.drinks) }))
    .filter((r) => yearByEdition.has(editionByQuestion.get(r.question_id) ?? ""));
  const winners = winnersByQuestion(archived);

  // A representative portrait = the person's most recent archived headshot.
  const headshotByPerson = new Map<string, { year: number; url: string }>();
  for (const p of players ?? []) {
    if (!p.headshot_url) continue;
    const year = yearByEdition.get(p.edition_id);
    if (year == null) continue;
    const cur = headshotByPerson.get(p.person_id);
    if (!cur || year > cur.year) headshotByPerson.set(p.person_id, { year, url: p.headshot_url });
  }

  const agg = new Map<string, { total: number; titles: number; editions: Set<string> }>();
  for (const r of archived) {
    const editionId = editionByQuestion.get(r.question_id);
    if (!editionId) continue;
    const personId = personByPlayer.get(r.player_id);
    if (!personId) continue;
    const a = agg.get(personId) ?? { total: 0, titles: 0, editions: new Set<string>() };
    a.total += r.drinks;
    if (winners.get(r.question_id)?.has(r.player_id)) a.titles += 1;
    a.editions.add(editionId);
    agg.set(personId, a);
  }

  const drinkers: DrinkerStat[] = [...agg.entries()]
    .map(([personId, a]) => ({
      personId,
      name: nameByPerson.get(personId) ?? "Sans nom",
      headshot: headshotByPerson.get(personId)?.url ?? null,
      totalDrinks: a.total,
      titleCount: a.titles,
      editionCount: a.editions.size,
    }))
    .sort((x, y) => y.totalDrinks - x.totalDrinks || y.titleCount - x.titleCount);

  return { drinkers, editionsCount: yearByEdition.size };
}

export type PlayerTitle = { editionId: string; editionName: string; year: number; prompt: string };
export type PlayerEditionLine = {
  editionId: string;
  name: string;
  year: number;
  drinks: number;
  titles: number;
};
export type SignatureWin = { prompt: string; count: number };
export type PlayerProfile = {
  person: { id: string; name: string; headshot: string | null } | null;
  lifetimeDrinks: number;
  titleCount: number;
  history: PlayerEditionLine[];
  titles: PlayerTitle[];
  signatureWins: SignatureWin[];
};

/** One person's lifetime record across the archived editions the viewer can read. */
export async function loadPlayerProfile(
  supabase: Client,
  personId: string,
): Promise<PlayerProfile> {
  const empty: PlayerProfile = {
    person: null,
    lifetimeDrinks: 0,
    titleCount: 0,
    history: [],
    titles: [],
    signatureWins: [],
  };

  const { data: person } = await supabase
    .from("people")
    .select("id, display_name")
    .eq("id", personId)
    .single();
  if (!person) return empty;

  const { data: editions } = await supabase
    .from("editions")
    .select("id, name, year")
    .eq("state", "ARCHIVED");
  const edInfo = new Map((editions ?? []).map((e) => [e.id, e]));

  const { data: ownPlayers } = await supabase
    .from("players")
    .select("id, edition_id, headshot_url")
    .eq("person_id", personId);
  const ownPlayerIds = new Set((ownPlayers ?? []).map((p) => p.id));

  // Most-recent archived headshot for the portrait.
  let headshot: string | null = null;
  let headshotYear = -1;
  for (const p of ownPlayers ?? []) {
    const year = edInfo.get(p.edition_id)?.year;
    if (p.headshot_url && year != null && year > headshotYear) {
      headshot = p.headshot_url;
      headshotYear = year;
    }
  }
  const personView = { id: person.id, name: person.display_name ?? "Sans nom", headshot };
  if (ownPlayerIds.size === 0) return { ...empty, person: personView };

  // Load ALL readable player-audience results so winners can be computed per
  // question (a tie needs the whole field), then attribute to this person.
  const { data: results } = await supabase
    .from("results")
    .select("question_id, player_id, borda_score, vote_count, final_rank, drinks")
    .eq("audience", "players");

  const { data: questions } = await supabase.from("questions").select("id, edition_id, prompt");
  const qInfo = new Map(
    (questions ?? []).map((q) => [q.id, { editionId: q.edition_id, prompt: q.prompt }]),
  );

  const archived = (results ?? [])
    .map((r) => ({ ...r, drinks: Number(r.drinks) }))
    .filter((r) => edInfo.has(qInfo.get(r.question_id)?.editionId ?? ""));
  const winners = winnersByQuestion(archived);

  const perEdition = new Map<string, { drinks: number; titles: number }>();
  const titles: PlayerTitle[] = [];
  for (const r of archived) {
    if (!ownPlayerIds.has(r.player_id)) continue;
    const q = qInfo.get(r.question_id);
    if (!q) continue;
    const ed = edInfo.get(q.editionId);
    if (!ed) continue;
    const line = perEdition.get(q.editionId) ?? { drinks: 0, titles: 0 };
    line.drinks += r.drinks;
    if (winners.get(r.question_id)?.has(r.player_id)) {
      line.titles += 1;
      titles.push({
        editionId: q.editionId,
        editionName: ed.name,
        year: ed.year,
        prompt: q.prompt,
      });
    }
    perEdition.set(q.editionId, line);
  }

  const history: PlayerEditionLine[] = [...perEdition.entries()]
    .map(([editionId, v]) => {
      const ed = edInfo.get(editionId);
      return {
        editionId,
        name: ed?.name ?? "Édition",
        year: ed?.year ?? 0,
        drinks: v.drinks,
        titles: v.titles,
      };
    })
    .sort((a, b) => b.year - a.year);

  // "Palmarès des catégories les plus gagnées" (§10): categories won 2+ times.
  const byPrompt = new Map<string, number>();
  for (const t of titles) byPrompt.set(t.prompt, (byPrompt.get(t.prompt) ?? 0) + 1);
  const signatureWins: SignatureWin[] = [...byPrompt.entries()]
    .filter(([, count]) => count >= 2)
    .map(([prompt, count]) => ({ prompt, count }))
    .sort((a, b) => b.count - a.count);

  return {
    person: personView,
    lifetimeDrinks: history.reduce((s, h) => s + h.drinks, 0),
    titleCount: titles.length,
    history,
    titles: titles.sort((a, b) => b.year - a.year),
    signatureWins,
  };
}
