// Libellés des règles de consommation.
//
// Les valeurs en base restent TOP_UNIQUE / ESCALATION ; ce qui change ici,
// c'est la façon de les nommer côté écran. Le nom dit désormais QUI cale,
// puisque c'est la seule chose à décider en écrivant une catégorie : selon que
// l'énoncé est flatteur ou peu flatteur, on veut que ce soit le premier ou le
// dernier du classement qui trinque.

export type DrinkRule = "TOP_UNIQUE" | "ESCALATION";

export const DRINK_RULE_LABEL: Record<DrinkRule, string> = {
  TOP_UNIQUE: "Gagnant boit",
  ESCALATION: "Perdant boit",
};

/** Version courte pour les listes déroulantes denses. */
export const DRINK_RULE_HINT: Record<DrinkRule, string> = {
  TOP_UNIQUE: "Gagnant boit — le 1er du classement cale",
  ESCALATION: "Perdant boit — le dernier cale, les autres boivent selon leur rang",
};
