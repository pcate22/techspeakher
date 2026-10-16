import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";

// Le champ Photo (`ChampPhoto`) appelle des Server Actions : le module entier
// tirerait Auth.js et la base dans ce test de rendu.
vi.mock("@/app/mon-espace/actions", () => ({
  reprendrePhotoLinkedInAction: vi.fn(),
  reconnecterLinkedInAction: vi.fn(),
}));

import { ChampsDeSection } from "@/app/mon-espace/ChampsSection";
import { SECTIONS_PROFIL } from "@/lib/profil-sections";
import type { SpeakerProfile } from "@/lib/profiles";

afterEach(cleanup);

/**
 * L'invariant qui tient l'enregistrement partiel debout : ce qu'une section
 * AFFICHE est exactement ce qu'elle a le droit d'ÉCRIRE.
 *
 * Les deux listes vivent à deux endroits — le composant qui rend les champs et
 * `SECTIONS_PROFIL` qui borne l'écriture — et rien ne les relie à la
 * compilation. Une divergence est SILENCIEUSE dans les deux sens, et c'est le
 * pire genre de bug :
 *
 * - champ rendu mais absent du registre → la case se décoche à l'écran, part
 *   dans le POST, et revient cochée après enregistrement (« ça n'enregistre
 *   pas », sans message, sans erreur) ;
 * - champ du registre rendu nulle part → il devient inéditable, et une valeur
 *   déjà en base ne peut plus être corrigée.
 *
 * C'est exactement ce qui était arrivé à `cfpSuggestionsOk`, rendu dans « Où te
 * trouver » sans y être déclaré.
 */

const fiche: SpeakerProfile = {
  id: 1,
  userId: 7,
  slug: "lea-dubois",
  name: "Léa Dubois",
  image: null,
  titreProfil: "Développeuse plateforme",
  poste: "Staff engineer",
  entreprise: "Airbus",
  bio: "Dix ans de systèmes distribués.",
  website: null,
  linkedin: "https://linkedin.com/in/lea",
  instagram: null,
  sessionizeUrl: null,
  conferenceHallUrl: null,
  ville: "Toulouse",
  codePostal: "31000",
  codeInsee: "31555",
  regionResidence: "Occitanie",
  regions: ["Occitanie"],
  langues: ["Français"],
  secteurs: ["Industrie / Manufacturing"],
  sujets: ["Cloud / DevOps / Infra"],
  contactEmailOk: true,
  isWoman: true,
  cfpSyncMode: "suggestions",
  status: "publie",
} as SpeakerProfile;

/** Les `name` réellement rendus par une section (donc réellement postés). */
function champsRendus(cle: string): Set<string> {
  const { container } = render(
    <ChampsDeSection cle={cle} initial={fiche} nom="Léa Dubois" erreurs={undefined} />,
  );
  const noms = [...container.querySelectorAll<HTMLElement>("[name]")].map(
    (e) => e.getAttribute("name") ?? "",
  );
  cleanup();
  return new Set(noms.filter(Boolean));
}

describe("Champs rendus ⇔ champs déclarés, section par section", () => {
  it.each(SECTIONS_PROFIL.map((s) => [s.cle, s] as const))(
    "« %s » : tout ce qu'elle affiche, elle peut l'écrire",
    (cle, section) => {
      const rendus = champsRendus(cle);
      const declares = new Set(section.champs);
      const nonDeclares = [...rendus].filter((n) => !declares.has(n));
      expect(nonDeclares, `champs rendus hors registre (${cle})`).toEqual([]);
    },
  );

  /**
   * L'autre sens, sans exception : un champ déclaré mais rendu nulle part
   * devient inéditable, et une valeur déjà en base ne peut plus être corrigée.
   * Les trois champs cachés de la localisation comptent — `VilleField` les rend
   * en permanence (vides tant qu'aucune commune n'est choisie), donc ils sont
   * bien postés.
   */
  it.each(SECTIONS_PROFIL.map((s) => [s.cle, s] as const))(
    "« %s » : tout ce qu'elle déclare, elle l'affiche",
    (cle, section) => {
      const rendus = champsRendus(cle);
      const manquants = section.champs.filter((n) => !rendus.has(n));
      expect(manquants, `champs déclarés jamais rendus (${cle})`).toEqual([]);
    },
  );

  it("toutes les sections rendent au moins un champ", () => {
    for (const s of SECTIONS_PROFIL) {
      expect(champsRendus(s.cle).size, s.cle).toBeGreaterThan(0);
    }
  });
});
