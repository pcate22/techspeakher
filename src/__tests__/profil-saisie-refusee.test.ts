import { describe, it, expect } from "vitest";
import { appliquerSaisieRefusee } from "@/lib/profil-saisie";
import { makeFiche } from "./test-helpers";

/**
 * LA SAISIE REFUSÉE DOIT REVENIR À L'ÉCRAN.
 *
 * Mesuré en navigateur : sur un refus serveur (« Cette adresse est déjà prise,
 * essaies-en une autre »), le champ réaffichait la valeur EN BASE. On lisait
 * donc le message à côté d'un champ qui ne contenait plus ce qu'on avait tapé —
 * impossible de voir ni de corriger ce qui avait été refusé (WCAG 3.3.1 / 3.3.3,
 * et le §6 du guide : « une erreur de validation CONSERVE la saisie »).
 *
 * Le correctif se pose ICI plutôt qu'aux vingt-quatre `defaultValue` du
 * formulaire : la saisie est fusionnée dans le profil que la vue rend, donc
 * chaque champ la retrouve sans le savoir. Un seul endroit à tenir, et rien à
 * recopier au prochain champ ajouté.
 */

const fiche = makeFiche();

describe("appliquerSaisieRefusee", () => {
  it("sans refus, le profil rendu est celui de la base", () => {
    expect(appliquerSaisieRefusee(fiche, undefined, ["slug"])).toBe(fiche);
  });

  it("un champ texte reprend la valeur tapée, pas celle en base", () => {
    const p = appliquerSaisieRefusee(fiche, { slug: ["aicha-benali"] }, ["slug"]);
    expect(p?.slug).toBe("aicha-benali");
    // Et rien d'autre ne bouge.
    expect(p?.bio).toBe(fiche.bio);
  });

  /** Un champ vidé exprès est une saisie comme une autre : on la respecte, sinon
   * le refus ferait « repousser » un texte qu'on venait d'effacer. */
  it("un champ vidé reste vide", () => {
    const p = appliquerSaisieRefusee(fiche, {}, ["titreProfil"]);
    expect(p?.titreProfil).toBeNull();
  });

  it("les listes de cases reprennent ce qui était coché", () => {
    const p = appliquerSaisieRefusee(fiche, { secteurs: ["RH / HRTech", "MedTech / Santé"] }, [
      "secteurs",
    ]);
    expect(p?.secteurs).toEqual(["RH / HRTech", "MedTech / Santé"]);
  });

  it("une liste entièrement décochée revient vide", () => {
    const p = appliquerSaisieRefusee(fiche, {}, ["secteurs"]);
    expect(p?.secteurs).toEqual([]);
  });

  /** Une case décochée n'envoie RIEN : son absence est l'information. */
  it("une case cochée reste cochée, une case décochée reste décochée", () => {
    const coche = appliquerSaisieRefusee(fiche, { contactEmailOk: ["on"] }, ["contactEmailOk"]);
    expect(coche?.contactEmailOk).toBe(true);
    const decoche = appliquerSaisieRefusee(fiche, {}, ["contactEmailOk"]);
    expect(decoche?.contactEmailOk).toBe(false);
  });

  /**
   * LE garde-fou de portée : la fusion ne touche QUE les champs de la section,
   * comme l'écriture. Une valeur glissée pour un champ d'ailleurs n'a pas plus
   * le droit de revenir à l'écran qu'elle n'a le droit d'être enregistrée.
   */
  it("un champ hors de la section est ignoré, même s'il est renvoyé", () => {
    const p = appliquerSaisieRefusee(fiche, { bio: ["glissée depuis ailleurs"] }, ["slug"]);
    expect(p?.bio).toBe(fiche.bio);
  });

  /** Le nom vit sur le compte, pas sur la fiche : il n'entre pas dans le profil. */
  it("le nom du compte ne se fusionne pas dans la fiche", () => {
    const p = appliquerSaisieRefusee(fiche, { nomComplet: ["Aïcha Benali"] }, ["nomComplet"]);
    expect(p).toMatchObject({ name: fiche.name });
  });

  it("sans fiche (création), il n'y a rien à fusionner", () => {
    expect(appliquerSaisieRefusee(null, { slug: ["x"] }, ["slug"])).toBeNull();
  });
});
