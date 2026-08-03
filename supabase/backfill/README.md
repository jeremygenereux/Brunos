# Backfill — importer les anciennes éditions

Import **ponctuel** de données historiques. Ce ne sont **pas** des migrations :
`supabase/migrations/` décrit le *schéma* et rejoue sur tous les environnements
(dont `pnpm db:reset`). Un import de données se lance **une seule fois**, à la
main, sur la base visée.

## Le principe

On réinjecte les **bulletins d'époque**, puis on laisse l'application calculer
et figer les classements. Deux raisons :

- les nombres (Borda, rangs, gorgées) sont produits par le code réellement
  testé (`computeQuestionRanking`, `questionDrinks`) — aucun risque d'écart
  entre une archive saisie à la main et le reste de l'app ;
- on récupère gratuitement les **déboules** et la transparence des votes, qui
  se calculent depuis `vote_answers`.

## Utilisation

```bash
# 1. Vérifier sans rien écrire (à faire systématiquement)
node --env-file=.env.local scripts/import-edition.mjs supabase/backfill/2025.json --dry-run

# 2. Importer pour de vrai
node --env-file=.env.local scripts/import-edition.mjs supabase/backfill/2025.json
```

Puis, dans `/admin/editions/<id>`, enchaîner :

1. **« Verrouiller l'édition »** (COMPILATION → LOCKED) — c'est **cette**
   transition qui calcule et fige les `results` ;
2. **« Passer en direct »** ;
3. **« Envoyer à l'archive »**.

L'archive lit exclusivement le cache figé `results` et n'a **aucun repli de
calcul** : sans ce passage par LOCKED, la page resterait vide.

## Les configs

Une par édition. Elles pointent vers les CSV de `_preparation_BD` :

| Fichier | Édition | Format | Bulletins |
| --- | --- | --- | --- |
| `2024-printemps.json` | B2024P — 21 mars 2024 | `single_choice` | 114 |
| `2024-automne.json` | B2024A — 24 août 2024 | `single_choice` | 150 |
| `2025.json` | B2025 — 30 août 2025 | `ranking` | 540 |

Champs utiles :

- `data_dir` — dossier des CSV sources.
- `edition_code` — filtre les lignes (les CSV contiennent plusieurs éditions).
- `columns` — correspondance des colonnes du CSV de votes. `rang` peut être
  omis : un bulletin sans rang est un choix unique (rang 1).
- `questions_csv` — donne le **format** de chaque question et si elle a été
  **présentée au gala** (→ `is_selected_for_show`), y compris pour les
  questions écartées.
- `players_csv` — l'effectif **explicite** des nommés. Indispensable : un joueur
  peut n'avoir reçu **aucune voix** (Vincent Beaulieu en 2024P) et doit malgré
  tout figurer dans l'édition, puisqu'il était un choix possible.
- `jury` — les votants d'entourage, avec le joueur auquel ils se rattachent et
  leur lien de parenté (obligatoire : contrainte `participants_jury_fields_chk`).

## Les pièges

- **Chaque votant historique doit avoir un compte.** `participants.user_id` est
  `not null`. Le script crée automatiquement un **compte de substitution**
  (confirmé, sans mot de passe utilisable) pour les votants d'époque qui n'en
  ont pas, et le rattache à leur fiche `people` existante.
- **Les `people` sont réutilisées** : c'est l'annuaire pérenne, les stats à vie
  se relient par `person_id`. Le script ne crée que les noms manquants.
- **Auto-enrôlement** : insérer un `players` crée le `participants`
  correspondant si la personne a un compte (migration `20260612090000`). Le
  script fait donc un `upsert` sur les participants pour ne pas se heurter à
  ces lignes déjà créées.
- **`vote_answers.edition_id` est rempli par un trigger** depuis le vote parent.

## Hors périmètre pour l'instant

Le volet **« proches »** de 2024 Automne (190 notations de 1 à 5) n'est pas
importé : cette mécanique n'existe pas dans le modèle — ce n'est ni un
classement ni un choix unique, et le proche n'évalue qu'**un seul** joueur.
Elle demanderait un format `rating` (schéma + agrégation + affichage).

## `template-edition.sql`

Le gabarit SQL reste là pour comprendre le modèle ou traiter une toute petite
édition à la main. Pour de vraies données, utilise le script : personne n'écrit
540 lignes de bulletins avec des UUID à la main.
