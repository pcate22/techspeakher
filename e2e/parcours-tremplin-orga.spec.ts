import { test, expect, type Page } from "@playwright/test";
import { exigerDecor, COMPTES } from "./decor";
import { seConnecter } from "./session";
import { fermerBase } from "./comptes-jetables";
import {
  creerEdition,
  ajouterParticipante,
  inscrireEnPhase,
  ajouterAtelier,
  placerDansAtelier,
  ajouterPhoto,
  creerCompte,
  rattacherAccompagnante,
  consentementGalerie,
  consentementAccompagnante,
  podiumEtRecompenses,
  recompensesDeLEdition,
  journalConsentement,
  coachsDeLAtelier,
  estMarqueCoach,
  resteDeLEdition,
  effacerEdition,
  type EditionJetable,
} from "./tremplin-jetable";

/**
 * LE PILOTAGE D'UNE ÉDITION DU TREMPLIN, DE BOUT EN BOUT.
 *
 * 54 Server Actions, 189 tests de pièces détachées, et aucun parcours traversé
 * (`docs/audit-e2e-parcours-2026-08.md` §5.3, P3). Le relevé dit déjà comment
 * l'ouvrir : « par les chemins qui écrivent, pas page par page ». On en choisit
 * CINQ, par le risque (`docs/principes-tests.md` §5) et pas par la complétude :
 *
 *   1. le consentement de diffusion d'une participante — une donnée personnelle
 *      publiée, ou retirée, sur une page que les moteurs indexent (risque 1) ;
 *   2. le rattachement d'une coach — le seul chemin par lequel les noms et les
 *      présences des participantes atteignent quelqu'un qui n'est ni orga ni
 *      la personne concernée (risque 2) ;
 *   3. l'accord d'une ACCOMPAGNANTE à être citée — le troisième consentement du
 *      Tremplin, et le seul qui publie un nom sur DEUX pages à la fois
 *      (risque 1) ;
 *   4. le PALMARÈS — récompenser sans nommer celle qui a refusé, sur les deux
 *      canaux qui le calculent séparément (risque 1) ;
 *   5. la suppression d'une édition — l'action la plus destructive du produit
 *      (risque 3).
 *
 * CE QUE CE NIVEAU VOIT, ET LUI SEUL. Les validations et les écritures sont
 * déjà tenues en unitaire ; on ne les rejoue pas. Ce qui n'existe qu'ici :
 * - les pages publiques en ISR (`revalidate = 300`) se rafraîchissent VRAIMENT
 *   au moment du retrait — sans le `revalidatePath` des actions, un consentement
 *   retiré resterait affiché cinq minutes. C'est ce que le parcours 3 a trouvé
 *   pour `/partenaires`, qu'aucune action ne revalidait ;
 * - le consentement de galerie ne déborde pas sur le chapitre « montée sur
 *   scène », qui lit le sien (`tremplin_registration_phases.public`), ni sur
 *   celui des accompagnantes (`coach_profiles.public`) : TROIS accords que le
 *   code prend soin de séparer, et que rien ne regardait ensemble ;
 * - une photo cesse d'être publiable quand une personne qui y figure se retire ;
 * - le nom que l'écran demande de retaper est bien celui que l'action attend.
 *
 * CHAQUE PARCOURS SUR SON PROPRE DÉCOR (`e2e/tremplin-jetable.ts`) : voir
 * l'en-tête de ce fichier pour la raison — publier ou supprimer dans le décor
 * partagé rendrait la suite dépendante de l'ordre d'exécution.
 */

let edition: EditionJetable | null = null;

test.beforeEach(async ({ request }) => {
  await exigerDecor(request);
});

test.afterEach(async () => {
  await effacerEdition(edition);
  edition = null;
});

test.afterAll(async () => {
  await fermerBase();
});

/** Ouvre la modale de confirmation d'un `InlineActionForm` et valide. */
async function confirmer(page: Page, declencheur: RegExp, bouton: RegExp): Promise<void> {
  await page.getByRole("button", { name: declencheur }).first().click();
  const dialogue = page.getByRole("alertdialog");
  await expect(dialogue).toBeVisible();
  await dialogue.getByRole("button", { name: bouton }).click();
}

/**
 * L'origine de l'accord, sur l'écran de visibilité d'une participante.
 *
 * Le champ est cherché DANS SA RÉGION, et en prenant le premier : pendant une
 * navigation streamée (les écrans d'admin passent par `loading.tsx`), l'ancien
 * arbre peut coexister un instant avec le nouveau, et un sélecteur global trouve
 * alors DEUX fois le même champ — mesuré en projet mobile, où le test tombait
 * sur « strict mode violation » sans qu'aucune garde n'ait bougé. Le décor et
 * l'écran étaient justes ; c'est l'instrument qui visait mal.
 */
function origineDeLAccord(page: Page) {
  return page
    .getByRole("region", { name: /Visibilité sur la page/ })
    .getByLabel(/d.où vient l.autorisation/i)
    .first();
}

test.describe("Le consentement de diffusion d'une participante", () => {
  /**
   * LE PARCOURS RGPD DU TREMPLIN. Une participante accepte d'être nommée sur la
   * page publique de l'édition, puis se ravise — c'est un droit (art. 7-3), et
   * son retrait doit être IMMÉDIAT.
   *
   * Trois choses ne se vérifient qu'ici :
   *
   * - l'ISR. La page publique est mise en cache 300 s. Les actions de
   *   visibilité appellent `revalidatePath(PUBLIC_EDITION_ROUTE, "layout")`
   *   pour cette raison exacte ; le test visite la page AVANT le retrait (elle
   *   se met donc en cache) puis juste après. Sans la revalidation, il verrait
   *   l'ancienne page — et en production, la personne resterait nommée.
   * - la CASCADE PHOTO. `getPublicPhotos` bloque une photo dès qu'un des tags
   *   n'est pas couvert : retirer le consentement d'une participante doit
   *   dépublier les photos où elle figure. Personne ne pense à cliquer là.
   * - le CLOISONNEMENT. Le consentement de galerie n'est pas celui du chapitre
   *   « montée sur scène » (`tremplin_registration_phases.public`), ni celui de
   *   l'annuaire. Le code sépare les trois avec insistance ; rien ne le
   *   vérifiait ensemble.
   */
  test("elle paraît, puis se retire — et tout ce qui la nommait suit", async ({
    context,
    page,
    browser,
  }) => {
    edition = await creerEdition({ statut: "clos" });
    const elle = await ajouterParticipante(edition, { nom: "Douce Ravel-E2E" });
    // Elle est aussi dans la cohorte du chapitre 2, SANS consentement de phase :
    // c'est le voisin dont le consentement de galerie ne doit pas déborder.
    await inscrireEnPhase(elle, "montee_sur_scene", false);
    await ajouterAtelier(edition, {
      titre: "Filage sur la grande scène",
      phase: "montee_sur_scene",
      auProgrammePublic: true,
    });
    await ajouterPhoto(edition, {
      legende: "La soirée finale (photo E2E)",
      participantes: [elle],
    });

    const anonyme = await browser.newContext();
    const vuePublique = await anonyme.newPage();

    // ── 0. Avant tout accord : elle n'est nulle part, la photo non plus ──────
    // L'ancre d'abord : sans elle, une page en 404 rendrait toutes les
    // assertions « absente » vraies pour la mauvaise raison.
    await vuePublique.goto(edition.urlPublique);
    await expect(vuePublique.getByRole("heading", { name: /Conf de test/ })).toBeVisible();
    await expect(vuePublique.getByText(elle.nom)).toHaveCount(0);
    await expect(vuePublique.getByText("La soirée finale (photo E2E)")).toHaveCount(0);

    // ── 1. L'orga enregistre son accord ──────────────────────────────────────
    await seConnecter(context, COMPTES.orga);
    const visibilite = `${edition.urlAdmin}/participantes/${elle.registrationId}/visibilite`;
    await page.goto(visibilite);
    // L'origine de l'accord est obligatoire : l'orga atteste d'un recueil
    // EXTERNE, elle ne peut pas se faire passer pour la personne elle-même.
    await origineDeLAccord(page).selectOption("email");
    await confirmer(page, /^Rendre visible du public$/, /^Rendre visible$/);

    await expect
      .poll(() => consentementGalerie(elle.registrationId), { timeout: 10_000 })
      .toEqual({ public: true, horodate: true });
    // Démontrabilité (art. 7.1) : l'accord est journalisé AVEC son origine.
    expect(await journalConsentement(elle.registrationId)).toEqual([
      { action: "accorde", base: "email" },
    ]);

    // ── 2. Elle paraît sur la page publique, la photo avec elle ─────────────
    await vuePublique.goto(edition.urlPublique);
    await expect(vuePublique.getByText(elle.nom).first()).toBeVisible();
    await expect(vuePublique.getByText("La soirée finale (photo E2E)")).toBeVisible();

    // ── 3. …et PAS sur le chapitre 2, qui parle d'autre chose ───────────────
    // Le roster « montée sur scène » lit `tremplin_registration_phases.public`,
    // un consentement distinct recueilli pour une autre diffusion. Elle est
    // dans la cohorte, donc comptée — jamais nommée.
    // Même précaution qu'à l'étape 0 : on s'assure d'être SUR le chapitre 2
    // avant d'affirmer qu'elle n'y est pas.
    await vuePublique.goto(`${edition.urlPublique}/montee-sur-scene`);
    await expect(vuePublique.getByRole("heading", { name: /En route vers/ })).toBeVisible();
    await expect(vuePublique.getByText(elle.nom)).toHaveCount(0);

    // ── 4. Elle se ravise ────────────────────────────────────────────────────
    await page.goto(visibilite);
    await confirmer(page, /^Masquer du public$/, /^Masquer$/);

    await expect
      .poll(() => consentementGalerie(elle.registrationId), { timeout: 10_000 })
      .toEqual({ public: false, horodate: false });
    expect(await journalConsentement(elle.registrationId)).toEqual([
      { action: "accorde", base: "email" },
      { action: "retire", base: "self" },
    ]);

    // ── 5. Le retrait est IMMÉDIAT sur la page publique, photo comprise ──────
    // La page est en cache ISR 300 s : sans la revalidation des actions, cette
    // visite servirait encore l'écran de l'étape 2.
    await vuePublique.goto(edition.urlPublique);
    await expect(vuePublique.getByText(elle.nom)).toHaveCount(0);
    await expect(vuePublique.getByText("La soirée finale (photo E2E)")).toHaveCount(0);

    await anonyme.close();
  });
});

test.describe("Rattacher une coach à un atelier", () => {
  /**
   * LE SEUL CHEMIN par lequel les noms des participantes atteignent quelqu'un
   * qui n'est ni l'orga ni la personne concernée. Le rattachement est donc une
   * décision d'accès à des données personnelles, prise depuis l'admin.
   *
   * L'espace coach est borné EN SQL (`getCoachAteliers(coachId, …)`) — la faute
   * y est rendue impossible plutôt que testée (`principes-tests.md` §4). Ce que
   * ce parcours garde est l'autre moitié : que les deux gestes d'admin sont
   * BRANCHÉS sur cette borne. Rattacher ouvre exactement un atelier, retirer le
   * referme, et le reste de l'édition n'a jamais été visible.
   *
   * La session de la coach est forgée avec `isCoach` (`e2e/session.ts`) : le
   * rôle est lu à la CONNEXION, donc c'est l'état d'une personne qui se
   * reconnecte après son rattachement. Ce que la base doit porter, elle, est
   * vérifié en base (`estMarqueCoach`).
   */
  test("elle voit son atelier et ses participantes — et rien d'autre", async ({
    context,
    page,
    browser,
  }) => {
    edition = await creerEdition({ statut: "en_cours" });
    const sienne = await ajouterAtelier(edition, { titre: "Répétition des pitchs (E2E)" });
    const autre = await ajouterAtelier(edition, { titre: "Atelier d'à côté (E2E)" });
    const coachee = await ajouterParticipante(edition, { nom: "Ombeline Sarrat-E2E" });
    const inconnue = await ajouterParticipante(edition, { nom: "Perrine Vaillant-E2E" });
    await placerDansAtelier(sienne.atelierId, coachee);
    await placerDansAtelier(autre.atelierId, inconnue);
    const coach = await creerCompte(edition, "Sidonie Aubert-E2E");

    const sonContexte = await browser.newContext();
    await seConnecter(sonContexte, { id: coach.userId, isCoach: true });
    const sonEspace = await sonContexte.newPage();
    const sonUrl = `/mon-espace/coaching/${edition.editionId}`;

    // ── 0. Sans mission, l'édition n'existe pas pour elle ────────────────────
    // `notFound()` et non une page vide : pas de fuite d'existence. On juge sur
    // l'écran INTROUVABLE, jamais sur le code HTTP — la page passe par la
    // coquille de `mon-espace/loading.tsx`, donc l'en-tête part en 200 avant que
    // le rendu ne décide. Un test qui guetterait un 404 mesurerait le streaming,
    // pas la garde.
    await sonEspace.goto(sonUrl);
    await expect(sonEspace.getByRole("heading", { name: "Page introuvable" })).toBeVisible();

    // ── 1. L'orga la rattache à un atelier ───────────────────────────────────
    await seConnecter(context, COMPTES.orga);
    await page.goto(`${edition.urlAdmin}/ateliers/${sienne.atelierId}/coachs`);
    await page.getByRole("button", { name: /ajouter un coach/i }).click();
    const modale = page.getByRole("dialog");
    await modale.getByRole("combobox").fill(coach.nom);
    await modale.getByRole("option", { name: new RegExp(coach.nom, "i") }).first().click();
    await modale.getByRole("button", { name: /^Ajouter ce coach$/ }).click();

    await expect
      .poll(() => coachsDeLAtelier(sienne.atelierId), { timeout: 10_000 })
      .toEqual([coach.userId]);
    // Le marqueur de rôle est posé APRÈS le lien, en deux écritures distinctes :
    // on l'attend donc lui aussi plutôt que de le lire dans l'intervalle. C'est
    // lui qui ouvrira son espace à sa prochaine connexion.
    await expect
      .poll(() => estMarqueCoach(coach.userId), { timeout: 10_000 })
      .toBe(true);

    // ── 2. Son espace s'ouvre — sur son atelier, et sur lui seul ─────────────
    await sonEspace.goto(sonUrl);
    await expect(sonEspace.getByText(sienne.titre).first()).toBeVisible();
    await expect(sonEspace.getByText(coachee.nom).first()).toBeVisible();
    // La cloison : l'autre atelier de la MÊME édition et sa participante
    // restent hors de portée. C'est ce qu'un scope oublié ferait fuiter.
    await expect(sonEspace.getByText(autre.titre)).toHaveCount(0);
    await expect(sonEspace.getByText(inconnue.nom)).toHaveCount(0);

    // ── 3. L'orga la retire : la porte se referme ───────────────────────────
    await page.goto(`${edition.urlAdmin}/ateliers/${sienne.atelierId}/coachs`);
    await confirmer(page, /^Retirer$/, /^Retirer$/);

    await expect
      .poll(() => coachsDeLAtelier(sienne.atelierId), { timeout: 10_000 })
      .toEqual([]);
    await sonEspace.goto(sonUrl);
    await expect(sonEspace.getByRole("heading", { name: "Page introuvable" })).toBeVisible();

    await sonContexte.close();
  });
});

test.describe("L'accord d'une accompagnante à être citée", () => {
  /**
   * LE TROISIÈME CONSENTEMENT DU TREMPLIN, et le seul qui publie un nom sur
   * DEUX pages à la fois.
   *
   * Il ne vit ni sur l'inscription (galerie des finalistes) ni sur la phase
   * (chapitre « montée sur scène ») mais sur le COMPTE
   * (`coach_profiles.public`) : une accompagnante est citée sur la page de
   * CHAQUE édition qu'elle a animée, et sur `/partenaires` (« Elles donnent de
   * leur temps »), toutes éditions confondues. Une seule révocation vaut donc
   * partout — et c'est précisément ce que rien ne suivait.
   *
   * CE QUE CE NIVEAU VOIT, ET LUI SEUL. Les trois gardes de la requête (accord,
   * atelier au programme public, édition publiée) sont déjà tenues en
   * intégration (`accompagnantes-publiques.integration.test.ts`) ; on ne les
   * rejoue pas. Restent deux choses qu'aucun test de pièce ne peut voir :
   *
   * - LE MONTAGE. L'interrupteur de la fiche coach est-il branché sur les deux
   *   surfaces publiques, ou seulement sur celle qu'on a sous les yeux en le
   *   cochant ?
   * - L'IMMÉDIATETÉ. `/partenaires` est une page STATIQUE à `revalidate = 300`
   *   (mesuré au build : `○ /partenaires … 5m`). Sans revalidation explicite,
   *   un accord retiré y reste affiché jusqu'à cinq minutes — un retrait RGPD
   *   (art. 7-3) qui attend le prochain passage du cache. Le test visite la
   *   page AVANT (elle se met donc en cache) puis juste après chaque geste,
   *   comme le parcours de la galerie le fait pour la page d'édition.
   */
  test("elle est citée sur les deux pages publiques, et se retire des deux", async ({
    context,
    page,
    browser,
  }) => {
    edition = await creerEdition({ statut: "clos" });
    // Au programme public : un atelier qu'on n'annonce pas n'expose pas non plus
    // son encadrement (garde 2 de `listAccompagnantesPubliques`).
    const atelier = await ajouterAtelier(edition, {
      titre: "Atelier CFP accompagné (E2E)",
      auProgrammePublic: true,
    });
    const elle = await rattacherAccompagnante(edition, atelier.atelierId, {
      nom: "Marguerite Delpech-E2E",
      role: "Coach produit (E2E)",
    });

    const anonyme = await browser.newContext();
    const vuePublique = await anonyme.newPage();
    const partenaires = "/partenaires";

    // ── 0. Fiche saisie, accord absent : elle n'est citée nulle part ──────────
    // Les ancres d'abord : sans elles, une page en panne rendrait vraies toutes
    // les assertions « absente », et pour la mauvaise raison.
    await vuePublique.goto(edition.urlPublique);
    await expect(vuePublique.getByRole("heading", { name: /Conf de test/ })).toBeVisible();
    await expect(vuePublique.getByText(elle.nom)).toHaveCount(0);

    // Sur `/partenaires`, cette absence est FAIBLE et on le sait : la page est
    // prérendue au build, donc elle ne peut pas nommer quelqu'un créé après. Ce
    // qui garde vraiment l'accord ici, c'est l'étape 5 (elle en part alors que
    // la page vient d'être revalidée) — vérifié en retirant le filtre de
    // consentement de la requête : c'est bien là que le test tombe.
    await vuePublique.goto(partenaires);
    // Ancre re-jugée le 2026-10-15 : « Devenir coach bénévole » a quitté la
    // page avec la section « Comment nous aider ? » (rangées par façon d'aider).
    await expect(vuePublique.getByRole("heading", { name: /Qui nous aide/ })).toBeVisible();
    await expect(vuePublique.getByText(elle.nom)).toHaveCount(0);

    // ── 1. L'orga coche son accord sur sa fiche ───────────────────────────────
    await seConnecter(context, COMPTES.orga);
    const ficheCoach = `${edition.urlAdmin}/ateliers/${atelier.atelierId}/coachs/${elle.userId}`;
    await page.goto(ficheCoach);
    await page.getByRole("switch", { name: "Citée sur le site public" }).click();

    await expect
      .poll(() => consentementAccompagnante(elle.userId), { timeout: 10_000 })
      .toEqual({ public: true, horodate: true });

    // ── 2. Elle est citée sur la page de l'édition, avec son rôle ─────────────
    await vuePublique.goto(edition.urlPublique);
    // Le rôle est jugé DANS SA vignette : cherché sur la page entière, il
    // pourrait venir de la voisine (le rôle, lui, n'est pas unique).
    const saVignette = vuePublique.getByRole("listitem").filter({ hasText: elle.nom });
    await expect(saVignette.getByText(elle.role)).toBeVisible();

    // ── 3. …et sur /partenaires, qui parle de toutes les éditions ────────────
    await vuePublique.goto(partenaires);
    await expect(vuePublique.getByText(elle.nom).first()).toBeVisible();

    // ── 4. Elle se ravise ────────────────────────────────────────────────────
    await page.goto(ficheCoach);
    await page.getByRole("switch", { name: "Citée sur le site public" }).click();

    // L'horodatage part avec l'accord : on ne garde pas la trace d'un
    // consentement qui n'a plus cours.
    await expect
      .poll(() => consentementAccompagnante(elle.userId), { timeout: 10_000 })
      .toEqual({ public: false, horodate: false });

    // ── 5. Son nom quitte les DEUX pages, tout de suite ──────────────────────
    // Ancre positive avant chaque absence, ici comme à l'étape 0 : une page
    // d'édition en panne rendrait ce retrait RGPD « vérifié » sans rien vérifier.
    await vuePublique.goto(edition.urlPublique);
    await expect(vuePublique.getByRole("heading", { name: /Conf de test/ })).toBeVisible();
    await expect(vuePublique.getByText(elle.nom)).toHaveCount(0);

    await vuePublique.goto(partenaires);
    await expect(vuePublique.getByRole("heading", { name: /Qui nous aide/ })).toBeVisible();
    await expect(vuePublique.getByText(elle.nom)).toHaveCount(0);

    await anonyme.close();
  });
});

test.describe("Le palmarès d'une édition", () => {
  /**
   * RÉCOMPENSER SANS NOMMER. Une participante peut gagner et refuser d'être
   * citée : le palmarès affiche alors son rang et son prix, et « Gagnante (non
   * communiquée) » à la place de son nom.
   *
   * C'est le QUATRIÈME canal du même consentement (`registrations.public`),
   * après la galerie des finalistes, les photos et le talk pitché — et il est
   * calculé deux fois, à deux endroits différents : le palmarès filtre le nom en
   * JavaScript (`nom: r.public ? r.nom : null`), la carte de récompense en SQL
   * (`CASE WHEN r."public" THEN …`). Deux gardes pour un seul accord, écrites
   * dans deux langages : c'est exactement le genre de paire qui dérive.
   *
   * Le gating lui-même est tenu en intégration ; ce que ce parcours garde est le
   * MONTAGE, sur les gestes réels de l'orga : classer au podium, créer une
   * récompense, l'attribuer, puis recueillir l'accord. Quatre écritures dont
   * aucune n'était traversée, et la plus coûteuse des régressions possibles ici
   * est de nommer sur la page d'accueil du Tremplin quelqu'un qui a refusé.
   */
  test("il montre le rang sans nommer celle qui n'a pas consenti", async ({
    context,
    page,
    browser,
  }) => {
    edition = await creerEdition({ statut: "clos" });
    // Finaliste (elle a concouru), mais AUCUN accord de diffusion.
    const elle = await ajouterParticipante(edition, { nom: "Solange Vergnaud-E2E" });
    const intitule = "Une présentation en meetup (E2E)";

    const anonyme = await browser.newContext();
    const vuePublique = await anonyme.newPage();

    // ── 0. Avant tout : la page publique existe, et n'a pas de palmarès ───────
    // Cette visite MET LA PAGE EN CACHE (ISR 300 s) : sans elle, le premier
    // affichage aurait lieu APRÈS les écritures et se rendrait à neuf, donc
    // l'étape 3 ne dirait rien de la revalidation.
    //
    // Ce qu'elle garde EXACTEMENT, mesuré : la CHAÎNE, pas chaque maillon.
    // Neutraliser la seule revalidation du classement laisse le test vert —
    // l'écriture voisine (la récompense) revalide la même route et rafraîchit
    // tout. Il faut les neutraliser TOUTES pour qu'il tombe (il tombe alors
    // ici même, sur le titre du palmarès). Donc : « au moins une de ces
    // écritures ramène la page publique à jour », et pas mieux. Écrit pour que
    // personne ne lui prête une garantie qu'il n'a pas.
    await vuePublique.goto(edition.urlPublique);
    await expect(vuePublique.getByRole("heading", { name: /Conf de test/ })).toBeVisible();
    await expect(vuePublique.getByRole("heading", { name: /les gagnantes et leur prix/i })).toHaveCount(0);

    // ── 1. L'orga la classe première ─────────────────────────────────────────
    await seConnecter(context, COMPTES.orga);
    const fiche = `${edition.urlAdmin}/participantes/${elle.registrationId}`;
    await page.goto(`${fiche}/classement`);
    // `getByRole("textbox")` et non `getByLabel` : la section porte le même
    // intitulé accessible que le champ, et le sélecteur trouverait les deux.
    await page.getByRole("textbox", { name: /classement au podium/i }).first().fill("1");
    await page.getByRole("button", { name: /enregistrer le classement/i }).first().click();
    // On juge en BASE, jamais sur le message de succès : celui-ci s'efface au
    // rafraîchissement que l'action déclenche, et l'attendre revient à courir
    // contre lui (`podiumEtRecompenses` dit pourquoi on ne relit pas l'écran
    // non plus).
    await expect
      .poll(() => podiumEtRecompenses(elle.registrationId), { timeout: 10_000 })
      .toEqual({ classement: 1, recompenses: [] });

    // ── 2. …crée la récompense du rang, et la lui attribue ───────────────────
    await page.goto(`${edition.urlAdmin}/recompenses`);
    await page.getByRole("button", { name: /ajouter une récompense/i }).click();
    const modale = page.getByRole("dialog");
    await modale.getByLabel("Intitulé").fill(intitule);
    await modale.getByLabel(/rang du podium/i).fill("1");
    await modale.getByRole("button", { name: /^Ajouter$/ }).click();
    // La modale rafraîchit la liste côté client. On ne suspend pas le test à ce
    // rafraîchissement pour savoir si l'écriture a eu lieu — on le demande à la
    // base, puis on rouvre la liste nous-mêmes.
    await expect
      .poll(() => recompensesDeLEdition(edition!.editionId), { timeout: 10_000 })
      .toEqual([intitule]);

    // On suit le lien de la récompense créée, comme l'orga : son identifiant
    // n'est pas connu du test, et l'écran est le chemin réel vers l'attribution.
    await page.goto(`${edition.urlAdmin}/recompenses`);
    // `.first()` sur ces trois-là pour la raison donnée sur `origineDeLAccord` :
    // un écran d'admin streamé peut porter un instant deux copies du même
    // contrôle, et elles disent la même chose.
    await page
      .getByRole("link", { name: new RegExp(intitule.replace(/[()]/g, "\\$&")) })
      .first()
      .click();
    await page.getByRole("link", { name: /bénéficiaire/i }).first().click();
    await page.getByLabel("Bénéficiaire").first().selectOption({ label: elle.nom });
    await page.getByRole("button", { name: /enregistrer l.attribution/i }).first().click();
    // Même raison : c'est la ligne en base qui atteste l'attribution.
    await expect
      .poll(() => podiumEtRecompenses(elle.registrationId), { timeout: 10_000 })
      .toEqual({ classement: 1, recompenses: [intitule] });

    // ── 3. Le public voit le prix, et pas son nom ────────────────────────────
    // La page était en cache depuis l'étape 0 : si le classement ou
    // l'attribution cessaient de la revalider, on relirait l'écran d'avant.
    await vuePublique.goto(edition.urlPublique);
    await expect(vuePublique.getByRole("heading", { name: /les gagnantes et leur prix/i })).toBeVisible();
    // Le rang est public — c'est le palmarès de l'édition ; le nom, non.
    await expect(vuePublique.getByText("1ᵉʳ prix").first()).toBeVisible();
    await expect(vuePublique.getByText("Gagnante (non communiquée)").first()).toBeVisible();
    await expect(vuePublique.getByText(intitule).first()).toBeVisible();
    // Ni dans le palmarès, ni sur la carte de la récompense (« Attribuée à »).
    await expect(vuePublique.getByText(elle.nom)).toHaveCount(0);
    await expect(vuePublique.getByText(/Attribuée à/)).toHaveCount(0);

    // ── 4. Elle accepte finalement d'être citée ──────────────────────────────
    await page.goto(`${fiche}/visibilite`);
    await origineDeLAccord(page).selectOption("email");
    await confirmer(page, /^Rendre visible du public$/, /^Rendre visible$/);
    await expect
      .poll(() => consentementGalerie(elle.registrationId), { timeout: 10_000 })
      .toEqual({ public: true, horodate: true });

    // ── 5. Les DEUX canaux la nomment, tout de suite ─────────────────────────
    await vuePublique.goto(edition.urlPublique);
    await expect(vuePublique.getByText("Gagnante (non communiquée)")).toHaveCount(0);
    await expect(vuePublique.getByText(elle.nom).first()).toBeVisible();
    await expect(vuePublique.getByText(`Attribuée à ${elle.nom}`)).toBeVisible();

    await anonyme.close();
  });
});

test.describe("Supprimer une édition", () => {
  /**
   * L'ACTION LA PLUS DESTRUCTRICE DU PRODUIT : elle emporte les participantes,
   * les ateliers, les photos, le jury, les récompenses et les documents.
   *
   * Le refus d'une saisie qui ne correspond pas est déjà tenu ailleurs (le
   * verrou client comme la revérification serveur) ; on ne le rejoue pas. Ce que
   * seul ce niveau voit :
   *
   * - LES DEUX CÔTÉS ATTENDENT LA MÊME CHOSE. L'écran affiche un nom à retaper,
   *   l'action le revérifie. Les deux passent par `plierConfirmation` — on tape
   *   donc une VARIANTE (casse, accents, apostrophe, espaces) de ce que la page
   *   affiche : elle doit débloquer le bouton ET satisfaire le serveur. Si un
   *   côté se met à comparer strictement, la suppression devient impossible et
   *   le test le dit (redirection `?err=edition_nom`).
   * - LA CASCADE EST RÉELLE. Une action qui redirige sans rien effacer passerait
   *   pour un succès ; on relit la base.
   * - LA PAGE PUBLIQUE DEVIENT UN TOMBSTONE, et ne nomme plus personne.
   */
  test("le nom retapé délivre la cascade, et la page publique le dit", async ({
    context,
    page,
    browser,
  }) => {
    edition = await creerEdition({ statut: "clos" });
    const elle = await ajouterParticipante(edition, {
      nom: "Blandine Chastel-E2E",
      publique: true,
    });
    await ajouterAtelier(edition, { titre: "Un atelier à emporter (E2E)" });
    await ajouterPhoto(edition, { legende: "Photo à emporter (E2E)", participantes: [elle] });

    const anonyme = await browser.newContext();
    const vuePublique = await anonyme.newPage();
    await vuePublique.goto(edition.urlPublique);
    await expect(vuePublique.getByText(elle.nom).first()).toBeVisible();

    await seConnecter(context, COMPTES.orga);
    await page.goto(`${edition.urlAdmin}/retrait`);

    await page.getByRole("button", { name: /supprimer cette édition/i }).click();
    const dialogue = page.getByRole("alertdialog");
    await expect(dialogue).toBeVisible();

    // Le nom est LU SUR L'ÉCRAN, jamais repris de la fixture : c'est ce que
    // l'orga voit qui doit fonctionner. (Les guillemets français portent des
    // espaces insécables : on prend l'intérieur, puis on rabote les blancs.)
    const indice = await dialogue.getByText(/^Le nom/).innerText();
    const nomAffiche = (/«([^»]*)»/.exec(indice)?.[1] ?? "").replace(/[\s ]+/g, " ").trim();
    expect(nomAffiche).toBe(edition.nom);

    // La variante : majuscules, accent et espaces multiples. Une personne qui
    // recopie ce qu'elle voit ne tape pas au caractère près.
    await dialogue
      .getByLabel(/réécris le nom de l.édition/i)
      .fill(`  ${nomAffiche.toUpperCase().replace("TREMPLIN", "TRÉMPLIN")}  `);
    await dialogue.getByRole("button", { name: /supprimer définitivement/i }).click();

    // Le retour au registre vaut accusé de réception : un refus serveur aurait
    // ramené sur la page de retrait avec son message d'erreur.
    await expect(page).toHaveURL(/\/admin\/tremplins$/);

    // LA VÉRITÉ EST EN BASE.
    await expect
      .poll(() => resteDeLEdition(edition!.editionId), { timeout: 10_000 })
      .toEqual({ supprimee: true, participantes: 0, ateliers: 0, photos: 0 });

    // Et l'adresse publique ne nomme plus personne : elle dit ce qui s'est
    // passé, plutôt que de casser un lien déjà indexé.
    await vuePublique.goto(edition.urlPublique);
    await expect(
      vuePublique.getByRole("heading", { name: /cette édition a été supprimée/i }),
    ).toBeVisible();
    await expect(vuePublique.getByText(elle.nom)).toHaveCount(0);

    await anonyme.close();
  });
});
