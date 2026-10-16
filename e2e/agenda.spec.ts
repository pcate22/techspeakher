import { test, expect, type Locator, type Page } from "@playwright/test";
import { exigerDecor, AGENDA } from "./decor";

/**
 * L'AGENDA PUBLIC PEUPLÉ — les deux décisions du 2026-08-16, éprouvées en
 * vrai navigateur (docs/audit-ux-agenda-2026-08.md §8).
 *
 * Ce que Vitest ne peut PAS répondre, et qui se joue ici :
 *   • « la lecture est-elle BRANCHÉE ? » — les tests de page mockent la base ;
 *     seule cette suite prouve que la requête, le DTO, le groupement et le
 *     rendu s'enchaînent pour de bon ;
 *   • « la mémoire est-elle vraiment complète ? » — un plafond réintroduit
 *     n'importe où dans la chaîne (SQL, lib, page) se verrait ici et nulle
 *     part ailleurs ;
 *   • « la page d'atterrissage survit-elle au changement d'année ? » — le
 *     décor porte exprès une date au 16 janvier PROCHAIN.
 *
 * Chaque test est écrit pour TOMBER sur une régression précise, jamais pour
 * constater qu'une page s'affiche.
 */

/** Les cartes d'intervention d'une page — ou d'une seule de ses sections. */
function cartes(ou: Page | Locator) {
  return ou.getByRole("link", { name: /Voir sa fiche$/ });
}

/** La section « À venir » : ce que la barre de filtres gouverne. */
function aVenir(page: Page): Locator {
  return page.getByRole("region", { name: /^à venir$/i });
}

test.describe("Agenda public (avec données)", () => {
  test.beforeEach(async ({ request }) => {
    await exigerDecor(request);
  });

  test("l'horizon porte les dates à venir, y compris celle de l'année PROCHAINE", async ({
    page,
  }) => {
    // LA garde de « l'horizon glissant ». Un agenda calé sur l'année civile
    // perdrait cette date, et la page se viderait la dernière semaine de
    // décembre — un défaut qui n'apparaît qu'une semaine par an, donc
    // qu'aucune revue ne verrait passer.
    await page.goto("/agenda");
    await expect(page.getByRole("heading", { name: /^à venir$/i })).toBeVisible();
    await expect(page.getByText(AGENDA.titreJanvierProchain)).toBeVisible();
    // Et une date hors registre reste visible : la jointure au catalogue est
    // LEFT, elle ne doit jamais faire disparaître une saisie en texte libre.
    await expect(page.getByText(AGENDA.titreTexteLibre)).toBeVisible();
  });

  test("le nombre annoncé correspond à ce qui est réellement affiché", async ({ page }) => {
    // Un compteur qui diverge des cartes est pire que pas de compteur : il
    // fait croire qu'on a tout vu.
    await page.goto("/agenda");
    const annonce = await page
      .getByText(/(\d+) interventions? annoncées? à ce jour/i)
      .textContent();
    const attendu = Number(annonce?.match(/(\d+)/)?.[1]);
    expect(attendu).toBe(AGENDA.aVenir);
    await expect(cartes(aVenir(page))).toHaveCount(AGENDA.aVenir);
  });

  test("une fiche NON publiée n'apparaît nulle part, ni à venir ni en archive", async ({
    page,
  }) => {
    // Le périmètre public, éprouvé de bout en bout. Une régression ici
    // publierait le nom et le déplacement d'une personne qui ne l'a pas
    // demandé — le genre de défaut qui ne casse rien à l'écran.
    await page.goto("/agenda");
    await expect(page.getByText(AGENDA.titreFicheNonPubliee)).toHaveCount(0);
  });

  test("l'aperçu du passé et ses portes d'année sont TOUJOURS là", async ({ page }) => {
    await page.goto("/agenda");
    await expect(page.getByRole("heading", { name: /déjà en scène/i })).toBeVisible();
    const annees = page.getByRole("link", { name: /^\d{4}, \d+ intervention/ });
    await expect(annees.first()).toBeVisible();
  });

  test("MÉMOIRE COMPLÈTE : toutes les interventions passées sont atteignables", async ({
    page,
  }) => {
    // Le cœur de la décision. L'ancien plafond (`maxPassees = 12`) cachait les
    // deux tiers de l'archive SANS LE DIRE. Ce test additionne ce que les
    // pages d'année affichent vraiment et le compare au total annoncé : un
    // plafond réintroduit à n'importe quel étage fait diverger les deux.
    await page.goto("/agenda");
    const total = await page.getByText(/(\d+) interventions? depuis \d{4}/i).textContent();
    const annonce = Number(total?.match(/(\d+)/)?.[1]);
    expect(annonce).toBe(AGENDA.passees);

    const liens = page.getByRole("link", { name: /^\d{4}, \d+ intervention/ });
    const adresses = await liens.evaluateAll((els) =>
      els.map((e) => (e as HTMLAnchorElement).getAttribute("href") ?? ""),
    );
    expect(adresses.length).toBeGreaterThan(0);

    let vues = 0;
    for (const adresse of adresses) {
      await page.goto(adresse);
      vues += await cartes(page).count();
    }
    expect(vues).toBe(annonce);
  });

  test("une année s'ouvre depuis l'horizon, et sait revenir", async ({ page }) => {
    await page.goto("/agenda");
    const premiere = page.getByRole("link", { name: /^\d{4}, \d+ intervention/ }).first();
    const annee = (await premiere.textContent())?.match(/\d{4}/)?.[0];
    await premiere.click();
    await expect(page).toHaveURL(new RegExp(`/agenda/${annee}$`));
    await expect(page.getByRole("heading", { level: 1 })).toContainText(String(annee));
    // La porte de sortie : sans elle, la page d'année est un cul-de-sac.
    await page.getByRole("link", { name: /voir les dates à venir/i }).click();
    await expect(page).toHaveURL(/\/agenda$/);
  });

  test("une année sans rien ferme la porte, elle ne rend pas une page vide", async ({
    page,
  }) => {
    // Une page vide laisserait croire à un trou dans la mémoire ; un 404 dit
    // qu'il n'y a rien à cette adresse, ce qui est la vérité.
    const res = await page.goto("/agenda/2001");
    expect(res?.status()).toBe(404);
  });

  test("une année hors bornes est refusée sans exploser", async ({ page }) => {
    for (const url of ["/agenda/abcd", "/agenda/1999", "/agenda/99999"]) {
      const res = await page.goto(url);
      expect(res?.status()).toBe(404);
    }
  });

  test("l'agenda publie ses données structurées, et elles décrivent de VRAIS événements", async ({
    page,
  }) => {
    // Mesuré avant ce lot : la page ne servait qu'un bloc `NGO` hérité du
    // gabarit, sur une page dont le contenu EST une liste d'événements. Ce
    // test lit ce qui est RÉELLEMENT servi — un JSON-LD calculé mais jamais
    // rendu passerait les tests unitaires sans rien publier.
    await page.goto("/agenda");
    const blocs = await page.locator('script[type="application/ld+json"]').allTextContents();
    const collection = blocs
      .map((b) => JSON.parse(b) as Record<string, unknown>)
      .find((b) => b["@type"] === "CollectionPage");
    expect(collection).toBeDefined();

    const liste = collection!.mainEntity as { itemListElement: Array<{ item: Record<string, unknown> }> };
    expect(liste.itemListElement.length).toBeGreaterThan(0);
    const evt = liste.itemListElement[0].item;
    expect(evt["@type"]).toBe("Event");
    // Une date FERME : c'est la promesse faite au moteur.
    expect(String(evt.startDate)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Et la personne qui la porte, reliée à sa fiche.
    const performer = evt.performer as Record<string, unknown>;
    expect(performer["@type"]).toBe("Person");
    expect(String(performer.url)).toContain("/speakeuses/");
  });

  test("le balisage ne nomme QUE des fiches publiées", async ({ page }) => {
    // Un `performer` est une personne. La page ne nomme que des fiches
    // publiées ; cette propriété doit tenir jusque dans ce que les machines
    // recopient — c'est là qu'une fuite se propagerait sans qu'on la voie.
    await page.goto("/agenda");
    const blocs = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(blocs.join(" ")).not.toContain(AGENDA.titreFicheNonPubliee);
  });

  /**
   * L'ENTRÉE DE L'AGENDA (lot 1) — ce que seul un vrai navigateur prouve.
   *
   * Les tests de page mockent la base ET se fournissent leurs `searchParams` :
   * ils vérifient ce que la page FAIT d'un filtre, jamais que Next branche ce
   * filtre sur l'adresse, ni que le formulaire y écrive (principes-tests §2 —
   * un test qui affirme sa propre entrée ne teste pas le montage). C'est ici
   * que le lien partagé, la barre et le bouton retour se jugent.
   */
  test("un filtre posé dans l'ADRESSE arrive jusqu'à la liste", async ({ page }) => {
    await page.goto("/agenda?ville=toulouse");
    await expect(cartes(aVenir(page))).toHaveCount(AGENDA.filtres.toulouse);
    // Le résumé nomme le filtre, et dit « ou en ligne » parce que le compte
    // comprend les visios — sans ça, le nombre contredirait le libellé.
    await expect(
      page.getByText(/interventions? annoncée.? à Toulouse ou en ligne/i),
    ).toBeVisible();
    // La date SANS lieu est joignable depuis Toulouse : elle reste là.
    await expect(page.getByText(AGENDA.titreEnLigne)).toBeVisible();
  });

  test("la facette conférence réunit ce que le REGISTRE réunit", async ({ page }) => {
    // Le décor porte « DevFest » et « DevFest Toulouse » : deux saisies, une
    // conférence. Une facette bâtie sur le libellé figé en listerait deux et
    // n'en ramènerait qu'une — le filtre mentirait dès le premier clic (§4.1).
    await page.goto("/agenda?conference=devfest-toulouse");
    await expect(cartes(aVenir(page))).toHaveCount(AGENDA.filtres.devfest);
    await expect(page.getByText(AGENDA.titreTexteLibre)).toHaveCount(0);
  });

  test("« À distance » ne ramène QUE ce qui se suit à distance", async ({ page }) => {
    await page.goto("/agenda?region=a-distance-visio");
    await expect(cartes(aVenir(page))).toHaveCount(AGENDA.filtres.enLigne);
    await expect(page.getByText(AGENDA.titreEnLigne)).toBeVisible();
  });

  test("la barre écrit dans l'URL, et l'écran suit l'adresse dans les deux sens", async ({
    page,
  }) => {
    // LE parcours du lot : on tape, on filtre, l'adresse suit — donc le lien
    // se partage et le bouton retour du téléphone fonctionne.
    const recherche = page.getByRole("searchbox", { name: "Rechercher" });
    await page.goto("/agenda");
    await recherche.fill("visio");
    await page.getByRole("button", { name: "Filtrer" }).click();
    // L'adresse est PROPRE : un formulaire GET soumet ses quatre champs, donc
    // sans rangement on partagerait `?q=visio&ville=&region=&conference=`.
    await expect(page).toHaveURL(/\/agenda\?q=visio$/);
    await expect(cartes(aVenir(page))).toHaveCount(1);
    await expect(page.getByText(AGENDA.titreEnLigne)).toBeVisible();

    // Le retour arrière rend la vue précédente — ET les commandes avec elle.
    // Sans clé de remontage, la liste et le champ gardaient l'ancienne valeur
    // au-dessus d'une page complète : l'écran montrait un filtre que la page
    // n'appliquait plus, et « Filtrer » le rétablissait sans qu'on l'ait
    // demandé. Un compte de cartes seul ne voyait pas ce défaut.
    await page.goBack();
    await expect(cartes(aVenir(page))).toHaveCount(AGENDA.aVenir);
    await expect(recherche).toHaveValue("");

    await page.goto("/agenda?ville=toulouse");
    await expect(page.locator('select[name="ville"]')).toHaveValue("toulouse");
    await page.getByRole("link", { name: "Tout effacer" }).click();
    await expect(page).toHaveURL(/\/agenda$/);
    await expect(cartes(aVenir(page))).toHaveCount(AGENDA.aVenir);
    await expect(page.locator('select[name="ville"]')).toHaveValue("");
  });

  test("« À distance » range l'adresse : une ville qui ne filtre plus s'en va", async ({
    page,
  }) => {
    // Deux clics dans l'écran suffisaient à obtenir « Ville : Toulouse » avec un
    // résumé qui dit « en ligne » — la commande contredisait la phrase.
    await page.goto("/agenda?ville=toulouse&region=a-distance-visio");
    await expect(page).toHaveURL(/\/agenda\?region=a-distance-visio$/);
    await expect(cartes(aVenir(page))).toHaveCount(AGENDA.filtres.enLigne);
  });

  test("les commandes d'affinage restent là quand la recherche resserre la vue", async ({
    page,
  }) => {
    // Le défaut bloquant de la revue d'écran : la présence des listes se
    // décidait sur la VUE, donc taper un mot les faisait disparaître — et le
    // parcours « je cherche, puis j'affine » devenait impossible.
    await page.goto("/agenda?q=devfest");
    await expect(page.locator('select[name="ville"]')).toHaveCount(1);
    await expect(page.locator('select[name="conference"]')).toHaveCount(1);
  });

  test("à l'arrivée, on voit une DATE — la barre ne mange pas le premier écran", async ({
    page,
  }) => {
    // Le mal que ce lot répare est un mur de défilement : le réparer en posant
    // un formulaire de 417 px au-dessus de la liste aurait déplacé le problème.
    // Mesuré sur téléphone : la première carte se posait à y = 920 pour une
    // fenêtre de 852, donc AUCUNE date à l'écran. D'où l'affinage replié, et
    // l'en-tête de page resserré : sur un portable de 720 px de haut, la carte
    // tombait encore 29 px sous la flottaison.
    await page.goto("/agenda");
    const fenetre = page.viewportSize()?.height ?? 0;
    const premiere = await cartes(aVenir(page)).first().boundingBox();
    expect(premiere).not.toBeNull();
    expect(premiere!.y).toBeLessThan(fenetre);
    // Replié par défaut, ouvert dès qu'un filtre est posé : on ne referme
    // jamais une commande sur les doigts de qui s'en sert.
    await expect(page.locator("details")).not.toHaveAttribute("open", "");
    await page.goto("/agenda?ville=toulouse");
    await expect(page.locator("details")).toHaveAttribute("open", "");
  });

  test("une facette annonce le décompte qu'elle rend vraiment", async ({ page }) => {
    // « On ne clique pas dans le vide » : le nombre écrit dans l'option doit
    // être celui des cartes obtenues, dates en ligne comprises.
    await page.goto("/agenda");
    const option = page.locator('select[name="ville"] option', {
      hasText: /^Toulouse \(/,
    });
    const annonce = Number((await option.textContent())?.match(/\((\d+)\)/)?.[1]);
    expect(annonce).toBe(AGENDA.filtres.toulouse);
    await page.goto("/agenda?ville=toulouse");
    await expect(cartes(aVenir(page))).toHaveCount(annonce);
  });

  test("une année filtrée à vide reste OUVERTE, elle ne se ferme pas", async ({
    page,
  }) => {
    // Le document existe, il n'a simplement rien à Lyon cette année-là. Un 404
    // dirait « cette année n'existe pas » et inviterait à désindexer une
    // archive réelle.
    await page.goto("/agenda");
    const premiere = page.getByRole("link", { name: /^\d{4}, \d+ intervention/ }).first();
    const annee = (await premiere.textContent())?.match(/\d{4}/)?.[0];
    const res = await page.goto(`/agenda/${annee}?ville=lyon`);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(String(annee));
    await expect(
      page.getByText(new RegExp(`Aucune intervention en ${annee} à Lyon`, "i")),
    ).toBeVisible();
  });

  test("« Déjà en scène » montre ce qu'il annonce, dates au mois comprises", async ({
    page,
  }) => {
    // LE DÉFAUT DU 18/08, relevé sur une impression de la vraie page et non par
    // un test : « 2 interventions depuis 2025. Voici la plus récente. » au-dessus
    // de RIEN. L'aperçu empruntait la lecture du fil connecté, qui exige un jour
    // exact ; l'archive, elle, compte les périodes closes. Aucun parcours ne
    // regardait cette section — c'est ce trou qui se ferme ici.
    await page.goto("/agenda");
    const section = page.getByRole("region", { name: /déjà en scène/i });
    await expect(section).toBeVisible();

    // La promesse et la marchandise, dans le même geste : si la phrase annonce
    // des cartes, il y a des cartes.
    await expect(section.getByText(/voici (la plus récente|les plus récentes)/i)).toBeVisible();
    expect(await cartes(section).count()).toBeGreaterThan(0);

    // CE QUI FAIT MORDRE CETTE GARDE : la plus récente du passé est annoncée au
    // MOIS près (décor), donc elle DOIT être dans l'aperçu. C'est exactement la
    // carte que l'ancienne lecture jetait en silence. Sans cette assertion, le
    // test restait vert avec le défaut remis — les quinze dates exactes du décor
    // suffisaient à remplir l'aperçu, et personne ne voyait la manquante.
    await expect(section.getByText(AGENDA.titrePasseAuMois)).toBeVisible();
  });

  test("le flux iCalendar est SERVI, et il ne porte que l'horizon", async ({
    page,
    request,
  }) => {
    // `agenda-ics.test.ts` répond « cette pièce est-elle correcte ? » (format,
    // pliage, échappement, dates exactes). Ici on répond à l'autre question :
    // « est-elle branchée ? » — et surtout sur QUOI. Un flux d'abonnement câblé
    // sur la mauvaise lecture déverserait seize dates passées dans le
    // calendrier de qui s'abonne, ce qu'aucun test unitaire ne verrait.
    const res = await request.get("/agenda.ics");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/calendar");

    const ics = await res.text();
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    expect(ics).toContain("BEGIN:VEVENT");

    // Une date à venir y est (celle de janvier prochain, à date exacte)…
    expect(ics).toContain(AGENDA.titreJanvierProchain);
    // …et le passé, non. Ce sont les assertions qui mordent : câbler le flux
    // sur toutes les scènes au lieu de l'horizon les fait tomber (vérifié).
    expect(ics).not.toContain("Retour d'expérience");
    // Le titre au mois près est comparé ÉCHAPPÉ : le format double les virgules,
    // donc le chercher tel quel ne pouvait jamais échouer — première version de
    // cette ligne, et un placebo au milieu d'un test qui, lui, mordait.
    expect(ics).not.toContain(AGENDA.titrePasseAuMois.replace(/,/g, "\\,"));

    // Et la page y mène vraiment, sans quoi le flux existe sans être trouvable.
    await page.goto("/agenda");
    const lien = page.getByRole("link", { name: /s'abonner au calendrier/i });
    await expect(lien).toBeVisible();
    expect(await lien.getAttribute("href")).toBe("/agenda.ics");
  });

  test("le sitemap ouvre une entrée par année d'archive", async ({ page, request }) => {
    // Une adresse qui n'est pas au sitemap existe sans être trouvable.
    await page.goto("/agenda");
    const annees = await page
      .getByRole("link", { name: /^\d{4}, \d+ intervention/ })
      .evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).getAttribute("href") ?? ""));
    expect(annees.length).toBeGreaterThan(0);

    const sitemap = await (await request.get("/sitemap.xml")).text();
    for (const chemin of annees) {
      expect(sitemap).toContain(chemin);
    }
  });
});
