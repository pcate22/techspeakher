import { describe, it, expect } from "vitest";
import {
  rapprocher,
  scoreRessemblance,
  voisines,
  type ConferenceRepertoriee,
} from "@/lib/proposition-rapprochement";

/** Un répertoire d'essai tiré du VRAI catalogue (`conference-seed.ts`) : les
 * noms canoniques que les propositions de la file frôlent sans les toucher. */
const conf = (
  id: number,
  nom: string,
  annees: (number | null)[] = [],
): ConferenceRepertoriee => ({
  id,
  nom,
  slug: nom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .toLowerCase()
    .replace(/^-+|-+$/g, ""),
  editions: annees.map((annee) => ({ annee })),
});

const REPERTOIRE = [
  conf(1, "Devoxx France", [2024, 2025]),
  conf(2, "KubeCon + CloudNativeCon Europe", [2026]),
  conf(3, "DevFest Strasbourg"),
  conf(4, "Agile Tour Toulouse", [2025]),
  conf(5, "SunnyTech", [2024]),
  conf(6, "Cloud Native Days France", [2026]),
  // Un nom du vrai catalogue qui ne porte AUCUNE coupure : replié, il fait un
  // seul jeton de treize lettres. C'est le cas qui piège un rapprochement au
  // jeton, et il pèse : trois propositions de la file d'Aurélie Vache portent
  // « Paris » dans leur nom.
  conf(7, "ParisTestConf", [2025]),
];

describe("rapprocher — ce que le répertoire dit d'une proposition", () => {
  it("slug identique : un FAIT, et il dit si l'année y est déjà", () => {
    const r = rapprocher({ nom: "SunnyTech", annee: 2024 }, REPERTOIRE);
    expect(r.identique).toMatchObject({
      id: 5,
      nom: "SunnyTech",
      anneeDejaLa: true,
    });
    // Dite en haut avec sa certitude, elle ne se répète pas en ressemblance.
    expect(r.proches.map((p) => p.id)).not.toContain(5);
  });

  it("slug identique, année neuve : valider AJOUTERA l'édition", () => {
    const r = rapprocher({ nom: "SunnyTech", annee: 2026 }, REPERTOIRE);
    expect(r.identique?.anneeDejaLa).toBe(false);
  });

  it("« DevoxxFR » remonte « Devoxx France » (le doublon de marque que l'import laisse passer)", () => {
    const r = rapprocher({ nom: "DevoxxFR", annee: 2025 }, REPERTOIRE);
    expect(r.identique).toBeNull();
    expect(r.proches[0]).toMatchObject({
      nom: "Devoxx France",
      anneeDejaLa: true,
    });
  });

  it("« KubeCon + CloudNativeCon EU » remonte « … Europe »", () => {
    const r = rapprocher(
      { nom: "KubeCon + CloudNativeCon EU", annee: 2025 },
      REPERTOIRE,
    );
    expect(r.proches[0]?.nom).toBe("KubeCon + CloudNativeCon Europe");
    // 2025 n'est pas au répertoire pour cette conférence : l'édition manque.
    expect(r.proches[0]?.anneeDejaLa).toBe(false);
  });

  it("une faute de frappe dans l'année du nom ne cache plus la conférence", () => {
    // Cas réel de la file : « DevFest Strasbourg 3019 · 2019 ». `extraireAnnee`
    // ne reconnaît que 19xx/20xx, donc le nom garde son nombre.
    const r = rapprocher(
      { nom: "DevFest Strasbourg 3019", annee: 2019 },
      REPERTOIRE,
    );
    expect(r.proches[0]?.nom).toBe("DevFest Strasbourg");
  });

  it("un nom qui porte son année reste comparable (l'année n'est pas l'identité)", () => {
    // Les exports de portefeuille nomment volontiers « Devoxx 2025 » : l'année
    // vit déjà dans son champ, et la laisser dans le nom dilue la comparaison
    // (1 jeton commun sur 2 au lieu de 1 sur 1) au point de cacher la marque.
    const r = rapprocher({ nom: "Devoxx 2025", annee: 2025 }, REPERTOIRE);
    expect(r.proches[0]?.nom).toBe("Devoxx France");
  });

  it("un meetup de communauté remonte la communauté", () => {
    const avecAsso = [...REPERTOIRE, conf(7, "Cloud Native Aix-Marseille")];
    const r = rapprocher(
      { nom: "Meetup Cloud Native Aix-Marseille", annee: 2025 },
      avecAsso,
    );
    expect(r.proches[0]?.nom).toBe("Cloud Native Aix-Marseille");
  });

  it("ne crie pas au loup : une conférence sans rapport ne remonte rien", () => {
    for (const nom of ["HeForShe", "Cisco Connected Girls", "Digital 113"]) {
      const r = rapprocher({ nom, annee: 2021 }, REPERTOIRE);
      expect({ nom, proches: r.proches }).toEqual({ nom, proches: [] });
    }
  });

  it("une ville en commun ne rapproche pas deux conférences", () => {
    // Mesuré le 2026-08-22 sur la file réelle : ces trois propositions
    // marquaient 1,00 contre « ParisTestConf » — le score d'un VRAI doublon.
    // « paris » est un début de « paristestconf », et un nom d'un seul jeton
    // saturait la part des jetons du plus court (1 sur 1).
    for (const nom of [
      "Women Who Go Paris",
      "Ladies of Code Paris",
      "Paris Container Day (PCD)",
    ]) {
      const r = rapprocher({ nom, annee: 2025 }, REPERTOIRE);
      expect({ nom, proches: r.proches.map((p) => p.nom) }).toEqual({
        nom,
        proches: [],
      });
    }
  });

  it("les mêmes lettres à une séparation près restent un doublon", () => {
    // Ce que le jeton seul ne peut pas voir : c'est justement la coupure qui
    // manque d'un côté. Trois cas de la file, dont deux tirés du catalogue.
    const paires: [string, string][] = [
      ["SunnyTech", "Sunny Tech"],
      ["RivieraDev", "Riviera Dev"],
      ["VoxxedDays Luxembourg", "Voxxed Days Luxembourg"],
    ];
    for (const [propose, canonique] of paires) {
      const r = rapprocher({ nom: propose, annee: 2025 }, [
        conf(9, canonique, [2025]),
      ]);
      expect({ propose, proches: r.proches.map((p) => p.nom) }).toEqual({
        propose,
        proches: [canonique],
      });
    }
  });

  it("un seul mot en commun ne suffit pas (« Agile Niort » reste loin d'« Agile Tour Toulouse »)", () => {
    expect(
      rapprocher({ nom: "Agile Niort", annee: 2025 }, REPERTOIRE).proches,
    ).toEqual([]);
  });

  it("un mot court commun ne rapproche rien (« EU », « FR », « la »)", () => {
    expect(scoreRessemblance("EU Summit", "EU Tour")).toBe(0);
  });

  it("plafonne la liste : au-delà, elle cesse d'aider", () => {
    const grappe = Array.from({ length: 6 }, (_, i) =>
      conf(
        100 + i,
        `Cloud Native Days ${["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta"][i]}`,
      ),
    );
    const r = rapprocher({ nom: "Cloud Native Days", annee: 2026 }, grappe);
    expect(r.proches).toHaveLength(3);
  });

  it("répertoire vide : rien, et sans erreur", () => {
    expect(rapprocher({ nom: "Devoxx France", annee: 2025 }, [])).toEqual({
      identique: null,
      proches: [],
    });
  });
});

describe("voisines — les conférences désignées, en une liste", () => {
  /**
   * Les deux écrans d'arbitrage en ont besoin sous cette forme (le nom canonique
   * à recopier, le lien vers la fiche). L'ORDRE est le contrat : la certaine
   * d'abord, parce que c'est celle qu'on recopie.
   */
  it("la certaine passe devant les ressemblances", () => {
    // Un répertoire où les DEUX niveaux sont peuplés : sans ça, l'ordre ne se
    // joue pas et le test passerait quel que soit le sens de la liste.
    const r = rapprocher({ nom: "Devoxx France", annee: 2025 }, [
      conf(1, "Devoxx France", [2025]),
      conf(2, "Devoxx France Junior"),
    ]);
    expect(r.identique?.nom).toBe("Devoxx France");
    expect(r.proches.map((p) => p.nom)).toEqual(["Devoxx France Junior"]);
    expect(voisines(r).map((v) => v.nom)).toEqual([
      "Devoxx France",
      "Devoxx France Junior",
    ]);
  });

  it("sans conférence identique, il ne reste que les ressemblances", () => {
    const r = rapprocher({ nom: "DevoxxFR", annee: 2025 }, REPERTOIRE);
    expect(r.identique).toBeNull();
    expect(voisines(r).map((v) => v.nom)).toEqual(["Devoxx France"]);
  });

  it("rien de rapproché : une liste vide, jamais un trou", () => {
    expect(voisines({ identique: null, proches: [] })).toEqual([]);
  });
});
