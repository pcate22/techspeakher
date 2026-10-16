/**
 * Récupère les icônes des conférences du catalogue d'amorçage et les dépose
 * dans `public/conferences/<slug>.<ext>`, puis affiche les lignes à coller dans
 * `src/data/logos-conferences.ts`.
 *
 *   npm run logos:conferences            # les conférences sans logo déposé
 *   npm run logos:conferences -- --force # re-télécharge tout
 *   npm run logos:conferences -- devfest-toulouse mixit   # ciblé
 *
 * Pourquoi rapatrier plutôt que pointer le logo chez la conf : la CSP du site
 * n'autorise que `img-src 'self'`, et un logo distant ferait fuiter l'IP de
 * chaque visiteuse vers le site de la conférence.
 *
 * À lancer depuis un poste avec un accès réseau ouvert (l'environnement CI et
 * les agents n'atteignent pas les sites des confs).
 */

import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CONFERENCES_SEED } from "../src/data/conferences-seed.ts";
import { slugify } from "../src/lib/slug.ts";

const DOSSIER = path.join(process.cwd(), "public", "conferences");
const TIMEOUT_MS = 15_000;
const TAILLE_MAX = 300 * 1024; // au-delà, ce n'est plus une icône

const EXTENSIONS = {
  "image/svg+xml": "svg",
  "image/png": "png",
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
};

const args = process.argv.slice(2);
const force = args.includes("--force");
const cibles = args.filter((a) => !a.startsWith("--"));

async function recuperer(url, accept) {
  const res = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      accept,
      // Se présenter honnêtement : c'est un script d'association, pas un bot masqué.
      "user-agent": "TechSpeakHer-logos/1.0 (+https://techspeakher.fr)",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

/**
 * Icônes déclarées par une page HTML, de la meilleure à la moins bonne :
 * SVG d'abord (net à toutes les tailles), puis apple-touch-icon (180 px, fond
 * plein), puis les autres, la plus grande taille annoncée d'abord.
 */
function iconesDeclarees(html, base) {
  const liens = [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]);
  const candidats = [];
  for (const lien of liens) {
    const rel = lien.match(/\brel\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
    const href = lien.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!rel || !href || !/\bicon\b/.test(rel)) continue;
    const tailles = lien.match(/\bsizes\s*=\s*["'](\d+)x\d+["']/i)?.[1];
    const type = lien.match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
    let url;
    try {
      url = new URL(href, base).toString();
    } catch {
      continue;
    }
    const svg = type === "image/svg+xml" || /\.svg(\?|$)/i.test(url);
    const apple = rel.includes("apple-touch-icon");
    candidats.push({ url, score: (svg ? 10_000 : 0) + (apple ? 500 : 0) + Number(tailles ?? 0) });
  }
  return candidats.sort((a, b) => b.score - a.score).map((c) => c.url);
}

async function telecharger(url) {
  const res = await recuperer(url, "image/svg+xml,image/png,image/webp,image/*");
  const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  const ext = EXTENSIONS[type];
  if (!ext) throw new Error(`type non géré : ${type || "inconnu"}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0) throw new Error("fichier vide");
  if (buf.length > TAILLE_MAX) throw new Error(`trop lourd (${Math.round(buf.length / 1024)} Ko)`);
  return { buf, ext };
}

async function pourUneConference(conf) {
  const slug = slugify(conf.nom);
  if (cibles.length > 0 && !cibles.includes(slug)) return null;
  if (!conf.siteUrl) return { slug, erreur: "pas de site dans le catalogue" };
  if (!force && existsSync(DOSSIER) && trouveFichier(slug)) {
    return { slug, deja: true };
  }

  let urls = [];
  try {
    const page = await recuperer(conf.siteUrl, "text/html");
    urls = iconesDeclarees(await page.text(), page.url);
  } catch (e) {
    // Page inaccessible : /favicon.ico reste jouable.
    urls = [];
    if (process.env.DEBUG) console.error(`  ${slug} : page illisible (${e.message})`);
  }
  urls.push(new URL("/favicon.ico", conf.siteUrl).toString());

  for (const url of urls) {
    try {
      const { buf, ext } = await telecharger(url);
      mkdirSync(DOSSIER, { recursive: true });
      const fichier = `${slug}.${ext}`;
      writeFileSync(path.join(DOSSIER, fichier), buf);
      return { slug, fichier, url, taille: buf.length };
    } catch (e) {
      if (process.env.DEBUG) console.error(`  ${slug} : ${url} → ${e.message}`);
    }
  }
  return { slug, erreur: "aucune icône exploitable" };
}

function trouveFichier(slug) {
  return Object.values(EXTENSIONS).some((ext) =>
    existsSync(path.join(DOSSIER, `${slug}.${ext}`)),
  );
}

const resultats = [];
for (const conf of CONFERENCES_SEED) {
  const r = await pourUneConference(conf);
  if (r) resultats.push({ nom: conf.nom, ...r });
}

const recuperes = resultats.filter((r) => r.fichier);
const deja = resultats.filter((r) => r.deja);
const rates = resultats.filter((r) => r.erreur);

console.log(`\n${recuperes.length} icône(s) récupérée(s), ${deja.length} déjà là, ${rates.length} sans icône.\n`);

if (recuperes.length > 0) {
  console.log("À coller dans src/data/logos-conferences.ts :\n");
  for (const r of recuperes.sort((a, b) => a.slug.localeCompare(b.slug))) {
    console.log(`  "${r.slug}": "${r.fichier}",`);
  }
  console.log(
    "\nRelire les fichiers déposés (une icône illisible en 44 px vaut moins qu'un monogramme),",
    "\npuis `npm run test` : un test vérifie déclaratif ↔ fichiers.\n",
  );
}

if (rates.length > 0) {
  console.log("Sans icône (monogramme, rien à faire) :");
  for (const r of rates) console.log(`  ${r.slug} — ${r.erreur}`);
}
