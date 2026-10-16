import { describe, it, expect } from "vitest";
import { espaceChecklist } from "@/lib/espace";
import { makeProfile } from "./test-helpers";

const base = makeProfile({ name: "Marie" });
/** Cohorte lien-magique : le compte arrive SANS nom (la connexion ne demande
 * que l'e-mail, aucun provider ne le fournit). */
const sansNom = makeProfile({ name: null });

describe("espaceChecklist", () => {
  it("profil vide, compte sans nom + 0 talk = 0 %", () => {
    const { percent, steps } = espaceChecklist(sansNom, 0);
    expect(percent).toBe(0);
    expect(steps.every((s) => !s.done)).toBe(true);
  });

  // Le nom conditionne la publication : sans lui, `SpeakeuseCard` retombe sur
  // «\u00a0Speakeuse\u00a0» et la fiche s'afficherait anonyme dans un annuaire de
  // personnes. Il vit donc dans la checklist, comme les autres pré-requis, avec
  // son lien vers l'étape qui le porte.
  it("le nom est une étape à part entière, liée à l'étape Profil", () => {
    const etape = espaceChecklist(sansNom, 0).steps.find((s) => s.key === "nom");
    expect(etape).toBeDefined();
    expect(etape?.done).toBe(false);
    expect(etape?.href).toBe("/mon-espace/fiche/identite");
  });

  it("un nom renseigné franchit l'étape ; des espaces seuls la laissent à faire", () => {
    expect(
      espaceChecklist(base, 0).steps.find((s) => s.key === "nom")?.done,
    ).toBe(true);
    expect(
      espaceChecklist(makeProfile({ name: "   " }), 0).steps.find((s) => s.key === "nom")
        ?.done,
    ).toBe(false);
  });

  it("sans nom, une fiche par ailleurs complète reste incomplète", () => {
    const p = {
      ...sansNom,
      bio: "Salut",
      linkedin: "https://lk/x",
      isWoman: true,
      status: "publie" as const,
    };
    const { percent, steps } = espaceChecklist(p, 2);
    expect(steps.find((s) => s.key === "nom")?.done).toBe(false);
    expect(percent).toBeLessThan(100);
  });

  it("compte chaque étape franchie", () => {
    const p = {
      ...base,
      bio: "Salut",
      linkedin: "https://lk/x",
      isWoman: true,
      status: "publie" as const,
    };
    const { percent, steps } = espaceChecklist(p, 2);
    expect(steps.find((s) => s.key === "nom")?.done).toBe(true);
    expect(steps.find((s) => s.key === "profil")?.done).toBe(true);
    expect(steps.find((s) => s.key === "talks")?.done).toBe(true);
    expect(steps.find((s) => s.key === "contact")?.done).toBe(true);
    expect(steps.find((s) => s.key === "attestation")?.done).toBe(true);
    expect(steps.find((s) => s.key === "annuaire")?.done).toBe(true);
    expect(percent).toBe(100);
  });

  it("l'attestation (femme ou personne non binaire) est une étape requise", () => {
    const sans = espaceChecklist({ ...base, bio: "x" }, 1);
    expect(sans.steps.find((s) => s.key === "attestation")?.done).toBe(false);
    const avec = espaceChecklist({ ...base, bio: "x", isWoman: true }, 1);
    expect(avec.steps.find((s) => s.key === "attestation")?.done).toBe(true);
  });

  it("le contact est validé par LinkedIn OU l'option e-mail", () => {
    const sansContact = espaceChecklist({ ...base, bio: "x" }, 1);
    expect(sansContact.steps.find((s) => s.key === "contact")?.done).toBe(false);
    const parEmail = espaceChecklist({ ...base, bio: "x", contactEmailOk: true }, 1);
    expect(parEmail.steps.find((s) => s.key === "contact")?.done).toBe(true);
  });

  it("profil null géré", () => {
    expect(espaceChecklist(null, 0).percent).toBe(0);
  });

  // Chaque étape « à remplir » pointe vers le formulaire qui la remplit : c'est
  // LA source unique du lien, partagée par la ligne cliquable de la checklist et
  // le CTA. Le contact et l'attestation ouvrent directement leur sous-étape
  // (deep-link), sinon on retombe sur l'étape 0 (bug corrigé).
  it("chaque étape mène à LA page qui l'édite (source unique ligne + CTA)", () => {
    const href = (key: string) =>
      espaceChecklist(base, 0).steps.find((s) => s.key === key)?.href;
    expect(href("profil")).toBe("/mon-espace/fiche/identite");
    expect(href("talks")).toBe("/mon-espace/talks/nouveau");
    expect(href("contact")).toBe("/mon-espace/fiche/contact");
    expect(href("attestation")).toBe("/mon-espace/fiche/attestation");
  });

  it("« Soumis à l'annuaire » n'a pas de href (c'est une action, pas un champ)", () => {
    const annuaire = espaceChecklist(base, 0).steps.find((s) => s.key === "annuaire");
    expect(annuaire?.href).toBeUndefined();
  });

  // Retour orga : « fiche remplie mais non soumise = 80 % » était illisible
  // (le formulaire EST complet). Le % ne mesure que le contenu ; la soumission
  // est une ACTION, listée dans la checklist mais hors pourcentage.
  it("formulaire complet mais non soumis = 100 % (la soumission n'est pas un champ)", () => {
    const p = { ...base, bio: "Salut", linkedin: "https://lk/x", isWoman: true };
    const { percent, steps } = espaceChecklist(p, 1);
    expect(percent).toBe(100);
    expect(steps.find((s) => s.key === "annuaire")?.done).toBe(false);
  });

  it("une fiche en pause (adhésion) compte comme soumise : rien à re-soumettre", () => {
    const { steps } = espaceChecklist({ ...base, status: "en_pause" }, 1);
    expect(steps.find((s) => s.key === "annuaire")?.done).toBe(true);
  });
});
