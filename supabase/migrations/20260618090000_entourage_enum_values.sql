-- =====================================================================
-- Les Brunos — les deux valeurs d'énumération du vote des proches.
--
-- POURQUOI UN FICHIER À PART. Postgres refuse d'UTILISER une valeur d'enum
-- dans la transaction qui vient de l'ajouter (« unsafe use of new value »).
-- Or chaque fichier de migration est sa propre transaction. Les valeurs sont
-- donc créées ici, et la migration suivante peut s'en servir librement.
--
-- entourage : la question n'est posée qu'aux proches, et la réponse
--   n'est pas un rang mais une note de 1 à 10 attribuée à SON joueur.
--
-- ESCALATION_INVERSE : miroir d'ESCALATION. Le premier du classement cale le
--   shooter et les gorgées décroissent vers le bas, au lieu de croître. C'est
--   la règle des questions entourage : la note la plus haute paie le plus.
-- =====================================================================

alter type public.question_format add value if not exists 'entourage';
alter type public.drink_rule      add value if not exists 'ESCALATION_INVERSE';
