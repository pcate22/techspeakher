import { describe, it, expect } from "vitest";
import { mentionTransfert, type PublicRecompense } from "@/lib/tremplin-public";

/**
 * Matrice des 4 cas de consentement pour la phrase publique de transfert.
 * Invariant RGPD : un nom (bénéficiaire OU lauréate d'origine) n'apparaît que
 * si CETTE personne a consenti ; si l'origine n'a pas consenti, on n'expose ni
 * son nom ni son rang (anti-ré-identification). Personas fictifs (Ada/Grace).
 */
/** Normalise les espaces insécables (typographie française) → espace simple,
 * pour comparer le texte visible sans dépendre du type d'espace. */
const NBSP = new RegExp("\\u00a0", "g");
const norm = (s: string | null): string | null => (s === null ? null : s.replace(NBSP, " "));

const rec = (o: Partial<PublicRecompense>): PublicRecompense => ({
  intitule: "Une présentation au DevFest",
  detail: null,
  rang: 1,
  beneficiaireNom: null,
  beneficiaireClassement: null,
  transfertRaison: "cfp_officiel",
  origineNom: null,
  ...o,
});

describe("mentionTransfert — matrice de consentement", () => {
  it("pas un transfert (transfertRaison null) → aucune mention", () => {
    expect(mentionTransfert(rec({ transfertRaison: null }))).toBeNull();
  });

  it("bénéficiaire ET origine consentent → phrase complète, sans cadratin, au féminin", () => {
    const m = mentionTransfert(
      rec({ beneficiaireNom: "Grace", beneficiaireClassement: 2, origineNom: "Ada", rang: 1 }),
    );
    expect(norm(m)).toBe(
      norm("Attribuée à Grace (2ᵉ) à la place d'Ada (1ʳᵉ), retenue via le CFP officiel de l'événement."),
    );
    expect(m).not.toContain("—"); // pas de cadratin
  });

  it("origine NON consentante → ni son nom ni son rang (pas de « à la place de »)", () => {
    const m = mentionTransfert(
      rec({ beneficiaireNom: "Grace", beneficiaireClassement: 2, origineNom: null, rang: 1 }),
    );
    expect(norm(m)).toBe(norm("Attribuée à Grace (2ᵉ)."));
    expect(m).not.toContain("à la place");
    expect(m).not.toContain("1ʳᵉ");
  });

  it("bénéficiaire NON consentante mais origine oui → transmise, sans nommer la bénéficiaire", () => {
    const m = mentionTransfert(rec({ beneficiaireNom: null, origineNom: "Ada", rang: 1 }));
    expect(norm(m)).toBe(norm("Récompense du 1ᵉʳ prix, transmise, retenue via le CFP officiel de l'événement."));
  });

  it("aucune des deux ne consent → rien de nominatif (null)", () => {
    expect(mentionTransfert(rec({ beneficiaireNom: null, origineNom: null }))).toBeNull();
  });

  it("raison « autre » → pas de complément de motif ajouté", () => {
    const m = mentionTransfert(
      rec({ transfertRaison: "autre", beneficiaireNom: "Grace", beneficiaireClassement: 2, origineNom: "Ada", rang: 1 }),
    );
    expect(norm(m)).toBe(norm("Attribuée à Grace (2ᵉ) à la place d'Ada (1ʳᵉ)."));
  });
});
