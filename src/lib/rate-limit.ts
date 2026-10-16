/**
 * Limiteur de débit best-effort, en mémoire.
 *
 * ⚠️ Par instance serverless : remis à zéro au cold start et NON partagé entre
 * instances. C'est un garde-fou anti-abus (spam d'e-mails, quota Brevo), pas une
 * limite stricte. Pour du strict, prévoir un store durable (Redis/Upstash).
 */
type Entry = { count: number; reset: number };
const store = new Map<string, Entry>();

/**
 * Incrémente le compteur de `key` et indique si la limite est dépassée.
 * @param key    clé de regroupement (ex. `magic:ip:1.2.3.4`)
 * @param limit  nombre d'actions autorisées par fenêtre
 * @param windowMs durée de la fenêtre, en millisecondes
 */
export function isRateLimited(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry || now > entry.reset) {
    // Purge opportuniste des entrées expirées pour borner la mémoire.
    if (store.size > 500) {
      for (const [k, v] of store) if (now > v.reset) store.delete(k);
    }
    store.set(key, { count: 1, reset: now + windowMs });
    return false;
  }
  entry.count++;
  return entry.count > limit;
}

/** Adresse IP cliente depuis les en-têtes (x-forwarded-for), ou "unknown". */
export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/**
 * Anti-abus de l'envoi de lien magique : 5 demandes/min/IP et 3/min/adresse.
 * Évite le spam de liens vers des tiers et l'abus du quota d'e-mails.
 */
export function isMagicLinkThrottled(ip: string, email: string): boolean {
  return (
    isRateLimited(`magic:ip:${ip}`, 5, 60_000) ||
    isRateLimited(`magic:mail:${email.toLowerCase()}`, 3, 60_000)
  );
}
