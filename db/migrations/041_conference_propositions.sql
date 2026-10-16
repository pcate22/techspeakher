-- Migration 041 — Propositions de conférences par les membres (modération).
-- Une speakeuse peut signaler une conférence manquante ; la proposition attend
-- ici jusqu'à ce qu'une orga la valide (promotion → conferences +
-- conference_editions) ou la refuse. Rien dans cette table n'est lu par les
-- sélecteurs ni le moissonneur : aucune donnée non validée ne fuit dans le
-- répertoire. Idempotente.
CREATE TABLE IF NOT EXISTS conference_propositions (
  id           SERIAL PRIMARY KEY,
  nom          TEXT NOT NULL,
  annee        INTEGER,
  ville        TEXT,
  url          TEXT,
  endpoint     TEXT,
  propose_par  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
