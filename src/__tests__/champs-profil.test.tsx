import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

// Le registre se lit sur le formulaire RENDU : on isole donc l'action serveur
// (qui tirerait Auth.js et la base).
vi.mock("@/app/mon-espace/actions", () => ({
  saveProfile: vi.fn(),
  reprendrePhotoLinkedInAction: vi.fn(),
  reconnecterLinkedInAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  // `ChampPhoto` lit la route courante (retour après un passage par LinkedIn).
  usePathname: () => "/mon-espace/fiche",
}));
import { CHAMPS_PROFIL, libelleChamp, messageRefus } from "@/app/mon-espace/champs-profil";
import { ETAPES } from "@/app/mon-espace/profil-etapes";
import { BIO_MAX } from "@/lib/profile-limits";
import ProfileForm from "@/app/mon-espace/ProfileForm";
import { makeProfile } from "./test-helpers";

afterEach(cleanup);

/**
 * Motif du refus : il était codé en dur («\u00a0à renseigner\u00a0») quel que soit le vrai
 * motif. Cas atteignable : une bio migrée dépasse la limite (colonne TEXT sans
 * borne, import en SQL) → `tooLong`. La personne lisait «\u00a0Bio : à renseigner\u00a0»
 * sur un champ rempli, et restait bloquée sans savoir qu'il fallait raccourcir.
 *
 * Testé sur la fonction seule : jsdom ne pose pas le «\u00a0dirty value flag\u00a0» sur une
 * affectation programmatique, donc `tooLong` n'y est pas reproductible.
 */
describe("messageRefus — le message dit le motif RÉEL", () => {
  const validite = (o: Partial<{ valueMissing: boolean; tooLong: boolean }>) => ({
    valueMissing: false,
    tooLong: false,
    ...o,
  });

  it("champ vide : on demande de le renseigner, en nommant le champ", () => {
    expect(
      messageRefus({ name: "nomComplet", validity: validite({ valueMissing: true }) }),
    ).toMatch(/indique ton prénom et ton nom/i);
    expect(
      messageRefus({ name: "ville", validity: validite({ valueMissing: true }) }),
    ).toMatch(/^Ville.*à renseigner/i);
  });

  it("champ trop long : on demande de RACCOURCIR, avec la borne", () => {
    const msg = messageRefus({
      name: "bio",
      validity: validite({ tooLong: true }),
      maxLength: BIO_MAX,
    });
    expect(msg).toMatch(/raccourcis/i);
    expect(msg).toContain(String(BIO_MAX));
    expect(msg).not.toMatch(/à renseigner/i);
  });

  it("autre motif : on invite à vérifier la saisie, sans jargon", () => {
    expect(messageRefus({ name: "linkedin", validity: validite({}) })).toMatch(
      /^LinkedIn.*vérifie la saisie/i,
    );
  });

  // §5 : la forme négative est interdite dans les libellés.
  it("aucun message n'emploie la forme négative", () => {
    const tous = [
      messageRefus({ name: "nomComplet", validity: validite({ valueMissing: true }) }),
      messageRefus({ name: "bio", validity: validite({ tooLong: true }), maxLength: 10 }),
      messageRefus({ name: "linkedin", validity: validite({}) }),
    ];
    for (const m of tous) expect(m).not.toMatch(/n['e]\s?\w*\s+(pas|plus)\b/i);
  });
});

/**
 * Un champ absent du registre renverrait à l'étape courante avec son nom
 * technique dans le bandeau — la dérive silencieuse que le registre existe pour
 * empêcher. Ce test la rend impossible : il lit le formulaire RENDU.
 */
describe("CHAMPS_PROFIL — le registre couvre le formulaire", () => {
  /** Champs qui ne sont jamais nommés à l'utilisatrice : cases à cocher des
   * taxonomies, consentements, et champs cachés remplis par l'autocomplétion. */
  const HORS_REGISTRE = new Set([
    "secteurs", "sujets", "regions", "langues",
    "contactEmailOk", "cfpSuggestionsOk", "isWoman",
    "codePostal", "codeInsee", "regionResidence",
  ]);

  it("tout champ nommé du formulaire a une entrée", () => {
    const { container } = render(<ProfileForm initial={makeProfile()} nom="Marie Curie" />);
    const noms = new Set(
      [...container.querySelectorAll<HTMLElement>("[name]")]
        .map((el) => el.getAttribute("name") ?? "")
        .filter((n) => n && !HORS_REGISTRE.has(n)),
    );
    expect(noms.size).toBeGreaterThan(0);
    for (const nom of noms) {
      expect(CHAMPS_PROFIL[nom], `champ « ${nom} » absent du registre`).toBeDefined();
    }
  });

  it("chaque étape déclarée existe dans le parcours", () => {
    for (const [nom, def] of Object.entries(CHAMPS_PROFIL)) {
      expect(ETAPES[def.etape], `champ « ${nom} » : étape ${def.etape} hors parcours`).toBeTruthy();
    }
  });

  it("un champ inconnu retombe sur son nom technique, sans planter", () => {
    expect(libelleChamp("champInconnu")).toBe("champInconnu");
  });
});
