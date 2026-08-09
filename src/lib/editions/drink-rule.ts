// Libellés des règles de consommation.
//
// LA RÈGLE DÉPEND DU FORMAT, et ce module ne sert qu'à la nommer à l'écran.
//
//   Choix unique  → TOP_UNIQUE, et rien d'autre. On désigne une personne, elle
//                   cale. Il n'y a aucune option à offrir : les places 2 à N ne
//                   sont qu'un décompte de voix, pas un classement.
//
//   Classement    → deux sens, jamais TOP_UNIQUE :
//                   • Perdant boit (ESCALATION)         → le DERNIER cale
//                   • Gagnant boit (ESCALATION_INVERSE) → le PREMIER cale
//                   Dans les deux cas TOUT LE MONDE boit selon son rang. Le
//                   choix ne dépend que de la tournure de l'énoncé : « le pire
//                   cuisinier » ou « le meilleur cuisinier » font boire la même
//                   personne, l'un par la tête du classement, l'autre par la
//                   queue.

export type DrinkRule = "TOP_UNIQUE" | "ESCALATION" | "ESCALATION_INVERSE";

/** Les deux seuls sens proposés sur une question de classement. */
export const RANKING_RULES = ["ESCALATION_INVERSE", "ESCALATION"] as const;

export const DRINK_RULE_LABEL: Record<DrinkRule, string> = {
  TOP_UNIQUE: "La personne désignée cale",
  ESCALATION: "Perdant boit",
  ESCALATION_INVERSE: "Gagnant boit",
};

/** Version détaillée : les chiffres lèvent le doute sur qui avale quoi. */
export const DRINK_RULE_HINT: Record<DrinkRule, string> = {
  TOP_UNIQUE: "La personne la plus votée cale. Personne d'autre ne boit.",
  ESCALATION:
    "Perdant boit : le dernier cale, et les autres montent vers lui (1 gorgée au 1er, 2 au 2e…)",
  ESCALATION_INVERSE:
    "Gagnant boit : le premier cale, et les autres descendent depuis lui (le dernier n'a qu'1 gorgée)",
};

/** Ce que l'énoncé doit viser pour que la règle tombe juste. */
export const DRINK_RULE_EXAMPLE: Record<DrinkRule, string> = {
  TOP_UNIQUE: "« Qui a le plus honte de sa soirée ? »",
  ESCALATION: "Énoncé flatteur : « Qui est le meilleur cuisinier ? »",
  ESCALATION_INVERSE: "Énoncé peu flatteur : « Qui est le pire cuisinier ? »",
};
