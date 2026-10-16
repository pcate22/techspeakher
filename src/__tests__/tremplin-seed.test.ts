import { describe, it, expect } from "vitest";
import {
  buildTremplin1Seed,
  TREMPLIN1_PARTICIPANTES,
  TREMPLIN1_RESULTATS,
} from "@/lib/tremplin-seed";
import { accompagnement } from "@/data/tremplin";

describe("buildTremplin1Seed", () => {
  const seed = buildTremplin1Seed();

  it("édition EN COURS (coaching post-soirée jusqu'au DevFest), finale du 4 juin", () => {
    expect(seed.edition.statut).toBe("en_cours");
    expect(seed.edition.annee).toBe(2026);
    expect(seed.edition.confSlug).toBe("devfest-toulouse");
    expect(seed.edition.confNom).toMatch(/DevFest/);
    expect(seed.edition.finaleDate).toBe("2026-06-04");
  });

  it("fenêtre d'inscriptions passée (12 mars → 17 avril) : plus « ouvertes »", () => {
    expect(seed.edition.inscriptionsDebut).toBe("2026-03-12");
    expect(seed.edition.inscriptionsFin).toBe("2026-04-17");
  });

  it("reprend les 5 ateliers d'accompagnement (titre, jour, heures)", () => {
    expect(seed.ateliers).toHaveLength(accompagnement.length);
    const a1 = seed.ateliers[0];
    expect(a1.ordre).toBe(1);
    expect(a1.titre).toBe(accompagnement[0].title);
    expect(a1.heureDebut).toBe("12:45");
    expect(a1.heureFin).toBe("13:45");
  });

  it("reprend les 8 finalistes comme inscriptions acceptées, présentes à la finale", () => {
    expect(seed.registrations).toHaveLength(TREMPLIN1_PARTICIPANTES.length);
    const r = seed.registrations[0];
    expect(r.userId).toBeNull(); // saisie orga, rattachée plus tard
    expect(r.statut).toBe("acceptee");
    expect(r.finalePresente).toBe(true);
    expect(r.participanteNom).toBe(TREMPLIN1_PARTICIPANTES[0].name);
    // Participante[0] (Alice, 2ᵉ prix) est classée → son titre est figé dans
    // l'archive du palmarès (titre_palmares), plus dans un champ « sujet ».
    expect(r.titrePalmares).toBe(TREMPLIN1_PARTICIPANTES[0].sujet);
  });

  it("finalistes publiques (consentement historique) avec bio reprise", () => {
    for (const r of seed.registrations) {
      expect(r.public).toBe(true);
      expect(r.bio).toBeTruthy();
    }
  });

  it("les gagnantes portent leur classement (palmarès), les autres non", () => {
    const gagnantes = seed.registrations.filter((r) => r.classement != null);
    expect(gagnantes).toHaveLength(TREMPLIN1_RESULTATS.length); // 3 gagnantes
    const premiere = seed.registrations.find((r) => r.participanteNom === TREMPLIN1_RESULTATS[0].nom);
    expect(premiere?.classement).toBe(Number.parseInt(TREMPLIN1_RESULTATS[0].place, 10)); // « 1ᵉʳ prix » → 1
  });

  it("ne contient aucune donnée privée (pas de contenu/lien de retour jury)", () => {
    // Le seed public ne crée pas de documents : ceux-ci (retours jury, vidéos)
    // sont ajoutés par l'orga via l'admin, hors seed.
    expect("documents" in seed).toBe(false);
  });
});
