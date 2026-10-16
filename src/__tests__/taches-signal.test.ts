import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * LE POINT de l'onglet « À faire » — `desTachesAttendent()`.
 *
 * Un POINT, pas un compteur (`docs/conception-technique-profil-et-a-faire.md`
 * D3, révisé le 2026-08-17 sur question de Cateline : « Est-ce que le compteur
 * apporte vraiment ? »). Sur des volumes de une à cinq lignes, « 3 » et « il y
 * a quelque chose » déclenchent la même décision : j'ouvre.
 *
 * Ce que ce fichier garde, et qui n'est pas dans le moteur :
 *
 * 1. **La liste peut finir.** Il existe un état de la base où le point est
 *    ÉTEINT pour une orga qui a pourtant des lignes à l'écran. Sans ce test, la
 *    règle COGA « une liste doit pouvoir finir » n'est gardée nulle part — et
 *    on ne s'en apercevrait qu'à l'usage, en apprenant à se méfier du point.
 * 2. **Le point n'ouvre aucune porte.** `chargerTaches` a déjà ses gardes
 *    (`taches-portes.test.ts`) ; on vérifie ici que le SIGNAL les emprunte,
 *    au lieu d'appeler la porte du cron par raccourci.
 *
 * Un booléen ne peut se tromper que de deux façons : s'allumer pour rien, ou
 * rester éteint à tort. Les deux sont jouées.
 */

vi.mock("@/lib/auth-guards", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/profiles", () => ({
  getProfilesPubliesSansNom: vi.fn(async () => []),
  getPendingProfiles: vi.fn(async () => []),
  getProfilesEnSommeilBrefs: vi.fn(async () => []),
}));
vi.mock("@/lib/tremplin-editions", () => ({
  listEditions: vi.fn(async () => []),
  aujourdhuiParis: vi.fn(() => "2026-08-17"),
}));
vi.mock("@/lib/contact-message", () => ({ countPendingContactMessages: vi.fn(async () => 0) }));
vi.mock("@/lib/conference-propositions", () => ({
  resumeFilePropositions: vi.fn(async () => ({ attend: false })),
}));
vi.mock("@/lib/articles-membres", () => ({ listArticlesEnRelecture: vi.fn(async () => []) }));
vi.mock("@/lib/reglages", () => ({
  getReglages: vi.fn(async () => ({
    relance_brouillon_jours: 30,
    validation_fiche_jours: 15,
    alerte_atelier_jours: 7,
  })),
}));
vi.mock("@/lib/tremplin-ateliers", () => ({
  getAteliersByEdition: vi.fn(async () => []),
  getAtelierMembersByEdition: vi.fn(async () => new Map()),
}));
vi.mock("@/lib/tremplin-coachs", () => ({ getCoachsByEdition: vi.fn(async () => new Map()) }));
vi.mock("@/lib/tremplin-recompenses", () => ({ getRecompensesByEdition: vi.fn(async () => []) }));
vi.mock("@/lib/tremplin-photos", () => ({
  getPhotosByEdition: vi.fn(async () => []),
  getPhotoTagsByEdition: vi.fn(async () => new Map()),
  photoPubliable: vi.fn(() => true),
}));
vi.mock("@/lib/tremplin-registrations", () => ({
  getRegistrationsByEdition: vi.fn(async () => []),
}));

import { getSession } from "@/lib/auth-guards";
import { getPendingProfiles } from "@/lib/profiles";
import { listEditions } from "@/lib/tremplin-editions";
import { getPhotosByEdition, getPhotoTagsByEdition, photoPubliable } from "@/lib/tremplin-photos";
import { chargerTaches, desTachesAttendent } from "@/lib/taches-chargement";

const orga = () =>
  vi.mocked(getSession).mockResolvedValue({ user: { id: "1", isOrga: true } } as never);

/** Une édition active, minimale — le décor des cas « constat ». */
const uneEdition = () =>
  vi.mocked(listEditions).mockResolvedValue([
    { id: 1, nom: "Tremplin 2026", statut: "en_cours", finaleDate: null } as never,
  ]);

/**
 * UNE photo, avec les tags donnés — et `photoPubliable` laissé VRAI de vrai
 * (la vraie fonction est mockée à `() => true`, on la force selon les tags).
 * C'est le tri de `chargerEditionEntrees` qui est jugé, pas un compteur qu'on
 * lui souffle.
 */
const photoAvecTags = (tags: { id: number; registrationId: number | null; couverte: boolean }[]) => {
  vi.mocked(getPhotosByEdition).mockResolvedValue([{ id: 9 } as never]);
  vi.mocked(getPhotoTagsByEdition).mockResolvedValue(new Map([[9, tags as never]]));
  vi.mocked(photoPubliable).mockImplementation((t) => t.every((x) => x.couverte));
};

/**
 * `reset`, pas `clear`. `clearAllMocks` efface les appels et LAISSE les
 * implémentations : un `mockResolvedValue` posé par un cas survivait au suivant,
 * et « rien à faire » héritait de la fiche du cas précédent — un faux vert dans
 * le fichier même qui garde que le point puisse s'éteindre.
 *
 * `resetAllMocks` restaure l'implémentation passée à `vi.fn(impl)`, donc
 * exactement les valeurs neutres des `vi.mock` ci-dessus. Une source ajoutée
 * demain est reposée d'office : il n'y a plus rien à penser à reposer.
 */
beforeEach(() => vi.resetAllMocks());

describe("desTachesAttendent — le point s'allume pour ce qu'un geste referme", () => {
  it("le décor vide ne dérive RIEN (sinon tous les cas d'après mentent)", async () => {
    orga();
    expect((await chargerTaches()).taches).toEqual([]);
  });

  it("une fiche à valider : le point est ALLUMÉ", async () => {
    orga();
    vi.mocked(getPendingProfiles).mockResolvedValue([
      { id: 7, name: "Ada Lovelace", submittedAt: "2026-08-01" } as never,
    ]);
    expect(await desTachesAttendent()).toBe(true);
  });

  it("rien à faire : le point est ÉTEINT", async () => {
    orga();
    expect(await desTachesAttendent()).toBe(false);
  });

  it("LA LISTE PEUT FINIR : une ligne à l'écran, et le point éteint", async () => {
    // Le test qui compte, et le SEUL décor qui l'obtienne : une photo bloquée
    // par la SEULE inscrite qui y figure. Sa couverture vaut son propre réglage
    // de visibilité — l'orga n'a aucun geste à poser. L'écran affiche donc une
    // ligne et le point reste éteint.
    //
    // Le décor est traversé pour de vrai jusqu'à `photoPubliable` : c'est le
    // tri de `chargerEditionEntrees` (tag d'inscription ou non) qu'on juge ici,
    // pas seulement le moteur. Le mocker au-dessus rendrait le test aveugle au
    // défaut qu'il existe pour garder.
    orga();
    uneEdition();
    photoAvecTags([{ id: 1, registrationId: 55, couverte: false }]);

    const { taches } = await chargerTaches();
    expect(taches.map((t) => t.libelle)).toEqual(["1 photo reste privée"]);
    expect(await desTachesAttendent()).toBe(false);
  });

  it("la MÊME photo, identifiée hors inscription : le point s'ALLUME", async () => {
    // Le pendant, et la moitié qui manquait. Un tag sans `registrationId` est
    // couvert par la case « Accord recueilli », que l'orga coche elle-même :
    // c'est un travail d'un clic, il doit s'annoncer. Fondre les deux cas dans
    // un compteur unique éteignait le point dessus.
    orga();
    uneEdition();
    photoAvecTags([{ id: 1, registrationId: null, couverte: false }]);

    const { taches } = await chargerTaches();
    expect(taches.map((t) => t.libelle)).toEqual(["Recueillir l'accord pour 1 photo"]);
    expect(await desTachesAttendent()).toBe(true);
  });

  it("un constat ET une vraie tâche : le point est allumé, par la vraie", async () => {
    orga();
    uneEdition();
    photoAvecTags([{ id: 1, registrationId: 55, couverte: false }]);
    vi.mocked(getPendingProfiles).mockResolvedValue([
      { id: 7, name: "Ada Lovelace", submittedAt: "2026-08-01" } as never,
    ]);
    expect(await desTachesAttendent()).toBe(true);
  });
});

describe("desTachesAttendent — le signal emprunte la porte, il n'en perce pas une", () => {
  it("une membre sans rôle : éteint, et aucune lecture d'association", async () => {
    vi.mocked(getSession).mockResolvedValue({ user: { id: "9", isOrga: false } } as never);
    expect(await desTachesAttendent()).toBe(false);
    expect(vi.mocked(listEditions)).not.toHaveBeenCalled();
    expect(vi.mocked(getPendingProfiles)).not.toHaveBeenCalled();
  });

  it("sans session du tout : éteint, et aucune lecture non plus", async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    expect(await desTachesAttendent()).toBe(false);
    expect(vi.mocked(listEditions)).not.toHaveBeenCalled();
  });

  it("n'accepte AUCUN argument : personne ne peut lui souffler un rôle", () => {
    expect(desTachesAttendent.length).toBe(0);
  });
});
