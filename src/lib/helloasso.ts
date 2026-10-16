import { HELLOASSO_ADHESION_URL } from "@/constants/site";
import { isValidEmail } from "@/lib/profile-form";

/**
 * Client de l'API HelloAsso (v5), réduit à ce dont les adhésions ont besoin.
 * Conception : docs/conception-adhesions-helloasso.md.
 *
 * Deux règles portent tout le module :
 *
 * 1. **La notification n'est jamais crue.** HelloAsso ne signe pas ses
 *    notifications : n'importe qui peut en poster une. On n'en garde que
 *    l'identifiant de commande, et `lireCommande` va relire la commande par
 *    l'API, avec nos identifiants. Une fausse notification ne peut donc que
 *    déclencher la relecture d'une vraie commande.
 * 2. **L'adresse rapprochée est celle du MEMBRE, jamais celle du payeur**
 *    (décision du 2026-10-15) : une même personne peut inscrire plusieurs
 *    membres dans une commande. Rapprocher le payeur lui donnerait leurs
 *    adhésions. Chaque article (un membre) porte l'adresse demandée pour lui,
 *    dans les champs du formulaire.
 *
 * Sans identifiants (preview, local), `helloassoConfig()` rend null et la
 * synchro est inerte, comme celle de Brevo.
 */

export interface HelloAssoConfig {
  clientId: string;
  clientSecret: string;
  apiUrl: string;
  organisation: string;
  formulaire: string;
}

/** Une adhésion telle que la plateforme la retient : rien d'autre ne sort de
 *  HelloAsso (ni montant, ni nom, ni autres réponses — minimisation RGPD). */
export interface AdhesionHelloAsso {
  itemId: number;
  /** Date de la commande (ISO) : l'adhésion court 12 mois à partir d'elle. */
  date: string;
  /** Adresses du MEMBRE, en minuscules. Vide = ne se rapproche de personne. */
  emails: string[];
}

/** L'organisation et le formulaire, lus dans l'URL publique de la campagne
 *  (`/associations/{organisation}/adhesions/{formulaire}`) : une seule source. */
export function campagneAdhesion(
  url: string,
): { organisation: string; formulaire: string } | null {
  const m = url.match(/\/associations\/([^/?#]+)\/adhesions\/([^/?#]+)/);
  return m ? { organisation: m[1], formulaire: m[2] } : null;
}

export function helloassoConfig(): HelloAssoConfig | null {
  const clientId = process.env.HELLOASSO_CLIENT_ID?.trim();
  const clientSecret = process.env.HELLOASSO_CLIENT_SECRET?.trim();
  const campagne = campagneAdhesion(HELLOASSO_ADHESION_URL);
  if (!clientId || !clientSecret || !campagne) return null;
  return {
    clientId,
    clientSecret,
    apiUrl: process.env.HELLOASSO_API_URL?.trim() || "https://api.helloasso.com",
    ...campagne,
  };
}

/**
 * États d'un article qui valent adhésion : payé (`Processed`) ou inscrit sans
 * paiement (`Registered`, l'adhésion gratuite sur déclaration). Liste BLANCHE :
 * un état inconnu, un remboursement ou une annulation ne vaut rien.
 */
const ETATS_VALIDES = new Set(["Processed", "Registered"]);

type Brut = Record<string, unknown>;
const objet = (v: unknown): Brut | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Brut) : null;

function emailsDuMembre(article: Brut): string[] {
  const champs = Array.isArray(article.customFields) ? article.customFields : [];
  const emails = champs
    .map((c) => objet(c)?.answer)
    .filter((a): a is string => typeof a === "string")
    .map((a) => a.trim().toLowerCase())
    .filter(isValidEmail);
  return [...new Set(emails)];
}

function adhesionDArticle(article: Brut, dateCommande: unknown): AdhesionHelloAsso | null {
  if (article.type !== "Membership") return null;
  if (typeof article.state !== "string" || !ETATS_VALIDES.has(article.state)) return null;
  const id = Number(article.id);
  const date = new Date(String(dateCommande ?? ""));
  if (!Number.isSafeInteger(id) || Number.isNaN(date.getTime())) return null;
  return { itemId: id, date: date.toISOString(), emails: emailsDuMembre(article) };
}

/** Les adhésions d'une commande relue par l'API — vide si elle n'est pas du
 *  formulaire d'adhésion (le soutien des membres bienfaitrices n'en est pas). */
export function adhesionsDeCommande(
  brut: unknown,
  cfg: Pick<HelloAssoConfig, "organisation" | "formulaire">,
): AdhesionHelloAsso[] {
  const c = objet(brut);
  if (!c || !Array.isArray(c.items)) return [];
  if (
    c.organizationSlug !== cfg.organisation ||
    c.formType !== "Membership" ||
    c.formSlug !== cfg.formulaire
  )
    return [];
  return c.items
    .map((i) => objet(i))
    .filter((i): i is Brut => i !== null)
    .map((i) => adhesionDArticle(i, c.date))
    .filter((a): a is AdhesionHelloAsso => a !== null);
}

// ─── Jeton OAuth2 (client credentials) ───

let jeton: { valeur: string; expireA: number } | null = null;

/** Pour les tests : repartir sans jeton en mémoire. */
export function oublierJeton(): void {
  jeton = null;
}

async function obtenirJeton(cfg: HelloAssoConfig): Promise<string> {
  // Marge d'une minute : un jeton qui expire pendant l'appel échouerait.
  if (jeton && jeton.expireA > Date.now() + 60_000) return jeton.valeur;
  const res = await fetch(`${cfg.apiUrl}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
    }),
    cache: "no-store",
  });
  const corps = objet(await res.json().catch(() => null));
  const valeur = corps?.access_token;
  if (!res.ok || typeof valeur !== "string") {
    throw new Error(`HelloAsso : jeton refusé (${res.status})`);
  }
  const duree = Number(corps?.expires_in) || 1800;
  jeton = { valeur, expireA: Date.now() + duree * 1000 };
  return valeur;
}

async function lire(cfg: HelloAssoConfig, chemin: string): Promise<unknown> {
  const res = await fetch(`${cfg.apiUrl}${chemin}`, {
    headers: { Authorization: `Bearer ${await obtenirJeton(cfg)}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HelloAsso : ${chemin} a répondu ${res.status}`);
  return res.json();
}

/** Relit une commande par l'API et en rend les adhésions. */
export async function lireCommande(
  orderId: number,
  cfg: HelloAssoConfig,
): Promise<AdhesionHelloAsso[]> {
  return adhesionsDeCommande(await lire(cfg, `/v5/orders/${orderId}`), cfg);
}

/** Garde-fou : à 100 articles par page, 50 pages couvrent des années. */
const PAGES_MAX = 50;

/** Toutes les adhésions du formulaire, tout l'historique (le rattrapage). */
export async function listerAdhesions(cfg: HelloAssoConfig): Promise<AdhesionHelloAsso[]> {
  const base = `/v5/organizations/${encodeURIComponent(cfg.organisation)}/forms/Membership/${encodeURIComponent(cfg.formulaire)}/items?pageSize=100&withDetails=true`;
  const adhesions: AdhesionHelloAsso[] = [];
  let suite: string | null = null;
  for (let page = 0; page < PAGES_MAX; page++) {
    const corps = objet(
      await lire(cfg, suite ? `${base}&continuationToken=${encodeURIComponent(suite)}` : base),
    );
    const articles = Array.isArray(corps?.data) ? corps.data : [];
    if (articles.length === 0) return adhesions;
    for (const a of articles) {
      const article = objet(a);
      const adhesion = article && adhesionDArticle(article, objet(article.order)?.date);
      if (adhesion) adhesions.push(adhesion);
    }
    const jetonSuite = objet(corps?.pagination)?.continuationToken;
    if (typeof jetonSuite !== "string" || !jetonSuite) return adhesions;
    suite = jetonSuite;
  }
  throw new Error(`HelloAsso : plus de ${PAGES_MAX} pages d'adhésions, lecture interrompue`);
}
