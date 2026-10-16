import { test, expect } from "@playwright/test";
import { exigerDecor } from "./decor";
import { seConnecter } from "./session";
import { fermerBase } from "./comptes-jetables";
import {
  creerEdition,
  ajouterParticipante,
  inscrireEnPhase,
  ajouterAtelier,
  effacerEdition,
  type EditionJetable,
} from "./tremplin-jetable";
// Le test lit le jour et le libellé avec les MÊMES fonctions que la page (le
// dépôt le fait déjà pour `slugify`, cf. `e2e/comptes-jetables.ts`) : sinon il
// vise un `id` et une chaîne construits avec SA notion d'aujourd'hui, et le jour
// où la définition bouge côté serveur, il rougit pour une mauvaise raison — ou
// mesure la mauvaise bande sans rien dire. Le LIBELLÉ exact, lui, reste épinglé
// en dur côté Vitest (`mon-agenda-page.test.tsx`), là où il se juge.
import { aujourdhuiParis, dateParis } from "../src/lib/tremplin-statut";
import { jourAgendaFr } from "../src/lib/format";

/**
 * MON AGENDA — L'ARRIVÉE SUR LA PAGE.
 *
 * CE QUE CE PARCOURS TIENT, en une phrase : **ce qu'on lit en haut de l'écran en
 * arrivant, c'est aujourd'hui**. Son mois dans la bande collante, sa date juste
 * dessous, et le passé hors champ. Le défaut qui l'a fait écrire est au registre
 * (`docs/principes-conception-ui.md`, 16/08/2026).
 *
 * SEUL CE NIVEAU PEUT LE VOIR. `mon-agenda-page.test.tsx` juge la structure (le
 * jour même a sa ligne, son mois, sa place) et il est resté vert pendant tout le
 * défaut : la position d'arrivée est le produit de deux règles CSS et d'un
 * `scrollIntoView` après hydratation, que jsdom ne calcule pas. On la MESURE
 * donc dans un vrai navigateur, en pixels, contre la seule référence qui ait un
 * sens : le bas des deux barres collantes du site.
 *
 * DÉCOR JETABLE, et pas le seed partagé : il faut du passé ET assez d'à-venir
 * pour que la fenêtre puisse réellement descendre jusqu'au jour même (sans quoi
 * le navigateur s'arrête au bas du document et la mesure ne dirait plus rien).
 * Ses dates sont calées sur LE JOUR MÊME — un décor à dates fixes finirait par
 * passer entièrement dans le passé et le test cesserait silencieusement de
 * garder quoi que ce soit. Et il SAUTE le mois courant (rien entre -60 et +30
 * jours) : c'est la configuration exacte du signalement.
 */

let edition: EditionJetable | null = null;

/**
 * Une date à `delta` jours d'aujourd'hui (AAAA-MM-JJ), dans le fuseau où la page
 * range son passé et son à-venir. Formatée en UTC, `jour(0)` désignait la veille
 * entre minuit et 2 h à Paris : un flake nocturne que personne n'aurait rattaché
 * à ce helper.
 */
const jour = (delta: number): string => dateParis(new Date(Date.now() + delta * 86_400_000));

test.afterEach(async () => {
  await effacerEdition(edition);
  edition = null;
});

test.afterAll(async () => {
  await fermerBase();
});

test.describe("Mon agenda", () => {
  test("s'ouvre sur aujourd'hui, calé sous les barres du site", async ({
    request,
    context,
    page,
  }) => {
    await exigerDecor(request);
    edition = await creerEdition({ statut: "en_cours" });
    const participante = await ajouterParticipante(edition, { nom: "Agenda E2E" });
    await inscrireEnPhase(participante, "cfp_et_pitch");
    // Deux séances derrière (le fil remonte), huit devant : de quoi défiler.
    // Rien entre les deux : le mois courant n'a aucune séance, donc aucun
    // en-tête à lui — la configuration du signalement.
    await ajouterAtelier(edition, { titre: "Séance passée (1)", date: jour(-120) });
    await ajouterAtelier(edition, { titre: "Séance passée (2)", date: jour(-60) });
    for (let i = 1; i <= 8; i++) {
      await ajouterAtelier(edition, { titre: `Séance à venir (${i})`, date: jour(30 + i * 7) });
    }
    await seConnecter(context, { id: participante.userId });

    await page.goto("/mon-espace/agenda");
    // La page est STREAMÉE (derrière `loading.tsx`) : le contenu arrive dans un
    // conteneur MASQUÉ, que le client déplace ensuite à sa place. Sous charge,
    // le document porte donc un instant DEUX copies du même contenu — le même
    // phénomène que les écrans d'admin (cf. `e2e/tremplin-jetable.ts`), et il a
    // fait tomber ce test au premier passage de la suite complète. On attend le
    // document recomposé avant de mesurer quoi que ce soit ; sans quoi on
    // mesurerait une copie qui n'est pas celle qu'on voit.
    await expect(page.getByRole("heading", { level: 1, name: "Mon agenda" })).toBeVisible();
    const repere = page.locator("#aujourdhui");
    await expect.poll(() => repere.count(), { timeout: 20_000 }).toBe(1);

    // La référence : le bas du fil d'Ariane, dernière des deux barres collantes.
    const fil = (await page
      .getByRole("navigation", { name: /fil d'ariane/i })
      .boundingBox())!;
    const basDesBarres = fil.y + fil.height;

    // Le calage arrive APRÈS l'hydratation : on attend la position, on ne la
    // lit pas une fois pour toutes. Avant correction, la ligne du jour se posait
    // 104 px plus bas (deux marges de défilement cumulées), sous une bande de
    // mois qui était celle du PASSÉ.
    await expect
      .poll(async () => (await repere.boundingBox())?.y ?? Number.POSITIVE_INFINITY, {
        message: "la ligne du jour doit arriver en haut de la fenêtre",
        timeout: 20_000,
      })
      .toBeLessThan(basDesBarres + 80);

    // 1. LA BANDE COLLÉE EN HAUT EST CELLE DU MOIS COURANT — c'est le cœur du
    //    signalement (« je vois encore mai ») : le mois du PASSÉ y restait et se
    //    lisait comme la date du jour. Le mois courant existe même sans aucune
    //    séance (`avecAujourdhui`), et les sections du passé sont donc toutes
    //    entièrement au-dessus de la fenêtre.
    const bande = (await page
      .locator(`#mois-avenir-${aujourdhuiParis().slice(0, 7)}`)
      .boundingBox())!;
    expect(
      Math.abs(bande.y - basDesBarres),
      "la bande de mois collée sous les barres doit être celle d'aujourd'hui, jamais celle du passé",
    ).toBeLessThanOrEqual(3);

    // 2. Et la ligne du jour se lit JUSTE dessous, jamais glissée derrière.
    const ligne = (await repere.boundingBox())!;
    expect(
      ligne.y,
      "la ligne du jour doit se poser sous la bande de mois, pas derrière elle",
    ).toBeGreaterThanOrEqual(bande.y + bande.height - 1);

    // 3. Ce qu'on lit, c'est bien la date du jour, ET le mot qui dit que c'est
    //    aujourd'hui : la couleur ne porte jamais l'information seule.
    await expect(repere).toContainText(jourAgendaFr(aujourdhuiParis())!);
    await expect(repere).toContainText(/aujourd'hui/i);

    // 4. Journée vide (le décor n'a rien ce mois-ci) : elle le dit, plutôt que
    //    de laisser un titre sans rien dessous.
    await expect(page.getByText(/rien à l'agenda aujourd'hui/i)).toBeVisible();
  });
});
