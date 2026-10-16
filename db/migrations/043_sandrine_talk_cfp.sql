-- 043 — Sandrine Berger et Camille Ghibaudo (correction de la promotion 042).
--
-- Backfill de DONNÉES (pas de schéma). Corrige la façon dont Sandrine et Camille
-- rejoignent le line-up DevFest 2026.
--
-- Sandrine Berger : acceptée au CFP (talk confirmé) mais ne l'a jamais saisi sur
-- sa fiche. Sa seule trace en base était sa proposition Tremplin — qu'on NE promeut
-- PLUS (la 042 la promouvait, gardée par status='publie' ; comme sa fiche n'était
-- pas publiée, la promotion n'a jamais eu lieu). On INSÈRE plutôt son vrai talk
-- DevFest comme talk manuel relié à l'édition (comme Montaine), avec son résumé
-- officiel. Sa proposition Tremplin reste inchangée (artefact Tremplin, masqué du
-- public par source='tremplin').
--
-- Camille Ghibaudo : sa proposition Tremplin EST son talk DevFest (salle des
-- communautés) ; on continue de la promouvoir, mais SANS la garde status='publie'.
--
-- Pourquoi retirer la garde status='publie' des promotions : l'affichage public
-- (getPublicSpeakersByConferenceEdition + fiche publique) exige DÉJÀ status='publie'.
-- La garde était donc redondante côté consentement, et forçait un redéploiement
-- après la publication d'une fiche pour que le talk bascule. Sans elle, le talk est
-- prêt en base ; il apparaît dès que la fiche est publiée (ISR), sans redéploiement.
-- Aucune fuite : une fiche non publiée reste invisible (fiche + line-up).
--
-- Idempotent, no-op sur base vierge (tests). Appliqué au déploiement via
-- db/sync-to-latest.sql (bloc identique, en fin de fichier).

-- Sandrine Berger : INSERT de son talk DevFest confirmé (résolu par le nom, édition
-- jointe, idempotent sur profil + édition).
INSERT INTO speaker_talks
       (speaker_profile_id, titre, type, conference, ville, pays, date, description, source, edition_id)
SELECT sp.id,
       'L''IA à l''épreuve du monde physique',
       'Conférence', 'DevFest Toulouse', 'Toulouse', 'France', '2026-11-19',
       $desc$On entend partout que Claude code votre site et que ChatGPT rédige vos contrats. Mais une IA qui comprend vraiment la physique ? Ça, c'est une autre histoire. Et 2026 le confirme : pendant que NVIDIA construit des usines à données synthétiques, physiciens et roboticiens se ruent sur la simulation.

Ici, le vrai goulot d'étranglement n'est pas l'algorithme. Je le sais parce que j'ai passé des mois à entraîner des agents RL à piloter une aile, et le modèle, c'était la partie facile. Tout le travail était ailleurs : leur construire un monde assez fidèle pour qu'ils apprennent quelque chose d'utile. Car contrairement au texte, la réalité physique ne se scrape pas.

C'est de là que part ce talk. On verra pourquoi chaque donnée physique coûte si cher, pourquoi on ne peut pas scaler comme avec les LLMs, et quelles réponses émergent aujourd'hui, des surrogates aux données synthétiques en passant par le transfer learning et les neural operators. Le tout autour d'un même fil rouge, le compromis fidélité contre coût, sans cacher ce qui reste encore ouvert.

Le public repartira en sachant exactement où se trouve le vrai chantier, l'un des problèmes les plus fascinants du moment. Parce que ce monde simulé, fidèle et entraînable, il reste à construire. Peut-être par l'un d'entre eux.$desc$,
       'manuel', ce.id
  FROM speaker_profiles sp
  JOIN users u ON u.id = sp."userId"
  JOIN conferences c ON c.slug = 'devfest-toulouse'
  JOIN conference_editions ce ON ce.conference_id = c.id AND ce.annee = 2026
 WHERE lower(u.name) = 'sandrine berger'
   AND NOT EXISTS (
     SELECT 1 FROM speaker_talks st2
      WHERE st2.speaker_profile_id = sp.id AND st2.edition_id = ce.id
   );

-- Camille Ghibaudo : promotion de sa proposition Tremplin (#26) en talk confirmé,
-- sans garde status='publie' (JOIN sur l'édition : édition absente ⇒ 0 ligne).
UPDATE speaker_talks st
   SET source = 'manuel', type = 'Conférence', conference = 'DevFest Toulouse',
       date = '2026-11-19', ville = 'Toulouse', pays = 'France', edition_id = ce.id
  FROM conference_editions ce
  JOIN conferences c ON c.id = ce.conference_id
 WHERE c.slug = 'devfest-toulouse' AND ce.annee = 2026
   AND st.id = 26 AND st.source = 'tremplin';
