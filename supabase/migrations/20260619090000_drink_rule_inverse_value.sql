-- =====================================================================
-- Les Brunos — la troisième règle de consommation.
--
-- POURQUOI UN FICHIER À PART. Postgres refuse d'UTILISER une valeur d'enum
-- dans la transaction qui vient de l'ajouter (« unsafe use of new value »).
-- Chaque fichier de migration étant sa propre transaction, la valeur naît
-- ici et la migration suivante s'en sert librement.
--
-- ESCALATION_INVERSE — « Gagnant boit ». Miroir exact d'ESCALATION : le
-- PREMIER du classement cale le shooter, puis les gorgées décroissent vers le
-- bas. Tout le monde boit, et c'est la tête du classement qui paie le plus.
-- =====================================================================

alter type public.drink_rule add value if not exists 'ESCALATION_INVERSE';
