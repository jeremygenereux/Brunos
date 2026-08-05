# Les Brunos — Fonctionnalités futures (hors MVP)

> Révisé le 4 août 2026, après la mise en ligne sur **brunos.live**.
>
> Complexité : 🟢 facile · 🟡 moyen · 🔴 gros morceau. Les estimations tiennent
> compte du code réellement en place, pas d'une idée générale de la difficulté.
>
> **Décision du 4 août 2026 : rien n'est entrepris pour l'instant.** L'app reste
> telle quelle jusqu'au prochain gala. Ce document sert de mémoire, pas de plan
> de travail.

---

## Déjà livré (retiré des idées)

Le document d'origine listait plusieurs choses désormais en production. Elles
sont notées ici pour ne pas les reproposer.

| Idée d'origine | Où c'est rendu |
| --- | --- |
| Teasing pré-soirée, compte à rebours | `src/app/account/countdown.tsx`, plus l'avancement du scrutin côté admin |
| Profil joueur « carrière » | `src/app/archive/players/[personId]/` |
| Détecteurs de drame | `src/lib/editions/drama.ts` (classement mutuel en queue, plébiscite, vote pour soi…) |
| Records et superlatifs all-time | Les quatre trophées de `src/lib/editions/stats.ts` |
| Simulateur de gorgées | L'égaliseur, `compile/equalizer-panel.tsx` |
| Multi-admin / co-organisateurs | Les cercles et `circle_admins` |
| Compagnon mobile (PWA) | `manifest.json` + icônes. Installable ; sans notifications push ni mode hors-ligne |
| Notifications admin | En application (la cloche). **Pas** par courriel, et ce n'est pas un oubli : voir la contrainte plus bas |

---

## Contraintes à connaître avant de chiffrer quoi que ce soit

Trois faits du socle qui décident du coût réel de plusieurs idées ci-dessous.

**Le cycle de vie est verrouillé par construction.** `edition_accepts_votes()`
exige l'état `SENT_FOR_VOTE` **et** une échéance non dépassée. La présentation,
elle, lit exclusivement les `results` figés au passage en `LOCKED`. Toute idée
de vote pendant la soirée se bat contre ces deux invariants à la fois : ce n'est
pas une fonctionnalité qui s'ajoute, c'est le cycle de vie qu'on rouvre.

**Aucun envoi de courriel.** Choix assumé pour éviter de payer un service
d'envoi toute l'année pour une app ouverte deux fois. Les accès se créent à la
main avec un mot de passe généré. Toute idée reposant sur un courriel
automatique (rappels, rapport du lendemain) suppose d'abord de revenir sur cette
décision.

**Les gorgées figées sont sacrées.** `questionDrinks` alimente `snapshot.ts`,
qui écrit l'archive définitive et les statistiques à vie. Une erreur là ne se
voit pas le soir même : elle se voit deux ans plus tard dans le palmarès.

---

## A. Vote et interaction en direct le soir même

- **🔴 Vote live au téléphone pendant la soirée.** Une ou deux catégories
  « bonus » votées sur place (connexion avec son compte → page de vote →
  résultats en direct via Supabase Realtime). Parfait pour une catégorie
  improvisée née pendant la soirée. Plus tard : mode invité avec code ou QR à
  rejoindre, façon Kahoot.

  *Reclassé 🟡 → 🔴.* Ce n'est pas la complexité du temps réel qui coûte, c'est
  qu'il faut rouvrir le cycle de vie (voir contraintes) et recalculer hors du
  chemin figé. **Et ça échoue en public, à 21 h, sans possibilité de déboguer.**
  Si on y va un jour : en faire un **sondage live séparé** qui ne touche pas aux
  `results` figés. Un plantage devient gênant au lieu d'être corrupteur.
  L'intégrer au calcul officiel viendra après, si la mécanique a fait ses
  preuves.

- **🟢 Buzzer / tambour de suspense déclenché depuis le téléphone de l'admin**,
  qui sert de télécommande à la place du clavier, avec sons de gala.

  *Contre-argument à peser d'abord :* une télécommande de présentation Bluetooth
  à 20 $ règle le problème de mobilité aujourd'hui, sans une ligne de code. Le
  deck écoute déjà les flèches, et ces boîtiers émulent Page suivante /
  précédente. Ce que le clicker ne fait pas, c'est déclencher un son précis au
  bon moment. **Cette idée n'a donc de sens qu'après la trame sonore**, comme
  surface de contrôle de celle-ci.

- **🔴 Prédictions live.** Avant chaque révélation, les invités parient sur le
  gagnant ; un mini-classement de « qui devine le mieux » émerge en fin de
  soirée. Méta-jeu social, peut-être relié aux jetons (section E).

  Dépend entièrement de l'infrastructure live ci-dessus. À ne pas envisager
  avant qu'elle existe et ait servi au moins une fois.

---

## B. Présentation et mise en scène

- **🟢 Trame sonore. — LA PREMIÈRE À FAIRE.** Musique d'intro, roulements de
  tambour, fanfare à la révélation, applaudissements. Chaque type de son
  activable ou coupable par édition.

  Meilleur rapport effet/risque de toute la liste : aucun schéma, aucune
  migration, tout côté client. Les points de déclenchement existent déjà (les
  étapes 0 → 1 → 2 du deck, la cascade, la face card). La présentation est déjà
  belle mais **muette** ; c'est la seule chose de la liste qui capitalise
  directement sur le travail de chorégraphie déjà fait.

- **🟡 Bandes-annonces / nominations animées** façon Oscars : avant le résultat,
  un montage des nommés avec transitions cinématiques.

- **🟡 Thèmes visuels par édition.** Garder le squelette or et noir en
  permettant une variante par année (2027 en argent et bleu nuit, par exemple).

  Techniquement facile, le design tient dans des variables CSS. Mais **personne
  ne le remarquera.** À faire un dimanche pluvieux, pas avant.

---

## C. Statistiques et données

- **🟡 Heatmap de votes.** Matrice qui-a-voté-comment-pour-qui, anonymisable ou
  non selon le niveau de chaos désiré.
- **🟡 Détecteurs de drame, deuxième vague.** Au-delà de ceux qui existent :
  alliances durables, revirements d'une année à l'autre, ennemi juré de chacun.
- **🔴 Rapport de fin de soirée généré par IA.** Résumé narratif et drôle de
  l'édition, ton de chroniqueur mondain. Suppose de régler la question de
  l'envoi de courriel (voir contraintes) ou de le publier dans l'app.

---

## D. Social, engagement et hors-soirée

- **🟡 Proposition de questions par les joueurs.** Chacun soumet des idées de
  catégories en tout temps ; elles tombent dans la banque, l'admin y pige. Le
  contrôle final reste à l'admin, la créativité devient collective.

  **À noter : c'est la même fonctionnalité que la banque de questions (F), vue
  de l'autre bout.** Une table de questions détachée des éditions, avec tags et
  auteur. Construire la banque d'abord donne celle-ci presque gratuitement.

  C'est aussi **la seule idée de la liste qui fait vivre l'app entre deux
  galas.** Une application ouverte deux fois par an meurt d'oubli ; si quelqu'un
  peut déposer une idée un mardi de mars, elle existe toute l'année.

- **🟢 Galerie photo de l'édition.** Les invités déposent leurs photos, jointes
  à l'édition dans l'archive.

---

## E. Mécaniques de jeu avancées

- **🟡 Jetons « sauvetage » / « sabotage ».** Un pouvoir à usage unique par
  joueur : faire boire quelqu'un à sa place, doubler la mise sur une catégorie.
  Éventuellement gagnés par de bonnes prédictions.

  *Reclassé 🟢 → 🟡.* Le coût n'est pas dans l'interface, il est dans le calcul :
  ça modifie `questionDrinks`, donc l'archive définitive et les stats à vie
  (voir contraintes). Demande de vrais tests, pas un essai à l'œil.

- **🟡 Malus d'unanimité.** Un joueur classé premier par tout le monde prend une
  gorgée de plus. Le drame de l'unanimité. Même réserve : ça touche au calcul
  figé. Note : la déboule « Plébiscite » détecte **déjà** l'unanimité, donc la
  détection est faite ; il ne reste que la conséquence.

- **🟡 Catégories à formats variés.** Au-delà du classement et du choix unique :
  vrai ou faux sur les joueurs, associer une citation à quelqu'un, sondages
  chiffrés.

  **Dette existante à traiter en premier ici :** les **190 notations de 1 à 5
  des proches de l'édition 2024 Automne ne sont pas importées**, faute d'un
  format `rating` dans le modèle (documenté dans `supabase/backfill/README.md`).
  C'est le seul format qui rembourse immédiatement : il déverrouille une édition
  passée au lieu de créer du futur.

- **🟡 Catégories à valeur double.** Certaines catégories comptent double au
  classement.

  **Penser à l'égaliseur.** `equalize()` choisit k questions pour aplatir les
  gorgées à partir d'un vecteur `{questionId, drinks}` par question. Il est
  volontairement agnostique du format : le vote des proches n'a rien exigé de
  lui, il a suffi que les questions entourage sachent produire leur vecteur.
  Une catégorie à valeur double devra faire pareil, c'est-à-dire livrer des
  gorgées **déjà doublées**, et surtout ne pas doubler ailleurs dans la chaîne.
  Même consigne pour tout format à venir : la règle est que l'optimiseur ne
  connaît que des gorgées, jamais des formats.

---

## F. Administration et qualité de vie

- **🟢 Banque de questions réutilisables.** Une bibliothèque de vos meilleures
  catégories, taguées, piochables dans n'importe quelle édition. **Prérequis
  naturel de D.**

- **🟢 Duplication d'édition.** Cloner l'an dernier (joueurs et questions
  retenues) pour démarrer la suivante en un clic.

  Avec la banque, c'est ce qui décide si monter l'édition 2027 prend vingt
  minutes ou deux heures. Autrement dit, en partie, si le gala a lieu.

- **🟡 Export.** PDF des résultats, export des stats, sauvegarde de la
  présentation.

  À relativiser : la page d'archive contient déjà tout. Une feuille de style
  d'impression donne 80 % du résultat en une heure. À faire le jour où
  quelqu'un le demande.

---

## Ordre d'attaque recommandé

Établi le 4 août 2026, en partant du fait que les éditions ont eu lieu le
21 mars 2024, le 24 août 2024 et le 30 août 2025 — donc que la suivante tombe
probablement fin août. **À revalider : si la date change, l'ordre change.**

**S'il reste moins d'un mois avant le gala**

1. **La trame sonore (B), et rien d'autre.** C'est la seule chose de la liste
   qui améliore la soirée sans risquer de la casser.

**Une fois le gala passé, avec douze mois devant soi**

2. **Banque de questions (F)**, puis **duplication d'édition (F)**.
3. **Propositions des joueurs (D)**, qui découle de la banque et fait vivre
   l'app hors saison.
4. **Format `rating` (E)** pour récupérer les notations de 2024 Automne.
5. **Réévaluer le vote live (A)** avec du recul : la mécanique a-t-elle
   vraiment manqué pendant la soirée, ou est-ce une idée séduisante sur papier ?

**Ce que je laisserais dormir :** thèmes par édition, export PDF, prédictions
live. Rien n'y presse et rien n'y manque à personne.
