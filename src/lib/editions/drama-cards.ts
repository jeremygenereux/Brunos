// Les déboules : ce que les bulletins racontent une fois le verdict tombé.
//
// Module PUR — aucune entrée-sortie. `drama.ts` (server-only) lit la base et
// façonne l'entrée ; ici on ne fait que juger. C'est ce qui permet de tester
// chaque déclencheur à froid, sans base ni rendu.
//
// DEUX EXTRÉMITÉS, ET ELLES CHANGENT DE CÔTÉ. Selon la règle, l'extrémité qui
// cale est la tête ou la queue du classement :
//   • « Perdant boit » (ESCALATION)         → la dernière place cale
//   • « Gagnant boit » (ESCALATION_INVERSE) → la première place cale
//   • Désignation (TOP_UNIQUE)              → la personne la plus votée cale
// Plusieurs déboules n'ont de sens que d'un seul côté : se classer mutuellement
// dernier est une rancune quand le dernier boit, et une politesse quand c'est
// le premier. Chaque carte porte donc sa restriction.

import type { DrinkRule, PlayerScore } from "../scoring/types";
import type { DramaCard } from "./presentation-types";
import { detectDelusions, type DelusionBallot } from "./delusion";

export type DramaBallot = {
  voterName: string;
  /** Le joueur QU'EST ce votant dans l'édition ; null pour l'entourage. */
  selfPlayerId: string | null;
  /** playerId → rang donné par ce votant. */
  byPlayer: Map<string, number>;
  /** Le dernier rang de SON bulletin. */
  maxRank: number;
};

export type DramaInput = {
  format: string;
  /** Règle EFFECTIVE de la question. */
  rule: DrinkRule;
  /** Bulletins des JOUEURS uniquement — la déboule raconte leur histoire. */
  ballots: DramaBallot[];
  /** Classement officiel, trié par `finalRank`. */
  official: PlayerScore[];
  playerName: Map<string, string>;
};

/**
 * L'ordre de priorité, du plus rare et racontable au plus courant. La
 * présentation n'en garde que les premières ; l'archive les montre toutes.
 */
const PRIORITE: DramaCard["kind"][] = [
  "protest_vote",
  "unanimous_first",
  "unanimous_last",
  "self_delusion",
  "mutual_last",
  "mutual_first",
  "sacrificed_friend",
  "lone_defender",
  "self_top",
];

/** Combien de déboules la scène affiche au maximum. L'archive n'en coupe aucune. */
export const DRAMA_MAX_ON_STAGE = 4;

/**
 * Le catalogue annoncé en début de soirée : ce qui PEUT tomber.
 *
 * `rules` dit sous quelles règles la carte existe. On ne promet jamais une
 * déboule impossible : annoncer « Admiration mutuelle » à une soirée sans
 * aucune catégorie « gagnant boit », c'est faire attendre pour rien.
 */
export const DRAMA_CATALOGUE: {
  kind: DramaCard["kind"];
  title: string;
  blurb: string;
  rules: DrinkRule[];
}[] = [
  {
    kind: "protest_vote",
    title: "À contre-courant",
    blurb: "Un vote exactement à l'envers du résultat.",
    rules: ["ESCALATION", "ESCALATION_INVERSE"],
  },
  {
    kind: "unanimous_first",
    title: "Sans appel",
    blurb: "Tout le monde a voté pareil.",
    rules: ["ESCALATION", "ESCALATION_INVERSE", "TOP_UNIQUE"],
  },
  {
    kind: "self_delusion",
    title: "Dans le déni",
    blurb: "Celui qui boit s'était mis à l'autre bout.",
    rules: ["ESCALATION", "ESCALATION_INVERSE"],
  },
  {
    // Une seule entrée au catalogue pour les deux réciproques : elles ne
    // peuvent pas tomber sur la même question, et le public n'a pas à retenir
    // laquelle va avec quelle règle. Le geste annoncé est le même — s'envoyer
    // boire l'un l'autre. Les cartes, elles, restent distinctes en scène.
    kind: "mutual_last",
    title: "Rancune · Admiration mutuelle",
    blurb: "Deux joueurs s'envoient boire l'un l'autre.",
    rules: ["ESCALATION", "ESCALATION_INVERSE"],
  },
  {
    kind: "sacrificed_friend",
    title: "Sacrifice humain",
    blurb: "Envoyer au shooter quelqu'un qui vous avait protégé.",
    rules: ["ESCALATION", "ESCALATION_INVERSE"],
  },
  {
    kind: "lone_defender",
    title: "Joueur défensif",
    blurb: "Une seule personne a protégé celui qui boit.",
    rules: ["ESCALATION", "ESCALATION_INVERSE"],
  },
  {
    kind: "self_top",
    title: "Sans complexe · Aucune illusion",
    blurb: "Mettre son propre nom tout en haut ou tout en bas.",
    rules: ["ESCALATION", "ESCALATION_INVERSE", "TOP_UNIQUE"],
  },
];

/** Les déboules réellement possibles au vu des règles présentes ce soir. */
export function dramaCatalogueFor(rules: DrinkRule[]) {
  const presentes = new Set(rules);
  return DRAMA_CATALOGUE.filter((c) => c.rules.some((r) => presentes.has(r)));
}

export function buildDramaCards(input: DramaInput): DramaCard[] {
  const { format, rule, ballots, official, playerName } = input;
  if (ballots.length === 0 || official.length === 0) return [];

  const nom = (id: string) => playerName.get(id) ?? "?";
  const estClassement = format === "ranking";
  const votants = ballots.length;

  // Qui cale, avec la même définition que `questionDrinks` : toujours sur le
  // rang PARTAGÉ, jamais sur la position d'affichage.
  const dernierRang = official.reduce((max, s) => Math.max(max, s.tiedRank), 0);
  const caleurs = new Set(
    official
      .filter((s) => (rule === "ESCALATION" ? s.tiedRank === dernierRang : s.tiedRank === 1))
      .map((s) => s.playerId),
  );

  // L'extrémité qui trinque, vue depuis UN bulletin. En désignation il n'y a
  // pas de queue : voter pour quelqu'un, c'est l'envoyer boire.
  const rangQuiCale = (b: DramaBallot) => (rule === "ESCALATION" ? b.maxRank : 1);
  const rangClement = (b: DramaBallot) => (rule === "ESCALATION" ? 1 : b.maxRank);

  const cards: DramaCard[] = [];

  /* ── À contre-courant ────────────────────────────────────────────────
     Un bulletin exactement inversé par rapport au verdict. Rarissime, et
     c'est ce qui en fait le prix : on la garde stricte volontairement. */
  if (estClassement) {
    const n = official.length;
    for (const b of ballots) {
      if (b.byPlayer.size !== n) continue;
      const inverse = official.every((s) => b.byPlayer.get(s.playerId) === n - s.finalRank + 1);
      if (inverse) {
        cards.push({
          kind: "protest_vote",
          title: "À contre-courant",
          detail: `${b.voterName} a voté exactement à l'envers du résultat.`,
        });
      }
    }
  }

  /* ── Sans appel ──────────────────────────────────────────────────────
     La personne qui cale a été désignée à l'unanimité. Une seule des deux
     variantes peut sortir : une catégorie n'a qu'une règle. */
  const unanimeAu = (rang: (b: DramaBallot) => number) => {
    const compte = new Map<string, number>();
    for (const b of ballots) {
      for (const [pid, r] of b.byPlayer) if (r === rang(b)) compte.set(pid, (compte.get(pid) ?? 0) + 1);
    }
    for (const [pid, c] of compte) if (c === votants) return pid;
    return null;
  };

  if (votants >= 2) {
    // « Gagnant boit » et désignation : c'est la tête qui trinque.
    if (rule !== "ESCALATION") {
      const pid = unanimeAu(() => 1);
      if (pid && caleurs.has(pid)) {
        cards.push({
          kind: "unanimous_first",
          title: "Sans appel",
          detail: estClassement
            ? `Tout le monde a mis ${nom(pid)} en premier.`
            : `Tout le monde a voté pour ${nom(pid)}.`,
        });
      }
    } else if (estClassement) {
      const pid = unanimeAu((b) => b.maxRank);
      if (pid && caleurs.has(pid)) {
        cards.push({
          kind: "unanimous_last",
          title: "Sans appel",
          detail: `Tout le monde a mis ${nom(pid)} en dernier.`,
        });
      }
    }
  }

  /* ── Dans le déni ────────────────────────────────────────────────────
     Le caleur s'était placé à l'extrémité opposée. */
  const delusions = estClassement
    ? detectDelusions(
        ballots.map<DelusionBallot>((b) => ({
          voterName: b.voterName,
          selfPlayerId: b.selfPlayerId,
          selfRank: b.selfPlayerId ? (b.byPlayer.get(b.selfPlayerId) ?? null) : null,
          maxRank: b.maxRank,
        })),
        official,
        rule,
      )
    : [];
  cards.push(...delusions);

  // Les noms visés par « Dans le déni » : leur carte d'auto-classement est
  // masquée. Se voir reprocher son aveuglement ET son aplomb pour le même
  // geste, ce serait dire deux fois la même chose.
  const enDeni = new Set(
    ballots
      .filter((b) => b.selfPlayerId && caleurs.has(b.selfPlayerId))
      .filter((b) => {
        const r = b.selfPlayerId ? b.byPlayer.get(b.selfPlayerId) : null;
        return rule === "ESCALATION" ? r === 1 : r === b.maxRank;
      })
      .map((b) => b.voterName),
  );

  /* ── Rancune / Admiration mutuelle ───────────────────────────────────
     Deux joueurs se placent mutuellement à la même extrémité. Le sens
     dépend entièrement de qui boit de ce côté-là. */
  if (estClassement) {
    // Dans les deux cas, la carte dit la même chose : ces deux-là se sont
    // mutuellement envoyés BOIRE. Seul le bout du classement change.
    const choixA = new Map<string, string>();
    const cible = rangQuiCale;
    for (const b of ballots) {
      if (!b.selfPlayerId) continue;
      for (const [pid, r] of b.byPlayer) if (r === cible(b)) choixA.set(b.selfPlayerId, pid);
    }
    const vus = new Set<string>();
    for (const [a, b] of choixA) {
      if (choixA.get(b) !== a || a === b || vus.has(b)) continue;
      vus.add(a);
      vus.add(b);
      cards.push(
        rule === "ESCALATION"
          ? {
              kind: "mutual_last",
              title: "Rancune mutuelle",
              detail: `${nom(a)} et ${nom(b)} ont mis le nom de l'autre en dernier.`,
            }
          : {
              kind: "mutual_first",
              title: "Admiration mutuelle",
              detail: `${nom(a)} et ${nom(b)} ont mis le nom de l'autre en premier.`,
            },
      );
    }
  }

  /* ── Sacrifice humain ────────────────────────────────────────────────
     Quelqu'un envoie au shooter une personne qui, elle, l'avait épargné.
     On exige que la victime cale VRAIMENT : sinon la carte sortirait à
     chaque catégorie et ne raconterait plus rien. */
  if (estClassement) {
    const place = (b: DramaBallot, pid: string) => b.byPlayer.get(pid);
    for (const bourreau of ballots) {
      if (!bourreau.selfPlayerId) continue;
      for (const victime of caleurs) {
        if (victime === bourreau.selfPlayerId) continue;
        if (place(bourreau, victime) !== rangQuiCale(bourreau)) continue;
        const sien = ballots.find((x) => x.selfPlayerId === victime);
        if (!sien) continue;
        if (place(sien, bourreau.selfPlayerId) !== rangClement(sien)) continue;
        cards.push({
          kind: "sacrificed_friend",
          title: "Sacrifice humain",
          detail: `${bourreau.voterName} a envoyé ${nom(victime)} au shooter. ${nom(victime)} avait pourtant protégé ${bourreau.voterName}.`,
        });
      }
    }
  }

  /* ── Joueur défensif ─────────────────────────────────────────────────
     Le caleur n'a eu qu'un seul défenseur : une personne, et une seule,
     l'avait placé du côté clément. */
  if (estClassement) {
    for (const victime of caleurs) {
      const defenseurs = ballots.filter(
        (b) => b.selfPlayerId !== victime && b.byPlayer.get(victime) === rangClement(b),
      );
      if (defenseurs.length === 1) {
        cards.push({
          kind: "lone_defender",
          title: "Joueur défensif",
          detail: `Une seule personne a protégé ${nom(victime)} : ${defenseurs[0].voterName}.`,
        });
      }
    }
  }

  /* ── Sans complexe / Aucune illusion ─────────────────────────────────
     Deux gestes OPPOSÉS, pas un seul geste vu sous deux règles :

       • se mettre du côté qui CALE   → lucidité   → « Aucune illusion »
       • se mettre du côté ÉPARGNÉ    → aplomb     → « Sans complexe »

     Le déclencheur est donc l'extrémité, jamais le rang 1. Le tester sur la
     tête ratait le cas le plus courant — se classer dernier quand c'est le
     dernier qui boit. En désignation il n'y a pas de côté épargné : voter
     pour soi, c'est se désigner, et seule la lucidité existe. */
  for (const b of ballots) {
    if (!b.selfPlayerId) continue;
    const soi = b.byPlayer.get(b.selfPlayerId);
    if (soi === undefined) continue;

    if (soi === rangQuiCale(b)) {
      cards.push({
        kind: "self_top",
        title: "Aucune illusion",
        detail: estClassement
          ? `${b.voterName} a mis son propre nom ${rule === "ESCALATION" ? "en dernier" : "en premier"}, là où on boit.`
          : `${b.voterName} a voté pour son propre nom.`,
      });
    } else if (estClassement && soi === rangClement(b)) {
      // Masquée quand « Dans le déni » vise déjà cette personne : lui
      // reprocher son aveuglement ET son aplomb, c'est le dire deux fois.
      if (enDeni.has(b.voterName)) continue;
      cards.push({
        kind: "self_top",
        title: "Sans complexe",
        detail: `${b.voterName} a mis son propre nom ${rule === "ESCALATION" ? "en premier" : "en dernier"}, là où on ne boit pas.`,
      });
    }
  }

  return cards.sort((a, b) => PRIORITE.indexOf(a.kind) - PRIORITE.indexOf(b.kind));
}
