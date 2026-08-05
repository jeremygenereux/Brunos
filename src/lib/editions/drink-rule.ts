// Libellés des règles de consommation.
//
// Les valeurs en base restent TOP_UNIQUE / ESCALATION / ESCALATION_INVERSE ; ce
// qui change ici, c'est la façon de les nommer côté écran.
//
// POURQUOI CES NOMS-LÀ. Les anciens ne disaient qu'une chose, QUI cale, ce qui
// suffisait tant qu'il n'y avait que deux règles. Avec trois, « gagnant boit »
// et « gagnant cale » désignaient deux mécaniques différentes sous le même
// sens : dans les deux cas le premier cale. Ce qui les sépare n'est pas là.
//
// Il y a en réalité DEUX axes, et un nom utile doit porter les deux :
//   • quelle extrémité du classement cale le shooter, la première ou la
//     dernière ;
//   • si le reste de la table boit, ou si le caleur boit seul.
//
// D'où « Le premier cale, seul » contre « Le premier cale, les autres suivent ».

export type DrinkRule = "TOP_UNIQUE" | "ESCALATION" | "ESCALATION_INVERSE";

export const DRINK_RULE_LABEL: Record<DrinkRule, string> = {
  TOP_UNIQUE: "Le premier cale, seul",
  ESCALATION: "Le dernier cale, les autres suivent",
  ESCALATION_INVERSE: "Le premier cale, les autres suivent",
};

/** Version détaillée pour les listes déroulantes : les chiffres lèvent le doute. */
export const DRINK_RULE_HINT: Record<DrinkRule, string> = {
  TOP_UNIQUE: "Le premier cale, seul : personne d'autre ne boit",
  ESCALATION: "Le dernier cale : 1 gorgée au premier, 2 au deuxième, et ainsi de suite",
  ESCALATION_INVERSE: "Le premier cale : le deuxième boit le plus, puis de moins en moins",
};
