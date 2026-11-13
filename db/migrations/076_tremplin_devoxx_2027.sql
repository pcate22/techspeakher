-- 076 — Tremplin Devoxx France 2027 : l'édition, ses cinq ateliers et l'article
-- d'annonce (migration de DONNÉES, pas de schéma).
--
-- Le partenariat avec Devoxx France est signé : l'édition s'ouvre au public dès
-- le déploiement (statut « ouvert », candidatures du 9 au 30 novembre 2026). La
-- page /tremplin/devoxx-france/2027 en tire tout ; le bouton « Candidater »
-- suit la fenêtre d'inscriptions. Le lieu de la soirée reste « Paris » tant qu'il
-- n'est pas confirmé.
--
-- Posé UNE fois (clé dans `seeds_appliques`) : une édition, un atelier ou un
-- article retouché ou supprimé ensuite depuis l'admin n'est jamais recréé au
-- déploiement suivant. Rien de personnel : ni inscrite, ni jury, ni adresse.

DO $seed076$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'tremplin_editions' AND column_name = 'statut') THEN
    RETURN;
  END IF;

INSERT INTO tremplin_editions
  (nom, annee, conf_slug, statut, description,
   conf_nom, conf_lieu, conf_date, conf_lien,
   finale_date, finale_lieu, inscriptions_debut, inscriptions_fin)
SELECT
  'Tremplin 2027', 2027, 'devoxx-france', 'ouvert',
  $d$Le Tremplin Tech Speak'Her avec Devoxx France : cinq ateliers à distance, une soirée finale le 19 janvier 2027 à Paris, et une conférence de 30 minutes au Devoxx France 2027 pour la gagnante.$d$,
  'Devoxx France', NULL, DATE '2027-04-07', 'https://www.devoxx.fr/',
  DATE '2027-01-19', 'Paris', DATE '2026-11-09', DATE '2026-11-30'
 WHERE NOT EXISTS (SELECT 1 FROM seeds_appliques WHERE cle = '076_tremplin_devoxx_2027')
ON CONFLICT (conf_slug, annee) DO NOTHING;

-- Les thèmes des cinq ateliers du Tremplin DevFest 2026, aux dates 2027. Le
-- midi, à distance : l'heure et le lien de visio se règlent dans l'admin.
INSERT INTO tremplin_ateliers
  (edition_id, ordre, titre, date, description, audience, ouvert_a_toutes, au_programme_public)
SELECT e.id, a.ordre, a.titre, a.jour::date, a.description, 'toutes', TRUE, TRUE
  FROM tremplin_editions e
 CROSS JOIN (VALUES
  (1, $t$Trouver son sujet$t$, '2026-12-01',
   $t$Du blanc à 3 idées de talk via le triangle Expertise / Expérience / Émotion. Brainstorm guidé, partage en tour de table, shortlist personnelle.$t$),
  (2, $t$Construire le plan$t$, '2026-12-08',
   $t$Du sujet au squelette du talk en 3 blocs : accroche, corps, chute. Validation de la promesse et du public visé. Test du plan avec un agent IA.$t$),
  (3, $t$Proposer son sujet : le CFP$t$, '2026-12-15',
   $t$Construire un titre qui émerge, une description structurée (contexte / sujet / contenu / promesse), une bio à la première personne, et les notes aux organisatrices qui peuvent faire la différence. On encourage à soumettre au Devoxx France, et ailleurs.$t$),
  (4, $t$Travailler le pitch$t$, '2027-01-05',
   $t$Premier passage à l'oral devant le groupe. Travail du débit, des transitions, de la chute. Feedback bienveillant pour caler la version 1.$t$),
  (5, $t$Affiner la prise de parole$t$, '2027-01-12',
   $t$Entraînement au pitch et finalisation des CFP. Dernière ligne droite avant la soirée du 19 janvier.$t$)
 ) AS a(ordre, titre, jour, description)
 WHERE e.conf_slug = 'devoxx-france' AND e.annee = 2027 AND e.deleted_at IS NULL
   AND NOT EXISTS (SELECT 1 FROM seeds_appliques WHERE cle = '076_tremplin_devoxx_2027')
   AND NOT EXISTS (SELECT 1 FROM tremplin_ateliers t WHERE t.edition_id = e.id AND t.ordre = a.ordre);
END
$seed076$;

INSERT INTO contenus (type, slug, titre, chapo, corps, categorie, tag, lien, statut, publie_le, au_flux)
SELECT
  'publication',
  'tremplin-2027-devoxx-france',
  $t$Le Tremplin repart, avec Devoxx France$t$,
  $c$Envie de donner ton premier talk dans une conférence tech ? Le Tremplin Tech Speak'Her t'accompagne de la salle à la scène, et cette année, la gagnante donnera sa conférence au Devoxx France 2027. Candidatures ouvertes jusqu'au 30 novembre.$c$,
  $corps$## Le Tremplin, c'est quoi ?

Un programme pour les femmes de la tech qui visent leur première scène en conférence. On t'accompagne pendant plusieurs semaines pour trouver ton sujet, construire ton talk et travailler ta prise de parole, puis tu le présentes devant un jury bienveillant.

La première édition s'est faite avec le DevFest Toulouse : 8 finalistes, 3 gagnantes, et des talks au DevFest en novembre 2026. Cette année, on part à Paris : la gagnante donnera sa conférence au **Devoxx France 2027**, du 7 au 9 avril au Palais des Congrès.

## Le programme

- **Du 9 au 30 novembre 2026** : les candidatures.
- **En décembre et janvier** : cinq ateliers en groupe, à distance, sur le temps de midi, les 1er, 8 et 15 décembre puis les 5 et 12 janvier. Trouver son sujet, construire son plan, rédiger son CFP, travailler son pitch, affiner sa prise de parole.
- **Le mardi 19 janvier 2027, en soirée** : la soirée Tremplin, à Paris. Trois minutes de pitch, cinq minutes d'échange avec le jury.
- **Jusqu'en avril** : on accompagne la gagnante pour préparer sa conférence.

## Ce que tu y gagnes

La gagnante donne une conférence de 30 minutes au Devoxx France 2027, et on l'accompagne jusqu'au jour J. Toutes les participantes repartent avec le retour écrit du jury, la vidéo de leur pitch et, si elles le veulent, un post sur nos réseaux.

## Qui peut candidater ?

- Les femmes de la tech, ou les personnes qui se reconnaissent comme telles, tous métiers et tous niveaux.
- Qui donneront leur premier talk dans une conférence publique avec appel à orateurs (CFP) et sélection. Tu peux candidater même si tu as déjà fait des présentations internes, des lightning talks en entreprise, des cours, des formations, des podcasts ou des webinaires.
- Adhérentes de Tech Speak'Her : [adhérer à l'association](/adherer).
- Disponibles à Paris le 19 janvier au soir, et du 7 au 9 avril pour Devoxx France en cas de victoire. Le transport et le logement restent à la charge des candidates : nous cherchons des financements pour les prendre en charge.

Un doute sur ta situation ? [Écris-nous](/contact).

## Une idée vague suffit

Et si tu pars d'une page blanche, le premier atelier sert justement à trouver ton sujet. Ce qui compte, c'est l'envie d'oser et de progresser ensemble.

[Tout savoir et candidater](/tremplin/devoxx-france/2027)

Tu connais quelqu'une qui hésite encore ? Envoie-lui cet article.$corps$,
  'Tremplin', 'En cours', '/tremplin/devoxx-france/2027', 'publie', CURRENT_DATE, TRUE
 WHERE NOT EXISTS (SELECT 1 FROM seeds_appliques WHERE cle = '076_tremplin_devoxx_2027')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO seeds_appliques (cle) VALUES ('076_tremplin_devoxx_2027')
ON CONFLICT (cle) DO NOTHING;
