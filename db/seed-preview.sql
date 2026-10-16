-- ═══════════════════════════════════════════════════════════════════════════
-- Tech Speak'Her — Jeu de données FICTIVES pour la PREVIEW (base de test).
--
--   ⚠️  NE JAMAIS exécuter en prod ni en pré-prod : ne contient que des
--       personnes INVENTÉES (RGPD : aucune vraie personne de la communauté).
--       Seule exception : le compte orga qui aura l'accès admin de la preview.
--       Son e-mail N'EST PAS committé (donnée personnelle) : remplace le
--       placeholder 'orga@example.com' ci-dessous par ton adresse AVANT d'exécuter.
--
-- But : peupler une preview pour tester l'UI sur un état réaliste :
--   • un tremplin TERMINÉ (année N-1)         → 3 ateliers faits, podium, prix ;
--   • un tremplin EN COURS (année N)          → 1 atelier passé, 1 à animer ;
--   • un tremplin EN PRÉPARATION (année N+1)  → tâche « Ouvrir au public ».
-- N est l'année de la conférence en cours, datée à J+37 : TOUT le décor
-- (années, noms, URL, dates) se dérive du jour où on l'exécute. En dur, il
-- vieillissait : « Tremplin DevFest 2026 » daté en 2027, puis sorti des
-- éditions récentes de l'import (dette P2 soldée le 2026-10-14).
--
-- Réexécutable : purge SES données de démo (comptes @demo.techspeakher.test +
-- éditions devfest-toulouse N-3 à N+1) puis réinsère. Le compte orga (ton
-- e-mail, saisi ci-dessous) est conservé : on ne fait que lui (re)donner le rôle.
--
-- Prérequis : base à jour (migrations 027→031, via db/sync-to-latest.sql).
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── Garde-fou anti-prod ───────────────────────────────────────────────────
-- La purge plus bas SUPPRIME les éditions devfest-toulouse N-3 à N+1 (et,
-- en cascade, inscriptions, photos, documents, jury, journal de consentement).
-- Sur une base de TEST vide de vraies données, aucun risque. Mais lancé par
-- erreur sur la PROD, ce serait une perte irréversible. On refuse donc de
-- tourner si la base contient de VRAIES speakeuses publiées (marqueur fiable
-- de prod) : dans une transaction, l'exception annule tout, rien n'est touché.
DO $$
DECLARE n_reelles INTEGER;
BEGIN
  SELECT count(*) INTO n_reelles
    FROM speaker_profiles sp
    JOIN users u ON u.id = sp."userId"
   WHERE sp.status = 'publie'
     AND u.email NOT LIKE '%@demo.techspeakher.test';
  IF n_reelles > 0 THEN
    RAISE EXCEPTION
      'seed-preview REFUSE : % speakeuse(s) publiee(s) reelle(s) detectee(s). Cela ressemble a la PROD, pas a une base de test. Rien n''a ete touche.',
      n_reelles;
  END IF;
END $$;

DO $$
DECLARE
  -- Comptes
  u_orga    INTEGER;  -- orga de démo (Camille)
  u_coach1  INTEGER;  -- Sofia (coach + speakeuse publiée)
  u_coach2  INTEGER;  -- Malik (coach)
  u_lea     INTEGER;
  u_aicha   INTEGER;
  u_nadia   INTEGER;
  u_yasmine INTEGER;
  u_ines    INTEGER;

  -- Référence conférences
  c_devfest    INTEGER;
  -- Agenda public : fiches propriétaires et talk courant (section 8)
  sp_lea       INTEGER;
  sp_aicha     INTEGER;
  sp_nadia     INTEGER;
  t_courant    INTEGER;
  i            INTEGER;
  ce_passee    INTEGER;
  ce_courante  INTEGER;

  -- Le jour de la conférence en cours, et son année N : la source de toutes
  -- les années du décor (e2e/decor.ts porte le même décalage, gardé par
  -- src/__tests__/seed-preview-dates.test.ts).
  date_conf DATE := CURRENT_DATE + 37;
  n         INTEGER := EXTRACT(YEAR FROM date_conf)::int;

  -- Éditions de tremplin
  ed_passee   INTEGER;  -- TERMINÉ
  ed_courante INTEGER;  -- EN COURS
  ed_suivante INTEGER;  -- EN PRÉPARATION

  -- Ateliers N-1 (terminés)
  ap_1 INTEGER; ap_2 INTEGER; ap_3 INTEGER;
  -- Ateliers N (à animer)
  ac_1 INTEGER; ac_2 INTEGER;

  -- Inscriptions N-1
  rp_lea   INTEGER; rp_aicha INTEGER; rp_nadia INTEGER;
  -- Inscriptions N
  rc_lea     INTEGER; rc_yasmine INTEGER; rc_manon INTEGER;

  -- Photos
  ph_podium INTEGER; ph_soiree INTEGER; ph_repet INTEGER;
BEGIN
  -- ── 0. Purge des données de démo précédentes (idempotence) ──────────────
  DELETE FROM tremplin_editions
   WHERE conf_slug = 'devfest-toulouse' AND annee BETWEEN n - 3 AND n + 1;  -- N-3 : un décor de l'an dernier
  DELETE FROM users
   WHERE email LIKE '%@demo.techspeakher.test';

  -- ── 1. Ton compte orga (réel) : upsert, sans jamais dupliquer ───────────
  -- ⚠️  Remplace 'orga@example.com' par TON adresse avant d'exécuter (l'e-mail
  --     réel n'est pas committé : donnée personnelle, RGPD).
  UPDATE users SET is_orga = true WHERE email = 'orga@example.com';
  IF NOT FOUND THEN
    INSERT INTO users (name, email, "emailVerified", is_orga)
    VALUES ('Orga preview', 'orga@example.com', now(), true);
  END IF;

  -- ── 2. Comptes de démo (fictifs) ────────────────────────────────────────
  INSERT INTO users (name, email, "emailVerified", is_orga, genre)
  VALUES ('Camille Rivière', 'orga@demo.techspeakher.test', now(), true, 'femme')
  RETURNING id INTO u_orga;

  INSERT INTO users (name, email, "emailVerified", is_coach, genre)
  VALUES ('Sofia Nguyen', 'sofia@demo.techspeakher.test', now(), true, 'femme')
  RETURNING id INTO u_coach1;

  INSERT INTO users (name, email, "emailVerified", is_coach, genre)
  VALUES ('Malik Ferrand', 'malik@demo.techspeakher.test', now(), true, 'homme')
  RETURNING id INTO u_coach2;

  INSERT INTO users (name, email, "emailVerified", genre)
  VALUES ('Léa Dubois', 'lea@demo.techspeakher.test', now(), 'femme')   RETURNING id INTO u_lea;
  INSERT INTO users (name, email, "emailVerified", genre)
  VALUES ('Aïcha Benali', 'aicha@demo.techspeakher.test', now(), 'femme') RETURNING id INTO u_aicha;
  INSERT INTO users (name, email, "emailVerified", genre)
  VALUES ('Nadia Lopez', 'nadia@demo.techspeakher.test', now(), 'femme')  RETURNING id INTO u_nadia;
  INSERT INTO users (name, email, "emailVerified", genre)
  VALUES ('Yasmine Roche', 'yasmine@demo.techspeakher.test', now(), 'femme') RETURNING id INTO u_yasmine;
  INSERT INTO users (name, email, "emailVerified", genre)
  VALUES ('Inès Kabbaj', 'ines@demo.techspeakher.test', now(), 'femme') RETURNING id INTO u_ines;

  -- ── 3. Fiches speakeuses ────────────────────────────────────────────────
  -- Publiées (annuaire public).
  INSERT INTO speaker_profiles
    ("userId", titre_profil, poste, entreprise, bio, website, linkedin, ville,
     regions, langues, secteurs, sujets, contact_email_ok, is_woman,
     status, published_at, submitted_at, validated_by, validated_at)
  VALUES
    (u_lea, 'Ingénieure plateforme & conférencière', 'Staff Engineer', 'Nuagelib',
     'Léa conçoit des plateformes internes et adore expliquer la fiabilité sans jargon.',
     'https://lea.example.test', 'https://www.linkedin.com/in/lea-dubois-demo', 'Toulouse',
     ARRAY['Occitanie'], ARRAY['Français','Anglais'], ARRAY['Cloud','DevOps'],
     ARRAY['Observabilité','Plateformes internes'], true, true,
     'publie', now(), now() - INTERVAL '400 days', u_orga, now() - INTERVAL '395 days'),
    (u_aicha, 'Data engineer', 'Data Engineer', 'Cartodonnées',
     'Aïcha construit des pipelines de données et milite pour des tableaux de bord lisibles.',
     NULL, 'https://www.linkedin.com/in/aicha-benali-demo', 'Blagnac',
     ARRAY['Occitanie'], ARRAY['Français'], ARRAY['Data'],
     ARRAY['Qualité des données','Dataviz'], false, true,
     'publie', now(), now() - INTERVAL '390 days', u_orga, now() - INTERVAL '385 days'),
    (u_nadia, 'Développeuse back-end', 'Développeuse', 'Fabrique API',
     'Nadia parle d''architectures d''API sobres et testables.',
     NULL, 'https://www.linkedin.com/in/nadia-lopez-demo', 'Toulouse',
     ARRAY['Occitanie'], ARRAY['Français'], ARRAY['Back-end'],
     ARRAY['API','Tests'], false, true,
     'publie', now(), now() - INTERVAL '380 days', u_orga, now() - INTERVAL '375 days'),
    (u_coach1, 'Accessibilité numérique', 'UX Engineer', 'Accessic',
     'Sofia accompagne les speakeuses et parle d''accessibilité concrète.',
     NULL, 'https://www.linkedin.com/in/sofia-nguyen-demo', 'Toulouse',
     ARRAY['Occitanie'], ARRAY['Français','Anglais'], ARRAY['Web','Accessibilité'],
     ARRAY['RGAA','Design inclusif'], true, true,
     'publie', now(), now() - INTERVAL '500 days', u_orga, now() - INTERVAL '495 days');

  -- En attente de validation → tâche orga « Valider la fiche de … ».
  INSERT INTO speaker_profiles
    ("userId", titre_profil, poste, entreprise, bio, ville,
     langues, secteurs, sujets, is_woman, status, submitted_at)
  VALUES
    (u_yasmine, 'Développeuse front', 'Développeuse', 'Studio Pixel',
     'Yasmine découvre la prise de parole et prépare son premier talk.', 'Toulouse',
     ARRAY['Français'], ARRAY['Web'], ARRAY['Front-end'], true,
     'en_attente', now() - INTERVAL '2 days');

  -- Brouillon EN SOMMEIL → tâche orga « Relancer … » + page /admin/speakeuses/relances.
  -- Fiche à peine commencée (ni titre, ni bio, ni contact), sans changement
  -- depuis deux mois : c'est exactement la personne que la relance vise.
  INSERT INTO speaker_profiles ("userId", ville, langues, status, updated_at)
  VALUES (u_ines, 'Toulouse', ARRAY['Français'], 'brouillon', now() - INTERVAL '60 days');

  -- ── 4. Référence des conférences (migration 027) ────────────────────────
  INSERT INTO conferences (slug, nom, type, ville, pays, site_url)
  VALUES ('devfest-toulouse', 'DevFest Toulouse', 'conference', 'Toulouse', 'France',
          'https://devfest.gdgtoulouse.fr')
  ON CONFLICT (slug) DO UPDATE SET nom = EXCLUDED.nom
  RETURNING id INTO c_devfest;

  -- Deux éditions de conférence, N-1 et N. Celle de N a le MÊME jour que
  -- `conf_date` du tremplin en cours : un DevFest, une date. Réexécuté plus
  -- tard, le seed RECALE les dates d'une édition déjà là (un décor de la veille
  -- garderait sinon sa date d'hier).
  SELECT id INTO ce_passee FROM conference_editions
   WHERE conference_id = c_devfest AND annee = n - 1 LIMIT 1;
  IF ce_passee IS NULL THEN
    INSERT INTO conference_editions (conference_id, type, annee, date_debut, date_fin, ville, pays, url, actif)
    VALUES (c_devfest, 'edition', n - 1, make_date(n - 1, 11, 21), make_date(n - 1, 11, 21), 'Toulouse', 'France',
            'https://devfest.gdgtoulouse.fr', false)
    RETURNING id INTO ce_passee;
  ELSE
    UPDATE conference_editions SET date_debut = make_date(n - 1, 11, 21), date_fin = make_date(n - 1, 11, 21)
     WHERE id = ce_passee;
  END IF;

  SELECT id INTO ce_courante FROM conference_editions
   WHERE conference_id = c_devfest AND annee = n LIMIT 1;
  IF ce_courante IS NULL THEN
    INSERT INTO conference_editions (conference_id, type, annee, date_debut, date_fin, ville, pays, url, actif)
    VALUES (c_devfest, 'edition', n, date_conf, date_conf, 'Toulouse', 'France',
            'https://devfest.gdgtoulouse.fr', true)
    RETURNING id INTO ce_courante;
  ELSE
    UPDATE conference_editions SET date_debut = date_conf, date_fin = date_conf
     WHERE id = ce_courante;
  END IF;

  -- ══════════════════════════════════════════════════════════════════════
  -- 5. TREMPLIN TERMINÉ — DevFest N-1 (archivé, tout est fait)
  -- ══════════════════════════════════════════════════════════════════════
  INSERT INTO tremplin_editions
    (nom, annee, conf_slug, statut, description, conf_nom, conf_lieu, conf_date,
     conf_lien, finale_date, finale_lieu, inscriptions_debut, inscriptions_fin, conference_edition_id)
  VALUES
    ('Tremplin DevFest ' || (n - 1), n - 1, 'devfest-toulouse', 'archive',
     'Édition terminée : podium attribué, prix remis, photos en ligne.',
     'DevFest', 'Toulouse', make_date(n - 1, 11, 21), 'https://devfest.gdgtoulouse.fr',
     make_date(n - 1, 11, 20), 'La Cité, Toulouse', make_date(n - 1, 4, 1), make_date(n - 1, 5, 15), ce_passee)
  RETURNING id INTO ed_passee;

  -- 3 ateliers, tous PASSÉS et animés. Toutes les dates de N-1 sont passées :
  -- N bascule à N+1 dès le 25 novembre (J+37 franchit le 1er janvier), après
  -- le 21 novembre, la plus tardive.
  INSERT INTO tremplin_ateliers (edition_id, ordre, titre, date, heure_debut, heure_fin, description, lien_visio, coachs, phase, ouvert_a_toutes)
  VALUES (ed_passee, 1, 'Écrire un sujet de CFP qui accroche', make_date(n - 1, 9, 10), TIME '18:30', TIME '20:00',
          'Ouvert à toutes : structurer son abstract et son titre.', 'https://meet.example.test/cfp-passee', 'Sofia Nguyen', 'cfp_et_pitch', true)
  RETURNING id INTO ap_1;
  INSERT INTO tremplin_ateliers (edition_id, ordre, titre, date, heure_debut, heure_fin, description, lien_visio, coachs, phase, ouvert_a_toutes)
  VALUES (ed_passee, 2, 'Répétition des pitchs', make_date(n - 1, 9, 24), TIME '18:30', TIME '20:00',
          'Chacune pitche et reçoit un retour à chaud.', 'https://meet.example.test/pitch-passee', 'Malik Ferrand', 'cfp_et_pitch', false)
  RETURNING id INTO ap_2;
  INSERT INTO tremplin_ateliers (edition_id, ordre, titre, date, heure_debut, heure_fin, description, coachs, phase, ouvert_a_toutes)
  VALUES (ed_passee, 3, 'Filage sur la grande scène', make_date(n - 1, 11, 19), TIME '17:00', TIME '19:00',
          'Filage sur la scène du DevFest, la veille.', 'Sofia Nguyen', 'montee_sur_scene', false)
  RETURNING id INTO ap_3;

  -- Podium : 3 gagnantes classées, finale présente, consentement public.
  INSERT INTO tremplin_registrations (edition_id, "userId", statut, titre_palmares, phase_entree, public, public_consent_at, classement, bio, site_web, finale_presente)
  VALUES (ed_passee, u_lea, 'acceptee', 'Rendre l''observabilité lisible par toute l''équipe', 'cfp_et_pitch', true, now(), 1,
          'Staff engineer à Toulouse, passionnée de fiabilité.', 'https://lea.example.test', true)
  RETURNING id INTO rp_lea;
  INSERT INTO tremplin_registrations (edition_id, "userId", statut, titre_palmares, phase_entree, public, public_consent_at, classement, bio, finale_presente)
  VALUES (ed_passee, u_aicha, 'acceptee', 'Des données propres sans y passer ses nuits', 'cfp_et_pitch', true, now(), 2,
          'Data engineer, curieuse de tout.', true)
  RETURNING id INTO rp_aicha;
  INSERT INTO tremplin_registrations (edition_id, "userId", statut, titre_palmares, phase_entree, public, public_consent_at, classement, bio, finale_presente)
  VALUES (ed_passee, u_nadia, 'acceptee', 'Des API sobres et testables', 'cfp_et_pitch', true, now(), 3,
          'Développeuse back-end, adepte du strict nécessaire.', true)
  RETURNING id INTO rp_nadia;

  INSERT INTO tremplin_registration_phases (registration_id, phase) VALUES
    (rp_lea,'cfp_et_pitch'),(rp_lea,'finale'),(rp_lea,'montee_sur_scene'),
    (rp_aicha,'cfp_et_pitch'),(rp_aicha,'finale'),
    (rp_nadia,'cfp_et_pitch'),(rp_nadia,'finale'),(rp_nadia,'montee_sur_scene');

  -- Présences TOUTES pointées (édition finie).
  INSERT INTO tremplin_atelier_membres (atelier_id, registration_id, presence) VALUES
    (ap_2, rp_lea,'presente'),(ap_2, rp_aicha,'presente'),(ap_2, rp_nadia,'absente'),
    (ap_3, rp_lea,'presente'),(ap_3, rp_nadia,'presente');

  INSERT INTO tremplin_atelier_coachs (atelier_id, user_id) VALUES
    (ap_1, u_coach1),(ap_2, u_coach2),(ap_3, u_coach1);
  INSERT INTO tremplin_registration_coachs (registration_id, user_id) VALUES
    (rp_lea, u_coach1),(rp_nadia, u_coach2);

  INSERT INTO tremplin_jury (edition_id, nom, prenom, fonction, entreprise, email) VALUES
    (ed_passee, 'Fontaine', 'Claire', 'CTO', 'Orbite Logicielle', 'claire@demo.techspeakher.test'),
    (ed_passee, 'Marchand', 'Hugo', 'Responsable technique', 'Studio Pixel', 'hugo@demo.techspeakher.test');

  -- Récompenses RÉALISÉES (édition finie).
  INSERT INTO tremplin_recompenses (edition_id, intitule, detail, rang, beneficiaire_registration_id, statut, evenement_le, attribuee_le) VALUES
    (ed_passee, 'Présentation au DevFest Toulouse', 'Conférence sur la scène principale.', 1, rp_lea, 'realisee', make_date(n - 1, 11, 21), now() - INTERVAL '230 days'),
    (ed_passee, 'Talk en meetup partenaire', 'Créneau dans un meetup local.', 2, rp_aicha, 'realisee', LEAST(make_date(n, 2, 10), CURRENT_DATE - 1), now() - INTERVAL '150 days');  -- après la finale de N-1, et passé

  -- Photos : une publiable (toutes consentent), une bloquée (accord manquant).
  INSERT INTO tremplin_photos (edition_id, url, legende, kind)
  VALUES (ed_passee, 'https://placehold.co/800x600?text=Podium+' || (n - 1), 'Le podium ' || (n - 1), 'podium')
  RETURNING id INTO ph_podium;
  INSERT INTO tremplin_photos (edition_id, url, legende, kind)
  VALUES (ed_passee, 'https://placehold.co/800x600?text=Soiree+' || (n - 1), 'La soirée finale', 'soiree')
  RETURNING id INTO ph_soiree;

  INSERT INTO tremplin_photo_personnes (photo_id, registration_id) VALUES
    (ph_podium, rp_lea),(ph_podium, rp_aicha),(ph_podium, rp_nadia);  -- inscrites publiques → publiable
  -- Personne hors inscription, accord PAS recueilli → photo bloquée par un
  -- GESTE d'orga (« Recueillir l'accord pour 1 photo », tâche allumante).
  INSERT INTO tremplin_photo_personnes (photo_id, nom_libre, consentement) VALUES
    (ph_soiree, 'Invité du public', false);

  INSERT INTO tremplin_documents (edition_id, atelier_id, auteur_id, type, titre, lien) VALUES
    (ed_passee, ap_1, u_coach1, 'support_atelier', 'Trame d''abstract (slides)', 'https://slides.example.test/trame-cfp');
  INSERT INTO tremplin_documents (edition_id, registration_id, auteur_id, type, titre, contenu) VALUES
    (ed_passee, rp_lea, u_orga, 'feedback_jury', 'Retour du jury (pitch)',
     'Sujet clair et rythme maîtrisé. Travailler la transition vers la démo.');

  -- ══════════════════════════════════════════════════════════════════════
  -- 6. TREMPLIN EN COURS — DevFest N (dates relatives au jour)
  -- ══════════════════════════════════════════════════════════════════════
  INSERT INTO tremplin_editions
    (nom, annee, conf_slug, statut, description, conf_nom, conf_lieu, conf_date,
     conf_lien, finale_date, finale_lieu, inscriptions_debut, inscriptions_fin, conference_edition_id)
  VALUES
    ('Tremplin DevFest ' || n, n, 'devfest-toulouse', 'en_cours',
     'Édition en cours : inscriptions closes, un atelier à animer avant la finale.',
     'DevFest', 'Toulouse', date_conf, 'https://devfest.gdgtoulouse.fr',
     date_conf - 1, 'La Cité, Toulouse', CURRENT_DATE - 196, CURRENT_DATE - 152, ce_courante)
  RETURNING id INTO ed_courante;

  -- Dates relatives au jour (garde : seed-preview-dates.test.ts).
  -- Atelier 1 passé (ouvert à toutes, sans membre : rien à pointer),
  -- atelier 2 à venir (« à animer »).
  INSERT INTO tremplin_ateliers (edition_id, ordre, titre, date, heure_debut, heure_fin, description, lien_visio, coachs, phase, ouvert_a_toutes)
  VALUES (ed_courante, 1, 'Écrire son sujet de CFP', CURRENT_DATE - 29, TIME '18:30', TIME '20:00',
          'Ouvert à toutes : cadrer son abstract.', 'https://meet.example.test/cfp-courante', 'Sofia Nguyen', 'cfp_et_pitch', true)
  RETURNING id INTO ac_1;
  INSERT INTO tremplin_ateliers (edition_id, ordre, titre, date, heure_debut, heure_fin, description, lien_visio, coachs, phase, ouvert_a_toutes)
  VALUES (ed_courante, 2, 'Répétition des pitchs', CURRENT_DATE + 14, TIME '18:30', TIME '20:00',
          'Groupe restreint : chacune pitche et reçoit un retour.', 'https://meet.example.test/pitch-courante', 'Malik Ferrand', 'cfp_et_pitch', false)
  RETURNING id INTO ac_2;

  -- Inscriptions (dont une SANS compte → tâche « Relier à un compte »).
  -- Non classées : plus de « sujet » libre ; leur titre viendra du talk pitché
  -- (aucun en preview → pas de sous-titre en galerie, conforme au nouveau modèle).
  INSERT INTO tremplin_registrations (edition_id, "userId", statut, phase_entree, public, public_consent_at)
  VALUES (ed_courante, u_lea, 'acceptee', 'cfp_et_pitch', true, now())
  RETURNING id INTO rc_lea;
  INSERT INTO tremplin_registrations (edition_id, "userId", statut, phase_entree, public, public_consent_at)
  VALUES (ed_courante, u_yasmine, 'acceptee', 'cfp_et_pitch', false, NULL)
  RETURNING id INTO rc_yasmine;
  INSERT INTO tremplin_registrations (edition_id, participante_nom, participante_role, participante_linkedin, statut, phase_entree, public)
  VALUES (ed_courante, 'Manon Girard', 'Développeuse mobile', 'https://www.linkedin.com/in/manon-girard-demo',
          'en_attente', 'cfp_et_pitch', false)
  RETURNING id INTO rc_manon;

  INSERT INTO tremplin_registration_phases (registration_id, phase) VALUES
    (rc_lea,'cfp_et_pitch'),(rc_yasmine,'cfp_et_pitch'),(rc_manon,'cfp_et_pitch');

  -- Membres de l'atelier restreint (présences pas encore pointées : à venir).
  INSERT INTO tremplin_atelier_membres (atelier_id, registration_id) VALUES
    (ac_2, rc_lea),(ac_2, rc_yasmine),(ac_2, rc_manon);

  -- Photo de N bloquée par la SEULE inscrite qui y figure : la couverture de
  -- Yasmine vaut SON réglage de visibilité (public=false) — aucun geste
  -- d'orga ne la referme. C'est le CONSTAT du moteur (« 1 photo reste
  -- privée », étiquette « Pour information ») : sans cette ligne, ni la
  -- pastille ni la règle « la liste peut finir » n'étaient rendues dans un
  -- vrai navigateur, donc jamais auditées par axe (relevé du 2026-08-18).
  INSERT INTO tremplin_photos (edition_id, url, legende, kind)
  VALUES (ed_courante, 'https://placehold.co/800x600?text=Repetition+' || n, 'La répétition des pitchs', 'soiree')
  RETURNING id INTO ph_repet;
  INSERT INTO tremplin_photo_personnes (photo_id, registration_id) VALUES
    (ph_repet, rc_yasmine);

  INSERT INTO tremplin_atelier_coachs (atelier_id, user_id) VALUES
    (ac_1, u_coach1),(ac_2, u_coach2);

  INSERT INTO tremplin_jury (edition_id, nom, prenom, fonction, entreprise, email) VALUES
    (ed_courante, 'Fontaine', 'Claire', 'CTO', 'Orbite Logicielle', 'claire@demo.techspeakher.test');

  -- Récompense à organiser (non attribuée : la finale n'a pas eu lieu).
  INSERT INTO tremplin_recompenses (edition_id, intitule, detail, statut) VALUES
    (ed_courante, 'Présentation au DevFest Toulouse', 'Créneau de conférence à caler après la finale.', 'a_organiser');

  -- ══════════════════════════════════════════════════════════════════════
  -- 6 bis. UN MESSAGE REÇU PAR LÉA (relais de contact, déjà transmis)
  -- ══════════════════════════════════════════════════════════════════════
  -- Sans lui, la rangée « Mes messages » du profil n'apparaît JAMAIS en
  -- navigateur, et /mon-espace/messages n'est auditée que vide : la promesse
  -- « est-elle branchée ? » ne serait pas tenue, et le <li> réel échapperait à
  -- axe comme à la porte de largeur (relecture du 2026-08-17).
  --
  -- `transmis` et pas `en_attente` : c'est l'état que la membre VOIT. Un
  -- message en attente vit dans la file de modération, pas chez elle.
  -- L'adresse de l'expéditeur reste dans le décor (`EMAILS_DU_DECOR`) : c'est
  -- elle que le balayage de cloisonnement cherche à ne pas trouver ailleurs.
  INSERT INTO contact_messages
    (profile_id, reason, sender_name, sender_email, body, status, moderated_by, moderated_at)
  SELECT sp.id, 'conference', 'Élodie Barreau', 'elodie@demo.techspeakher.test',
         'Bonjour Léa, on organise un meetup en novembre et ton sujet sur l''observabilité nous intéresse beaucoup. Serais-tu disponible ?',
         'transmis', u_orga, now() - INTERVAL '3 days'
    FROM speaker_profiles sp
   WHERE sp."userId" = u_lea;

  -- ══════════════════════════════════════════════════════════════════════
  -- 7. TREMPLIN EN PRÉPARATION — DevFest N+1 (tâche « Ouvrir au public »)
  -- ══════════════════════════════════════════════════════════════════════
  INSERT INTO tremplin_editions (nom, annee, conf_slug, statut, description, conf_nom, conf_lieu)
  VALUES ('Tremplin DevFest ' || (n + 1), n + 1, 'devfest-toulouse', 'preparation',
          'En préparation : à ouvrir quand les dates seront connues.', 'DevFest', 'Toulouse')
  RETURNING id INTO ed_suivante;

  -- ══════════════════════════════════════════════════════════════════════
  -- 8. AGENDA PUBLIC — de quoi éprouver /agenda pour de vrai
  -- ══════════════════════════════════════════════════════════════════════
  -- Sans cette matière, la suite E2E ouvrait un agenda VIDE : elle vérifiait
  -- qu'une page vide s'affiche, pas qu'un agenda fonctionne. Les dates sont
  -- toutes RELATIVES à `now()` — un décor calé sur des dates fixes cesserait
  -- de distinguer le futur du passé l'année suivante, et les gardes se
  -- tairaient sans que personne ne le remarque.
  SELECT id INTO sp_lea   FROM speaker_profiles WHERE "userId" = u_lea;
  SELECT id INTO sp_aicha FROM speaker_profiles WHERE "userId" = u_aicha;
  SELECT id INTO sp_nadia FROM speaker_profiles WHERE "userId" = u_nadia;

  -- ── À VENIR ───────────────────────────────────────────────────────────
  -- Deux saisies DIVERGENTES du même DevFest, rattachées au même registre :
  -- c'est le cas relevé en prod le 16/08/2026 (« DevFest » vs « DevFest
  -- Toulouse » le même jour). Une facette qui les sépare est en faute.
  INSERT INTO speaker_talks (speaker_profile_id, titre, type, source)
  VALUES (sp_lea, 'Rendre l''observabilité lisible par toute l''équipe', 'Conférence', 'manuel')
  RETURNING id INTO t_courant;
  -- La GÉOGRAPHIE est renseignée comme la Base Adresse Nationale la renvoie à
  -- la saisie (migration 072) : sans `region`, toutes ces villes françaises se
  -- rangeraient en « International » et la facette « Occitanie » du lot 1
  -- filtrerait sur du vide — le décor testerait alors le contraire du réel.
  INSERT INTO talk_occurrences (talk_id, speaker_profile_id, conference_id, conference, ville, code_insee, region, pays, date)
  VALUES (t_courant, sp_lea, c_devfest, 'DevFest Toulouse', 'Toulouse', '31555', 'Occitanie', 'France',
          to_char(now() + INTERVAL '20 days', 'YYYY-MM-DD'));

  INSERT INTO speaker_talks (speaker_profile_id, titre, type, source)
  VALUES (sp_aicha, 'Des tableaux de bord qu''on lit vraiment', 'Quickie', 'manuel')
  RETURNING id INTO t_courant;
  INSERT INTO talk_occurrences (talk_id, speaker_profile_id, conference_id, conference, ville, code_insee, region, pays, date)
  VALUES (t_courant, sp_aicha, c_devfest, 'DevFest', 'Toulouse', '31555', 'Occitanie', 'France',
          to_char(now() + INTERVAL '20 days', 'YYYY-MM-DD'));

  -- Une date hors registre (texte libre) : elle doit rester visible.
  INSERT INTO speaker_talks (speaker_profile_id, titre, type, source)
  VALUES (sp_nadia, 'Migrer sans réveiller personne', 'Conférence', 'manuel')
  RETURNING id INTO t_courant;
  INSERT INTO talk_occurrences (talk_id, speaker_profile_id, conference, ville, code_insee, region, pays, date)
  VALUES (t_courant, sp_nadia, 'Nuit de l''Info', 'Bordeaux', '33063', 'Nouvelle-Aquitaine', 'France',
          to_char(now() + INTERVAL '55 days', 'YYYY-MM-DD'));

  -- UNE DATE EN LIGNE, sans ville : elle se suit de partout, donc elle doit
  -- apparaître dans « À distance » ET dans tous les filtres géographiques
  -- (décision du 17/08 — une visio depuis Toulouse est joignable depuis
  -- Toulouse). Sans elle, cette règle n'aurait aucun décor pour se juger.
  INSERT INTO speaker_talks (speaker_profile_id, titre, type, source)
  VALUES (sp_aicha, 'Démarrer une communauté en visio', 'Conférence', 'manuel')
  RETURNING id INTO t_courant;
  INSERT INTO talk_occurrences (talk_id, speaker_profile_id, conference, date)
  VALUES (t_courant, sp_aicha, 'Meetup en ligne',
          to_char(now() + INTERVAL '35 days', 'YYYY-MM-DD'));

  -- LA DATE QUI GARDE LA BASCULE D'ANNÉE : toujours le 16 janvier PROCHAIN,
  -- donc toujours à venir, et toujours dans l'année civile suivante. Un
  -- agenda calé sur l'année en cours la perdrait — c'est exactement le défaut
  -- que « l'horizon glissant » existe pour rendre impossible.
  INSERT INTO speaker_talks (speaker_profile_id, titre, type, source)
  VALUES (sp_lea, 'Ce que janvier prochain nous réserve', 'Conférence', 'manuel')
  RETURNING id INTO t_courant;
  INSERT INTO talk_occurrences (talk_id, speaker_profile_id, conference, ville, code_insee, region, pays, date)
  VALUES (t_courant, sp_lea, 'Snowcamp', 'Grenoble', '38185', 'Auvergne-Rhône-Alpes', 'France',
          to_char(date_trunc('year', now()) + INTERVAL '1 year 15 days', 'YYYY-MM-DD'));

  -- ── DÉJÀ EN SCÈNE ─────────────────────────────────────────────────────
  -- QUINZE interventions passées, sur DEUX années révolues. Le nombre compte :
  -- l'ancien plafond de douze en cachait trois sans le dire, et c'est ce que
  -- la décision « mémoire complète » corrige. Une garde qui tournerait sur
  -- douze dates ou moins ne verrait jamais la troncature.
  FOR i IN 1..8 LOOP
    INSERT INTO speaker_talks (speaker_profile_id, titre, type, source)
    VALUES (sp_lea, 'Retour d''expérience n°' || i, 'Conférence', 'manuel')
    RETURNING id INTO t_courant;
    INSERT INTO talk_occurrences (talk_id, speaker_profile_id, conference, ville, code_insee, region, pays, date)
    VALUES (t_courant, sp_lea, 'Meetup Tech Speak''Her', 'Toulouse', '31555', 'Occitanie', 'France',
            to_char(date_trunc('year', now()) - INTERVAL '1 year' + (i * INTERVAL '31 days'), 'YYYY-MM-DD'));
  END LOOP;

  FOR i IN 1..7 LOOP
    INSERT INTO speaker_talks (speaker_profile_id, titre, type, source)
    VALUES (sp_aicha, 'Chronique de données n°' || i, 'Quickie', 'manuel')
    RETURNING id INTO t_courant;
    INSERT INTO talk_occurrences (talk_id, speaker_profile_id, conference, ville, code_insee, region, pays, date)
    VALUES (t_courant, sp_aicha, 'Capitole du Libre', 'Toulouse', '31555', 'Occitanie', 'France',
            to_char(date_trunc('year', now()) - INTERVAL '2 years' + (i * INTERVAL '37 days'), 'YYYY-MM-DD'));
  END LOOP;

  -- Une date passée AU MOIS PRÈS : DÉCEMBRE de l'année révolue. Trois propriétés
  -- portent cette ligne, et les deux dernières ont été apprises en cassant le
  -- test qui s'appuie dessus :
  --
  -- 1. la précision au MOIS, sans jour — le décor n'en portait aucune, et c'est
  --    ce qui a laissé le défaut du 18/08 atteindre la prod (`/agenda` annonçait
  --    « Voici la plus récente. » au-dessus de rien, son aperçu n'acceptant
  --    qu'un jour exact quand l'archive compte les périodes closes) ;
  -- 2. la PLUS RÉCENTE du passé (décembre finit après le 16 septembre des dates
  --    exactes ci-dessus), donc forcément dans les trois cartes de l'aperçu.
  --    Posée sur une vieille année, elle n'y entrait jamais et le parcours
  --    restait VERT avec le défaut remis : une garde qui ne voit pas la pièce
  --    qu'elle juge ne garde rien ;
  -- 3. dans une année RÉVOLUE, jamais l'année en cours. Calée sur « le mois
  --    dernier », elle ouvrait une porte d'archive pour l'année courante — dont
  --    la page d'année liste aussi le futur — et faisait diverger la garde
  --    « mémoire complète » qui additionne les pages d'année.
  INSERT INTO speaker_talks (speaker_profile_id, titre, type, source)
  VALUES (sp_lea, 'Ce mois-là, sans jour précis', 'Conférence', 'manuel')
  RETURNING id INTO t_courant;
  INSERT INTO talk_occurrences (talk_id, speaker_profile_id, conference, ville, code_insee, region, pays, date)
  VALUES (t_courant, sp_lea, 'Meetup Tech Speak''Her', 'Toulouse', '31555', 'Occitanie', 'France',
          to_char(date_trunc('year', now()) - INTERVAL '1 month', 'YYYY-MM'));

  -- Une fiche NON publiée qui annonce une date : elle ne doit apparaître nulle
  -- part. Cas négatif, sans lequel la garde de périmètre ne garde rien.
  INSERT INTO speaker_talks (speaker_profile_id, titre, type, source)
  SELECT id, 'Talk d''une fiche en attente', 'Conférence', 'manuel'
    FROM speaker_profiles WHERE "userId" = u_yasmine
  RETURNING id INTO t_courant;
  INSERT INTO talk_occurrences (talk_id, speaker_profile_id, conference, ville, pays, date)
  SELECT t_courant, id, 'Conférence Fantôme', 'Nulle Part', 'France',
         to_char(now() + INTERVAL '30 days', 'YYYY-MM-DD')
    FROM speaker_profiles WHERE "userId" = u_yasmine;

END $$;

COMMIT;

-- Vérification rapide (facultatif) :
--   SELECT nom, annee, statut FROM tremplin_editions WHERE conf_slug='devfest-toulouse' ORDER BY annee;
--   SELECT name, email, is_orga, is_coach FROM users WHERE is_orga OR is_coach ORDER BY email;
