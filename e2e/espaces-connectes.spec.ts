import { test, expect } from "@playwright/test";
import { exigerDecor, COMPTES, YASMINE, INES, EMAILS_DU_DECOR } from "./decor";
import { seConnecter } from "./session";
import { PAGES_MEMBRE, PAGES_ORGA } from "./pages-publiques";

/**
 * LES ESPACES CONNECTÉS, enfin atteignables.
 *
 * 83 pages (23 côté membre, 60 côté orga) n'avaient JAMAIS été ouvertes par un
 * test de bout en bout : il manquait une session et une base. Les deux sont là
 * (`e2e/session.ts`, `e2e/decor.ts`).
 *
 * Ce fichier reste un SMOKE délibérément mince, et c'est un choix. Couvrir 83
 * pages une à une produirait une suite que personne ne tient (« une porte qu'on
 * n'arrive pas à tenir finit désactivée », cf. `a11y.spec.ts`) : les écritures
 * se couvriront par PARCOURS, pas par visite. Ce qu'on garde ici, c'est ce
 * qu'aucun autre niveau de test ne voit — que ces pages s'affichent pour de
 * vrai, avec les bonnes données et pour la bonne personne. Une page connectée
 * qui tombe en 500 après un déploiement ne se voit aujourd'hui qu'en le vivant.
 */

/**
 * LE PIED DE PAGE, deux variantes selon la coquille (audit C10).
 *
 * Ce que Vitest ne peut PAS dire ici : la variante dépend d'une décision de
 * ROUTAGE. Un test de composant se fournit lui-même son `usePathname` et
 * passerait au vert même si le layout racine cessait de rendre `Footer`, ou si
 * `usePathname()` ne valait pas ce que le mock prétend (principes-tests §2 :
 * « cette pièce est-elle correcte ? » contre « est-elle branchée ? »).
 */
test.describe("Pied de page selon la coquille", () => {
  test("sur le site, le pied garde ses colonnes", async ({ page }) => {
    await page.goto("/");
    const pied = page.getByRole("contentinfo");
    await expect(pied.getByRole("link", { name: /à propos/i })).toBeVisible();
    await expect(pied.getByRole("link", { name: /mentions légales/i })).toBeVisible();
  });

  test("dans l'espace connecté, le pied s'allège sans perdre ses obligations", async ({
    context,
    page,
    request,
  }) => {
    await exigerDecor(request);
    await seConnecter(context, COMPTES.membre);
    await page.goto("/mon-espace/profil");
    const pied = page.getByRole("contentinfo");
    await expect(pied.getByRole("link", { name: /mentions légales/i })).toBeVisible();
    await expect(pied.getByRole("link", { name: /code de conduite/i })).toBeVisible();
    await expect(pied.getByRole("link", { name: /partenaires/i })).toBeVisible();
    // Les colonnes du site partent — et ne restent pas cachées dans le DOM :
    // `toBeVisible` les laisserait passer si elles étaient en `sr-only`.
    await expect(pied.getByRole("link", { name: /conférences/i })).toHaveCount(0);
  });
});

test.describe("Espace membre", () => {
  test.beforeEach(async ({ request, context }) => {
    await exigerDecor(request);
    await seConnecter(context, COMPTES.membre);
  });

  for (const chemin of PAGES_MEMBRE) {
    test(`${chemin} s'affiche`, async ({ page }) => {
      const res = await page.goto(chemin);
      expect(res?.status(), `${chemin} devrait s'afficher pour une membre`).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    });
  }

  /**
   * « Une page s'affiche » ne suffit pas : elle doit afficher SON espace à
   * elle. Une régression qui servirait la mauvaise personne rendrait toujours
   * un 200.
   */
  test("l'espace affiche bien les données de la personne connectée", async ({ page }) => {
    await page.goto("/mon-espace");
    await expect(page.locator("body")).toContainText(COMPTES.membre.nom);
  });

  /**
   * Le réglage de fréquence des rappels : une promesse faite dans DEUX e-mails
   * (« choisir la fréquence de ces rappels »), qui doit trouver un contrôle au
   * bout du lien. Un e-mail qui mène à un écran sans réglage vaudrait pire que
   * pas de lien du tout.
   */
  test("les réglages portent la fréquence des rappels de fiche", async ({ page }) => {
    await page.goto("/mon-espace/reglages");
    const groupe = page.getByRole("group", { name: /rappels sur ma fiche/i });
    await expect(groupe).toBeVisible();
    await expect(groupe.getByRole("radio", { name: /^aucun$/i })).toBeVisible();
  });

  test("sa fiche personnelle porte ses informations", async ({ page }) => {
    await page.goto("/mon-espace/fiche");
    await expect(page.locator("body")).toContainText(COMPTES.membre.nom);
  });
});

test.describe("Espace orga", () => {
  test.beforeEach(async ({ request, context }) => {
    await exigerDecor(request);
    await seConnecter(context, COMPTES.orga);
  });

  for (const chemin of PAGES_ORGA) {
    test(`${chemin} s'affiche`, async ({ page }) => {
      const res = await page.goto(chemin);
      expect(res?.status(), `${chemin} devrait s'afficher pour une orga`).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    });
  }

  /**
   * LE COMPLÉMENT DE L'INVARIANT PUBLIC. `annuaire.spec.ts` exige qu'une fiche
   * en attente reste invisible du public ; encore faut-il qu'elle soit visible
   * de QUI DOIT LA VALIDER. Les deux moitiés se tiennent : garder seulement la
   * première, c'est laisser passer une file de modération vide — les fiches
   * n'apparaîtraient nulle part, et personne ne serait jamais publiée.
   */
  test("la fiche en attente attend bien dans la file de modération", async ({ page }) => {
    await page.goto("/admin/speakeuses");
    await expect(page.locator("body")).toContainText(YASMINE.nom);
  });

  /**
   * Le pendant, pour les fiches que PERSONNE n'a soumises : un brouillon en
   * sommeil n'entre dans aucune file. S'il manquait à cet écran, il resterait
   * invisible partout, indéfiniment — et la page de relance serait un formulaire
   * qui ne trouve jamais personne. Le CTA compte les fiches : on juge sur son
   * libellé, pas sur sa simple présence.
   */
  test("le brouillon en sommeil est trouvable, et le lot le compte", async ({ page }) => {
    await page.goto("/admin/speakeuses/relances");
    await expect(page.locator("body")).toContainText(INES.nom);
    await expect(page.getByRole("button", { name: /relancer 1 speakeuse/i })).toBeVisible();
  });

  /**
   * La voie de DÉCOUVERTE : sans cette tâche, il faudrait penser à ouvrir la
   * page de relance pour apprendre qu'il y a quelqu'un à relancer.
   */
  test("le tableau de bord signale la fiche en sommeil", async ({ page }) => {
    await page.goto("/admin/taches");
    await expect(page.locator("body")).toContainText(/relancer la fiche d.Inès/i);
  });

  /**
   * LE POINT de l'onglet « À faire », joué de bout en bout : la barre →
   * `desTachesAttendent` → la porte → le moteur, sur un vrai rendu. Le décor
   * a une fiche en sommeil (refermable par l'orga), donc le point s'allume —
   * et il s'allume par le NOM, pas par une couleur muette : c'est l'attribut
   * qu'on lit, il se juge même quand la barre est cachée par le viewport
   * desktop (`xl:hidden`).
   */
  test("un constat s'affiche, étiqueté, et HORS du compte des tâches", async ({ page }) => {
    // Le décor a une photo bloquée par la seule inscrite qui y figure
    // (Yasmine, public=false) : la ligne « 1 photo reste privée » informe,
    // avec son étiquette « Pour information » — et ne compte pas comme une
    // tâche. C'est la SEULE occurrence rendue en vrai navigateur : sans elle,
    // ni la pastille ni la règle « la liste peut finir » ne passaient sous
    // axe (les portes de a11y.spec.ts la voient désormais aussi).
    await page.goto("/mon-espace/a-faire");
    const corps = page.locator("body");
    await expect(corps).toContainText(/1 photo reste privée/i);
    await expect(corps).toContainText(/pour information/i);
    // HORS DU COMPTE : cinq lignes à l'écran, la méta en compte quatre — le
    // constat informe, il n'est pas « à faire ». (La photo au nom libre du
    // décor, elle, est sur l'édition 2025 ARCHIVÉE : hors moteur — sa moitié
    // « Recueillir l'accord » se garde en Vitest.)
    await expect(corps).toContainText(/4 tâches à faire/i);
  });

  test("le point de « À faire » s'allume pour l'orga : le décor a du refermable", async ({
    page,
  }) => {
    await page.goto("/admin");
    const onglet = page.locator('nav[data-bottom-nav] a[href="/mon-espace/a-faire"]');
    await expect(onglet).toHaveAttribute("aria-label", "À faire, quelque chose attend");
  });
});

/**
 * LE FILTRE EST CALCULÉ PAR LE SERVEUR — la part tenable de la promesse §5
 * (« filtrable sans JS », D4 : les puces sont des liens).
 *
 * Jouée d'abord avec `javaScriptEnabled: false` : l'écran restait sur
 * « Chargement de la page… » — le remplacement du repli de `loading.tsx`
 * passe par les scripts de streaming de l'App Router, et ça vaut pour TOUTES
 * les pages derrière un `loading.tsx`, pas pour celle-ci. Limite de
 * plateforme, consignée dans la dette (2026-08-18).
 *
 * Ce qui reste vrai, et se garde ici au niveau HTTP : le HTML servi contient
 * déjà la vue filtrée ENTIÈRE et son retour — le filtre vit dans l'URL,
 * aucun JavaScript ne le calcule, et une page hydratée n'a rien à recalculer.
 */
test.describe("« À faire » — le filtre est calculé par le serveur", () => {
  test.beforeEach(async ({ request, context }) => {
    await exigerDecor(request);
    await seConnecter(context, COMPTES.orga);
  });

  test("la vue filtrée arrive entière dans le HTML, retour compris", async ({ context }) => {
    const res = await context.request.get("/mon-espace/a-faire?vue=association");
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html).toContain("Relancer la fiche d");
    expect(html).toContain("Voir toutes les tâches");
    expect(html).toContain('href="/mon-espace/a-faire"');
  });
});

/**
 * Le cloisonnement, vu de l'autre côté : `auth.spec.ts` prouve que le proxy
 * refuse /admin à une membre. Ici on vérifie qu'aucune adresse e-mail du décor
 * ne traîne dans SON espace à elle — la surface où le produit manipule le plus
 * de données personnelles.
 */
test.describe("Cloisonnement des données", () => {
  test.beforeEach(async ({ request, context }) => {
    await exigerDecor(request);
    await seConnecter(context, COMPTES.membre);
  });

  test("le point de « À faire » reste ÉTEINT pour une membre — le même décor", async ({
    page,
  }) => {
    // Le miroir : mêmes données en base, aucune n'est à elle — l'onglet garde
    // son nom nu. Un point qui s'allumerait ici signalerait le travail des
    // autres (et apprendrait à ne plus regarder la barre).
    await page.goto("/mon-espace");
    const onglet = page.locator('nav[data-bottom-nav] a[href="/mon-espace/a-faire"]');
    await expect(onglet).toHaveCount(1);
    expect(await onglet.getAttribute("aria-label")).toBeNull();
  });

  test("« À faire » d'une membre : JAMAIS les tâches de l'association", async ({ page }) => {
    // LE chemin sensible du lot 5 : la liste a quitté /admin (préfixe refusé
    // aux non-orgas) pour /mon-espace (session seule). La protection du
    // contenu repose entièrement sur la porte `chargerTaches` — et ce test la
    // joue depuis l'ÉCRAN, avec la clé de vue la plus hostile. Le miroir du
    // test orga « le tableau de bord signale la fiche en sommeil » : même
    // décor, l'inverse doit être vrai.
    await page.goto("/mon-espace/a-faire?vue=association");
    const corps = page.locator("body");
    await expect(corps).toContainText(/rien à faire pour l'instant/i);
    // Ni la tâche d'association du décor, ni un bandeau qui révélerait qu'une
    // vue « association » existe pour d'autres (S5 : silencieux).
    await expect(corps).not.toContainText(/relancer la fiche d.Inès/i);
    await expect(corps).not.toContainText(/vue\s*:/i);
  });

  test("l'espace membre n'expose pas les adresses des autres", async ({ page }) => {
    await page.goto("/mon-espace");
    const html = await page.content();
    // La sienne peut légitimement s'y trouver (c'est son compte) ; celles des
    // autres, jamais.
    const autres = EMAILS_DU_DECOR.filter((e) => !e.startsWith("lea@"));
    for (const email of autres) {
      expect(html, `adresse d'une autre personne dans /mon-espace : ${email}`).not.toContain(
        email,
      );
    }
  });
});

/**
 * Aucune adresse dans un LIBELLÉ de l'espace organisatrices.
 *
 * Une orga voit légitimement des adresses là où c'est son métier — la fiche
 * d'une speakeuse, la file de modération, l'écran d'une inscrite invitée par
 * e-mail. Ce qu'on garde ici est plus étroit : les pages de TRAVAIL, où une
 * adresse ne peut arriver que par un libellé composé — et un libellé de tâche
 * s'affiche à l'écran ET partira dans l'e-mail quotidien à l'étape C.
 *
 * Cette garde remplace un test unitaire écarté à la relecture du 2026-08-16.
 * Le moteur de tâches avait reçu une garde « un nom qui contient une arobase
 * n'est pas un nom » : correctif au mauvais étage. Trois de ses quatre cibles
 * viennent de `users.name` et ne portent jamais d'adresse ; sur la quatrième,
 * `CONSTRAINT registration_identite` rend le repli e-mail INATTEIGNABLE. Pire,
 * le mode de défaillance créé était plus grave que celui évité : si le filtre
 * s'élargissait, N tâches devenaient N lignes identiques, en silence, sur
 * l'écran dont le rôle est justement de les distinguer.
 *
 * Ici, la garde échoue pour la bonne raison : une adresse est arrivée sur un
 * vrai écran, quelle que soit la couche fautive — filtre élargi, libellé
 * changé, helper modifié.
 */
test.describe("Cloisonnement des données — libellés de l'espace organisatrices", () => {
  test.beforeEach(async ({ request, context }) => {
    await exigerDecor(request);
    await seConnecter(context, COMPTES.orga);
  });

  test("aucune adresse ne s'affiche dans « À faire »", async ({ page }) => {
    await page.goto("/admin/taches");
    const texte = (await page.locator("body").innerText()).toLowerCase();
    for (const email of EMAILS_DU_DECOR) {
      expect(texte, `adresse dans un libellé de tâche : ${email}`).not.toContain(
        email.toLowerCase(),
      );
    }
  });
});
