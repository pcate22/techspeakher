import type { MetadataRoute } from "next";
import { BASE_URL, HELLOASSO_ADHESION_URL } from "@/constants/site";
import { getPublishedAnnuaire, speakeuseHref } from "@/lib/profiles";
import { listArticlesPublies, listPagesPubliees } from "@/lib/contenus";
import { getAnneesArchive } from "@/lib/agenda-public";
import { aujourdhuiParis } from "@/lib/tremplin-statut";
import { listEditionsPubliques } from "@/lib/tremplin-editions";
import { getPublicEdition, aUnChapitreMonteeSurScene } from "@/lib/tremplin-public";

// Dynamique : le sitemap inclut les fiches publiées (lues en base).
export const dynamic = "force-dynamic";

/**
 * Charge une source dynamique et la projette en entrées de sitemap, avec repli
 * résilient : si la lecture échoue (base indisponible), on log et on renvoie []
 * plutôt que de casser tout le sitemap.
 */
async function collectRoutes<T>(
  label: string,
  load: () => Promise<T[]>,
  toRoute: (item: T) => MetadataRoute.Sitemap[number],
): Promise<MetadataRoute.Sitemap> {
  try {
    return (await load()).map(toRoute);
  } catch (err) {
    console.error(`Sitemap : ${label} indisponible`, err);
    return [];
  }
}

/**
 * Les éditions du Tremplin naissent en base : écrites en dur ici, une
 * nouvelle édition n'entrait pas seule et un tombstone (noindex) restait
 * listé. La « montée sur scène » ne se liste que si l'édition a un chapitre 2
 * — MÊME prédicat que le 404 de sa page (source unique) : un sitemap qui
 * pointe des 404 fait ce que ce prédicat existe pour empêcher. Le DTO par
 * édition coûte quelques requêtes × une poignée d'éditions.
 */
async function routesEditionsTremplin(now: Date): Promise<MetadataRoute.Sitemap> {
  const editions = await listEditionsPubliques();
  const parEdition = await Promise.all(
    editions.map(async (e): Promise<MetadataRoute.Sitemap> => {
      const base = `${BASE_URL}/tremplin/${e.confSlug}/${e.annee}`;
      // Résilience PAR ÉDITION : une erreur transitoire sur le DTO sacrifie
      // la seule sous-page de cette édition, jamais les URLs de base des autres.
      const dto = await getPublicEdition(e.confSlug, e.annee).catch(() => null);
      const entrees: MetadataRoute.Sitemap = [
        { url: base, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
      ];
      // Le second temps de l'édition : l'accompagnement d'après-finale vers
      // la scène. Une page à part (autre cohorte, autre calendrier), donc une
      // entrée à part — sans quoi elle existe sans être trouvable.
      if (dto !== null && dto !== "deleted" && aUnChapitreMonteeSurScene(dto)) {
        entrees.push({
          url: `${base}/montee-sur-scene`,
          lastModified: now,
          changeFrequency: "monthly",
          priority: 0.8,
        });
      }
      return entrees;
    }),
  );
  return parEdition.flat();
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE_URL}/devfest-toulouse`, lastModified: now, changeFrequency: "weekly", priority: 0.95 },
    { url: `${BASE_URL}/a-propos`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/tremplin`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE_URL}/speakeuses`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    // Agenda : « weekly » (il bouge dès qu'une speakeuse annonce une date).
    { url: `${BASE_URL}/agenda`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE_URL}/actualites`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE_URL}/partenaires`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/benevole`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/kit-de-communication`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
    { url: `${BASE_URL}/conferences`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE_URL}/contact`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
    { url: `${BASE_URL}/code-de-conduite`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    // /adherer reste hors index tant que la campagne n'est pas renseignée.
    ...(HELLOASSO_ADHESION_URL
      ? [{ url: `${BASE_URL}/adherer`, lastModified: now, changeFrequency: "yearly" as const, priority: 0.6 }]
      : []),
    { url: `${BASE_URL}/mentions-legales`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/brand/tokens.json`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE_URL}/llms.txt`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE_URL}/feed.xml`, lastModified: now, changeFrequency: "weekly", priority: 0.5 },
  ];

  // Sources dynamiques (fiches, articles, pages), lues en parallèle. Chacune
  // est résiliente indépendamment : une base/table indisponible renvoie [] sans
  // casser le sitemap ni les autres sources.
  const [ficheRoutes, articleRoutes, anneeRoutes, pageRoutes, editionRoutes] = await Promise.all([
    collectRoutes("annuaire", getPublishedAnnuaire, (p) => ({
      url: `${BASE_URL}${speakeuseHref(p)}`,
      lastModified: p.updatedAt ? new Date(p.updatedAt) : now,
      changeFrequency: "monthly",
      priority: 0.7,
    })),
    collectRoutes("articles", listArticlesPublies, (a) => ({
      url: `${BASE_URL}/articles/${a.slug}`,
      lastModified: a.majLe ? new Date(a.majLe) : now,
      changeFrequency: "monthly",
      priority: 0.6,
    })),
    // Les comptes rendus d'année de l'agenda. Ils naissent en base (une année
    // existe dès qu'une intervention passée s'y range) : les lister à la main
    // reviendrait à oublier la suivante. `changeFrequency` reste « monthly » —
    // une année révolue bouge encore, car le passé se remplit à retardement, à
    // mesure que les speakeuses complètent leur fiche.
    collectRoutes(
      "années d'agenda",
      () => getAnneesArchive(aujourdhuiParis()),
      (a) => ({
        url: `${BASE_URL}/agenda/${a.annee}`,
        lastModified: now,
        changeFrequency: "monthly" as const,
        priority: 0.6,
      }),
    ),
    collectRoutes("pages", listPagesPubliees, (p) => ({
      url: `${BASE_URL}/${p.slug}`,
      lastModified: p.majLe ? new Date(p.majLe) : now,
      changeFrequency: "monthly",
      priority: 0.5,
    })),
    // collectRoutes ne sert ici que de toit résilient : les entrées sont déjà
    // construites par la fonction (une édition → une ou deux URLs).
    collectRoutes("éditions Tremplin", () => routesEditionsTremplin(now), (r) => r),
  ]);

  return [...staticRoutes, ...ficheRoutes, ...articleRoutes, ...anneeRoutes, ...pageRoutes, ...editionRoutes];
}
