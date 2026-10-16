import { timingSafeEqual } from "node:crypto";

/**
 * Le secret reçu est-il le bon ? Comparaison à temps constant (pas de fuite de
 * longueur ni de contenu par le temps de réponse). Un secret absent de
 * l'environnement refuse tout : une route gardée reste fermée tant qu'on ne
 * l'a pas configurée.
 */
export function secretValide(secret: string | undefined, recu: string | null): boolean {
  if (!secret || !recu) return false;
  const attendu = Buffer.from(secret);
  const donne = Buffer.from(recu);
  return attendu.length === donne.length && timingSafeEqual(attendu, donne);
}

/**
 * Autorise une requête de cron : Vercel Cron envoie
 * `Authorization: Bearer <CRON_SECRET>` quand CRON_SECRET est défini.
 *
 * Un refus se DIT dans les logs. Le 2026-10-15, la variable manquait en
 * production : tous les crons (`/api/cron/*`) répondaient 401 sans rien
 * écrire, et la panne passait pour du silence. Le jeton reçu n'est jamais écrit.
 */
export function isAuthorizedCron(authHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error(
      "[cron] CRON_SECRET absent de l'environnement : tous les crons sont refusés (401). À poser dans Vercel, cf. docs/exploitation.md.",
    );
    return false;
  }
  const ok = secretValide(`Bearer ${secret}`, authHeader);
  if (!ok) console.warn("[cron] appel refusé (401) : jeton absent ou invalide.");
  return ok;
}
