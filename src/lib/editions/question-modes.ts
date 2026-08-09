// Les modes de vote d'une cérémonie, résumés pour le règlement en séance.
//
// POURQUOI. Le règlement énoncé en prose ne dit pas ce que l'assemblée va
// VOIR. Deux pictogrammes — les mêmes que sur le bulletin — annoncent d'un
// coup d'œil les façons de voter présentes ce soir et, pour chacune, où tombe
// la charge. On reconnaît en séance ce qu'on a déjà vu en votant.
//
// Les formulations suivent `questionDrinks` à la lettre :
//   • Désignation → la personne la plus votée cale, PERSONNE d'autre ne boit.
//   • Classement  → tout le monde boit selon son rang, et le shooter tombe à
//     l'une des deux extrémités : au premier (« gagnant boit ») ou au dernier
//     (« perdant boit »). Une cérémonie mélange couramment les deux, alors on
//     annonce ce qui est RÉELLEMENT présent, pas une règle d'édition.
//
// ON LIT LE VERDICT, PAS LA CONFIGURATION. `cascadeOf` dit qui cale et si le
// classement porte un enjeu ; on en déduit la formulation. C'est ce qui garde
// la carte d'accord avec la scène même quand la configuration a changé après
// le gel des résultats.

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

const DESIGNATION_NOTE =
  "La personne qui reçoit le plus de votes boit un shooter. Les autres ne boivent pas.";

/** « Gagnant boit » : le shooter en tête, les gorgées décroissent. */
const TETE_NOTE =
  "La première place boit un shooter. Les suivantes boivent de moins en moins, jusqu'à une seule gorgée pour la dernière.";

/** « Perdant boit » : le shooter en queue, les gorgées montent. */
const QUEUE_NOTE =
  "Chaque place boit selon son rang : 1 gorgée pour la première, 2 pour la deuxième, et ainsi de suite. La dernière place boit un shooter.";

const MIXTE_NOTE =
  "Tout le monde boit à chaque catégorie. Selon l'énoncé, le shooter va à la première place ou à la dernière, et les gorgées s'échelonnent depuis elle.";

export function questionModesFor(
  categories: Category[],
  defaultRule: "ESCALATION" | "TOP_UNIQUE",
): QuestionMode[] {
  const order: ModeKind[] = [];
  const stats = new Map<ModeKind, { count: number; tete: boolean; queue: boolean }>();

  for (const cat of categories) {
    const kind: ModeKind = cat.format === "ranking" ? "ranking" : "single_choice";
    if (!stats.has(kind)) {
      stats.set(kind, { count: 0, tete: false, queue: false });
      order.push(kind);
    }
    const s = stats.get(kind)!;
    s.count += 1;

    // Une catégorie sans verdict n'enseigne rien : on la compte sans lui
    // laisser décider de ce qu'on annonce.
    if (cat.players.length === 0) continue;
    const { shooters, rankingMatters } = cascadeOf(cat.players);
    if (shooters.length === 0 || !rankingMatters) continue;

    // Le classement porte un enjeu : reste à savoir de quel côté tombe le
    // shooter. `players` arrive trié par rang croissant.
    if (shooters.some((p) => p.finalRank === 1)) s.tete = true;
    else s.queue = true;
  }

  return order.map((kind) => {
    const s = stats.get(kind)!;
    if (kind === "single_choice") {
      return {
        kind,
        title: TITLE[kind],
        count: s.count,
        ballotNote: BALLOT_NOTE[kind],
        drinkNote: DESIGNATION_NOTE,
      };
    }

    // Repli quand rien n'est encore dépouillé : la valeur de pré-remplissage
    // de l'édition donne le sens le plus probable.
    const observed = s.tete || s.queue;
    const tete = observed ? s.tete : defaultRule === "TOP_UNIQUE";
    const queue = observed ? s.queue : defaultRule === "ESCALATION";

    return {
      kind,
      title: TITLE[kind],
      count: s.count,
      ballotNote: BALLOT_NOTE[kind],
      drinkNote: tete && queue ? MIXTE_NOTE : tete ? TETE_NOTE : QUEUE_NOTE,
    };
  });
}
