// Les modes de vote d'une cérémonie, résumés pour le règlement en séance.
//
// POURQUOI. Le règlement énoncé en prose ne dit pas ce que l'assemblée va
// VOIR. Deux pictogrammes — les mêmes que sur le bulletin — annoncent d'un
// coup d'œil les façons de voter présentes ce soir et, pour chacune, où tombe
// la charge. On reconnaît en séance ce qu'on a déjà vu en votant.
//
// Les formulations suivent `questionDrinks` à la lettre :
//   • Gagnant boit (TOP_UNIQUE) : la première place boit un shooter, tous les
//     autres rangs sont à zéro ;
//   • Perdant boit (ESCALATION) : rang 1 = 1 gorgée, rang 2 = 2, et ainsi de
//     suite, la dernière place buvant un shooter au lieu de N gorgées.
// Le mode (classer ou désigner) ne change pas ce calcul : il ne change que la
// façon dont le classement a été obtenu. En pratique une désignation est
// toujours en « gagnant boit » : ne choisir qu'une personne puis faire boire
// tout le monde selon un rang de dépouillement n'aurait pas de sens.

import type { Category } from "./presentation-types";
import { cascadeOf } from "./reveal-order";

export type ModeKind = "ranking" | "single_choice";

export type QuestionMode = {
  kind: ModeKind;
  title: string;
  count: number;
  /** Ce que le votant a fait. */
  ballotNote: string;
  /** Où tombe la charge, selon les règles réellement en vigueur. */
  drinkNote: string;
};

const TITLE: Record<ModeKind, string> = {
  ranking: "Classement",
  single_choice: "Désignation",
};

const BALLOT_NOTE: Record<ModeKind, string> = {
  ranking: "Vous avez classé tous les joueurs, du premier au dernier.",
  single_choice: "Vous avez désigné une seule personne.",
};

const TOP_UNIQUE_NOTE: Record<ModeKind, string> = {
  ranking: "La première place boit un shooter. Les autres ne boivent pas.",
  single_choice:
    "La personne qui reçoit le plus de votes boit un shooter. Les autres ne boivent pas.",
};

const ESCALATION_NOTE: Record<ModeKind, string> = {
  ranking:
    "Chaque place boit selon son rang : 1 gorgée pour la première, 2 pour la deuxième, et ainsi de suite. La dernière place boit un shooter.",
  single_choice:
    "Les votes classent les joueurs. Chaque place boit selon son rang : 1 gorgée pour la première, 2 pour la deuxième, et ainsi de suite. La dernière place boit un shooter.",
};

const MIXED_NOTE: Record<ModeKind, string> = {
  ranking:
    "Selon la catégorie, le shooter va à la première ou à la dernière place. À la première, elle boit seule. À la dernière, chaque place boit selon son rang : 1 gorgée pour la première, 2 pour la deuxième, et ainsi de suite.",
  single_choice:
    "Selon la catégorie, le shooter va à la personne la plus votée, qui boit seule, ou à la moins votée, chaque place buvant alors selon son rang.",
};

/**
 * Les modes réellement présents, dans l'ordre de première apparition.
 *
 * La règle se lit dans la CHORÉGRAPHIE (`rankingMatters`) et non dans celle de
 * l'édition : une cérémonie peut mélanger les deux par `drink_rule_override`,
 * et c'est ce que l'assemblée verra qu'il faut lui annoncer.
 *
 * `defaultRule` ne sert que de repli, quand aucune catégorie du mode n'a encore
 * de verdict à observer (aperçu d'une cérémonie non dépouillée).
 */
export function questionModesFor(
  categories: Category[],
  defaultRule: "ESCALATION" | "TOP_UNIQUE",
): QuestionMode[] {
  const order: ModeKind[] = [];
  const stats = new Map<ModeKind, { count: number; escalation: boolean; topUnique: boolean }>();

  for (const cat of categories) {
    const kind: ModeKind = cat.format === "ranking" ? "ranking" : "single_choice";
    if (!stats.has(kind)) {
      stats.set(kind, { count: 0, escalation: false, topUnique: false });
      order.push(kind);
    }
    const s = stats.get(kind)!;
    s.count += 1;

    // Une catégorie sans verdict n'enseigne rien sur la règle : on la compte
    // sans lui laisser décider de ce qu'on annonce.
    if (cat.players.length === 0) continue;
    const { shooters, rankingMatters } = cascadeOf(cat.players);
    if (shooters.length === 0) continue;
    if (rankingMatters) s.escalation = true;
    else s.topUnique = true;
  }

  return order.map((kind) => {
    const s = stats.get(kind)!;
    const observed = s.escalation || s.topUnique;
    const escalation = observed ? s.escalation : defaultRule === "ESCALATION";
    const topUnique = observed ? s.topUnique : defaultRule === "TOP_UNIQUE";

    return {
      kind,
      title: TITLE[kind],
      count: s.count,
      ballotNote: BALLOT_NOTE[kind],
      drinkNote:
        escalation && topUnique
          ? MIXED_NOTE[kind]
          : escalation
            ? ESCALATION_NOTE[kind]
            : TOP_UNIQUE_NOTE[kind],
    };
  });
}
