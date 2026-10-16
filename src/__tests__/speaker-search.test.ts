import { describe, it, expect } from "vitest";
import Fuse from "fuse.js";
import {
  createSpeakerMatcher,
  normalizeText,
  SPEAKER_FUSE_OPTIONS,
  type SpeakerDoc,
} from "@/lib/speaker-search";

const doc = (over: Partial<SpeakerDoc>): SpeakerDoc => ({
  id: 0,
  name: "",
  titreProfil: "",
  poste: "",
  entreprise: "",
  secteurs: [],
  sujets: [],
  regions: [],
  langues: [],
  text: "",
  ...over,
});

const DOCS: SpeakerDoc[] = [
  doc({ id: 1, name: "Rachel Dubois", poste: "Coach Orga", text: "Interview behind the scenes" }),
  doc({ id: 2, name: "Nadia Brainy", sujets: ["IA"], text: "Talk : AI Brain Fry, comment le cerveau apprend" }),
  doc({ id: 3, name: "Hélène Garnier", poste: "Product Manager", text: "co-organisatrice front-end" }),
  doc({ id: 4, name: "Élodie Martin", regions: ["Île-de-France"], text: "spécialiste Kubernetes" }),
];

const match = (q: string) => createSpeakerMatcher(Fuse, DOCS)(q);

describe("normalizeText", () => {
  it("retire casse et accents", () => {
    expect(normalizeText("Île-de-France")).toBe("ile-de-france");
  });
});

describe("SPEAKER_FUSE_OPTIONS", () => {
  it("garde l'invariant ignoreLocation (bug « brain »)", () => {
    expect(SPEAKER_FUSE_OPTIONS.ignoreLocation).toBe(true);
  });
});

describe("createSpeakerMatcher", () => {
  it("trouve un mot enfoui dans un talk (invariant ignoreLocation)", () => {
    // « brain » est dans le talk de Nadia (text) — doit être trouvé.
    expect(match("brain")).toContain(2);
  });

  it("écarte les alignements de lettres éparses (pas de faux positif « brain »)", () => {
    // Géraldine (m-an-ager org-ani-satrice) ne contient pas « brain » contigu.
    expect(match("brain")).not.toContain(3);
  });

  it("classe le match de nom en tête", () => {
    expect(match("rachel")[0]).toBe(1);
  });

  it("tolère les accents (« elodie » → « Élodie », « ile » → « Île-de-France »)", () => {
    expect(match("elodie")).toContain(4);
    expect(match("ile-de-france")).toContain(4);
  });

  it("cherche dans les facettes (zones, sujets)", () => {
    expect(match("kubernetes")).toContain(4);
    expect(match("IA")).toContain(2);
  });

  it("tolère une faute de frappe (branche floue du gate : « kubernets »)", () => {
    // Pas de sous-chaîne exacte → c'est le fragment flou contigu qui sauve.
    expect(match("kubernets")).toContain(4);
  });

  it("un match sur le nom prime sur un match plein-texte (poids nom > text)", () => {
    const docs = [
      doc({ id: 10, name: "Data enthusiast", text: "parle beaucoup de Kubernetes" }),
      doc({ id: 11, name: "Kubernetes Martin", text: "coach agile" }),
    ];
    expect(createSpeakerMatcher(Fuse, docs)("kubernetes")[0]).toBe(11);
  });

  it("requête vide ou 1 caractère : tous les ids, ordre d'origine", () => {
    expect(match("")).toEqual([1, 2, 3, 4]);
    expect(match("a")).toEqual([1, 2, 3, 4]);
  });

  it("aucun match → liste vide", () => {
    expect(match("zzzzzz")).toEqual([]);
  });
});
