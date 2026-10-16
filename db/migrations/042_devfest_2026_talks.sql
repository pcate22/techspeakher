-- 042 — Line-up DevFest Toulouse 2026 : rattachement des talks à l'édition.
--
-- Backfill de DONNÉES (pas de schéma : edition_id existe depuis la 027). Relie
-- les talks déjà en base à l'édition « DevFest Toulouse 2026 » du répertoire pour
-- que /devfest-toulouse et l'article rattaché listent automatiquement les
-- speakeuses publiées (via speaker_talks.edition_id).
--
-- Ponctuel ET idempotent : chaque écriture est GARDÉE pour ne jamais réécrire un
-- choix orga ultérieur. Toutes les étapes qui posent edition_id le font par
-- JOIN sur l'édition : si l'édition n'existe pas encore, 0 ligne touchée (jamais
-- de passage à NULL, jamais de promotion « à vide »), et l'état se rattrape au
-- déploiement suivant une fois l'édition présente. Aucune donnée personnelle
-- (e-mail) : résolution par nom d'affichage et attributs de talk. No-op sur une
-- base vierge (tests). Appliqué au déploiement via db/sync-to-latest.sql (bloc
-- identique, en fin de fichier).

-- 1) Garantir l'édition « DevFest Toulouse 2026 » (aucune réécriture si présente).
--    Index UNIQUE partiel conf_editions_conf_annee (conference_id, annee) → ON CONFLICT.
INSERT INTO conference_editions (conference_id, type, annee, date_debut, ville, pays, url)
SELECT c.id, 'edition', 2026, DATE '2026-11-19', 'Toulouse', 'France', 'https://devfesttoulouse.fr'
  FROM conferences c
 WHERE c.slug = 'devfest-toulouse'
ON CONFLICT (conference_id, annee) WHERE annee IS NOT NULL DO NOTHING;

-- 2) Rattacher les talks CONFIRMÉS du programme officiel : saisis à la main,
--    conférence DevFest, année 2026, pas encore rattachés. Sans id en dur.
--    lower(trim(...)) tolère casse et espaces parasites. Forme JOIN + edition_id
--    IS NULL : édition absente ⇒ 0 ligne (jamais de passage à NULL).
--    Attendus : Leïla, Géraldine, Cateline, Asma.
UPDATE speaker_talks st
   SET edition_id = ce.id
  FROM conference_editions ce
  JOIN conferences c ON c.id = ce.conference_id
 WHERE c.slug = 'devfest-toulouse'
   AND ce.annee = 2026
   AND st.edition_id IS NULL
   AND st.source = 'manuel'
   AND lower(trim(st.conference)) IN ('devfest', 'devfest toulouse')
   AND st.date LIKE '2026%';

-- 3) Montaine Marteau : son talk DevFest 2026 est absent de la base ; on le crée
--    et on le rattache. Profil résolu par le NOM d'affichage (attribut stable),
--    jamais par PK brute : sync-to-latest.sql est rejoué sur toute base (preview,
--    staging), où un id en dur pourrait désigner quelqu'un d'autre. Édition jointe
--    (pas de talk orphelin si l'édition manque). Idempotence gardée sur l'identité
--    stable (profil + édition), pas sur le titre (renommable). Résumé = abstract
--    public du programme DevFest.
INSERT INTO speaker_talks
       (speaker_profile_id, titre, type, conference, ville, pays, date, description, source, edition_id)
SELECT sp.id,
       'Construisez le dashboard qui répond à vos questions',
       'Quickie / Lightning', 'DevFest Toulouse', 'Toulouse', 'France', '2026-11-19',
       $desc$Vous, votre équipe, votre direction : le même dashboard sous les yeux. Personne n'y trouve toutes ses réponses. Et chacun y cherche des infos différentes. La version qui conviendrait à tout le monde ? Avec l'abonnement premium qui est hors budget. À force d'ouvrir dix onglets pour savoir où on en était, j'ai créé le dashboard adapté à mes besoins. Je manage, je ne code pas. Depuis, je l'utilise tous les jours et j'en ai fait d'autres. Je partagerai trois dashboards que je me suis construits : une timeline multi-projets, un daily enrichi des infos Git, un suivi d'équipe sur mesure. Puis la méthode : MCP + vibe-coding. Non-devs : ce qu'on peut réaliser sans coder. Devs : les outils que l'on peut développer à côté de la prod. Vous repartirez avec une question : quel dashboard vous manque vraiment. Et la méthode pour le construire.$desc$,
       'manuel', ce.id
  FROM speaker_profiles sp
  JOIN users u ON u.id = sp."userId"
  JOIN conferences c ON c.slug = 'devfest-toulouse'
  JOIN conference_editions ce ON ce.conference_id = c.id AND ce.annee = 2026
 WHERE lower(u.name) = 'montaine marteau'
   AND NOT EXISTS (
     SELECT 1 FROM speaker_talks st2
      WHERE st2.speaker_profile_id = sp.id
        AND st2.edition_id = ce.id
   );

-- 4) Sandrine Berger (#28) et Camille Ghibaudo (#26) présentent au DevFest, mais
--    leur seul talk en base est une PROPOSITION Tremplin (source='tremplin',
--    exclue de l'affichage public). On la promeut en talk DevFest confirmé.
--    Gardes : source='tremplin' = promotion UNIQUE (rejouée = no-op, protège un
--    talk déjà manuel) ; status='publie' = on ne bascule une proposition Tremplin
--    en talk public QUE si la fiche est déjà publiée (sinon la promotion attend un
--    déploiement postérieur à la publication : jamais de « pré-armement » d'un
--    contenu encore privé). Forme JOIN : édition absente ⇒ 0 ligne (pas de NULL,
--    pas de promotion « à vide »). Camille : « salle des communautés » (absente du
--    site officiel). FORMAT (type) : « Conférence » pour les deux (confirmé par l'orga).
UPDATE speaker_talks st
   SET source     = 'manuel',
       type       = 'Conférence',
       conference = 'DevFest Toulouse',
       date       = '2026-11-19',
       ville      = 'Toulouse',
       pays       = 'France',
       edition_id = ce.id
  FROM conference_editions ce
  JOIN conferences c ON c.id = ce.conference_id
 WHERE c.slug = 'devfest-toulouse' AND ce.annee = 2026
   AND st.id = 28 AND st.source = 'tremplin'
   AND EXISTS (SELECT 1 FROM speaker_profiles sp
                WHERE sp.id = st.speaker_profile_id AND sp.status = 'publie');
   -- Sandrine Berger, « L'IA à l'épreuve du monde physique »

UPDATE speaker_talks st
   SET source     = 'manuel',
       type       = 'Conférence',
       conference = 'DevFest Toulouse',
       date       = '2026-11-19',
       ville      = 'Toulouse',
       pays       = 'France',
       edition_id = ce.id
  FROM conference_editions ce
  JOIN conferences c ON c.id = ce.conference_id
 WHERE c.slug = 'devfest-toulouse' AND ce.annee = 2026
   AND st.id = 26 AND st.source = 'tremplin'
   AND EXISTS (SELECT 1 FROM speaker_profiles sp
                WHERE sp.id = st.speaker_profile_id AND sp.status = 'publie');
   -- Camille Ghibaudo, talk Tremplin (salle des communautés)
