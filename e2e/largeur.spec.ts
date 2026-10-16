import { test, expect, type Page } from "@playwright/test";
import {
  PAGES_PUBLIQUES,
  PAGES_AVEC_DONNEES,
  PAGES_MEMBRE,
  PAGES_ORGA,
} from "./pages-publiques";
import { exigerDecor, COMPTES } from "./decor";
import { seConnecter } from "./session";

/**
 * Garde-fou « aucun débordement horizontal » : sur mobile, une page plus large
 * que l'écran se fait couper à droite (html/body sont en `overflow-x: clip`,
 * le contenu qui dépasse devient invisible). On vérifie sur chaque page
 * publique que rien ne dépasse du viewport, et on NOMME les coupables pour que
 * l'échec soit actionnable. Agnostique aux données (états vides compris).
 */


/** Les éléments qui dépassent, nommés pour que l'échec soit actionnable. */
async function coupablesDe(page: Page, path: string): Promise<string[]> {
  await page.goto(path);
  return page.evaluate(() => {
        const limite = document.documentElement.clientWidth + 1;
        const defilable = (el: Element): boolean => {
          for (let p = el.parentElement; p; p = p.parentElement) {
            const o = getComputedStyle(p).overflowX;
            if (o === "auto" || o === "scroll") return true;
          }
          return false;
        };
        const trop: string[] = [];
        for (const el of Array.from(document.querySelectorAll("body *"))) {
          const r = el.getBoundingClientRect();
          // On ignore les éléments décoratifs volontairement hors cadre (halos
          // en position absolue, sans texte : clippés par html/body, ils ne
          // gênent pas la lecture) et les zones à défilement horizontal
          // VOULU (fil d'Ariane, tableaux).
          if (r.right > limite && r.width > 0 && el.textContent?.trim() && !defilable(el)) {
            const cls = (el as HTMLElement).className;
            trop.push(`${el.tagName.toLowerCase()}.${String(cls).slice(0, 80)}`);
          }
        }
    return trop.slice(0, 5);
  });
}

const attendreAucunDebordement = (coupables: string[]) =>
  expect(coupables, `Éléments plus larges que l'écran : ${coupables.join(" | ")}`).toEqual([]);

test.describe("Largeur des pages", () => {
  for (const path of PAGES_PUBLIQUES) {
    test(`${path} ne déborde pas du viewport`, async ({ page }) => {
      attendreAucunDebordement(await coupablesDe(page, path));
    });
  }
});

/**
 * Les pages PEUPLÉES : c'est le contenu réel qui déborde, pas la coquille. Une
 * carte de speakeuse à long intitulé, une galerie de portraits, un palmarès —
 * rien de tout ça n'existait dans l'état vide qu'auditait cette porte.
 */
test.describe("Largeur des pages peuplées", () => {
  test.beforeEach(async ({ request }) => {
    await exigerDecor(request);
  });

  for (const path of PAGES_AVEC_DONNEES) {
    test(`${path} ne déborde pas du viewport`, async ({ page }) => {
      attendreAucunDebordement(await coupablesDe(page, path));
    });
  }
});

/**
 * LES ESPACES CONNECTÉS. L'espace orga est la surface la plus dense en tableaux
 * et en listes longues du produit — donc la plus exposée au débordement mobile,
 * et la seule qu'aucune porte n'avait jamais mesurée.
 */
for (const [role, chemins] of [
  ["membre", PAGES_MEMBRE],
  ["orga", PAGES_ORGA],
] as const) {
  test.describe(`Largeur — espace ${role}`, () => {
    test.beforeEach(async ({ request, context }) => {
      await exigerDecor(request);
      await seConnecter(context, COMPTES[role]);
    });

    for (const path of chemins) {
      test(`${path} ne déborde pas du viewport`, async ({ page }) => {
        attendreAucunDebordement(await coupablesDe(page, path));
      });
    }
  });
}

/**
 * LE HEADER, AUTOUR DE SON POINT DE RUPTURE. Entre 1024 et ~1280 px, la nav
 * desktop débordait sans rien dépasser du viewport : « À propos » recouvrait le
 * nom à côté du logo, les libellés passaient sur deux lignes (2026-10-14), et
 * l'arrivée de « Partenaires » a mangé ce qui restait de marge (2026-10-15). La
 * porte ci-dessus, qui ne mesure que le bord droit de l'écran, était aveugle à
 * ce chevauchement interne. Décision : le burger tient jusqu'à `xl` (1280 px).
 */
/** Ce que le texte d'un élément DESSINE : son bord droit, son bord gauche et
 * son nombre de lignes. La boîte ment ici : sous la pression du flex, celle du
 * logo rétrécit pendant que son nom déborde par-dessus, et un bouton en flex
 * reste une seule boîte quand son libellé passe à la ligne. */
const texteDessine = (el: Element) => {
  const range = document.createRange();
  range.selectNodeContents(el);
  const rects = Array.from(range.getClientRects());
  return {
    gauche: Math.min(...rects.map((r) => r.left)),
    droite: Math.max(...rects.map((r) => r.right)),
    lignes: new Set(rects.map((r) => Math.round(r.top))).size,
  };
};

test.describe("Header autour de son point de rupture", () => {
  // Sous `xl`, le burger : la nav desktop n'a pas la place.
  for (const largeur of [1024, 1279]) {
    test(`à ${largeur} px, le burger remplace la nav desktop`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 700 });
      await page.goto("/");
      const header = page.locator("header nav[aria-label='Navigation principale']");
      await expect(header.getByRole("button", { name: "Ouvrir le menu" })).toBeVisible();
      await expect(header.getByRole("link", { name: "Agenda", exact: true })).toBeHidden();
    });
  }

  // Dès `xl`, la nav desktop, sans chevauchement ni retour à la ligne. 1280 est
  // le cas serré ; 1440 et 1536 couvrent les portables courants.
  for (const largeur of [1280, 1366, 1440, 1536]) {
    test(`à ${largeur} px, la nav ne chevauche pas le logo et tient sur une ligne`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 700 });
      await page.goto("/");
      // Mesurer la vraie police, pas son repli (font-display: swap).
      await page.evaluate(() => document.fonts.ready);
      const header = page.locator("header nav[aria-label='Navigation principale']");
      const logo = await header
        .getByRole("link", { name: "Tech Speak'Her, accueil" })
        .evaluate(texteDessine);
      const liens = header.locator("ul[role='list'] a, a[href='/connexion'], a[href='/mon-espace']");
      const n = await liens.count();
      expect(n).toBeGreaterThan(0);
      for (let i = 0; i < n; i++) {
        const lien = liens.nth(i);
        const nom = (await lien.textContent())?.trim();
        const t = await lien.evaluate(texteDessine);
        expect(t.gauche, `« ${nom} » chevauche le logo`).toBeGreaterThanOrEqual(logo.droite);
        expect(t.lignes, `« ${nom} » passe sur deux lignes`).toBe(1);
      }
    });
  }
});

/**
 * LE MENU COMPTE ENTRE `lg` ET `xl`. Le burger a pris la bande 1024-1279 px
 * (#365) et l'avatar, rangé dans la nav desktop, est parti avec : une connectée
 * sur un portable perdait son compte, le site public n'ayant pas de barre
 * d'onglets (2026-10-15). Sous `lg`, le tiroir porte « Mon espace » (N1 §2.2).
 */
test.describe("Menu compte autour du point de rupture", () => {
  test.beforeEach(async ({ request, context }) => {
    await exigerDecor(request);
    await seConnecter(context, COMPTES.membre);
  });

  for (const [largeur, visibles] of [
    [900, 0],
    [1024, 1],
    [1279, 1],
    [1280, 1],
  ] as const) {
    test(`à ${largeur} px, ${visibles} menu compte visible dans l'en-tête`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 700 });
      await page.goto("/speakeuses");
      const boutons = page.locator("header").getByRole("button", { name: /mon compte/i, includeHidden: true });
      // Le menu compte est chargé à la demande (next/dynamic) : sans attendre
      // qu'il soit LÀ, « 0 visible » passerait avant son arrivée.
      await expect(boutons).toHaveCount(2);
      await expect(boutons.filter({ visible: true })).toHaveCount(visibles);
    });
  }
});

/**
 * UNE SEULE PORTE VERS L'ESPACE. Entre `lg` et `xl`, l'avatar est dans
 * l'en-tête : le tiroir ouvert y montrait EN PLUS la porte « Mon espace »,
 * deux chemins visibles vers la même cible (revue du 2026-10-15). La porte du
 * tiroir ne sert que sous `lg`, là où l'avatar est absent.
 */
test.describe("Porte « Mon espace » du tiroir", () => {
  test.beforeEach(async ({ request, context }) => {
    await exigerDecor(request);
    await seConnecter(context, COMPTES.membre);
  });

  for (const [largeur, visible] of [
    [900, true],
    [1100, false],
  ] as const) {
    test(`à ${largeur} px, tiroir ouvert, la porte est ${visible ? "visible" : "absente"}`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 700 });
      await page.goto("/speakeuses");
      // La session se lit côté client : sans attendre qu'elle soit connue
      // (le menu compte monté), « absente » passerait avant son arrivée.
      await expect(
        page.locator("header").getByRole("button", { name: /mon compte/i, includeHidden: true }),
      ).toHaveCount(2);
      await page.getByRole("button", { name: "Ouvrir le menu" }).click();
      const tiroir = page.locator("#mobile-menu");
      await expect(tiroir.getByRole("link", { name: "Accueil du site" })).toBeVisible();
      const porte = tiroir.getByRole("link", { name: "Mon espace", exact: true });
      if (visible) await expect(porte).toBeVisible();
      else await expect(porte).toBeHidden();
    });
  }
});
