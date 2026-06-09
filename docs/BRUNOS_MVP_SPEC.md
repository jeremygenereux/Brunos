# Les Brunos — Spécification MVP

> Document de référence à donner à Claude Code pour bâtir l'application de zéro.
> Stack imposée : **Next.js (App Router) + TypeScript + Supabase + Vercel**.

---

## 1. Vision en une phrase

Une application web qui remplace TypeForm + compilation manuelle + Keynote pour notre gala annuel des **Brunos** : on crée une édition, les joueurs et l'entourage votent à des questions _who's most likely to_, l'app compile les classements, équilibre qui boit, et anime la révélation des gagnants en plein écran le soir de l'événement.

---

## 2. Concepts de domaine (vocabulaire)

| Terme                          | Définition                                                                                                                                                                                                        |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Édition**                    | Une instance annuelle du gala (ex: « Les Brunos 2026 »). Possède une date, un lieu, un état, des joueurs et des questions.                                                                                        |
| **Joueur**                     | Un nominé présent à la soirée. Son vote a un poids officiel et il peut _gagner_ (donc boire). 6 joueurs typiquement, mais le nombre est variable.                                                                 |
| **Membre du jury / Entourage** | Famille ou proche. Vote pour le drame mais **ne fait jamais boire personne**. Doit préciser son lien avec un joueur.                                                                                              |
| **Question (catégorie)**       | Un énoncé _who's most likely to_ (ex: « Qui est le plus susceptible de se marier en premier »). Deux formats : **ranking** (classer tous les joueurs de 1 à N) ou **choix unique** (sélectionner un seul joueur). |
| **Vote**                       | L'ensemble des réponses d'une personne pour une édition.                                                                                                                                                          |
| **Classement de catégorie**    | Le résultat agrégé d'une question : qui finit 1er, 2e, etc. selon la méthode Borda (voir §6).                                                                                                                     |
| **Charge (gorgées)**           | Le nombre de gorgées/shooters attribué à chaque joueur selon sa position et la règle de l'édition (voir §7).                                                                                                      |

---

## 3. Rôles et authentification

- **Auth = Supabase Auth, email + mot de passe.** On laisse Supabase gérer signup, login, reset de mot de passe, vérification email. Pas de système maison.
- Trois rôles, stockés sur le profil utilisateur :
  - `admin` — toi. Accès total : CRUD éditions, joueurs, questions, lancement présentation.
  - `player` — un joueur nominé. Peut voter, voir les détails d'événement, voir l'archive et ses stats.
  - `jury` — entourage. Peut voter (classement séparé), voir les détails, voir l'archive.
- Un `player`/`jury` est rattaché à une édition. Un même humain peut être joueur sur plusieurs éditions (le suivi de stats inter-éditions en dépend, voir §10).
- L'entourage (`jury`) doit, à l'inscription ou au premier vote, **déclarer son lien** avec un joueur (champ texte libre + référence au joueur : ex. « Mère de Jérémy »).

> Note sécurité : protège tout via **Row Level Security (RLS)** Supabase. Un votant ne voit jamais les votes des autres avant la révélation. L'admin voit tout.

---

## 4. États d'une édition (state machine)

Une édition transite par ces états. Les transitions sont déclenchées par l'admin (sauf fermeture auto possible à la date limite).

```
CONSTRUCTION → SENT_FOR_VOTE → COMPILATION → LOCKED → LIVE → ARCHIVED
```

| État              | Ce qui se passe                                                                                                | Ce qui est permis                                                                                           |
| ----------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **CONSTRUCTION**  | L'admin bâtit l'édition.                                                                                       | Créer/éditer/réordonner/supprimer questions et joueurs librement.                                           |
| **SENT_FOR_VOTE** | Période de vote ouverte, date limite affichée.                                                                 | Les votants soumettent/modifient leur vote jusqu'à la deadline. **Questions verrouillées** (voir règle §5). |
| **COMPILATION**   | Votes fermés. L'app calcule les classements. L'admin _curate_ les questions du soir et lance l'égaliseur (§7). | Sélection du sous-ensemble de questions à présenter. Pas de modif de vote.                                  |
| **LOCKED**        | Tout est prêt, on attend le jour J.                                                                            | Lecture seule. Aperçu de la présentation possible.                                                          |
| **LIVE**          | Le soir même.                                                                                                  | L'admin lance le mode présentation plein écran.                                                             |
| **ARCHIVED**      | Terminé.                                                                                                       | Résultats + présentation accessibles en lecture seule à tous. Stats mises à jour.                           |

**Règle critique sur les questions :** tant que l'état est `CONSTRUCTION`, les questions sont déplaçables / éditables / supprimables. **Dès `SENT_FOR_VOTE`, toute modification d'une question est bloquée** sauf si l'admin accepte d'effacer toutes les réponses associées (confirmation explicite à deux étapes).

---

## 5. Vue Administrateur

### 5.1 Gestion des éditions

- Créer une édition : nom, année, date/heure, lieu (adresse + nom du lieu), description/indications d'événement.
- **Système de confirmation de présence (RSVP)** : chaque joueur/jury peut répondre oui/non/peut-être.
- **Ajout au calendrier** : génère un fichier `.ics` téléchargeable + liens Google Agenda / Apple. (Pas d'intégration API calendrier, juste le `.ics` — simple et universel.)
- Liste des éditions passées avec accès aux résultats.

### 5.2 Gestion des joueurs

- CRUD joueurs pour une édition : nom, **photo headshot (PNG)** uploadée vers **Supabase Storage**.
- Recadrage carré conseillé à l'upload (la présentation et les cartes supposent un ratio 1:1).

### 5.3 Gestion des questions

- CRUD questions : énoncé, format (`ranking` | `single_choice`).
- **Réordonnancement par drag-and-drop** (ex. `dnd-kit`). L'ordre est stocké (`position`).
- Verrouillage selon l'état (voir §4).
- **Sur-approvisionnement assumé** : tu crées souvent plus de questions (ex. 30) que ce qui sera présenté (ex. 20). Toutes sont envoyées au vote; le tri se fait en COMPILATION.

### 5.4 Règles de consommation (configurable par édition, surchargeable par question)

Deux barèmes au minimum, plus des idées en §8 :

- **Mode « Top unique »** (anciennes éditions) : la personne avec le plus de votes boit un shooter. Égalité possible → tous les ex æquo boivent.
- **Mode « Escalade par classement »** (éditions récentes, défaut) : 1re place = 1 gorgée, 2e = 2 gorgées, … dernière place = 1 shooter. Tout le monde boit.
- L'admin choisit le mode au niveau de l'édition, et peut **surcharger une question précise** (ex. une catégorie spéciale en mode Top unique dans une édition Escalade).

---

## 6. Agrégation des votes (le cœur mathématique)

### 6.1 Questions `ranking` — méthode Borda

Chaque votant classe les N joueurs de 1 (le plus) à N (le moins).

- On **additionne les positions** reçues par chaque joueur sur tous les votes _joueurs_.
- **Plus petit total = 1re place** de la catégorie (« unanimement #1 » = celui que tout le monde a mis 1er).
- Égalités départagées par : (a) nombre de fois classé 1er, puis (b) au hasard stable (seed sur l'id).

### 6.2 Questions `single_choice`

- On **compte les votes** reçus par joueur. Le plus de votes gagne. Pour le mode Escalade, on dérive un classement à partir du nombre de votes décroissant.

### 6.3 Deux classements séparés (joueurs vs entourage)

- **Classement officiel** = calculé uniquement sur les votes des `player`. C'est lui qui détermine qui boit et qui pilote l'égaliseur.
- **Classement entourage** = calculé uniquement sur les votes des `jury`, affiché **côte à côte** dans la présentation et l'archive, pour le contraste et le drame. Il n'a **aucun impact** sur les gorgées.

---

## 7. Égaliseur de questions (la feature qui équilibre qui boit)

**Problème :** parmi M questions disponibles (ex. 30), choisir un sous-ensemble de K questions (ex. 20) tel que la **distribution totale de gorgées entre les joueurs soit la plus égale possible**.

**Objectif retenu (ton choix) :** _minimiser l'écart total entre tous les joueurs_ — concrètement, minimiser l'écart-type (ou l'étendue max−min) des totaux de gorgées par joueur.

**Pourquoi pas du brute force :** C(30,20) ≈ 30 millions de combinaisons. Trop pour le faire systématiquement à chaque clic.

**Algorithme spécifié :**

1. Pré-calculer, pour **chaque** question, le vecteur de charge par joueur (combien de gorgées chaque joueur prend si cette question est présentée), à partir du classement officiel et de la règle applicable.
2. **Glouton initial** : partir de l'ensemble vide, ajouter une à une les questions qui réduisent le plus l'écart, jusqu'à atteindre K.
3. **Recuit simulé / hill-climbing** : faire des swaps (retirer une question du set, en ajouter une hors set) en acceptant les améliorations et parfois de petites dégradations, sur ~5000 itérations. Tourne en < 1 s côté serveur (Route Handler / Edge Function).
4. Retourner : la combinaison suggérée, le total de gorgées par joueur, et l'écart obtenu.

**UX :** en COMPILATION, l'admin fixe K (nombre de questions désirées), clique « Suggérer la combinaison équilibrée », voit le résultat et la répartition par joueur, puis **ajuste manuellement** (ajouter/retirer des questions) avec recalcul en direct de l'équilibre. Il valide la sélection finale, qui devient l'ordre de présentation.

---

## 8. Suggestions de règles / mécaniques (à toi de piger)

Au-delà de tes deux modes, des idées qui marchent bien en gala :

- **Mode « Podium inversé »** : seuls les 3 derniers boivent, charge croissante. Fait moins boire, utile si beaucoup de questions.
- **Catégorie « Double shooter »** : une question vedette où le gagnant boit double. À réserver à 1-2 catégories.
- **« Malus unanimité »** : si un joueur est classé 1er par _tout le monde_, gorgée bonus (le drame de l'unanimité).
- **« Sauvetage »** : un joueur peut désigner quelqu'un pour boire à sa place une fois par soirée (jeton unique). Pur chaos social.
- **Catégorie « Choix du jury »** : une question où seul l'entourage vote et où le résultat fait _quand même_ boire — la seule exception au principe, à activer explicitement.

Toutes optionnelles et hors MVP strict sauf tes deux modes de base.

---

## 9. Vue Votant (joueurs + entourage)

- Page d'accueil après login : **prochaine édition** mise en avant (date, lieu, compte à rebours, RSVP, bouton calendrier).
- **Bulletin de vote** : liste des questions dans l'ordre. Pour `ranking`, interface de classement drag-and-drop des joueurs (avec photos). Pour `single_choice`, sélection d'un joueur.
- Sauvegarde du vote (modifiable jusqu'à la deadline). Indicateur « vote complet / incomplet ».
- L'entourage voit son **étiquette de lien** et le fait que son vote est « consultatif ».
- Aucun votant ne voit les résultats ni les votes d'autrui avant l'archivage.

---

## 10. Archive & statistiques

- Liste des éditions passées, chacune ouvrant : résultats par catégorie (les deux classements côte à côte), le « gagnant » du shooter (= le perdant, haha), et la présentation rejouable.
- **Stats globales et fun corrélations :**
  - Qui a le plus bu (cumul gorgées + shooters, **suivi inter-éditions** par humain).
  - Palmarès des catégories les plus « gagnées » par joueur.
  - **Révélations de votes** : qui a voté pour qui. Triggers de drame, ex. _« X et Y se sont mutuellement classés derniers »_ → carte spéciale dans la présentation.
- **Page joueur** : profil avec total de consommations à vie, historique par édition, ses « titres » remportés. Nécessite donc une **identité de joueur persistante entre éditions** (table `people` reliant les participations).

---

## 11. Vue Présentation (mode soirée, admin seulement)

- Plein écran, style **Keynote/Oscars**. Une catégorie à la fois.
- Déroulé par **clics** (flèches clavier + télécommande tactile) : annonce de la catégorie → suspense → **révélation du gagnant** avec animation → affichage du classement complet et de la charge (qui boit combien) → carte « drame » si un trigger s'applique → catégorie suivante.
- Affiche les deux classements (joueurs / entourage) pour le contraste.
- À la fin : écran récap (qui a le plus bu ce soir), puis l'admin peut **« Envoyer à l'archive »** → passe l'édition en `ARCHIVED` et rend la présentation publique.

---

## 12. États vides (empty states)

- **Aucune édition future** → écran soigné : _« On se voit l'année prochaine. »_ avec un visuel doré sobre et un lien vers l'archive.
- Édition sans questions, bulletin déjà soumis, archive vide, etc. → chacun son message clair.

---

## 13. Direction artistique (UI)

**Concept : gala des Oscars, glamour, luxe.** Noir profond + or, fonds abstraits animés lentement (dégradés/mesh dorés qui dérivent, grain léger, particules discrètes). Animations **lentes et amples** qui respirent le prestige — pas de micro-interactions nerveuses.

- **Couleurs (CSS variables) :** noirs étagés (`#0a0a0b`, `#121214`), ors (`#d4af37`, `#f0d77b`, accents champagne `#e8c87e`), texte ivoire cassé. Dominante sombre, accents or tranchants.
- **Typographie :** un display à fort caractère (ex. _Cormorant Garamond_, _Playfair Display_ ou une serif haute couture) pour les titres, paire avec un sans-serif raffiné pour le corps. **Éviter Inter/Roboto/Arial/system.**
- **« Liquid Glass » à la Apple :** cartes et boutons en **glassmorphism** poussé au max du web — `backdrop-filter: blur()` + saturation, bordures lumineuses 1px en dégradé doré, reflets spéculaires, ombres profondes, légère réfraction au survol. Boutons glossy.
- **Motion :** un _page load_ orchestré avec révélations échelonnées (staggered, `animation-delay`) vaut mieux que dix effets dispersés. Le moment fort = la **révélation du gagnant** dans la présentation (montée dramatique, glow doré, scale lent).
- Respecter `prefers-reduced-motion`.

> Donne ce projet au skill **frontend-design** de Claude Code pour l'exécution visuelle : direction « luxury/refined art-deco », thème sombre, exécutée avec précision (l'élégance vient de la retenue et du détail, pas de la surcharge).

---

## 14. Modèle de données (proposition Supabase / Postgres)

> Schéma de départ. Claude Code peut l'affiner, mais il couvre tout le MVP.

```
people                      -- identité persistante d'un humain entre éditions
  id (uuid, pk)
  display_name
  auth_user_id (fk -> auth.users, nullable pour purs nominés sans compte)

profiles                    -- 1:1 avec auth.users, rôle global
  user_id (uuid, pk, fk -> auth.users)
  role (enum: admin|player|jury)
  person_id (fk -> people)

editions
  id (uuid, pk)
  name, year (int)
  event_at (timestamptz), venue_name, venue_address
  description
  state (enum: CONSTRUCTION|SENT_FOR_VOTE|COMPILATION|LOCKED|LIVE|ARCHIVED)
  vote_deadline (timestamptz, nullable)
  drink_rule (enum: TOP_UNIQUE|ESCALATION, défaut ESCALATION)
  created_at

players                     -- participation d'une personne à une édition (= choix de réponse)
  id (uuid, pk)
  edition_id (fk)
  person_id (fk -> people)
  headshot_url (Supabase Storage)
  display_order (int)

participants                -- qui peut voter à cette édition et comment
  id (uuid, pk)
  edition_id (fk)
  user_id (fk -> auth.users)
  kind (enum: player|jury)
  linked_player_id (fk -> players, requis si kind=jury)
  relation_label (text, requis si kind=jury)  -- ex "Mère de Jérémy"
  rsvp (enum: yes|no|maybe|null)

questions
  id (uuid, pk)
  edition_id (fk)
  prompt (text)
  format (enum: ranking|single_choice)
  position (int)            -- ordre, pour drag-and-drop
  drink_rule_override (enum nullable) -- surcharge la règle de l'édition
  is_selected_for_show (bool, défaut false) -- choisi par l'égaliseur/curation
  show_order (int, nullable)              -- ordre de présentation final

votes                       -- un bulletin par (participant, édition)
  id (uuid, pk)
  edition_id (fk)
  participant_id (fk)
  submitted_at (timestamptz, nullable)

vote_answers                -- une ligne par (vote, question, joueur classé)
  id (uuid, pk)
  vote_id (fk)
  question_id (fk)
  player_id (fk)
  rank (int)                -- pour ranking: 1..N ; pour single_choice: 1 = choisi
  UNIQUE(vote_id, question_id, player_id)

results                     -- snapshot calculé à la compilation (cache)
  id (uuid, pk)
  question_id (fk)
  player_id (fk)
  borda_score (int, nullable)
  vote_count (int, nullable)
  final_rank (int)          -- position dans la catégorie
  drinks (numeric)          -- gorgées attribuées (shooter = valeur convenue, ex 4)
  audience (enum: players|jury)  -- pour les deux classements séparés
```

**Storage :** un bucket `headshots` (public en lecture, écriture admin).
**RLS :** votants ne lisent que leurs propres `votes`/`vote_answers` tant que l'édition n'est pas `ARCHIVED`; admin lit/écrit tout; `results` lisibles par tous une fois `ARCHIVED` (et par l'admin avant).

---

## 15. Découpage technique suggéré

- **Next.js App Router**, Server Components + Route Handlers pour la logique (agrégation Borda, égaliseur). Le calcul lourd reste serveur.
- **Supabase JS client** côté serveur (service role pour l'admin, anon + RLS côté votant).
- **Auth** : middleware Next.js qui redirige selon le rôle.
- **Drag-and-drop** : `dnd-kit` (questions admin + bulletin de ranking).
- **`.ics`** : génération à la volée (lib `ics` ou template manuel).
- **Présentation** : route dédiée plein écran, navigation clavier, animations via CSS + `Motion` (framer-motion) pour les révélations.
- **Déploiement Vercel**, variables d'env Supabase (URL, anon key, service role en server-only).

---

## 16. Périmètre MVP (ce qui doit marcher au lancement)

- [ ] Auth email/mot de passe + rôles (admin/player/jury) avec RLS.
- [ ] Admin : CRUD éditions (détails, RSVP, `.ics`), CRUD joueurs (+ headshot PNG), CRUD questions (drag-and-drop, formats ranking/single_choice).
- [ ] State machine complète des éditions avec les verrous de modification.
- [ ] Bulletin de vote votant (ranking drag-and-drop + choix unique), sauvegarde, deadline.
- [ ] Agrégation Borda + comptage choix unique, **deux classements séparés** (joueurs/entourage).
- [ ] Égaliseur de questions (glouton + recuit) avec ajustement manuel et recalcul live.
- [ ] Modes de consommation Top unique / Escalade, surcharge par question.
- [ ] Mode présentation plein écran avec révélations au clic + cartes drame.
- [ ] Archive : résultats par édition, page joueur, stats inter-éditions (qui a le plus bu), révélations de votes.
- [ ] Empty states (dont « On se voit l'année prochaine »).
- [ ] Direction artistique Oscars / or-sur-noir / glassmorphism.

---
