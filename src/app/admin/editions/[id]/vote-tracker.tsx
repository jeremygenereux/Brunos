import { createClient } from "@/lib/supabase/server";
import { ResetBallotButton } from "./reset-ballot-button";

/**
 * Suivi du scrutin pendant que le vote est ouvert : qui a déposé son bulletin,
 * et — repliés — les bulletins eux-mêmes pour vérifier que les réponses ont du
 * sens (doublons, classements incohérents, blagues).
 *
 * ⚠️ Le contenu des bulletins n'est visible que de l'admin (policies
 * `*_owner_or_admin`). C'est un pouvoir volontaire, pas une fuite — d'où le
 * repli par défaut et l'avertissement à l'écran.
 */
export async function VoteTracker({ editionId }: { editionId: string }) {
  const supabase = await createClient();

  const { data: parts } = await supabase
    .from("participants")
    .select("id, kind, user_id, relation_label")
    .eq("edition_id", editionId);

  const userIds = [...new Set((parts ?? []).map((p) => p.user_id))];
  const { data: people } = userIds.length
    ? await supabase.from("people").select("display_name, auth_user_id").in("auth_user_id", userIds)
    : { data: [] as { display_name: string | null; auth_user_id: string | null }[] };
  const nameByUser = new Map((people ?? []).map((p) => [p.auth_user_id, p.display_name]));

  const { data: votes } = await supabase
    .from("votes")
    .select("id, participant_id, submitted_at")
    .eq("edition_id", editionId);
  const voteByParticipant = new Map((votes ?? []).map((v) => [v.participant_id, v]));

  const { data: questions } = await supabase
    .from("questions")
    .select("id, prompt, format, position")
    .eq("edition_id", editionId)
    .order("position");
  const qById = new Map((questions ?? []).map((q) => [q.id, q]));

  const voteIds = (votes ?? []).map((v) => v.id);
  const { data: answers } = voteIds.length
    ? await supabase
        .from("vote_answers")
        .select("vote_id, question_id, player_id, rank")
        .in("vote_id", voteIds)
    : { data: [] as { vote_id: string; question_id: string; player_id: string; rank: number }[] };

  const { data: players } = await supabase
    .from("players")
    .select("id, person_id, people(display_name)")
    .eq("edition_id", editionId);
  const playerName = new Map(
    (players ?? []).map((p) => {
      const person = Array.isArray(p.people) ? p.people[0] : p.people;
      return [p.id, (person as { display_name?: string } | null)?.display_name ?? "—"];
    }),
  );

  const rows = (parts ?? [])
    .map((p) => ({
      id: p.id,
      kind: p.kind as "player" | "jury",
      name:
        nameByUser.get(p.user_id) ??
        p.relation_label ??
        (p.kind === "jury" ? "Entourage" : "Joueur"),
      vote: voteByParticipant.get(p.id) ?? null,
    }))
    .sort((a, b) => Number(Boolean(b.vote)) - Number(Boolean(a.vote)) || a.name.localeCompare(b.name));

  const voted = rows.filter((r) => r.vote).length;
  const totalQuestions = questions?.length ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="text-or-300 font-display text-3xl tabular-nums">
          {voted}/{rows.length}
        </span>
        <span className="text-ivoire-muted font-sans text-sm">
          bulletin{voted > 1 ? "s" : ""} déposé{voted > 1 ? "s" : ""}
        </span>
      </div>

      <ul className="flex flex-col gap-2">
        {rows.map((r) => {
          const mine = (answers ?? []).filter((a) => a.vote_id === r.vote?.id);
          const answered = new Set(mine.map((a) => a.question_id)).size;
          return (
            <li
              key={r.id}
              className={`rounded-xl border px-4 py-3 ${
                r.vote ? "border-or-400/25 bg-noir-700/40" : "border-or-400/10 bg-noir-700/20"
              }`}
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className={r.vote ? "text-or-300" : "text-ivoire-faint"}>
                  {r.vote ? "✓" : "○"}
                </span>
                <span className="text-ivoire flex-1 font-sans text-sm">{r.name}</span>
                <span className="text-ivoire-faint font-sans text-xs">
                  {r.kind === "jury" ? "Entourage" : "Joueur"}
                </span>
                <span className="text-ivoire-faint font-sans text-xs tabular-nums">
                  {r.vote ? `${answered}/${totalQuestions} catégories` : "n'a pas encore voté"}
                </span>
                {r.vote && (
                  <ResetBallotButton editionId={editionId} participantId={r.id} name={r.name} />
                )}
              </div>

              {r.vote && mine.length > 0 && (
                <details className="mt-2">
                  <summary className="text-ivoire-faint hover:text-or-300 w-fit cursor-pointer font-sans text-xs transition">
                    Voir son bulletin
                  </summary>
                  <ol className="mt-2 flex flex-col gap-1.5">
                    {(questions ?? []).map((q) => {
                      const forQ = mine
                        .filter((a) => a.question_id === q.id)
                        .sort((a, b) => a.rank - b.rank);
                      if (forQ.length === 0) return null;
                      const label =
                        qById.get(q.id)?.format === "ranking"
                          ? forQ.map((a) => playerName.get(a.player_id) ?? "—").join(" › ")
                          : (playerName.get(forQ[0].player_id) ?? "—");
                      return (
                        <li key={q.id} className="flex flex-col gap-0.5">
                          <span className="text-ivoire-faint font-sans text-[11px]">{q.prompt}</span>
                          <span className="text-ivoire font-sans text-xs">{label}</span>
                        </li>
                      );
                    })}
                  </ol>
                </details>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
