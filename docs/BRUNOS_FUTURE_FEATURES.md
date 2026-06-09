# Les Brunos — Fonctionnalités futures (hors MVP)

> Idées à ajouter après le MVP, regroupées par thème. Chacune est indépendante : tu piges selon l'envie et le temps. J'ai noté la complexité approximative (🟢 facile · 🟡 moyen · 🔴 gros morceau).

---

## A. Vote et interaction en direct le soir même

- **🟡 Vote live au téléphone pendant la soirée.** Une ou deux catégories « bonus » votées sur place via le cellulaire (QR code projeté → page de vote → résultats en temps réel via Supabase Realtime). Parfait pour une catégorie improvisée née pendant la soirée.
- **🟡 Mur de réactions en direct.** Pendant la révélation, les invités envoient des emojis/réactions depuis leur tel qui flottent sur l'écran de présentation (Supabase Realtime + animation). Ambiance « live show ».
- **🟢 Buzzer / tambour de suspense déclenché par l'admin** depuis son téléphone servant de télécommande (au lieu du clavier), avec sons de gala.
- **🔴 Prédictions live.** Avant chaque révélation, les invités parient sur le gagnant; un mini-classement de « qui devine le mieux les résultats » émerge en fin de soirée. Méta-jeu social.

---

## B. Présentation et mise en scène

- **🟡 Bandes-annonces / nominations animées** façon Oscars : avant le résultat, montage des « nominés » (photos des joueurs avec transitions cinématiques).
- **🟢 Trame sonore.** Musique d'intro, roulements de tambour, fanfare à la révélation, applaudissements. Contrôlé par l'admin.
- **🟡 Thèmes visuels par édition.** Garder le squelette or/noir mais permettre une variante par année (ex. 2027 = argent/bleu nuit) choisie par l'admin.
- **🟡 Transitions « enveloppe ».** Le gagnant scellé dans une enveloppe dorée qu'on ouvre au clic — pur Oscars.
- **🔴 Mode multi-écrans.** Présentation sur le grand écran + vue « régie » privée sur le téléphone de l'admin (prochaine catégorie, notes, trigger de drame à venir).

---

## C. Statistiques et données (la mine d'or à long terme)

- **🟡 Profil joueur enrichi (« carrière »).** Trophées à vie, catégories signature, évolution du « total bu » par année (graphique), rivalités récurrentes.
- **🟡 Détecteurs de drama automatiques.** Au-delà du « classés mutuellement derniers » : alliances (deux personnes qui votent toujours pareil), revirements (X adorait Y l'an dernier, le déteste cette année), l'« ennemi juré » de chacun.
- **🟡 Heatmap de votes.** Matrice qui-a-voté-comment-pour-qui, anonymisable ou pas selon le niveau de chaos désiré.
- **🟢 Records et superlatifs all-time.** « Plus gros buveur de l'histoire des Brunos », « catégorie la plus contestée », « la plus unanime ».
- **🔴 Rapport de fin de soirée généré par IA.** Un résumé narratif et drôle de l'édition (utilisant l'API Anthropic) : faits saillants, drames, palmarès, ton de chroniqueur mondain. Envoyé à tous le lendemain.

---

## D. Social, engagement et hors-soirée

- **🟢 Galerie photo de l'édition.** Les invités uploadent leurs photos de la soirée, attachées à l'édition dans l'archive.
- **🟡 Proposition de questions par les joueurs.** En amont, chacun soumet des idées de catégories; l'admin pige dans le pool. Tu gardes le contrôle final mais la créativité est collective.
- **🟡 Notifications / rappels.** Email automatique « le vote est ouvert », « plus que 3 jours pour voter », « RSVP toujours en attente ».
- **🟢 Teasing pré-soirée.** Compte à rebours stylé + « X% des votes sont rentrés » sans révéler le contenu.
- **🔴 Compagnon mobile (PWA).** Installer l'app sur l'écran d'accueil, notifications push, mode hors-ligne pour la consultation d'archive.

---

## E. Mécaniques de jeu avancées

- **🟢 Jetons « sauvetage » / « sabotage ».** Chaque joueur a un pouvoir à usage unique pendant la soirée (faire boire quelqu'un d'autre à sa place, doubler la mise sur une catégorie).
- **🟡 Catégories à formats variés.** Au-delà de ranking/choix unique : questions vrai/faux sur les joueurs, « associe la citation au joueur », sondages chiffrés (« combien de fois X a fait Y »).
- **🟡 Pondération des catégories.** Certaines catégories « prestige » valent plus au classement all-time des trophées.
- **🔴 Saison / méta-classement annuel.** Si jamais ça déborde sur plusieurs événements par an, un classement cumulatif type championnat.

---

## F. Administration et qualité de vie

- **🟢 Duplication d'édition.** Cloner l'an dernier (joueurs + questions favorites) pour démarrer la nouvelle édition en un clic.
- **🟢 Banque de questions réutilisables.** Une bibliothèque all-time de tes meilleures catégories, taguées, piochables dans n'importe quelle édition.
- **🟡 Export.** PDF des résultats, export des stats, sauvegarde de la présentation en vidéo/PDF.
- **🟡 Multi-admin / co-organisateurs.** Déléguer la création de questions à un comité.
- **🟢 Simulateur de gorgées.** Avant de figer la sélection, prévisualiser « si je garde ces 20 questions, voici qui boit combien » — extension naturelle de l'égaliseur du MVP.

---

## Suggestion d'ordre d'attaque post-MVP

1. **Duplication d'édition + banque de questions** (F) — réduit ton effort chaque année, gain immédiat.
2. **Trame sonore + transitions enveloppe** (B) — gros impact sur le _feel_ de la soirée, faible coût.
3. **Vote live au téléphone** (A) — la fonctionnalité « wow » que tu as nommée, une fois le socle solide.
4. **Détecteurs de drama + profil carrière** (C) — la valeur s'accumule avec les années de données.
5. **Rapport IA de fin de soirée** (C) — cerise sur le gâteau quand tout le reste roule.
