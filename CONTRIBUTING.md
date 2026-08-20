# Contribuer

Merci de donner un coup de main. Le dépôt sert une application **en production**
qui tourne une fois par année devant du monde : la règle du jeu est simple, on
ne casse pas le gala.

## Le flux, en cinq lignes

1. Partez de `develop` : `git switch develop && git pull`
2. Créez une branche `feature/ce-que-vous-faites`
3. Avant de pousser : `pnpm lint && pnpm typecheck && pnpm test`
4. Ouvrez une **PR vers `develop`**
5. Jérémy relit, fusionne, et s'occupe du passage vers `main`

## Ne poussez jamais sur `main`

`main` **est** la production. Une fusion sur `main` déclenche immédiatement deux
choses, sans confirmation :

- **Vercel redéploie** [brunos.live](https://brunos.live)
- **Supabase applique les migrations** sur la vraie base, avec les vrais votes

C'est pour ça que `main` n'est pas une branche de travail. Poussez sur
`develop`, jamais directement sur `main`.

## Les migrations, c'est différent

Tout fichier ajouté dans `supabase/migrations/` **modifie la base de production
au moment de la fusion sur `main`**. Il n'y a pas de retour en arrière
automatique, et il n'y a qu'un seul projet Supabase.

Signalez-le explicitement dans la description de votre PR. Ces fichiers exigent
la revue de Jérémy (voir [`CODEOWNERS`](.github/CODEOWNERS)) — ce n'est pas une
formalité.

Pour créer une migration : modifiez le schéma dans Studio en local, puis
`pnpm db:diff nom_de_la_migration`, puis `pnpm db:reset` pour vérifier qu'elle
se rejoue proprement depuis zéro.

## Environnement local

Vous n'avez **pas** besoin d'accès à la base de production, et vous ne
l'obtiendrez pas. Tout se développe sur un Supabase local :

```bash
pnpm install
cp .env.example .env.local     # les clés locales s'affichent au démarrage
pnpm dev:local                 # Supabase + Studio + Mailpit + le serveur
```

Le seed crée quatre éditions de démonstration et des comptes de test. Les
identifiants sont dans l'en-tête de [`supabase/seed.sql`](supabase/seed.sql).
Les personnes, les photos et les votes de ce jeu de données sont **fictifs**.

## Conventions

- **Commits** : [Conventional Commits](https://www.conventionalcommits.org)
  (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`), en anglais, courts.
- **Code et commentaires** : en français, comme le reste du dépôt. Un
  commentaire explique _pourquoi_, pas _quoi_.
- **Logique de calcul** : tout ce qui touche à `src/lib/scoring/` ou
  `src/lib/editions/` doit rester pur et testé. Ces valeurs sont gelées dans
  l'archive à vie — une erreur passe inaperçue le soir même et se voit deux ans
  plus tard dans le palmarès.

## Licence

Le dépôt est public à titre de portfolio mais **n'est pas open source** (voir
[`LICENSE`](LICENSE)). En proposant une contribution, vous acceptez qu'elle soit
intégrée sous cette licence.
