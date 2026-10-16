import { BASE_URL } from "@/constants/site";
import { listPublications, type Contenu } from "@/lib/contenus";

/**
 * Flux RSS 2.0 des actualités Tech Speak'Her, lu EN BASE (instantané : une
 * publication apparaît dès sa publication, sans redéploiement).
 *
 * Déclencheur d'automatisations (Zapier / Buffer → LinkedIn). ⚠️ On n'émet que
 * les publications `au_flux = true` : le contenu historique seedé (`au_flux =
 * false`) reste HORS flux, pour ne pas être republié sur LinkedIn.
 *
 * URL : https://techspeakher.fr/feed.xml
 */
export const dynamic = "force-dynamic";

/** Échappe les caractères réservés XML. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** URL cliquable : page article si corps, sinon lien externe/interne, sinon /actualites. */
function itemUrl(c: Contenu): string {
  if (c.corps.trim()) return `${BASE_URL}/articles/${c.slug}`;
  if (c.lienExterne) return c.lienExterne;
  if (c.lien) return `${BASE_URL}${c.lien}`;
  return `${BASE_URL}/actualites`;
}

export async function GET() {
  let publications: Contenu[] = [];
  try {
    // Publications publiées ET au flux (exclut l'historique seedé).
    publications = (await listPublications()).filter((p) => p.auFlux);
  } catch (err) {
    console.error("Flux RSS : base indisponible", err);
  }

  const lastBuildDate = new Date().toUTCString();

  const items = publications
    .map((c) => {
      const url = itemUrl(c);
      // publie_le est 'YYYY-MM-DD' ; maj_le est un timestamp complet — on ne garde
      // que la date (slice) pour éviter un « Invalid Date » sur le fallback.
      const jour = (c.publieLe ?? c.majLe).slice(0, 10);
      const pubDate = new Date(`${jour}T00:00:00Z`).toUTCString();
      const description = c.chapo ?? c.titre;
      const guid = `${url}#${c.slug}`;
      return `    <item>
      <title>${escapeXml(c.titre)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="false">${escapeXml(guid)}</guid>
      ${c.categorie ? `<category>${escapeXml(c.categorie)}</category>` : ""}
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(description)}</description>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Tech Speak'Her — Actualités</title>
    <link>${BASE_URL}/actualites</link>
    <atom:link href="${BASE_URL}/feed.xml" rel="self" type="application/rss+xml" />
    <description>Meetups, talks, interviews, Tremplin DevFest et vie de la communauté Tech Speak'Her à Toulouse.</description>
    <language>fr-FR</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
