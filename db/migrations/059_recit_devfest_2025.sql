-- 059 — Récit « DevFest Toulouse 2025 : ça a marché ! » (migration de DONNÉES).
--
-- Ce texte vivait EN DUR dans le JSX de /devfest-toulouse. Conséquences : la page
-- du Tremplin 2025, qui raconte pourtant cette année-là, ne pouvait pas s'en
-- servir (elle se réduisait à trois compteurs et une séance isolée), et le
-- corriger demandait un déploiement.
--
-- Il devient ce qu'il aurait dû être depuis la migration 040 : un CONTENU
-- rattaché à la conférence répertoriée (conference_edition_id). Les deux pages
-- s'y branchent, et l'orga l'édite dans /admin/contenus.
--
-- ON CONFLICT (slug) DO NOTHING, comme la 045 : rejouable au déploiement, et
-- surtout il ne réécrit JAMAIS une version éditée ensuite dans l'admin — c'est
-- toute la raison d'être du changement.
--
-- INSERT ... SELECT : no-op si l'édition de conférence 2025 est absente (base
-- vierge, tests). au_flux = FALSE : rien à reposter, l'événement date de 2025.
-- Texte de Cateline Puccetti, repris de la page, plus ce qu'elle a ajouté le
-- 2026-08-02 : elle était PRIMO-SPEAKEUSE cette année-là. Sans parcours de
-- préparation, 2025 a quand même été un tremplin — celui qui l'a lancée. C'est
-- devenu le chapô, donc l'accroche que montrent les deux pages : elle répond à
-- « pourquoi une édition du Tremplin sans parcours ? ».
--
-- Deux retouches de forme, aucune reformulation : « cette année » a sauté (daté
-- à tort une fois l'article publié) et les trois liens ont pris la forme d'une
-- liste Markdown.
--
-- `categorie` DOIT appartenir à `CATEGORIES` (src/lib/contenu-form.ts) : le
-- `<select>` de l'éditeur se construit dessus, et une valeur hors liste n'y a
-- pas d'option — la première sauvegarde l'effacerait, sur l'article même que
-- cette migration existe pour rendre éditable. « Communauté » y est.

-- Trace des SEEDS de contenu déjà posés une fois.
--
-- `sync-to-latest.sql` est rejoué à CHAQUE déploiement. Un seed gardé par le
-- seul `ON CONFLICT (slug) DO NOTHING` ne tient que tant qu'une ligne porte ce
-- slug : supprimer l'article dans l'admin le fait revenir au déploiement
-- suivant (une demande de retrait de nom serait annulée toute seule), et le
-- RENOMMER libère le slug — le seed réinsère alors un doublon qui, à date de
-- publication égale, gagne l'affichage public (`ORDER BY … id DESC`).
--
-- Un seed se pose UNE fois. Cette table dit lesquels sont passés.
CREATE TABLE IF NOT EXISTS seeds_appliques (
  cle         TEXT PRIMARY KEY,
  applique_le TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO contenus
  (type, slug, titre, chapo, corps, categorie, tag, statut, publie_le, au_flux,
   conference_edition_id)
SELECT
  'publication',
  'devfest-toulouse-2025-ca-a-marche',
  $t$DevFest Toulouse 2025 : ça a marché !$t$,
  $chapo$2025 était déjà un tremplin : c'est là que Cateline a fait son premier talk en conférence.$chapo$,
  $corps$En 2025, le DevFest Toulouse nous a ouvert les portes de sa salle des communautés. Sandrine Berger y a présenté Tech Speak'Her et Cateline Puccetti a fait un talk de 35 minutes, salle pleine, lors d'une journée qui a rassemblé 1 200 personnes au Diagora à Labège.

La salle des communautés, elle, fait une cinquantaine de places. Elle était pleine à craquer : certaines personnes ont écouté debout, d'autres depuis l'extérieur.

La session de questions-réponses qui a suivi a été riche, autant sur la communauté que sur le talk.

Elle était primo-speakeuse. Ça lui a permis de se lancer, de monter sur une scène et d'oser faire son premier talk en conférence.

Résultat : ça a tellement cartonné que c'est le DevFest qui nous a proposé de renouveler l'expérience en 2026.

C'est pour aller encore plus loin qu'on a lancé le Tremplin.

## Pour aller voir

Aucun replay : la salle des communautés n'était pas filmée en 2025.

- [Tech Speak'Her sur devfesttoulouse.fr](https://devfesttoulouse.fr/conferenciers/tech-speakher/)
- [Les retours sur Openfeedback](https://openfeedback.io/devfest-toulouse-2025/2025-11-13/1057177)
- [Les speakeuses de la communauté](/speakeuses)$corps$,
  'Communauté',
  'Passé',
  'publie',
  DATE '2025-11-13',
  FALSE,
  ce.id
FROM conference_editions ce
  JOIN conferences c ON c.id = ce.conference_id
WHERE c.slug = 'devfest-toulouse' AND ce.annee = 2025
  AND NOT EXISTS (SELECT 1 FROM seeds_appliques WHERE cle = '059_recit_devfest_2025')
ORDER BY ce.id
LIMIT 1
ON CONFLICT (slug) DO NOTHING;

-- Posé : on ne le reposera plus, quoi qu'il advienne de l'article ensuite.
-- La trace n'est écrite que si l'édition de conférence EXISTE — sinon le seed
-- n'avait rien à insérer, et une base qui la gagne plus tard doit encore
-- pouvoir le recevoir.
INSERT INTO seeds_appliques (cle)
SELECT '059_recit_devfest_2025'
  FROM conference_editions ce
  JOIN conferences c ON c.id = ce.conference_id
 WHERE c.slug = 'devfest-toulouse' AND ce.annee = 2025
 LIMIT 1
ON CONFLICT (cle) DO NOTHING;
