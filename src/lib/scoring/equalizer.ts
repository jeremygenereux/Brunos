export type QuestionLoad = { questionId: string; drinks: Map<string, number> };

export type EqualizerResult = {
  /** The chosen question ids. */
  selected: string[];
  /** Total drinks per player for the chosen set. */
  totals: Record<string, number>;
  /** max − min of the per-player totals (0 = perfectly balanced). */
  spread: number;
};

/** Seeded PRNG (mulberry32) — reproducible annealing. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function totalsFor(
  selected: Iterable<string>,
  byId: Map<string, QuestionLoad>,
  playerIds: string[],
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const id of playerIds) totals.set(id, 0);
  for (const qid of selected) {
    const load = byId.get(qid);
    if (!load) continue;
    for (const pid of playerIds)
      totals.set(pid, (totals.get(pid) ?? 0) + (load.drinks.get(pid) ?? 0));
  }
  return totals;
}

function spreadOf(totals: Map<string, number>): number {
  if (totals.size === 0) return 0;
  let min = Infinity;
  let max = -Infinity;
  for (const v of totals.values()) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return max - min;
}

/**
 * Choose `k` of the candidate questions so the total drinks per player are as
 * even as possible (minimise max−min). Greedy seed + simulated annealing;
 * deterministic given a seed. Always returns the best solution it found
 * (never worse than the greedy seed).
 */
export function equalize(
  candidates: QuestionLoad[],
  playerIds: string[],
  k: number,
  opts: { iterations?: number; seed?: number } = {},
): EqualizerResult {
  const byId = new Map(candidates.map((c) => [c.questionId, c]));
  const allIds = candidates.map((c) => c.questionId);
  const target = Math.max(0, Math.min(k, allIds.length));

  // Greedy: repeatedly add the question that most reduces the spread.
  const greedy: string[] = [];
  const remaining = new Set(allIds);
  while (greedy.length < target) {
    let best: string | null = null;
    let bestSpread = Infinity;
    for (const qid of remaining) {
      const s = spreadOf(totalsFor([...greedy, qid], byId, playerIds));
      if (s < bestSpread) {
        bestSpread = s;
        best = qid;
      }
    }
    if (best == null) break;
    greedy.push(best);
    remaining.delete(best);
  }

  let cur = new Set(greedy);
  let curSpread = spreadOf(totalsFor(cur, byId, playerIds));
  let bestSet = new Set(cur);
  let bestSpread = curSpread;

  const swappable = target > 0 && target < allIds.length;
  if (swappable) {
    const rnd = mulberry32(opts.seed ?? 0x9e3779b9);
    const iterations = opts.iterations ?? 5000;
    for (let i = 0; i < iterations; i++) {
      const temp = 1 - i / iterations;
      const selArr = [...cur];
      const unselArr = allIds.filter((id) => !cur.has(id));
      const out = selArr[Math.floor(rnd() * selArr.length)];
      const inn = unselArr[Math.floor(rnd() * unselArr.length)];
      const next = new Set(cur);
      next.delete(out);
      next.add(inn);
      const nextSpread = spreadOf(totalsFor(next, byId, playerIds));
      const accept =
        nextSpread <= curSpread || rnd() < 0.1 * Math.exp((curSpread - nextSpread) / (temp + 1e-9));
      if (accept) {
        cur = next;
        curSpread = nextSpread;
        if (curSpread < bestSpread) {
          bestSet = new Set(cur);
          bestSpread = curSpread;
        }
      }
    }
  }

  const totalsMap = totalsFor(bestSet, byId, playerIds);
  return {
    selected: [...bestSet],
    totals: Object.fromEntries(totalsMap),
    spread: bestSpread,
  };
}
