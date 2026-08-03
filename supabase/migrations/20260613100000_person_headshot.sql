-- =====================================================================
-- Les Brunos — Photo au niveau de la PERSONNE.
--
-- Jusqu'ici la photo vivait uniquement sur `players.headshot_url`, donc par
-- ÉDITION : ajouter quelqu'un à une nouvelle année repartait sans portrait, et
-- les vues à vie (palmarès, fiche joueur) devaient bricoler « la photo de
-- l'édition archivée la plus récente ».
--
-- `people.headshot_url` devient le portrait de référence, qui suit la personne
-- d'une année à l'autre. `players.headshot_url` reste et garde la priorité :
-- il sert de dérogation ponctuelle (la photo d'une année en particulier).
--
-- Écriture réservée aux admins : la policy people_update_admin existante
-- couvre déjà cette colonne.
-- =====================================================================

alter table public.people
  add column if not exists headshot_url text;

comment on column public.people.headshot_url is
  'Portrait de référence, persistant entre les éditions. players.headshot_url le remplace quand il est renseigné.';
