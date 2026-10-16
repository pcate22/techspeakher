import { test, expect } from "@playwright/test";
import { exigerDecor, COMPTES, ANNEE } from "./decor";
import { seConnecter } from "./session";
import {
  creerMembre,
  effacerMembre,
  effacerConferenceJetable,
  conferenceJetable,
  occurrencesDuTalk,
  premierTalkId,
  publierFiche,
  fermerBase,
  type MembreJetable,
} from "./comptes-jetables";

/**
 * LE PARCOURS QUI A ÉCHOUÉ EN VRAI : une speakeuse remplit sa fiche, ajoute un
 * talk, puis rattache les conférences où elle l'a donné.
 *
 * Aurélie Vache l'a signalé le 15/08/2026 : arrivée sur une conférence absente
 * du répertoire, le renvoi « demande son ajout » la sortait du formulaire pour
 * la déposer sur la liste des talks — et sa saisie était perdue. La suite
 * unitaire était pourtant verte : `talk-form-ui.test.tsx` vérifiait le lien
 * contre `/conferences/proposer`, une page qui n'a JAMAIS existé, parce que le
 * test fournissait lui-même la valeur du prop que la page réelle renseignait
 * autrement. Un test qui se donne sa propre entrée ne teste pas le branchement.
 *
 * D'où ce fichier : le seul niveau où le prop vient de la VRAIE page, où le
 * clic suit un VRAI lien, et où la publication se lit sur la VRAIE fiche
 * publique. Chaque étape est vérifiée en base ET à l'écran — les deux peuvent
 * diverger, et c'est justement l'écart qui nous a coûté ce bug.
 *
 * `DevFest Toulouse` (+ ses éditions N-1 et N, `ANNEE`) vient du décor partagé
 * `db/seed-preview.sql` ; la conférence hors répertoire est jetable, nommée par
 * le test et retirée après lui.
 */

let jetable: MembreJetable | null = null;
let confJetableSlug: string | null = null;

test.beforeEach(async ({ request }) => {
  await exigerDecor(request);
});

test.afterEach(async () => {
  await effacerMembre(jetable);
  jetable = null;
  if (confJetableSlug) await effacerConferenceJetable(confJetableSlug);
  confJetableSlug = null;
});

test.afterAll(async () => {
  await fermerBase();
});

/**
 * ATTENDRE L'HYDRATATION AVANT DE TOUCHER LE FORMULAIRE.
 *
 * `OccurrenceForm` est un composant client : le `<select>` de conférence nourrit
 * des champs cachés (`conferenceId`, `conference`) via l'état React, et les
 * champs Ville / Pays / Lien conf sont CONTRÔLÉS. Tant que React n'a pas repris
 * la main sur le HTML servi, taper dans ces champs écrit dans un DOM que
 * l'hydratation va réinitialiser, et changer le `<select>` ne pose aucun id
 * caché — l'enregistrement part alors vide et le serveur répond « choisis une
 * conférence ».
 *
 * Ça n'arrive pas à un humain (personne ne clique 50 ms après l'affichage),
 * mais ça arrive à Playwright sous charge : la suite complète a rougi ici une
 * fois sur douze, et un test qui rougit sans que rien ne soit cassé est pire
 * qu'un test absent. On attend donc le signal d'hydratation de React
 * (les clés internes `__react*` posées sur le nœud) plutôt que de dormir un
 * temps arbitraire.
 */
async function attendreHydratation(page: import("@playwright/test").Page) {
  await page.waitForFunction(() => {
    const el = document.querySelector("#conf-select");
    return !!el && Object.keys(el).some((k) => k.startsWith("__react"));
  });
}

/**
 * Ouvre la fiche publique en visiteuse anonyme, joue `verif`, referme.
 * Le `finally` compte : sans lui, une assertion qui tombe fuit un contexte
 * navigateur et la suite se traîne jusqu'à la fin du run.
 */
async function surLaFichePublique(
  browser: import("@playwright/test").Browser,
  profileId: number | null,
  verif: (page: import("@playwright/test").Page) => Promise<void>,
) {
  const anonyme = await browser.newContext();
  try {
    const vue = await anonyme.newPage();
    await vue.goto(`/speakeuses/${profileId}`);
    await verif(vue);
  } finally {
    await anonyme.close();
  }
}

/**
 * Choisit une conférence dans le combobox : on TAPE (nom, ville ou pays) puis
 * on clique l'option — le même geste que la speakeuse. `recherche` absent :
 * on ouvre la liste entière (clic seul), le chemin « je déroule et je choisis ».
 */
async function choisirConference(
  page: import("@playwright/test").Page,
  option: RegExp,
  recherche?: string,
) {
  const champ = page.getByRole("combobox", { name: /^conférence/i });
  if (recherche) await champ.fill(recherche);
  else await champ.click();
  await page.getByRole("option", { name: option }).click();
}

/** Remplit le formulaire d'occurrence, hors choix de la conférence. */
async function remplirContexte(
  page: import("@playwright/test").Page,
  o: { ville: string; annee: string; slides?: string },
) {
  // Choisir une conférence PRÉ-REMPLIT la ville (« Toulouse » pour le DevFest).
  // Sous charge, le champ a valu « ToulouseToulouse » une fois sur dix :
  // hypothèse, ce rendu se croise avec `fill`. On juge donc la valeur
  // obtenue, et on ressaisit tant qu'elle n'y est pas.
  const ville = page.getByLabel("Ville");
  await expect(async () => {
    await ville.fill(o.ville);
    await expect(ville).toHaveValue(o.ville, { timeout: 500 });
  }).toPass({ timeout: 5_000 });
  await page.getByLabel("Année").selectOption(o.annee);
  if (o.slides) await page.getByLabel("Lien slides").fill(o.slides);
}

test.describe("Ajouter une conférence à un talk", () => {
  /**
   * Le cas nominal, celui qui doit rester simple : la conférence est au
   * répertoire, on la choisit, elle paraît sur la fiche publique.
   */
  test("conférence du répertoire : choisie, enregistrée, publiée", async ({
    context,
    page,
    browser,
  }) => {
    jetable = await creerMembre({ nom: "Delphine Test", fiche: "prete" });
    await publierFiche(jetable);
    const talkId = await premierTalkId(jetable.userId);

    await seConnecter(context, { id: jetable.userId });
    await page.goto(`/mon-espace/talks/${talkId}/conference/nouveau`);
    await attendreHydratation(page);

    // La recherche par LIEU, avec un mot ABSENT du nom : « france » ne peut
    // faire remonter DevFest Toulouse que par son pays — casser le
    // rapprochement ville/pays fait donc tomber CE test (« toulouse »
    // matcherait aussi le nom, et ne prouverait rien).
    await choisirConference(page, /^DevFest Toulouse/, "france");
    // Le choix a bien nourri le champ caché : c'est LUI que le serveur lira.
    // Cherché DANS la région du formulaire, pas dans toute la page : pendant
    // une transition de l'App Router, l'arbre sortant et l'arbre entrant
    // coexistent un instant, et le locator global remontait alors DEUX champs
    // — celui qu'on vient de nourrir et un champ vide. Playwright échouait en
    // mode strict, sur une ambiguïté de l'assertion et non du produit. Isolé
    // le test passait, sous charge il tombait : ce n'était pas de l'aléa, mais
    // une fenêtre de temps qui s'ouvre quand la machine est occupée
    // (constaté sur la suite complète, 2026-08-17).
    const formulaire = page.getByRole("region", { name: /Ajouter une conférence/i });
    await expect(formulaire.locator('input[name="conferenceId"]')).toHaveValue(/\d+/);
    await remplirContexte(page, {
      ville: "Toulouse",
      annee: String(ANNEE),
      slides: "https://slides.example/devfest",
    });
    await page.getByRole("button", { name: /ajouter la conférence/i }).click();

    await expect(page).toHaveURL(new RegExp(`/mon-espace/talks/${talkId}`));

    // EN BASE : rattachée au répertoire, donc publiable d'emblée.
    await expect.poll(() => occurrencesDuTalk(talkId), { timeout: 10_000 }).toEqual([
      expect.objectContaining({
        conference: "DevFest Toulouse",
        ville: "Toulouse",
        lienSlides: "https://slides.example/devfest",
        propositionId: null,
      }),
    ]);

    // À L'ÉCRAN PUBLIC : la conférence est là.
    await surLaFichePublique(browser, jetable.profileId, async (vue) => {
      await expect(vue.getByText("DevFest Toulouse").first()).toBeVisible();
    });
  });

  /**
   * LE BUG D'AURÉLIE, joué de bout en bout.
   *
   * Ce que ce test aurait attrapé et que l'unitaire a laissé passer : le lien
   * sortait du formulaire. On vérifie donc d'abord qu'aucun renvoi ne quitte
   * l'écran, puis que la saisie SURVIT — c'est-à-dire qu'elle est en base avec
   * ses liens et sa date, pas seulement que la page affiche un accusé.
   */
  test("conférence hors répertoire : la saisie est gardée, pas perdue ni publiée", async ({
    context,
    page,
    browser,
  }) => {
    jetable = await creerMembre({ nom: "Eugénie Test", fiche: "prete" });
    await publierFiche(jetable);
    const talkId = await premierTalkId(jetable.userId);
    const conf = conferenceJetable();
    confJetableSlug = conf.slug;

    await seConnecter(context, { id: jetable.userId });
    await page.goto(`/mon-espace/talks/${talkId}/conference/nouveau`);
    await attendreHydratation(page);

    // Le défaut d'origine : plus AUCUN renvoi hors de l'écran de saisie.
    await expect(page.getByRole("link", { name: /demande son ajout/i })).toHaveCount(0);

    // Elle saisit d'abord son contexte, PUIS découvre que sa conf manque : c'est
    // l'ordre réel, et c'est cette saisie-là qui était perdue.
    await remplirContexte(page, {
      ville: "Lille",
      annee: "2025",
      slides: "https://slides.example/hors-registre",
    });
    // Elle CHERCHE sa conf (le geste réel), la trouve nulle part, et prend la
    // porte « ma conférence manque » — toujours présente sous le filtre.
    await choisirConference(page, /ma conférence manque/i, conf.nom);

    const champNom = page.getByLabel(/nom de la conférence/i);
    await expect(champNom).toBeVisible();
    // Sa recherche est devenue le nom proposé : zéro re-frappe.
    await expect(champNom).toHaveValue(conf.nom);

    // Ce qu'elle avait tapé AVANT est toujours là : on ne repart pas de zéro.
    await expect(page.getByLabel("Ville")).toHaveValue("Lille");
    await expect(page.getByLabel("Lien slides")).toHaveValue(
      "https://slides.example/hors-registre",
    );

    await page.getByRole("button", { name: /ajouter la conférence/i }).click();
    await expect(page).toHaveURL(new RegExp(`/mon-espace/talks/${talkId}`));

    // EN BASE : TOUT est enregistré, rattaché à la proposition (pas au répertoire).
    await expect.poll(() => occurrencesDuTalk(talkId), { timeout: 10_000 }).toEqual([
      expect.objectContaining({
        conference: conf.nom,
        ville: "Lille",
        lienSlides: "https://slides.example/hors-registre",
        conferenceId: null,
      }),
    ]);
    const [enAttente] = await occurrencesDuTalk(talkId);
    expect(enAttente.propositionId).not.toBeNull();

    // DANS SON ESPACE : elle voit où en est sa demande.
    //
    // Même délai que la vérification en base juste au-dessus : l'écriture est
    // confirmée, mais l'écran doit encore se rafraîchir, et sous charge il n'y
    // arrive pas en 5 s. Vu une fois sur la suite complète, jamais en isolé
    // (2026-08-17) — ce n'est pas de l'aléa, c'est le temps que met le
    // rafraîchissement quand la machine est occupée. On attend PLUS, on ne
    // recharge pas : ce que ce test garde, c'est que l'écran se met à jour
    // TOUT SEUL après l'action.
    await expect(page.getByText(/en attente de validation/i).first()).toBeVisible({
      timeout: 10_000,
    });

    // SUR SA FICHE PUBLIQUE : rien. Une conférence non validée ne paraît pas.
    await surLaFichePublique(browser, jetable.profileId, async (vue) => {
      await expect(vue.getByText(conf.nom)).toHaveCount(0);
    });
  });

  /**
   * L'autre moitié de la promesse : « quand on valide la conf, ça met en ligne
   * la saisie qu'elles avaient faite ». Sans ce test, on saurait que la saisie
   * est gardée, pas qu'elle finit par sortir.
   */
  test("l'orga valide : la saisie déjà faite passe en ligne, sans re-saisie", async ({
    context,
    page,
    browser,
  }) => {
    jetable = await creerMembre({ nom: "Fanny Test", fiche: "prete" });
    await publierFiche(jetable);
    const talkId = await premierTalkId(jetable.userId);
    const conf = conferenceJetable();
    confJetableSlug = conf.slug;

    // ── 1. La speakeuse saisit sa conférence hors répertoire ────────────────
    await seConnecter(context, { id: jetable.userId });
    await page.goto(`/mon-espace/talks/${talkId}/conference/nouveau`);
    await attendreHydratation(page);
    // L'autre chemin vers la porte : liste déroulée SANS recherche.
    await choisirConference(page, /ma conférence manque/i);
    await page.getByLabel(/nom de la conférence/i).fill(conf.nom);
    await remplirContexte(page, {
      ville: "Lille",
      annee: "2025",
      slides: "https://slides.example/a-publier",
    });
    await page.getByRole("button", { name: /ajouter la conférence/i }).click();
    await expect
      .poll(async () => (await occurrencesDuTalk(talkId))[0]?.propositionId != null, {
        timeout: 10_000,
      })
      .toBe(true);

    // ── 2. L'orga la valide depuis la file ──────────────────────────────────
    const cotéOrga = await browser.newContext();
    await seConnecter(cotéOrga, COMPTES.orga);
    const vueOrga = await cotéOrga.newPage();
    // La file d'arbitrage a sa page depuis le 2026-08-21 : le catalogue ne
    // porte plus 113 formulaires (docs/conception-arbitrage-conferences.md).
    await vueOrga.goto("/admin/conferences/propositions");

    // La file dit à l'orga ce que son clic va libérer.
    // Par RÔLE, pas `locator("li")` : pendant le streaming, Next garde une
    // copie CACHÉE de la liste le temps de remplacer le repli de
    // `loading.tsx`. `locator` la voit, et le mode strict trouvait deux
    // rangées une fois sur huit sous charge ; un rôle ignore ce qui est caché.
    const ligne = vueOrga.getByRole("listitem").filter({ hasText: conf.nom });
    await expect(ligne).toBeVisible();
    await expect(ligne.getByText(/1 talk à mettre en ligne/i)).toBeVisible();

    // ── 2 bis. Et surtout : elle peut LIRE la saisie qu'elle arbitre ────────
    // Le défaut du 2026-08-21 (« je ne peux pas voir le formulaire des
    // conférences pour comprendre si la saisie est ok ») : l'invariant de
    // visibilité tient l'occurrence hors du public, et aucun écran orga ne
    // montrait les talks d'une membre. C'est le seul endroit du produit où la
    // saisie en attente se lit — donc le seul endroit où ce test peut vivre.
    // La rangée ENTIÈRE est le lien (gabarit des listes orga) : un seul lien
    // par rangée, donc aucun homonyme à distinguer.
    await ligne.getByRole("link").click();
    // DANS la liste des saisies, nommée par son titre de section : sans ce
    // périmètre, le même titre de talk ailleurs sur l'écran (ou une saisie
    // restée d'un test précédent) rendait l'assertion ambiguë — et un test
    // ambigu ne garde rien.
    const saisies = vueOrga.getByRole("list", { name: /Ce qui a été saisi/i });
    await expect(saisies.getByText("Un sujet que j'aimerais présenter")).toBeVisible();
    // La ligne de méta, pas n'importe quel « Fanny Test » de la liste (le lien
    // vers sa fiche en porte un aussi) : ce qu'on garde ici, c'est que l'orga
    // lit QUI a saisi, QUAND et OÙ — les trois d'un coup.
    await expect(saisies.getByText("Fanny Test · 2025 · Lille · France")).toBeVisible();
    await expect(saisies.getByRole("link", { name: /Slides/ })).toHaveAttribute(
      "href",
      "https://slides.example/a-publier",
    );
    await vueOrga.getByRole("button", { name: /^Valider$/ }).click();

    // ── 3. La saisie est en ligne, TELLE QUELLE ─────────────────────────────
    await expect
      .poll(async () => (await occurrencesDuTalk(talkId))[0]?.propositionId, {
        timeout: 10_000,
      })
      .toBeNull();
    const [publiee] = await occurrencesDuTalk(talkId);
    // Rattachée au répertoire, avec le libellé recomposé (conf + année)…
    expect(publiee.conferenceId).not.toBeNull();
    expect(publiee.conference).toBe(`${conf.nom} 2025`);
    // …et SANS rien perdre de ce qu'elle avait tapé.
    expect(publiee.ville).toBe("Lille");
    expect(publiee.lienSlides).toBe("https://slides.example/a-publier");

    // Sur sa fiche publique, cette fois, la conférence paraît.
    await surLaFichePublique(browser, jetable.profileId, async (vue) => {
      await expect(vue.getByText(conf.nom).first()).toBeVisible();
    });
    await cotéOrga.close();
  });
});

/**
 * MODIFIER une conférence déjà enregistrée — le geste qu'aucun test ne jouait.
 *
 * Il a coûté cher : `updateOccurrence` annonçait quinze paramètres et n'en
 * passait que treize (migration 072), donc Postgres refusait la requête et
 * TOUTE modification échouait en production. Les unitaires restaient verts —
 * le pool y est simulé, et une requête qu'aucun serveur ne bind ne se plaint
 * jamais. C'est la question propre à ce niveau : « est-ce branché ? ».
 *
 * Le même parcours porte la géographie (lot 1b) : la Base Adresse Nationale
 * est JOUÉE ici, pour mesurer le branchement écran → action → colonne et pas
 * la joignabilité d'un service public depuis la CI.
 */
test.describe("Modifier une conférence d'un talk", () => {
  const TOULOUSE = {
    nom: "Toulouse",
    codePostal: "31000",
    codeInsee: "31555",
    region: "Occitanie",
  };

  test("la modification arrive en base, et la commune est capturée à la saisie", async ({
    context,
    page,
  }) => {
    jetable = await creerMembre({ nom: "Gaëlle Test", fiche: "prete" });
    await publierFiche(jetable);
    const talkId = await premierTalkId(jetable.userId);

    await seConnecter(context, { id: jetable.userId });
    await page.route("**/api/communes*", (route) =>
      route.fulfill({ json: { communes: [TOULOUSE] } }),
    );

    // ── 1. Une conférence du répertoire, saisie normalement ─────────────────
    await page.goto(`/mon-espace/talks/${talkId}/conference/nouveau`);
    await attendreHydratation(page);
    await choisirConference(page, /^DevFest Toulouse/, "france");
    await remplirContexte(page, { ville: "Toulouse", annee: String(ANNEE) });
    // Le champ DIT ce qu'il a compris : c'est le retour à l'écran, et c'est
    // aussi le signal fiable que la géographie est prête à partir.
    await expect(page.getByText("Région : Occitanie")).toBeVisible();
    await page.getByRole("button", { name: /ajouter la conférence/i }).click();

    await expect.poll(() => occurrencesDuTalk(talkId), { timeout: 10_000 }).toEqual([
      expect.objectContaining({
        ville: "Toulouse",
        codeInsee: "31555",
        region: "Occitanie",
      }),
    ]);

    // ── 2. Elle y revient et complète ses slides ────────────────────────────
    await page.getByRole("link", { name: /modifier$/i }).first().click();
    await attendreHydratation(page);
    await page.getByLabel("Lien slides").fill("https://slides.example/apres-coup");
    await page.getByRole("button", { name: /enregistrer les modifications/i }).click();
    await expect(page).toHaveURL(new RegExp(`/mon-espace/talks/${talkId}`));

    // ── 3. EN BASE : le lien est arrivé, la commune est restée ──────────────
    // La géographie n'a pas été retouchée à l'écran : c'est bien le formulaire
    // qui la repose. Sans ça, compléter un lien effacerait la commune.
    await expect.poll(() => occurrencesDuTalk(talkId), { timeout: 10_000 }).toEqual([
      expect.objectContaining({
        lienSlides: "https://slides.example/apres-coup",
        ville: "Toulouse",
        codeInsee: "31555",
        region: "Occitanie",
      }),
    ]);
  });
});

/**
 * UNE DATE SUR UN TALK, SANS L'OUVRIR (refonte de la navigation connectée,
 * 2026-10-15). Le geste le plus fréquent d'une speakeuse — « mon talk est
 * retenu à une nouvelle conf » — passait par la page du talk puis un
 * formulaire de dix champs. Il se fait maintenant depuis la fiche, dans une
 * fenêtre ouverte par le bouton « Une date » du talk.
 *
 * L'unitaire garde la fenêtre et l'action, chacune de son côté ; ce parcours
 * garde ce qu'il ne voit pas : que la VRAIE page passe le registre et le talk
 * à la fenêtre, que la VRAIE action écrit en base sans rediriger, et que le
 * lien de la feuille ➕ (`?date=<id>`) ouvre bien la fenêtre du bon talk.
 */
test.describe("Une date sur un talk, depuis la fiche", () => {
  test("« Une date » : conférence choisie, enregistrée, confirmée sur place", async ({
    context,
    page,
  }) => {
    jetable = await creerMembre({ nom: "Delphine Test", fiche: "prete" });
    const talkId = await premierTalkId(jetable.userId);

    await seConnecter(context, { id: jetable.userId });
    await page.goto("/mon-espace/fiche");
    await page.getByRole("button", { name: /^Une date pour «/ }).click();
    const fenetre = page.getByRole("dialog", { name: /^Une date pour «/ });
    await expect(fenetre).toBeVisible();
    await attendreHydratation(page);

    await choisirConference(page, /^DevFest Toulouse/, "devfest");
    await fenetre.getByLabel("Année").selectOption(String(ANNEE));
    // La fenêtre est RÉDUITE : les liens se complètent après.
    await expect(fenetre.getByLabel("Lien slides")).toHaveCount(0);
    await fenetre.getByRole("button", { name: "Ajouter la date" }).click();

    // Sur place : pas de redirection, la fenêtre se ferme, la confirmation
    // nomme le talk.
    await expect(page.getByRole("status").filter({ hasText: /^Date ajoutée à «/ })).toBeVisible();
    await expect(fenetre).toBeHidden();
    await expect(page).toHaveURL(/\/mon-espace\/fiche$/);
    // La fiche montre la date SANS rechargement (le `revalidatePath` de
    // l'action). Cherchée DANS la section des talks : sur toute la page,
    // l'assertion passait par moments alors que la liste n'avait pas bougé
    // (mesuré le 2026-10-15, fenêtre fermée pendant l'action).
    const sectionTalks = page.getByRole("region", { name: "Tes talks" });
    await expect(sectionTalks.getByText("DevFest Toulouse")).toBeVisible();

    // EN BASE : rattachée au répertoire, ville reprise de la conférence.
    await expect.poll(() => occurrencesDuTalk(talkId), { timeout: 10_000 }).toEqual([
      expect.objectContaining({
        conference: "DevFest Toulouse",
        ville: "Toulouse",
        propositionId: null,
      }),
    ]);
  });

  test("arrivée par `?date=<id>` : la fenêtre du talk s'ouvre, un id étranger n'ouvre rien", async ({
    context,
    page,
  }) => {
    jetable = await creerMembre({ nom: "Delphine Test", fiche: "prete" });
    const talkId = await premierTalkId(jetable.userId);
    await seConnecter(context, { id: jetable.userId });

    await page.goto(`/mon-espace/fiche?date=${talkId}`);
    await expect(page.getByRole("dialog", { name: /^Une date pour «/ })).toBeVisible();
    // Consommé : le paramètre quitte l'adresse.
    await expect(page).toHaveURL(/\/mon-espace\/fiche$/);

    await page.goto("/mon-espace/fiche?date=999999999");
    await expect(page.getByRole("button", { name: /^Une date pour «/ })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  /**
   * DÉJÀ SUR LA FICHE, ➕ → « Ajouter une date à un talk » ne change que l'URL : le
   * composant n'est pas remonté. La première version lisait le paramètre au
   * montage seulement, et rien ne s'ouvrait (relevé par la passe
   * simplification du 2026-10-15) — un `page.goto` ne le voit pas, d'où ce
   * parcours au clic, joué DEUX fois (le même lien recliqué).
   */
  test("déjà sur la fiche : ➕ → « Ajouter une date à un talk » ouvre la fenêtre, deux fois de suite", async ({
    context,
    page,
  }) => {
    jetable = await creerMembre({ nom: "Delphine Test", fiche: "prete" });
    await seConnecter(context, { id: jetable.userId });
    await page.goto("/mon-espace/fiche");
    await page.getByRole("button", { name: /^Une date pour «/ }).waitFor();

    const nav = page.getByRole("navigation", { name: "Mon espace" });
    for (let fois = 0; fois < 2; fois++) {
      await nav.getByRole("button", { name: /créer/i }).click();
      await page.getByRole("link", { name: "Ajouter une date à un talk" }).click();
      const fenetre = page.getByRole("dialog", { name: /^Une date pour «/ });
      await expect(fenetre).toBeVisible();
      await fenetre.getByRole("button", { name: "Fermer" }).click();
      await expect(fenetre).toBeHidden();
      // Le focus revient au bouton « Une date » du talk — pas au « Créer »
      // de la navigation, que le <dialog> natif aurait restauré (revue
      // justesse rejouée du 2026-10-15 ; jsdom ne restaure rien, d'où l'E2E).
      await expect(page.getByRole("button", { name: /^Une date pour «/ })).toBeFocused();
    }
  });

  test("Ma fiche à un geste : le rail sur bureau, l'onglet-photo sur mobile", async ({
    context,
    page,
  }) => {
    jetable = await creerMembre({ nom: "Delphine Test", fiche: "prete" });
    await seConnecter(context, { id: jetable.userId });
    await page.goto("/mon-espace");

    // Une seule navigation « Mon espace » est VISIBLE à la fois : le rail
    // (lg) ou la barre basse ; c'est elle qu'on emprunte.
    const nav = page.getByRole("navigation", { name: "Mon espace" });
    await expect(nav).toHaveCount(1);
    await nav.getByRole("link", { name: "Ma fiche" }).click();
    await expect(page).toHaveURL(/\/mon-espace\/fiche$/);
    await expect(nav.getByRole("link", { name: "Ma fiche" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
