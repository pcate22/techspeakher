import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * LES PORTES du moteur de tâches — qui a le droit de lire quoi.
 *
 * L'étape B déplace les tâches d'organisatrices de `/admin` vers
 * `/mon-espace/a-faire`. Or ces deux préfixes n'ont pas la même protection au
 * bord : `auth.config.ts` refuse `/admin` à qui n'est pas orga, `/mon-espace`
 * demande seulement d'être connectée. Les tâches d'association ont aujourd'hui
 * DEUX gardes indépendantes (le préfixe, puis `requireOrgaPage` sur la page) ;
 * sur la nouvelle route il n'en resterait qu'une.
 *
 * La première conception passait les capacités en argument
 * (`chargerTaches({ estOrga })`). La revue du 2026-08-16 l'a écartée : une
 * capacité qu'un appelant compose est une capacité qu'un appelant peut mentir,
 * et il y aurait eu trois appelants — la page, la barre d'onglets, et le cron
 * du digest qui n'a PAS de session et aurait dû passer `estOrga: true` en dur.
 *
 * D'où trois portes, chacune gardée chez elle et sans capacité qui voyage :
 *
 * - `chargerTaches()` : espace connecté. Aucun argument — la session EST la
 *   capacité, lue par la fonction elle-même.
 * - `chargerTachesAssociation()` : le cron, gardé par `CRON_SECRET` en amont.
 *   Sans session, donc nommée pour ce qu'elle charge et non pour qui la lit.
 *
 * Ce que ce fichier garde, et qu'aucun test de moteur ne peut garder : pour
 * une non-orga, **aucune requête d'association n'est émise**. Pas « une dont on
 * jette le résultat » — aucune. C'est la différence entre masquer et ne jamais
 * lire, et c'est ce qui rend la faute impossible plutôt que testée.
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
    // La VRAIE clé de `reglages.ts`. Ce mock disait `sla_fiche_jours`, un nom
    // qui n'existe nulle part : `validation_fiche_jours` valait donc `undefined`
    // et toute règle DATÉE plantait ici (`plusJours` → « Invalid time value »).
    // Le banc n'en avait aucune, la faute a dormi jusqu'au 2026-08-21 — un mock
    // n'est pas typé, il ment sans que le compilateur ne voie rien.
    validation_fiche_jours: 15,
    alerte_atelier_jours: 7,
  })),
}));

import { getSession } from "@/lib/auth-guards";
import { getPendingProfiles, getProfilesEnSommeilBrefs } from "@/lib/profiles";
import { listEditions } from "@/lib/tremplin-editions";
import { countPendingContactMessages } from "@/lib/contact-message";
import { listArticlesEnRelecture } from "@/lib/articles-membres";
import { resumeFilePropositions } from "@/lib/conference-propositions";
import { getReglages } from "@/lib/reglages";
import { chargerTaches, chargerTachesAssociation } from "@/lib/taches-chargement";

/** Toutes les lectures qui composent la famille « association ». */
const LECTURES_ASSOCIATION = [
  getPendingProfiles,
  getProfilesEnSommeilBrefs,
  listEditions,
  countPendingContactMessages,
  listArticlesEnRelecture,
  // La file des conférences proposées est une lecture d'association comme les
  // autres : l'oublier de cette liste laisserait la garde incomplète, et c'est
  // la liste — pas un test par lecture — qui garantit le « rien n'est LU ».
  resumeFilePropositions,
  getReglages,
];

const session = (user: object | null) =>
  vi.mocked(getSession).mockResolvedValue(user ? ({ user } as never) : null);

beforeEach(() => vi.clearAllMocks());

describe("chargerTaches — la session EST la capacité", () => {
  it("une orga reçoit les tâches de l'association", async () => {
    session({ id: "1", isOrga: true });
    const { taches } = await chargerTaches();
    expect(Array.isArray(taches)).toBe(true);
    expect(vi.mocked(listEditions)).toHaveBeenCalled();
  });

  it("une membre SANS rôle : aucune requête d'association n'est émise", async () => {
    // Le cœur du fichier. Pas « le résultat est filtré » : rien n'est LU.
    session({ id: "9", isOrga: false });
    const { taches } = await chargerTaches();
    expect(taches).toEqual([]);
    for (const lecture of LECTURES_ASSOCIATION) {
      expect(vi.mocked(lecture), lecture.name).not.toHaveBeenCalled();
    }
  });

  it("sans session du tout : aucune requête non plus", async () => {
    session(null);
    const { taches } = await chargerTaches();
    expect(taches).toEqual([]);
    for (const lecture of LECTURES_ASSOCIATION) {
      expect(vi.mocked(lecture), lecture.name).not.toHaveBeenCalled();
    }
  });

  it("`isOrga` absent de la session vaut NON, jamais « peut-être »", async () => {
    // Un champ manquant ne doit pas ouvrir : la comparaison est stricte.
    session({ id: "9" });
    await chargerTaches();
    expect(vi.mocked(listEditions)).not.toHaveBeenCalled();
  });

  it("n'accepte AUCUN argument : un appelant ne peut pas mentir sur son rôle", () => {
    // La garde ne peut pas être contournée parce qu'il n'y a rien à passer.
    // Si la signature reprend un jour un paramètre, ce test tombe.
    expect(chargerTaches.length).toBe(0);
  });
});

describe("chargerTaches — la file des conférences proposées est BRANCHÉE", () => {
  /**
   * Le moteur savait dériver la règle (`taches.test.ts`) ; ce qui manquait le
   * 2026-08-21 était le CÂBLE. Une règle juste qu'aucun chargeur n'alimente est
   * exactement le défaut d'origine — « À faire » annonçait « Tout roule » avec
   * 113 propositions en attente. Ce test-ci est la seule chose qui garde le fil.
   */
  it("une proposition en attente devient une tâche dans la liste chargée", async () => {
    session({ id: "1", isOrga: true });
    vi.mocked(resumeFilePropositions).mockResolvedValueOnce({
      attend: true,
      total: 1,
      plusAncienne: "2026-08-15T10:00:00Z",
      seule: { id: 7, nom: "DevoxxFR", proposeParNom: "Aurélie V." },
    });
    const { taches } = await chargerTaches();
    expect(taches.map((t) => t.regle)).toContain("valider-conference");
    expect(taches.find((t) => t.regle === "valider-conference")?.href).toBe(
      "/admin/conferences/propositions/7",
    );
  });
});

describe("chargerTachesAssociation — la porte du cron", () => {
  it("charge sans session : le cron n'en a pas, et n'a pas à en inventer une", async () => {
    session(null);
    const { taches } = await chargerTachesAssociation();
    expect(Array.isArray(taches)).toBe(true);
    expect(vi.mocked(listEditions)).toHaveBeenCalled();
    // Elle ne consulte JAMAIS la session : sa garde est `CRON_SECRET`, en
    // amont. La confondre avec `chargerTaches` rouvrirait le trou.
    expect(vi.mocked(getSession)).not.toHaveBeenCalled();
  });
});
