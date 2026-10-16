import { test, expect } from "@playwright/test";
import { exigerDecor, ANNEE, DATE_CONF } from "./decor";
import { seConnecter } from "./session";
import {
  creerMembre,
  effacerMembre,
  effacerConferenceJetable,
  conferenceJetable,
  fermerBase,
  pool,
  publierFiche,
  type MembreJetable,
} from "./comptes-jetables";

/**
 * IMPORTER SES TALKS, de bout en bout : coller un export, vérifier le plan à
 * l'écran, confirmer — et lire la VÉRITÉ en base puis sur la fiche publique.
 * C'est le parcours qu'Aurélie Vache ferait avec son export Notist : un même
 * titre donné à deux conférences, l'une au répertoire, l'autre inconnue.
 *
 * Le niveau E2E est le seul qui voie le câblage réel (le formulaire poste bien
 * vers l'action, le plan affiché correspond à ce qui s'écrit) — la leçon de
 * `docs/principes-tests.md` §2, apprise sur ce même écran de talks.
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
 * Même garde d'hydratation que `parcours-talks.spec.ts` : les formulaires
 * (useActionState) ont besoin de React ; y écrire avant l'hydratation part
 * dans un DOM que React va réinitialiser. Humainement improbable, mais la
 * suite complète sous charge y arrive.
 */
async function attendreHydratation(page: import("@playwright/test").Page) {
  await page.waitForFunction(() => {
    const el = document.querySelector("#import-texte");
    return !!el && Object.keys(el).some((k) => k.startsWith("__react"));
  });
}

/**
 * Même garde, sur le formulaire du TEMPS 2 (la confirmation) : c'est un autre
 * arbre React, monté après la prévisualisation. Sans elle, le clic pouvait
 * partir avant l'hydratation, être avalé, et le test relançait l'import — or
 * chaque envoi consomme le quota (3/h) : au 4ᵉ, le serveur refusait et le
 * rejeu rougissait sans que rien ne soit cassé. On attend le bon signal une
 * fois, on clique une fois.
 */
async function attendreHydratationConfirmation(
  page: import("@playwright/test").Page,
) {
  await page.waitForFunction(() => {
    const el = document.querySelector('input[name="texte"]');
    return !!el && Object.keys(el).some((k) => k.startsWith("__react"));
  });
}

/**
 * Confirme l'import : UN clic, une fois le formulaire hydraté. Le relanceur
 * de clic d'avant traitait le symptôme (clic avalé faute d'hydratation) en
 * recliquant, ce qui consommait le quota d'imports — le test finissait par
 * rougir à cause de sa propre protection. On attend la cause.
 */
async function importerLaSelection(page: import("@playwright/test").Page) {
  await attendreHydratationConfirmation(page);
  await page.getByRole("button", { name: /importer la sélection/i }).click();
  // Budget large ASSUMÉ : l'écriture elle-même prend ~200 ms (mesuré sur un
  // import réel de 73 talks), mais la toute PREMIÈRE invocation de l'action
  // sur un serveur qui vient de démarrer charge son module pendant que
  // l'autre navigateur travaille — seul ce tour-là dépasse 15 s.
  await expect(page.getByText(/import terminé/i)).toBeVisible({ timeout: 45_000 });
}

/** Les talks + occurrences de la fiche, lus EN BASE. */
async function talksEnBase(userId: number) {
  const { rows } = await pool().query(
    `SELECT t.titre, o.conference, o.proposition_id IS NOT NULL AS en_attente
       FROM speaker_talks t
       LEFT JOIN talk_occurrences o ON o.talk_id = t.id
       JOIN speaker_profiles sp ON sp.id = t.speaker_profile_id
      WHERE sp."userId" = $1
      ORDER BY t.id, o.id`,
    [userId],
  );
  return rows as { titre: string; conference: string | null; en_attente: boolean }[];
}

test("coller un export → vérifier le plan → importer : la fiche reflète exactement le plan", async ({
  context,
  page,
  browser,
}) => {
  jetable = await creerMembre({ nom: "Gaëlle Test", fiche: "prete" });
  await publierFiche(jetable);
  const conf = conferenceJetable();
  confJetableSlug = conf.slug;

  const fichier = JSON.stringify([
    // Un même talk à DEUX conférences : le plan doit les grouper en UN talk.
    { title: "Comprendre Kubernetes", event: "DevFest Toulouse", date: DATE_CONF },
    { title: "Comprendre Kubernetes", event: `${conf.nom} ${ANNEE}`, city: "Helsinki" },
    // Une entrée sans titre : sautée et ANNONCÉE, jamais silencieuse.
    { event: "Conf sans titre" },
  ]);

  await seConnecter(context, { id: jetable.userId });
  await page.goto("/mon-espace/talks");
  // Le point d'entrée existe depuis la liste des talks (le câblage, encore).
  await page.getByRole("link", { name: /importer mes talks/i }).click();
  await expect(page).toHaveURL(/\/mon-espace\/talks\/importer/);
  await attendreHydratation(page);

  // ── Temps 1 : coller, analyser ──
  await page.getByLabel(/colle son contenu ici/i).fill(fichier);
  await page.getByRole("button", { name: /analyser le fichier/i }).click();

  // ── Temps 2 : le plan dit ce qui va se passer, y compris ce qui est sauté ──
  await expect(page.getByText(/1 talk lu/i)).toBeVisible();
  await expect(page.getByText(/1 entrée illisible/i)).toBeVisible();
  await expect(page.getByText(/conférence du répertoire/i)).toBeVisible();
  await expect(page.getByText(/sera proposée à l'équipe/i)).toBeVisible();

  // ── Temps 3 : le récapitulatif, puis LA BASE ──
  await importerLaSelection(page);

  await expect
    .poll(() => talksEnBase(jetable!.userId), { timeout: 10_000 })
    .toEqual([
      // Le talk de la checklist du décor (fiche « prete ») reste tel quel.
      expect.objectContaining({ titre: "Un sujet que j'aimerais présenter" }),
      // Le talk importé : UNE identité, DEUX occurrences.
      expect.objectContaining({
        titre: "Comprendre Kubernetes",
        // Libellé SNAPSHOT recomposé : l'édition en cours du décor est reconnue.
        conference: `DevFest Toulouse ${ANNEE}`,
        en_attente: false,
      }),
      expect.objectContaining({
        titre: "Comprendre Kubernetes",
        conference: conf.nom,
        en_attente: true,
      }),
    ]);

  // Sur la fiche PUBLIQUE : la conférence du répertoire paraît, celle qui
  // attend l'arbitrage reste invisible — même invariant que la saisie manuelle.
  const anonyme = await browser.newContext();
  try {
    const vue = await anonyme.newPage();
    await vue.goto(`/speakeuses/${jetable.profileId}`);
    await expect(vue.getByText("Comprendre Kubernetes").first()).toBeVisible();
    await expect(vue.getByText("DevFest Toulouse").first()).toBeVisible();
    await expect(vue.getByText(conf.nom)).toHaveCount(0);
  } finally {
    await anonyme.close();
  }
});

test("rejouer le même fichier : tout est reconnu déjà là, zéro doublon écrit", async ({
  context,
  page,
}) => {
  jetable = await creerMembre({ nom: "Hélène Test", fiche: "prete" });
  const fichier = JSON.stringify([
    { title: "Talk unique", event: "DevFest Toulouse", date: DATE_CONF },
  ]);

  await seConnecter(context, { id: jetable.userId });
  for (const passage of [1, 2]) {
    await page.goto("/mon-espace/talks/importer");
    await attendreHydratation(page);
    await page.getByLabel(/colle son contenu ici/i).fill(fichier);
    await page.getByRole("button", { name: /analyser le fichier/i }).click();
    if (passage === 2) {
      // Le plan ANNONCE le doublon, et le talk déjà là arrive DÉCOCHÉ.
      await expect(page.getByText(/déjà sur ta fiche/i).first()).toBeVisible();
      const case2 = page.getByRole("checkbox").first();
      await expect(case2).toBeChecked({ checked: false });
      // On le coche quand même : même forcé, rien ne doit s'écrire en double.
      await case2.check();
    }
    await importerLaSelection(page);
  }

  const talks = await talksEnBase(jetable.userId);
  expect(talks.filter((t) => t.titre === "Talk unique")).toHaveLength(1);
});
