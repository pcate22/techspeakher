-- 065 — Correction de DONNÉES : la date du talk DevFest Toulouse 2026 de Leïla
-- Gazeilles était restée imprécise ("2026" seul) alors que celle des autres
-- speakeuses du line-up (Sandrine, Camille, Montaine : migration 042/043) a été
-- posée exacte ("2026-11-19"). Conséquence visible : dans l'agenda public
-- (lib/agenda-public.ts), une date imprécise se range à part sous « courant
-- 2026 » au lieu d'apparaître groupée avec le reste du DevFest au 19 novembre
-- (règle documentée et testée dans agenda-public.test.ts).
--
-- La donnée affichée par l'agenda public vit dans talk_occurrences.date depuis
-- la migration 044 (speaker_talks n'est plus lu que comme identité) : c'est
-- donc cette colonne qu'on corrige ici, pas speaker_talks.
--
-- Ponctuelle ET idempotente : cible la seule occurrence DevFest Toulouse 2026
-- de Leïla Gazeilles (résolue par nom, comme 042/043 — aucune donnée
-- personnelle en dur), et seulement si sa date n'est pas déjà au format exact
-- AAAA-MM-JJ (ne réécrit jamais une correction ultérieure faite depuis
-- « Mon espace »).
UPDATE talk_occurrences o
   SET date = '2026-11-19'
  FROM speaker_talks t
  JOIN speaker_profiles sp ON sp.id = t.speaker_profile_id
  JOIN users u ON u.id = sp."userId",
       conferences c
  JOIN conference_editions ce ON ce.conference_id = c.id
 WHERE o.talk_id = t.id
   AND o.edition_id = ce.id
   AND c.slug = 'devfest-toulouse'
   AND ce.annee = 2026
   AND lower(u.name) = 'leïla gazeilles'
   AND o.date !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$';
