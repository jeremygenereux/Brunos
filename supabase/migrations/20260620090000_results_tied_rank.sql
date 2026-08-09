-- =====================================================================
-- Les Brunos — le rang de COMPÉTITION entre dans les résultats gelés.
--
-- SYMPTÔME
--   « Qui a le moins de chances de survivre une journée sans téléphone ? » :
--   deux personnes remportaient la catégorie, l'archive les montrait toutes
--   les deux, et la scène n'affichait qu'un seul verre. Une seule buvait.
--   Symétriquement, deux personnes à égalité en fin de classement buvaient
--   des quantités différentes.
--
-- CAUSE
--   Les gorgées se calculaient sur `final_rank`, qui est distinct par
--   construction : entre deux scores identiques, c'est le hachage de
--   l'identifiant qui tranchait. Un départage arbitraire — voulu pour
--   ordonner un affichage — décidait donc qui calait.
--
-- LE CORRECTIF PORTE SUR DEUX RANGS
--   `final_rank` reste distinct : il ordonne la liste, sans jamais deux fois
--   le même numéro. `tied_rank` est le rang de compétition (1, 2, 2, 4) : les
--   ex æquo le partagent, et c'est LUI qui décide des gorgées.
--
-- POURQUOI LE STOCKER PLUTÔT QUE LE DÉDUIRE
--   Deux joueurs sont ex æquo quand leur score Borda ET leur nombre de
--   premières places sont égaux. Le second n'est pas dans `results` : le
--   déduire du seul Borda déclarerait ex æquo des joueurs que le calcul avait
--   séparés, et la scène afficherait un verre de plus que l'ardoise gelée.
--   C'est exactement la classe de bug qu'on ferme ici.
-- =====================================================================

alter table public.results
  add column if not exists tied_rank int;

comment on column public.results.tied_rank is
  'Rang de compétition, PARTAGÉ par les ex æquo (1, 2, 2, 4). Décide des '
  'gorgées. final_rank reste distinct et ne sert qu''à ordonner l''affichage.';

-- Reprise des lignes déjà gelées. Au mieux : sans le nombre de premières
-- places, on regroupe sur le seul score disponible. Les éditions recompilées
-- ensuite recevront la valeur exacte, calculée depuis les bulletins.
with classe as (
  select r.id,
         dense_rank() over (
           partition by r.question_id, r.audience
           order by
             case when r.borda_score is not null then r.borda_score end asc,
             case when r.borda_score is null then r.vote_count end desc
         ) as rang
  from public.results r
)
update public.results r
set tied_rank = c.rang
from classe c
where c.id = r.id
  and r.tied_rank is null;
