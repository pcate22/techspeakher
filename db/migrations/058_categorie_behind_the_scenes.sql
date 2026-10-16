-- Migration 058 — la catégorie « Interview » devient « Behind the Scenes ».
--
-- Backfill de DONNÉES (pas de schéma). « Behind the Scenes » est notre marque
-- pour les interviews : c'est ce libellé qui doit s'afficher sur la chip du type
-- de contenu (cartes de la home, liste /actualites, page d'article). Le code
-- n'accepte plus que le nouveau vocabulaire (src/lib/contenu-form.ts CATEGORIES),
-- donc les lignes historiques sont renommées ici.
--
-- Rejouable : les deux UPDATE sont gardés par la valeur qu'ils remplacent, donc
-- au 2ᵉ passage aucune ligne ne correspond (pas d'écriture, « maj_le » ne churne
-- pas à chaque déploiement). Aucune donnée personnelle.
-- Appliquée au déploiement via db/sync-to-latest.sql.

UPDATE contenus
   SET categorie = 'Behind the Scenes', maj_le = now()
 WHERE categorie = 'Interview';

-- L'interview de Rachel Dubois se lit désormais sur SA page d'article (elle a un
-- corps, cf. migration 047) : le chapô n'a plus à renvoyer le lecteur sur
-- LinkedIn, qui reste proposé en bas de l'article. Gardé sur le texte EXACT issu
-- du seed (espaces insécables comprises) : un chapô réécrit par une orga n'est
-- jamais écrasé.
UPDATE contenus
   SET chapo = $chapo$« On t'a prise parce que t'étais la seule fille. » Notre première interview Behind the Scenes.$chapo$,
       maj_le = now()
 WHERE slug = 'interview-de-rachel-dubois'
   AND chapo = $ancien$« On t'a prise parce que t'étais la seule fille. » Première interview Behind the Scenes, sur LinkedIn.$ancien$;
