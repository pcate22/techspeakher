import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Lot I — enregistrer UNE section de sa fiche.
 *
 * Ce que ce fichier verrouille, et qui ne se voit nulle part ailleurs :
 * l'action n'écrit QUE les colonnes de la section nommée par la PAGE. Le
 * périmètre ne vient donc pas du formulaire : un champ glissé dans le POST
 * d'une autre section est ignoré, silencieusement et sans effet. Sans ça,
 * l'enregistrement partiel serait un moyen d'écrire n'importe quelle colonne
 * depuis n'importe quel écran.
 */

vi.mock("next/navigation", () => ({
  redirect: vi.fn((p: string) => {
    throw new Error(`REDIRECT:${p}`);
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("@/auth", () => ({ auth: vi.fn(), signOut: vi.fn() }));
vi.mock("@/lib/auth-guards", () => ({ requireUserId: vi.fn(async () => 7) }));
vi.mock("@/lib/profiles", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/profiles")>();
  return {
    ...actual,
    getProfileByUserId: vi.fn(),
    upsertProfile: vi.fn(),
    isSlugAvailable: vi.fn(async () => true),
    deriveAvailableSlug: vi.fn(async () => "lea-dubois"),
    ensureProfileId: vi.fn(),
    submitForValidation: vi.fn(),
    withdrawOwnProfile: vi.fn(),
    raisonBlocageAnnuaire: vi.fn(),
    };
});
vi.mock("@/lib/users", () => ({ setUserName: vi.fn(), getUserById: vi.fn() }));
vi.mock("@/lib/talks", () => ({
  addTalk: vi.fn(),
  updateTalk: vi.fn(),
  deleteTalk: vi.fn(),
  getTalkById: vi.fn(),
  addOccurrence: vi.fn(),
  updateOccurrence: vi.fn(),
  removeOccurrence: vi.fn(),
  getKnownEditionById: vi.fn(),
  getRegistryConferenceById: vi.fn(),
}));
vi.mock("@/lib/talk-form", () => ({
  parseTalkIdentityForm: vi.fn(),
  parseOccurrenceForm: vi.fn(),
}));

import { requireUserId } from "@/lib/auth-guards";
import {
  getProfileByUserId,
  upsertProfile,
  isSlugAvailable,
  type SpeakerProfile,
} from "@/lib/profiles";
import { setUserName } from "@/lib/users";
import { saveProfileSection } from "@/app/mon-espace/actions";

const fiche = (o: Partial<SpeakerProfile> = {}): SpeakerProfile =>
  ({
    id: 1,
    userId: 7,
    slug: "lea-dubois",
    name: "Léa Dubois",
    image: null,
    titreProfil: "Développeuse plateforme",
    poste: "Staff engineer",
    entreprise: "Airbus",
    bio: "Dix ans de systèmes distribués.",
    website: "https://lea.dev",
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
    ...o,
  }) as SpeakerProfile;

const fd = (entrees: Record<string, string | string[]>): FormData => {
  const f = new FormData();
  for (const [k, v] of Object.entries(entrees)) {
    for (const item of Array.isArray(v) ? v : [v]) f.append(k, item);
  }
  return f;
};

/** L'action redirige en cas de succès : on rejoue la redirection comme résultat. */
const enregistrer = (cle: string, données: Record<string, string | string[]>) =>
  saveProfileSection(cle, {}, fd(données));

const ecrit = () => vi.mocked(upsertProfile).mock.calls[0]?.[1];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireUserId).mockResolvedValue(7);
  vi.mocked(getProfileByUserId).mockResolvedValue(fiche());
  vi.mocked(isSlugAvailable).mockResolvedValue(true);
});

describe("saveProfileSection — n'écrit que sa section", () => {
  it("enregistre les sujets, et rien d'autre ne bouge", async () => {
    await expect(enregistrer("sujets", { sujets: ["Mobile"] })).rejects.toThrow(/REDIRECT/);
    expect(ecrit()).toMatchObject({
      sujets: ["Mobile"],
      bio: "Dix ans de systèmes distribués.",
      linkedin: "https://linkedin.com/in/lea",
      secteurs: ["Industrie / Manufacturing"],
      contactEmailOk: true,
      isWoman: true,
    });
  });

  /**
   * LE contrôle qui compte : le périmètre vient de la PAGE, jamais du POST.
   * Une bio glissée dans le formulaire « Tes sujets » n'a aucun effet.
   */
  it("un champ hors section glissé dans le POST est ignoré", async () => {
    await expect(
      enregistrer("sujets", { sujets: ["Mobile"], bio: "Bio réécrite par un tiers" }),
    ).rejects.toThrow(/REDIRECT/);
    expect(ecrit()?.bio).toBe("Dix ans de systèmes distribués.");
  });

  it("le nom du compte ne s'écrit QUE depuis la section « Qui tu es »", async () => {
    await expect(
      enregistrer("sujets", { sujets: ["Mobile"], nomComplet: "Nom injecté" }),
    ).rejects.toThrow(/REDIRECT/);
    expect(setUserName).not.toHaveBeenCalled();
  });

  it("depuis « Qui tu es », le nom du compte est bien mis à jour", async () => {
    await expect(
      enregistrer("identite", { nomComplet: "Léa Dubois-Martin", titreProfil: "CTO" }),
    ).rejects.toThrow(/REDIRECT/);
    expect(setUserName).toHaveBeenCalledWith(7, "Léa Dubois-Martin");
    expect(ecrit()?.titreProfil).toBe("CTO");
  });

  it("vider un champ de SA section l'efface bien (c'est un retrait volontaire)", async () => {
    await expect(enregistrer("interventions", { langues: [] })).rejects.toThrow(/REDIRECT/);
    expect(ecrit()?.langues).toEqual([]);
  });

  it("une section inconnue n'écrit rien", async () => {
    const r = await saveProfileSection("constructor", {}, fd({ bio: "x" }));
    expect(r.ok).toBeFalsy();
    expect(upsertProfile).not.toHaveBeenCalled();
  });

  it("sans fiche existante, on repart de l'assistant plutôt que d'écrire à moitié", async () => {
    vi.mocked(getProfileByUserId).mockResolvedValue(null);
    await expect(enregistrer("sujets", { sujets: ["Mobile"] })).rejects.toThrow(
      "REDIRECT:/mon-espace/fiche",
    );
    expect(upsertProfile).not.toHaveBeenCalled();
  });

  it("l'identité vient de la session, jamais du formulaire", async () => {
    await expect(
      enregistrer("sujets", { sujets: ["Mobile"], userId: "999", id: "999" }),
    ).rejects.toThrow(/REDIRECT/);
    expect(vi.mocked(upsertProfile).mock.calls[0]?.[0]).toBe(7);
  });

  it("une saisie invalide de la section est refusée, sans rien écrire", async () => {
    const r = await saveProfileSection("contact", {}, fd({ linkedin: "pas une url" }));
    expect(r.errors?.linkedin).toBeTruthy();
    expect(upsertProfile).not.toHaveBeenCalled();
  });

  it("une adresse de fiche déjà prise est refusée, sans rien écrire", async () => {
    vi.mocked(isSlugAvailable).mockResolvedValue(false);
    const r = await saveProfileSection("identite", {}, fd({ slug: "deja-prise" }));
    expect(r.errors?.slug).toBeTruthy();
    expect(upsertProfile).not.toHaveBeenCalled();
  });

  it("une section sans champ « adresse » ne touche pas au slug", async () => {
    await expect(enregistrer("secteurs", { secteurs: ["RH / HRTech"] })).rejects.toThrow(
      /REDIRECT/,
    );
    expect(ecrit()?.slug).toBe("lea-dubois");
    expect(isSlugAvailable).not.toHaveBeenCalled();
  });

  /**
   * La cohérence qui traverse les sections doit s'appliquer aussi après un
   * enregistrement partiel : retirer sa ville nettoie la localisation qui en
   * dépend, même si la page ne parle jamais de code INSEE.
   */
  it("retirer sa ville nettoie la localisation qui en dépendait", async () => {
    await expect(enregistrer("identite", { ville: "" })).rejects.toThrow(/REDIRECT/);
    expect(ecrit()).toMatchObject({ ville: null, codePostal: null, codeInsee: null });
  });
});

/**
 * CE QUI SE PASSE APRÈS LE GESTE — la moitié qu'on avait oubliée.
 *
 * Mesuré en navigateur sur les sept sections : après « Enregistrer », le focus
 * retombait sur `body`, les deux régions vives de la page restaient VIDES et
 * aucun texte de confirmation n'apparaissait. Sur un lecteur d'écran, rien ne
 * se passait — alors que le même parcours, côté talks, fait exactement ce
 * qu'il faut depuis toujours (`?ok=` + `ConfirmationBanner`).
 *
 * Et au refus, le champ réaffichait la valeur EN BASE : on lisait « essaies-en
 * une autre » à côté d'un champ qui ne contenait plus ce qu'on avait tapé.
 */
describe("saveProfileSection — ce que la personne apprend de son geste", () => {
  it("le succès nomme la section dans l'adresse de retour (confirmation possible)", async () => {
    await expect(enregistrer("secteurs", { secteurs: ["RH / HRTech"] })).rejects.toThrow(
      "REDIRECT:/mon-espace/fiche?ok=secteurs",
    );
  });

  it("chaque section nomme la sienne, jamais un message générique", async () => {
    for (const cle of ["identite", "sujets", "interventions", "contact"]) {
      vi.clearAllMocks();
      vi.mocked(getProfileByUserId).mockResolvedValue(fiche());
      vi.mocked(isSlugAvailable).mockResolvedValue(true);
      await expect(saveProfileSection(cle, {}, fd({}))).rejects.toThrow(
        `REDIRECT:/mon-espace/fiche?ok=${cle}`,
      );
    }
  });

  /**
   * LE défaut : la saisie refusée doit revenir à l'écran. Sans elle, la personne
   * lit le message d'erreur à côté d'un champ qui a repris la valeur en base —
   * elle ne peut ni voir ni corriger ce qui a été refusé.
   */
  it("un refus renvoie la saisie, pas la valeur en base", async () => {
    vi.mocked(isSlugAvailable).mockResolvedValue(false);
    const r = await saveProfileSection("identite", {}, fd({ slug: "aicha-benali" }));
    expect(r.errors?.slug).toBeTruthy();
    expect(r.valeurs?.slug).toEqual(["aicha-benali"]);
  });

  it("un refus de validation renvoie aussi la saisie", async () => {
    const r = await saveProfileSection("contact", {}, fd({ linkedin: "pas une url" }));
    expect(r.errors?.linkedin).toBeTruthy();
    expect(r.valeurs?.linkedin).toEqual(["pas une url"]);
  });

  /** Les cases cochées sont une saisie comme une autre : elles reviennent aussi. */
  it("un refus conserve les cases cochées de la section", async () => {
    const r = await saveProfileSection(
      "contact",
      {},
      fd({ linkedin: "pas une url", contactEmailOk: "on" }),
    );
    expect(r.valeurs?.contactEmailOk).toEqual(["on"]);
  });

  /** On ne renvoie QUE les champs de la section : le périmètre reste celui de
   * la page, y compris dans ce qui revient à l'écran. */
  it("la saisie renvoyée est bornée à la section", async () => {
    const r = await saveProfileSection(
      "contact",
      {},
      fd({ linkedin: "pas une url", bio: "glissée depuis ailleurs" }),
    );
    expect(r.valeurs?.linkedin).toEqual(["pas une url"]);
    expect(r.valeurs?.bio).toBeUndefined();
  });
});
