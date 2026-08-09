-- =====================================================================
-- Les Brunos — la règle de consommation appartient au FORMAT de la question.
--
-- CE QUI S'EST PASSÉ (Gala Firme-École 25-26, 7 août 2026)
--   Quatorze questions écrites en CLASSEMENT avec « Gagnant boit ». À l'écran,
--   elles se sont comportées comme des choix uniques : le premier calait, et
--   TOUT LE MONDE D'AUTRE avait zéro gorgée. Plus personne à faire boire, donc
--   plus de cascade à dérouler — la présentation n'affichait que le visage du
--   gagnant. La soirée est tombée à plat.
--
-- LA CAUSE
--   `TOP_UNIQUE` voulait dire « le premier cale, SEUL ». C'est le bon sens pour
--   un CHOIX UNIQUE, où les places 2 à N ne sont qu'un décompte de voix et ne
--   forment aucun classement. Appliqué à un CLASSEMENT, ça jette l'ordre que
--   les votants ont pris la peine d'établir.
--
-- LE MODÈLE, désormais explicite
--   choix unique   → la ou les personnes les plus votées calent. Rien à régler,
--                    aucune autre règle n'a de sens.
--   classement     → tout le monde boit selon son rang, et le shooter tombe à
--                    l'une des deux extrémités :
--                      • Perdant boit (ESCALATION)         → au DERNIER
--                      • Gagnant boit (ESCALATION_INVERSE) → au PREMIER
--                    Les deux punissent la même personne ; seul l'énoncé change
--                    de sens (« le pire cuisinier » contre « le meilleur »).
--
--   `editions.drink_rule` n'est plus qu'une valeur de pré-remplissage pour les
--   nouvelles catégories. Une édition ne se définit pas par une règle : elle
--   mélange les trois formats et les deux sens.
-- =====================================================================


-- ---------------------------------------------------------------------
-- (1) La règle devient une conséquence du format, imposée en base.
--     En base et non seulement à l'écran : le seed, un import ou un client
--     bricolé passeraient sinon à côté, et l'erreur ne se verrait qu'au
--     moment du dépouillement — trop tard.
-- ---------------------------------------------------------------------
create or replace function public.tg_questions_force_rule()
returns trigger
language plpgsql
as $$
begin
  if new.format = 'single_choice'::public.question_format then
    -- Une désignation n'a qu'une conséquence possible.
    new.drink_rule_override := 'TOP_UNIQUE'::public.drink_rule;

  elsif new.format = 'ranking'::public.question_format then
    -- Un classement ne peut pas être en « le premier cale, seul » : ce serait
    -- effacer l'ordre voté. TOP_UNIQUE y signifiait « Gagnant boit », on le
    -- traduit dans la règle qui porte réellement ce sens.
    if new.drink_rule_override = 'TOP_UNIQUE'::public.drink_rule then
      new.drink_rule_override := 'ESCALATION_INVERSE'::public.drink_rule;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists questions_force_rule on public.questions;
create trigger questions_force_rule
  before insert or update of format, drink_rule_override on public.questions
  for each row execute function public.tg_questions_force_rule();


-- ---------------------------------------------------------------------
-- (2) Reprise de l'existant.
--
--     `questions_edit_lock` SURVEILLE `drink_rule_override` : il compte cette
--     colonne parmi celles qu'on ne touche pas hors CONSTRUCTION. Sans
--     l'interrupteur ci-dessous, ces UPDATE lèvent une exception dès qu'une
--     édition dépassée est concernée — et toute la migration est annulée.
--     C'est exactement ce qui est arrivé au premier essai en production :
--     l'édition fautive était ARCHIVÉE.
--
--     On utilise donc la dérogation prévue par le schéma, transaction-locale
--     (`true`), qui ne fait qu'AUTORISER l'écriture : aucun déclencheur
--     n'efface de réponses, seuls `questions_edit_lock` et `set_updated_at`
--     existent sur cette table.
--
--     Les `results` déjà gelés ne bougent PAS. On répare l'intention, pas le
--     verdict : recalculer une soirée passée est une décision
--     d'administration, jamais un effet de bord de migration.
-- ---------------------------------------------------------------------
select set_config('app.allow_question_edit', 'on', true);

update public.questions
set drink_rule_override = 'ESCALATION_INVERSE'::public.drink_rule
where format = 'ranking'::public.question_format
  and drink_rule_override = 'TOP_UNIQUE'::public.drink_rule;

update public.questions
set drink_rule_override = 'TOP_UNIQUE'::public.drink_rule
where format = 'single_choice'::public.question_format
  and drink_rule_override is distinct from 'TOP_UNIQUE'::public.drink_rule;

-- Un classement qui héritait d'une édition en « gagnant boit » aurait le même
-- défaut sans porter de surcharge : on fige son intention noir sur blanc.
update public.questions q
set drink_rule_override = 'ESCALATION_INVERSE'::public.drink_rule
from public.editions e
where e.id = q.edition_id
  and q.format = 'ranking'::public.question_format
  and q.drink_rule_override is null
  and e.drink_rule = 'TOP_UNIQUE'::public.drink_rule;


-- ---------------------------------------------------------------------
-- (3) Le garde-fou du dépouillement : `submit_ballot` refusait déjà les
--     formats étrangers ; on documente ici que la règle n'est plus une
--     donnée d'édition mais de question. Rien à changer côté RPC.
-- ---------------------------------------------------------------------
comment on column public.editions.drink_rule is
  'Valeur de PRÉ-REMPLISSAGE des nouvelles catégories. Ne décide de rien : '
  'chaque question porte sa propre règle dans drink_rule_override.';

comment on column public.questions.drink_rule_override is
  'Règle effective de la question. single_choice → toujours TOP_UNIQUE. '
  'ranking → ESCALATION (le dernier cale) ou ESCALATION_INVERSE (le premier cale).';
