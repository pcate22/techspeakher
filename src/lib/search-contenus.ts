import { listContenusPourRecherche, type ContenuRecherche } from "@/lib/contenus";
import { destinationContenu } from "@/lib/carte-actu";
import { texteBrut, couperSurUnMot } from "@/lib/texte-markdown";
import { dateLongueFr } from "@/lib/format";
import { estSlugReserve } from "@/data/slugs-reserves";
import type { SearchItem } from "@/data/search-index";

/**
 * Les contenus éditoriaux PUBLIÉS comme source de la recherche (⌘K).
 *
 * Pendant de `getSpeakerSearchItems` (src/lib/search.ts) pour l'autre source en
 * base. Avant ce lot, la recherche indexait la GRAINE du dépôt
 * (`src/data/actualites.ts`) : publier depuis l'éditeur ne rendait rien
 * trouvable, et tous les résultats menaient à la liste `/actualites` plutôt
 * qu'à l'article.
 *
 * Conception : docs/conception-recherche-contenus.md.
 */

/** Longueur de l'aperçu construit à partir du corps, faute de chapô. */
export const APERCU_MAX = 160;

/**
 * Destination d'un contenu DANS LA PALETTE, ou null s'il n'y entre pas.
 *
 * Où vit un contenu est une règle partagée (`destinationContenu`). Ce qui est
 * PROPRE à la palette, c'est la politique d'admission, et elle seule vit ici :
 *  - **rien à ouvrir** : un résultat sans destination est une impasse ;
 *  - **destination hors du site** : la palette est une liste d'options de
 *    combobox, pas de liens. Elle ne peut donc pas prévenir qu'on quitte le
 *    site ni qu'une fenêtre s'ouvre (RGAA 13.2). Une annonce purement externe
 *    reste cliquable là où elle est un vrai lien : `/actualites` et l'accueil.
 *  - **adresse masquée par une route du code** : le formulaire refuse désormais
 *    un tel slug, mais une page enregistrée AVANT cette garde existe peut-être.
 *    Son résultat mènerait à la page codée, pas à elle : autant ne pas la
 *    proposer (même règle, `estSlugReserve`).
 */
function urlDansLaPalette(c: ContenuRecherche): string | null {
  if (c.type === "page" && estSlugReserve(c.slug)) return null;
  const { href, externe } = destinationContenu(c);
  return href && !externe ? href : null;
}

export async function getContenuSearchItems(): Promise<SearchItem[]> {
  try {
    const contenus = await listContenusPourRecherche();
    const items: SearchItem[] = [];
    for (const c of contenus) {
      const url = urlDansLaPalette(c);
      if (!url) continue;
      // Le corps arrive tronqué par SQL, donc coupé au milieu d'un mot : on le
      // nettoie de sa syntaxe avant d'en tirer quoi que ce soit de lisible.
      const corps = texteBrut(c.extraitCorps);
      // L'aperçu : le chapô, sinon le début du corps. À défaut des deux,
      // l'adresse — une option amputée de sa deuxième ligne ne dit plus ce
      // qu'elle ouvre. La date vit à côté (voir `SearchItem.date`).
      const description = c.chapo ?? couperSurUnMot(corps, APERCU_MAX) ?? "";
      items.push({
        title: c.titre,
        // Repère temporel d'une pile de « Retour sur le meetup », que l'index
        // d'avant portait déjà et que la carte affiche toujours.
        date: dateLongueFr(c.publieLe) ?? undefined,
        dateISO: c.publieLe ?? undefined,
        description: description || url,
        url,
        category: c.categorie ?? (c.type === "page" ? "Page" : "Actualité"),
        // Plein-texte indexé mais NON affiché : retrouver un article par une
        // phrase de son ouverture, comme on retrouve une speakeuse par sa bio.
        // Omis quand l'aperçu le montre DÉJÀ en entier — sinon Fuse scannerait
        // deux fois le même texte à chaque frappe, et on l'enverrait deux fois.
        keywords: corps && corps !== description ? corps : undefined,
      });
    }
    return items;
  } catch {
    // La recherche est un confort : une base indisponible la rend moins bonne
    // (pages statiques, FAQ et speakeuses restent), jamais en panne.
    return [];
  }
}
