// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  ASSOCIATION,
  NOM_AFFICHE,
  SIEGE_UNE_LIGNE,
  formaterImmatriculation,
  nomInsecable,
} from "@/data/association";
import { metadata as metaMentions } from "@/app/mentions-legales/page";

/**
 * L'identité juridique de l'association doit rester juste, et lisible par un
 * humain comme par un crawler, sur des pages indexables.
 *
 * Ce n'est pas cosmétique : les organismes qui instruisent un dossier
 * (Google pour les associations, subventions, programmes associatifs)
 * rapprochent les numéros affichés sur le site de ceux du dossier déposé.
 * Contexte : docs/google-ad-grants.md.
 *
 * Les valeurs elles-mêmes vivent dans `src/data/association.ts`, source
 * unique importée par les deux pages et par le JSON-LD : la cohérence entre
 * surfaces est donc acquise par construction, elle n'a pas à être surveillée.
 * Ce qui reste à tenir, et que ce fichier tient : la validité des numéros, et
 * le fait que la page qui les porte reste indexable.
 */

describe("Identité de l'association", () => {
  it("les mentions légales restent indexables", () => {
    // La page porte le RNA, le SIREN, le SIRET, le siège et l'objet social :
    // la mettre en noindex la rend introuvable pour qui vérifie l'existence de
    // l'association. On lit la métadonnée exportée plutôt que le source (comme
    // seo.test.ts), pour attraper aussi `robots: "noindex"` et les reformatages.
    expect(metaMentions.robots ?? null).toBeNull();
  });

  it("les mentions légales annoncent l'association et son RNA", () => {
    expect(metaMentions.description).toContain(ASSOCIATION.nom);
    expect(metaMentions.description).toContain(ASSOCIATION.rna);
  });

  it("le SIREN et le SIRET ont une clé de contrôle valide, et sont cohérents", () => {
    // Un chiffre transposé dans un numéro d'immatriculation casse en silence le
    // rapprochement avec le registre : la clé de Luhn l'attrape. C'est le seul
    // endroit du dépôt où ces numéros sont écrits, donc le seul à surveiller.
    const luhnOk = (n: string) =>
      [...n].reverse().reduce((somme, c, i) => {
        const d = Number(c) * (i % 2 ? 2 : 1);
        return somme + (d > 9 ? d - 9 : d);
      }, 0) %
        10 ===
      0;

    expect(ASSOCIATION.siren).toHaveLength(9);
    expect(ASSOCIATION.siret).toHaveLength(14);
    expect(luhnOk(ASSOCIATION.siren), `clé SIREN invalide : ${ASSOCIATION.siren}`).toBe(true);
    expect(luhnOk(ASSOCIATION.siret), `clé SIRET invalide : ${ASSOCIATION.siret}`).toBe(true);
    // Le SIRET est le SIREN suivi du NIC de l'établissement.
    expect(ASSOCIATION.siret.startsWith(ASSOCIATION.siren)).toBe(true);
  });

  it("le RNA a la forme d'un numéro de déclaration préfectorale", () => {
    expect(ASSOCIATION.rna).toMatch(/^W\d{9}$/);
  });

  it("l'objet social est cité, pas reformulé", () => {
    // Un organisme compare cette chaîne à celle des statuts : elle doit rester
    // une citation complète, ponctuation finale comprise.
    expect(ASSOCIATION.objet.startsWith("Promouvoir")).toBe(true);
    expect(ASSOCIATION.objet.endsWith(".")).toBe(true);
    expect(ASSOCIATION.objet.length).toBeGreaterThan(150);
  });

  it("le siège porte une voie, un code postal et une commune", () => {
    expect(ASSOCIATION.siege.voie).toBeTruthy();
    expect(ASSOCIATION.siege.codePostal).toMatch(/^\d{5}$/);
    expect(ASSOCIATION.siege.commune).toBeTruthy();
    expect(SIEGE_UNE_LIGNE).toContain(ASSOCIATION.siege.voie);
    expect(SIEGE_UNE_LIGNE).toContain(ASSOCIATION.siege.codePostal);
  });

  it("le groupement par trois reste lisible et réversible", () => {
    expect(formaterImmatriculation(ASSOCIATION.siren)).toBe("108 095 993");
    expect(formaterImmatriculation(ASSOCIATION.siret)).toBe("108 095 993 00011");
    // Réversible : la forme affichée redonne la forme canonique du JSON-LD.
    expect(formaterImmatriculation(ASSOCIATION.siret).replace(/\s/g, "")).toBe(ASSOCIATION.siret);
  });
});

/**
 * LE NOM SAISI PAR QUELQU'UN D'AUTRE.
 *
 * Le dépôt écrit son propre nom avec une insécable, mais les membres, elles,
 * tapent au clavier : une speakeuse qui renseigne où elle a donné son talk
 * écrit « Meetup Tech Speak'Her » avec une espace ordinaire, et ce texte
 * s'affiche sur `/agenda`, page publique. Le nom s'y coupe donc en fin de ligne
 * — le défaut même que ce lot a corrigé partout ailleurs.
 *
 * Le repli se fait à l'AFFICHAGE, jamais en base : une insécable est une
 * décision de mise en page, pas une correction du texte de quelqu'un. Rien de
 * ce qu'une membre a saisi n'est réécrit.
 */
describe("nomInsecable — le nom tapé par une membre ne se coupe pas à l'écran", () => {
  it("remplace l'espace du nom, et elle seule", () => {
    expect(nomInsecable("Meetup Tech Speak'Her")).toBe(`Meetup ${NOM_AFFICHE}`);
  });

  it("laisse le reste de la phrase intact", () => {
    // Les autres espaces sont celles de sa phrase : on n'y touche pas.
    expect(nomInsecable("Un meetup Tech Speak'Her à Toulouse")).toBe(
      `Un meetup ${NOM_AFFICHE} à Toulouse`,
    );
  });

  /** Clavier de téléphone et traitement de texte posent l'apostrophe COURBE. */
  it("reconnaît les deux apostrophes", () => {
    expect(nomInsecable("Tech Speak\u2019Her")).toBe(
      NOM_AFFICHE.replace("'", "\u2019"),
    );
  });

  it("ne double pas le travail sur un nom déjà insécable", () => {
    expect(nomInsecable(NOM_AFFICHE)).toBe(NOM_AFFICHE);
  });

  /**
   * LE MÊME DÉFAUT QUE LA GARDE E2E, NI PLUS NI MOINS.
   *
   * `e2e/mots-colles` refuse toute suite de blancs sécables entre les deux mots,
   * quelle que soit la casse. Un repli plus étroit ferait rougir la CI sur une
   * saisie qu'il ne saurait pas corriger : la garde et le correctif doivent
   * parler du même défaut.
   */
  it.each([
    ["deux espaces (collage)", "Tech  Speak'Her"],
    ["une tabulation", "Tech\tSpeak'Her"],
    ["un retour à la ligne", "Tech\nSpeak'Her"],
  ])("replie aussi %s", (_, saisie) => {
    expect(nomInsecable(saisie)).toBe(NOM_AFFICHE);
  });

  /** La casse et l'apostrophe sont à elle : on ne touche QUE le blanc. */
  it("garde la casse et l'apostrophe telles que tapées", () => {
    expect(nomInsecable("tech speak'her")).toBe("tech\u00A0speak'her");
    expect(nomInsecable("Tech Speak\u02BCHer")).toBe("Tech\u00A0Speak\u02BCHer");
  });

  it("rend une chaîne sans le nom telle quelle", () => {
    expect(nomInsecable("DevFest Toulouse")).toBe("DevFest Toulouse");
  });
});
