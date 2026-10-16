import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Server Actions de la référence des conférences : garde-fous d'abord —
 * autorisation par la session, rate-limit, endpoint TESTÉ avant insertion
 * (ajout membre), erreurs douces sur doublon. Les accès DB sont mockés (le
 * comportement SQL réel est couvert par conferences-db.integration.test.ts).
 */

vi.mock("next/navigation", () => ({
  redirect: vi.fn((p: string) => {
    throw new Error(`REDIRECT:${p}`);
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));

vi.mock("@/auth", () => ({ auth: vi.fn(), signOut: vi.fn() }));
vi.mock("@/lib/auth-guards", () => ({
  requireOrgaId: vi.fn(),
  requireUserId: vi.fn(),
}));
vi.mock("@/lib/rate-limit", () => ({ isRateLimited: vi.fn(() => false) }));
vi.mock("@/lib/conferences", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/conferences")>();
  return {
    ...actual,
    createConference: vi.fn(),
    updateConference: vi.fn(),
    deleteConference: vi.fn(),
    saveEdition: vi.fn(),
    updateEdition: vi.fn(),
    deleteEdition: vi.fn(),
    setEditionActive: vi.fn(),
    testSessionizeEndpoint: vi.fn(),
  };
});
vi.mock("@/lib/conference-seed", () => ({ seedConferences: vi.fn() }));
vi.mock("@/lib/detecteur-sessionize", () => ({ detecterEndpointSessionize: vi.fn() }));
vi.mock("@/lib/cfp-sync", () => ({ runHarvestForProfile: vi.fn() }));
vi.mock("@/lib/profiles", () => ({
  getProfileByUserId: vi.fn(),
  upsertProfile: vi.fn(),
  ensureProfileId: vi.fn(),
  submitForValidation: vi.fn(),
  withdrawOwnProfile: vi.fn(),
  canSubmitToDirectory: vi.fn(),
}));
vi.mock("@/lib/talks", () => ({
  addTalk: vi.fn(),
  updateTalk: vi.fn(),
  deleteTalk: vi.fn(),
  addOccurrence: vi.fn(),
  updateOccurrence: vi.fn(),
  removeOccurrence: vi.fn(),
  getOccurrenceById: vi.fn(),
  talkAppartientAuProfil: vi.fn(),
  getKnownEditionById: vi.fn(),
  getRegistryConferenceById: vi.fn(),
}));
vi.mock("@/lib/users", () => ({ setUserName: vi.fn() }));
vi.mock("@/lib/cfp-suggestions", () => ({ acceptSuggestion: vi.fn(), refuseSuggestion: vi.fn() }));
vi.mock("@/lib/conference-propositions", () => ({
  createConferenceProposition: vi.fn(),
  soumettreProposition: vi.fn(),
  updateConferenceProposition: vi.fn(),
  findPropositionByNom: vi.fn(),
  validateConferenceProposition: vi.fn(),
  refuseConferenceProposition: vi.fn(),
  updatePropositionParOrga: vi.fn(),
  getPropositionEnAttente: vi.fn(),
}));

import { revalidatePath, updateTag } from "next/cache";
import { requireOrgaId, requireUserId } from "@/lib/auth-guards";
import { isRateLimited } from "@/lib/rate-limit";
import {
  createConference,
  updateConference,
  deleteConference,
  saveEdition,
  updateEdition,
  deleteEdition,
  setEditionActive,
  testSessionizeEndpoint,
} from "@/lib/conferences";
import { runHarvestForProfile } from "@/lib/cfp-sync";
import { detecterEndpointSessionize } from "@/lib/detecteur-sessionize";
import {
  soumettreProposition,
  updateConferenceProposition,
  findPropositionByNom,
  validateConferenceProposition,
  refuseConferenceProposition,
  updatePropositionParOrga,
  getPropositionEnAttente,
} from "@/lib/conference-propositions";
import { getProfileByUserId, ensureProfileId } from "@/lib/profiles";
import {
  addOccurrence,
  updateOccurrence,
  getOccurrenceById,
  talkAppartientAuProfil,
  getKnownEditionById,
  getRegistryConferenceById,
} from "@/lib/talks";
import { IDLE } from "@/lib/action-state";
import { makeProfile, makeOccurrence, fd } from "./test-helpers";
import {
  createConferenceAction,
  updateConferenceAction,
  deleteConferenceAction,
  createEditionAction,
  updateEditionAction,
  deleteEditionAction,
  toggleMoissonAction,
  validateConferencePropositionAction,
  refuseConferencePropositionAction,
  updatePropositionAction,
  reprendreNomAction,
} from "@/app/admin/conferences/actions";
import {
  proposeConferenceAction,
  runHarvestAction,
  addOccurrenceAction,
  updateOccurrenceAction,
} from "@/app/mon-espace/actions";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isRateLimited).mockReturnValue(false);
  vi.mocked(requireOrgaId).mockResolvedValue(42);
  vi.mocked(requireUserId).mockResolvedValue(7);
  // Par défaut le talk visé EST à la personne connectée : les tests qui parlent
  // d'autre chose n'ont pas à le redire. Celui qui teste la garde le renverse.
  vi.mocked(soumettreProposition).mockResolvedValue({
    ok: true, propositionId: 11, reutilisee: false,
  });
  // La file est vide par défaut : rien d'écarté, rien à rejoindre. Les tests qui
  // parlent d'arbitrage le renversent. `proposerConference` sonde désormais sur
  // TOUS ses chemins — l'arbitrage de l'orga se juge avant toute écriture.
  vi.mocked(findPropositionByNom).mockResolvedValue({
    aReutiliser: null, dejaEcartee: false,
  });
  // Par défaut le talk visé EST à la personne connectée : les tests qui parlent
  // d'autre chose n'ont pas à le redire. Celui qui teste la garde le renverse.
  vi.mocked(talkAppartientAuProfil).mockResolvedValue(true);
});

describe("actions orga (autorisation d'abord)", () => {
  it("createConferenceAction : refuse une non-orga (garde d'abord)", async () => {
    vi.mocked(requireOrgaId).mockRejectedValue(new Error("REDIRECT:/connexion"));
    await expect(
      createConferenceAction(IDLE, fd({ nom: "DevFest", type: "conference" })),
    ).rejects.toThrow("REDIRECT:/connexion");
    expect(createConference).not.toHaveBeenCalled();
  });

  it("createConferenceAction : Zod bloque avant la base (erreur, pas de redirect)", async () => {
    const r = await createConferenceAction(IDLE, fd({ nom: " ", type: "conference" }));
    expect(r.status).toBe("error");
    expect(createConference).not.toHaveBeenCalled();
  });

  it("createConferenceAction : création valide → PRG vers la page de la conférence", async () => {
    vi.mocked(createConference).mockResolvedValue({ ok: true, slug: "sunny-tech" });
    await expect(
      createConferenceAction(IDLE, fd({ nom: "Sunny Tech", type: "conference" })),
    ).rejects.toThrow("REDIRECT:/admin/conferences/sunny-tech?cree=1");
    expect(createConference).toHaveBeenCalledWith(expect.objectContaining({ nom: "Sunny Tech" }));
  });

  it("createConferenceAction : slug déjà pris → erreur douce (jamais d'écrasement)", async () => {
    vi.mocked(createConference).mockResolvedValue({ ok: false, raison: "deja_referencee" });
    const r = await createConferenceAction(IDLE, fd({ nom: "DevFest Toulouse", type: "conference" }));
    expect(r.status).toBe("error");
    if (r.status === "error") expect(r.error).toContain("déjà ce nom");
  });

  it("updateConferenceAction : nom inchangé (slug identique) → reste EN PLACE (success)", async () => {
    vi.mocked(updateConference).mockResolvedValue({ ok: true });
    const r = await updateConferenceAction(
      IDLE,
      fd({ conferenceId: "3", nom: "UX Days", type: "conference", slug: "ux-days" }),
    );
    expect(r.status).toBe("success");
    expect(updateConference).toHaveBeenCalledWith(3, expect.objectContaining({ nom: "UX Days" }));
  });

  it("updateConferenceAction : renommage (slug change) → redirige vers la page à jour", async () => {
    vi.mocked(updateConference).mockResolvedValue({ ok: true });
    await expect(
      updateConferenceAction(
        IDLE,
        fd({ conferenceId: "3", nom: "UX Days", type: "conference", slug: "ancien-nom" }),
      ),
    ).rejects.toThrow("REDIRECT:/admin/conferences/ux-days/modifier");
  });

  it("updateConferenceAction : id invalide → erreur, jamais d'écriture", async () => {
    const r = await updateConferenceAction(IDLE, fd({ conferenceId: "0", nom: "UX Days", type: "conference" }));
    expect(r.status).toBe("error");
    expect(updateConference).not.toHaveBeenCalled();
  });

  it("updateConferenceAction : collision de slug → erreur douce", async () => {
    vi.mocked(updateConference).mockResolvedValue({ ok: false, raison: "deja_referencee" });
    const r = await updateConferenceAction(
      IDLE,
      fd({ conferenceId: "3", nom: "Paris Web", type: "conference", slug: "paris-web-old" }),
    );
    expect(r.status).toBe("error");
    if (r.status === "error") expect(r.error).toContain("déjà ce nom");
  });

  it("deleteConferenceAction : conf avec événements → refus, retour à la conf", async () => {
    vi.mocked(deleteConference).mockResolvedValue({ ok: false, raison: "a_des_editions" });
    await expect(
      deleteConferenceAction(fd({ conferenceId: "3", slug: "devfest-toulouse" })),
    ).rejects.toThrow("REDIRECT:/admin/conferences/devfest-toulouse?suppr=refus");
    expect(deleteConference).toHaveBeenCalledWith(3);
  });

  it("deleteConferenceAction : succès → retour au hub avec confirmation nominative", async () => {
    vi.mocked(deleteConference).mockResolvedValue({ ok: true, nom: "Vieux Doublon" });
    await expect(deleteConferenceAction(fd({ conferenceId: "3", slug: "x" }))).rejects.toThrow(
      "REDIRECT:/admin/conferences?supprimee=Vieux%20Doublon",
    );
  });

  it("deleteConferenceAction : refuse une non-orga (garde d'abord)", async () => {
    vi.mocked(requireOrgaId).mockRejectedValue(new Error("REDIRECT:/connexion"));
    await expect(deleteConferenceAction(fd({ conferenceId: "3" }))).rejects.toThrow(
      "REDIRECT:/connexion",
    );
    expect(deleteConference).not.toHaveBeenCalled();
  });

  it("createEditionAction : endpoint fourni → RE-TESTÉ, INSERT-only, PRG vers l'édition", async () => {
    vi.mocked(testSessionizeEndpoint).mockResolvedValue({ ok: true, sessions: 5, speakers: 4 });
    vi.mocked(saveEdition).mockResolvedValue({ ok: true, id: 9 });
    await expect(
      createEditionAction(IDLE, fd({ conferenceId: "3", annee: "2026", endpoint: "abc123def", slug: "sunny-tech" })),
    ).rejects.toThrow("REDIRECT:/admin/conferences/sunny-tech/editions/9?cree=1");
    expect(testSessionizeEndpoint).toHaveBeenCalledWith("abc123def");
    expect(saveEdition).toHaveBeenCalledWith(
      expect.objectContaining({ conferenceId: 3, endpoint: "abc123def", actif: true, mode: "insert" }),
    );
  });

  it("createEditionAction : endpoint qui ne répond pas → erreur, rien enregistré", async () => {
    vi.mocked(testSessionizeEndpoint).mockResolvedValue({ ok: false, erreur: "introuvable" });
    const r = await createEditionAction(IDLE, fd({ conferenceId: "3", annee: "2026", endpoint: "abc123def", slug: "s" }));
    expect(r.status).toBe("error");
    expect(saveEdition).not.toHaveBeenCalled();
  });

  it("createEditionAction : année déjà là → erreur (corriger sur sa page)", async () => {
    vi.mocked(saveEdition).mockResolvedValue({ ok: false, raison: "deja_referencee" });
    const r = await createEditionAction(IDLE, fd({ conferenceId: "3", annee: "2026", slug: "s" }));
    expect(r.status).toBe("error");
    if (r.status === "error") expect(r.error).toContain("existe déjà");
  });

  it("updateEditionAction : id valide → mise à jour, reste EN PLACE (success)", async () => {
    vi.mocked(updateEdition).mockResolvedValue({ ok: true, id: 9 });
    const r = await updateEditionAction(
      IDLE,
      fd({ editionId: "9", conferenceId: "3", annee: "2026", slug: "s" }),
    );
    expect(r.status).toBe("success");
    expect(updateEdition).toHaveBeenCalledWith(9, expect.objectContaining({ annee: 2026 }));
  });

  it("createEditionAction : page programme collée → id DÉTECTÉ, puis testé et enregistré", async () => {
    // Le détecteur (garde SSRF) transforme l'adresse en id ; tout le reste du
    // chemin est inchangé : re-test Sessionize, écriture de l'ID seul.
    vi.mocked(detecterEndpointSessionize).mockResolvedValue({ ok: true, endpoint: "jl4ktls0" });
    vi.mocked(testSessionizeEndpoint).mockResolvedValue({ ok: true, sessions: 5, speakers: 4 });
    vi.mocked(saveEdition).mockResolvedValue({ ok: true, id: 9 });
    await expect(
      createEditionAction(
        IDLE,
        fd({ conferenceId: "3", annee: "2026", endpoint: "https://devfesttoulouse.fr/programme", slug: "s" }),
      ),
    ).rejects.toThrow("REDIRECT:");
    expect(detecterEndpointSessionize).toHaveBeenCalledWith("https://devfesttoulouse.fr/programme");
    expect(testSessionizeEndpoint).toHaveBeenCalledWith("jl4ktls0");
    expect(saveEdition).toHaveBeenCalledWith(expect.objectContaining({ endpoint: "jl4ktls0" }));
  });

  it("createEditionAction : un id collé passe SANS détection (aucune requête de page)", async () => {
    vi.mocked(testSessionizeEndpoint).mockResolvedValue({ ok: true, sessions: 5, speakers: 4 });
    vi.mocked(saveEdition).mockResolvedValue({ ok: true, id: 9 });
    await expect(
      createEditionAction(IDLE, fd({ conferenceId: "3", annee: "2026", endpoint: "abc123def", slug: "s" })),
    ).rejects.toThrow("REDIRECT:");
    expect(detecterEndpointSessionize).not.toHaveBeenCalled();
  });

  it("updateEditionAction : détection en échec → le message du détecteur, rien d'écrit ni testé", async () => {
    vi.mocked(detecterEndpointSessionize).mockResolvedValue({
      ok: false,
      erreur: "Aucun id d'endpoint Sessionize sur cette page : colle l'id directement.",
    });
    const r = await updateEditionAction(
      IDLE,
      fd({ editionId: "9", conferenceId: "3", annee: "2026", endpoint: "https://exemple.fr/prog", slug: "s" }),
    );
    expect(r.status).toBe("error");
    if (r.status === "error") expect(r.error).toMatch(/aucun id/i);
    expect(testSessionizeEndpoint).not.toHaveBeenCalled();
    expect(updateEdition).not.toHaveBeenCalled();
  });

  it("updateEditionAction : page programme collée → l'id détecté est écrit", async () => {
    vi.mocked(detecterEndpointSessionize).mockResolvedValue({ ok: true, endpoint: "jl4ktls0" });
    vi.mocked(testSessionizeEndpoint).mockResolvedValue({ ok: true, sessions: 5, speakers: 4 });
    vi.mocked(updateEdition).mockResolvedValue({ ok: true, id: 9 });
    const r = await updateEditionAction(
      IDLE,
      fd({ editionId: "9", conferenceId: "3", annee: "2026", endpoint: "https://devfesttoulouse.fr/programme", slug: "s" }),
    );
    expect(r.status).toBe("success");
    expect(updateEdition).toHaveBeenCalledWith(9, expect.objectContaining({ endpoint: "jl4ktls0" }));
  });

  it("updateEditionAction : id invalide → erreur, jamais d'écriture", async () => {
    const r = await updateEditionAction(IDLE, fd({ editionId: "0", conferenceId: "3", annee: "2026" }));
    expect(r.status).toBe("error");
    expect(updateEdition).not.toHaveBeenCalled();
  });

  it("deleteEditionAction : supprime puis retour à la conf", async () => {
    vi.mocked(deleteEdition).mockResolvedValue(undefined);
    await expect(
      deleteEditionAction(fd({ editionId: "9", slug: "sunny-tech" })),
    ).rejects.toThrow("REDIRECT:/admin/conferences/sunny-tech?edition-suppr=1");
    expect(deleteEdition).toHaveBeenCalledWith(9);
  });

  it("toggleMoissonAction : id non entier → no-op ; sinon confirmation nominative", async () => {
    const rien = await toggleMoissonAction({}, fd({ editionId: "abc", actif: "true" }));
    expect(setEditionActive).not.toHaveBeenCalled();
    expect(rien).toEqual({});

    vi.mocked(setEditionActive).mockResolvedValue(true);
    const ok = await toggleMoissonAction({}, fd({ editionId: "4", actif: "true" }));
    expect(ok.message).toBe("Moisson activée.");
  });
});

describe("validation orga des propositions", () => {
  it("valider : refuse une non-orga (garde d'abord)", async () => {
    vi.mocked(requireOrgaId).mockRejectedValue(new Error("REDIRECT:/connexion"));
    await expect(
      validateConferencePropositionAction(fd({ propositionId: "3" })),
    ).rejects.toThrow("REDIRECT:/connexion");
    expect(validateConferenceProposition).not.toHaveBeenCalled();
  });

  it("valider : promeut puis redirige (validée) avec le nombre de talks mis en ligne", async () => {
    vi.mocked(validateConferenceProposition).mockResolvedValue({
      ok: true,
      conferenceEditionId: 9,
      occurrences: 2,
    });
    await expect(
      validateConferencePropositionAction(fd({ propositionId: "3" })),
      // La FILE, pas le catalogue : une proposition arbitrée quitte la file, on
      // revient là où il en reste (l'arbitrage a sa page depuis le 2026-08-21).
    ).rejects.toThrow("REDIRECT:/admin/conferences/propositions?prop=validee&talks=2");
    expect(validateConferenceProposition).toHaveBeenCalledWith(3);
  });

  it("valider : rafraîchit les pages PUBLIQUES (les talks libérés y apparaissent)", async () => {
    vi.mocked(validateConferenceProposition).mockResolvedValue({
      ok: true,
      conferenceEditionId: 9,
      occurrences: 1,
    });
    await expect(
      validateConferencePropositionAction(fd({ propositionId: "3" })),
    ).rejects.toThrow("REDIRECT:");
    expect(revalidatePath).toHaveBeenCalledWith("/speakeuses");
    expect(revalidatePath).toHaveBeenCalledWith("/speakeuses/[id]", "page");
    expect(updateTag).toHaveBeenCalledWith("annuaire");
  });

  it("écarter : écarte puis redirige (écartée)", async () => {
    vi.mocked(refuseConferenceProposition).mockResolvedValue(true);
    await expect(
      refuseConferencePropositionAction(fd({ propositionId: "3" })),
    ).rejects.toThrow("REDIRECT:/admin/conferences/propositions?prop=refusee");
    expect(refuseConferenceProposition).toHaveBeenCalledWith(3);
  });

  it("écarter une proposition DÉJÀ arbitrée : « déjà traitée », pas un succès faux", async () => {
    // La garde d'état côté SQL rend `false` (dette soldée le 2026-08-21) : sans
    // elle, deux onglets suffisaient à écarter une proposition déjà validée —
    // et `findPropositionByNom` refusait alors ce nom à sa membre TOUTES ANNÉES
    // confondues, pour une conférence que l'équipe avait acceptée.
    vi.mocked(refuseConferenceProposition).mockResolvedValue(false);
    await expect(
      refuseConferencePropositionAction(fd({ propositionId: "3" })),
    ).rejects.toThrow("REDIRECT:/admin/conferences/propositions?prop=introuvable");
  });
});

describe("updatePropositionAction — corriger AVANT de valider", () => {
  /**
   * La troisième porte, celle qui manquait : valider écrivait tel quel, écarter
   * laissait la saisie hors ligne, et le message de conflit d'endpoint disait
   * pourtant « corrige-le » en pointant un écran qui n'existait pas
   * (`docs/conception-arbitrage-conferences.md`, défaut D).
   */
  it("refuse une non-orga : la garde d'abord, rien n'est écrit", async () => {
    vi.mocked(requireOrgaId).mockRejectedValue(new Error("REDIRECT:/connexion"));
    await expect(
      updatePropositionAction(IDLE, fd({ propositionId: "3", nomConference: "Devoxx France" })),
    ).rejects.toThrow("REDIRECT:/connexion");
    expect(updatePropositionParOrga).not.toHaveBeenCalled();
  });

  it("corrige le nom, l'année et le lieu — ce que la validation promeut", async () => {
    vi.mocked(updatePropositionParOrga).mockResolvedValue(true);
    const r = await updatePropositionAction(
      IDLE,
      fd({
        propositionId: "3",
        nomConference: "Devoxx France",
        annee: "2025",
        ville: "Paris",
      }),
    );
    expect(r.status).toBe("success");
    expect(updatePropositionParOrga).toHaveBeenCalledWith(3, {
      nomConference: "Devoxx France",
      annee: 2025,
      ville: "Paris",
      url: null,
      endpoint: null,
    });
  });

  it("nom invalide (slug vide) : rien n'est écrit, la saisie est rendue", async () => {
    // Le MÊME `nomConfField` que le formulaire orga et que la saisie membre :
    // un nom tout symbole donnerait une conférence inatteignable.
    const r = await updatePropositionAction(
      IDLE,
      fd({ propositionId: "3", nomConference: "!!!" }),
    );
    expect(r.status).toBe("error");
    expect(updatePropositionParOrga).not.toHaveBeenCalled();
  });

  it("proposition déjà arbitrée : erreur explicite, jamais un succès faux", async () => {
    // La garde `statut = 'en_attente'` du SQL rend `false`.
    vi.mocked(updatePropositionParOrga).mockResolvedValue(false);
    const r = await updatePropositionAction(
      IDLE,
      fd({ propositionId: "3", nomConference: "Devoxx France" }),
    );
    expect(r.status).toBe("error");
  });

  it("endpoint : l'adresse de la page programme est détectée, puis TESTÉE", async () => {
    // Pouvoir réservé à l'orga (le formulaire membre garde l'id strict), et
    // l'id est re-testé avant écriture : à la validation, un endpoint présent
    // ACTIVE la moisson.
    vi.mocked(detecterEndpointSessionize).mockResolvedValue({ ok: true, endpoint: "abc123def" });
    vi.mocked(testSessionizeEndpoint).mockResolvedValue({ ok: true, sessions: 10, speakers: 8 });
    vi.mocked(updatePropositionParOrga).mockResolvedValue(true);
    const r = await updatePropositionAction(
      IDLE,
      fd({
        propositionId: "3",
        nomConference: "Devoxx France",
        endpoint: "https://sessionize.com/api/v2/abc123def/view/Sessions",
      }),
    );
    expect(r.status).toBe("success");
    expect(updatePropositionParOrga).toHaveBeenCalledWith(
      3,
      expect.objectContaining({ endpoint: "abc123def" }),
    );
  });

  it("endpoint mort : rien n'est écrit, et le message dit ce qui a été JETÉ", async () => {
    vi.mocked(testSessionizeEndpoint).mockResolvedValue({ ok: false, erreur: "introuvable" });
    const r = await updatePropositionAction(
      IDLE,
      fd({ propositionId: "3", nomConference: "Devoxx France", endpoint: "abc123def" }),
    );
    expect(r.status).toBe("error");
    expect(updatePropositionParOrga).not.toHaveBeenCalled();
    // Le message hérité parlait d'« édition » sur un écran qui corrige une
    // PROPOSITION, où aucune édition n'existe encore — et l'orga n'avait aucune
    // raison de deviner que son nom corrigé était parti avec.
    expect(r.status === "error" && r.error).toContain("la correction n'a pas été enregistrée");
  });
});

describe("le nom arbitré voyage dans l'URL du PRG (et rien d'autre)", () => {
  /**
   * `nomArbitre` fait passer une saisie de MEMBRE dans une URL de redirection,
   * pour que la confirmation nomme la conférence. La passe sécurité a établi
   * qu'aucune injection n'est possible ; ce banc-là garde le POURQUOI, que la
   * mutation trouvait sans test : encodage, et borne.
   */
  const valide = () => {
    vi.mocked(validateConferenceProposition).mockResolvedValue({
      ok: true,
      conferenceEditionId: 9,
      occurrences: 1,
    });
  };

  it("encode ce qui casserait l'URL, et garde les trois paramètres attendus", async () => {
    valide();
    await expect(
      validateConferencePropositionAction(
        fd({ propositionId: "3", nom: "Devoxx & Co ?#=/ 2025\r\nSet-Cookie: x" }),
      ),
    ).rejects.toThrow(
      /^REDIRECT:\/admin\/conferences\/propositions\?prop=validee&nom=Devoxx%20%26%20Co%20%3F%23%3D%2F%202025%0D%0ASet-Cookie%3A%20x&talks=1$/,
    );
  });

  it("un nom trop long est OMIS : la phrase reste juste, simplement moins précise", async () => {
    valide();
    await expect(
      validateConferencePropositionAction(fd({ propositionId: "3", nom: "x".repeat(161) })),
    ).rejects.toThrow("REDIRECT:/admin/conferences/propositions?prop=validee&talks=1");
  });

  it("sans nom (vieux lien, champ absent) : aucun paramètre vide dans l'URL", async () => {
    valide();
    await expect(
      validateConferencePropositionAction(fd({ propositionId: "3" })),
    ).rejects.toThrow("REDIRECT:/admin/conferences/propositions?prop=validee&talks=1");
  });

  it("l'écartement nomme aussi ce qu'il vient d'écarter", async () => {
    vi.mocked(refuseConferenceProposition).mockResolvedValue(true);
    await expect(
      refuseConferencePropositionAction(fd({ propositionId: "3", nom: "DevoxxFR" })),
    ).rejects.toThrow(
      "REDIRECT:/admin/conferences/propositions?prop=refusee&nom=DevoxxFR",
    );
  });

  it("les trois actions refusent un id hors bornes AVANT la base", async () => {
    // `1e21` passe `Number.isInteger` et part en « 1e+21 » dans un `integer` :
    // 500 au lieu d'un retour propre (cf. `src/lib/id-url.ts`).
    for (const propositionId of ["0", "-4", "1e21", "abc", "2.5"]) {
      await expect(
        validateConferencePropositionAction(fd({ propositionId })),
      ).rejects.toThrow("REDIRECT:/admin/conferences/propositions");
      expect(validateConferenceProposition, propositionId).not.toHaveBeenCalled();
      await expect(
        refuseConferencePropositionAction(fd({ propositionId })),
      ).rejects.toThrow("REDIRECT:/admin/conferences/propositions");
      expect(refuseConferenceProposition, propositionId).not.toHaveBeenCalled();
    }
  });
});

describe("reprendreNomAction — le nom canonique en un geste", () => {
  /**
   * La porte du « Reprendre « Devoxx France » ». Écrite après avoir MESURÉ que
   * la version « lien + champ pré-rempli » ne tenait pas : le serveur envoyait
   * la bonne valeur, l'état client de React reprenait la main, et le champ
   * gardait l'ancien nom. Ce qu'on garde ici, c'est qu'une porte de plus n'est
   * pas une garde de moins.
   */
  const enAttente = {
    id: 7,
    nom: "DevoxxFR",
    annee: 2025,
    ville: "Paris",
    url: null,
    endpoint: "abc123def",
    proposeParNom: "Aurélie V.",
    talksEnAttente: 1,
    createdAt: "2026-08-15",
    saisies: [],
  };

  it("refuse une non-orga : la garde d'abord, rien n'est lu ni écrit", async () => {
    vi.mocked(requireOrgaId).mockRejectedValue(new Error("REDIRECT:/connexion"));
    await expect(
      reprendreNomAction(fd({ propositionId: "7", nom: "Devoxx France" })),
    ).rejects.toThrow("REDIRECT:/connexion");
    expect(getPropositionEnAttente).not.toHaveBeenCalled();
    expect(updatePropositionParOrga).not.toHaveBeenCalled();
  });

  it("n'écrit QUE le nom : le reste est relu en base, jamais reçu du client", async () => {
    // Des champs cachés auraient offert quatre valeurs de plus à falsifier pour
    // un geste qui n'en change qu'une.
    vi.mocked(getPropositionEnAttente).mockResolvedValue(enAttente);
    vi.mocked(updatePropositionParOrga).mockResolvedValue(true);
    await expect(
      reprendreNomAction(
        fd({
          propositionId: "7",
          nom: "Devoxx France",
          // Ce que le client tenterait de glisser :
          annee: "1999",
          ville: "Nulle part",
          endpoint: "zzzzzz",
        }),
      ),
    ).rejects.toThrow("REDIRECT:/admin/conferences/propositions/7?corrige=Devoxx%20France");
    expect(updatePropositionParOrga).toHaveBeenCalledWith(7, {
      nomConference: "Devoxx France",
      annee: 2025,
      ville: "Paris",
      url: null,
      endpoint: "abc123def",
    });
  });

  it("un nom impromouvable est refusé, comme sur le formulaire complet", async () => {
    // Le MÊME `nomConfField` : un nom dont le slug serait vide donnerait une
    // conférence inatteignable, et tous les noms « tout symbole » suivants
    // fusionneraient dessus.
    vi.mocked(getPropositionEnAttente).mockResolvedValue(enAttente);
    await expect(
      reprendreNomAction(fd({ propositionId: "7", nom: "!!!" })),
    ).rejects.toThrow("REDIRECT:/admin/conferences/propositions/7");
    expect(updatePropositionParOrga).not.toHaveBeenCalled();
  });

  it("proposition déjà arbitrée : rien n'est écrit, la page de l'item le dira", async () => {
    vi.mocked(getPropositionEnAttente).mockResolvedValue(null);
    await expect(
      reprendreNomAction(fd({ propositionId: "7", nom: "Devoxx France" })),
    ).rejects.toThrow("REDIRECT:/admin/conferences/propositions/7");
    expect(updatePropositionParOrga).not.toHaveBeenCalled();
  });

  it("un id hors bornes ne va jamais jusqu'à la base", async () => {
    // `1e21` passe `Number.isInteger` et part en « 1e+21 » dans un `integer` :
    // 500 au lieu d'un retour propre (cf. `src/lib/id-url.ts`).
    for (const propositionId of ["0", "-4", "1e21", "abc"]) {
      await expect(
        reprendreNomAction(fd({ propositionId, nom: "Devoxx France" })),
      ).rejects.toThrow("REDIRECT:/admin/conferences/propositions");
      expect(getPropositionEnAttente).not.toHaveBeenCalled();
    }
  });
});

describe("proposeConferenceAction (proposition membre, modérée)", () => {
  it("endpoint fourni : TESTÉ avant enregistrement ; id cassé → erreur, rien proposé", async () => {
    vi.mocked(testSessionizeEndpoint).mockResolvedValue({ ok: false, erreur: "introuvable" });
    const r = await proposeConferenceAction(
      {},
      fd({ nomConference: "Sunny Tech", endpoint: "abc123def" }),
    );
    expect(r.ok).toBe(false);
    expect(soumettreProposition).not.toHaveBeenCalled();
  });

  it("endpoint valide → proposition enregistrée (pas d'écriture directe au répertoire), créditée à la membre", async () => {
    vi.mocked(testSessionizeEndpoint).mockResolvedValue({ ok: true, sessions: 10, speakers: 8 });
    const r = await proposeConferenceAction(
      {},
      fd({ nomConference: "Sunny Tech", annee: "2026", endpoint: "abc123def" }),
    );
    expect(r.ok).toBe(true);
    expect(soumettreProposition).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 7, nomConference: "Sunny Tech", endpoint: "abc123def" }),
    );
  });

  it("sans endpoint : proposée sans test (conf connue, non moissonnée)", async () => {
    const r = await proposeConferenceAction({}, fd({ nomConference: "Sunny Tech" }));
    expect(r.ok).toBe(true);
    expect(testSessionizeEndpoint).not.toHaveBeenCalled();
    expect(soumettreProposition).toHaveBeenCalled();
  });

  it("rate-limitée (5/h) : au-delà, erreur douce sans enregistrement", async () => {
    vi.mocked(isRateLimited).mockReturnValue(true);
    const r = await proposeConferenceAction({}, fd({ nomConference: "Sunny Tech" }));
    expect(r.ok).toBe(false);
    expect(soumettreProposition).not.toHaveBeenCalled();
  });
});

/**
 * Les DEUX écrans qui déposent une proposition passent par la même porte
 * (`soumettreProposition`). Sans ça, celui-ci restait un contournement : une
 * conférence écartée par l'équipe y revenait dans la file en un clic.
 */
describe("proposeConferenceAction — même arbitrage que la saisie d'un talk", () => {
  it("nom déjà écarté par l'équipe : refusé ici aussi, pas remis en file", async () => {
    vi.mocked(soumettreProposition).mockResolvedValue({ ok: false, raison: "ecartee" });
    const r = await proposeConferenceAction({}, fd({ nomConference: "Conf Bidon" }));
    expect(r.ok).toBe(false);
    expect(r.errors?.nomConference).toMatch(/écarté/i);
  });

  it("même conférence déjà en file : rejointe, jamais dupliquée", async () => {
    vi.mocked(soumettreProposition).mockResolvedValue({
      ok: true, propositionId: 11, reutilisee: true,
    });
    const r = await proposeConferenceAction(
      {},
      fd({ nomConference: "Cloud Nord", annee: "2025" }),
    );
    expect(r.ok).toBe(true);
    expect(soumettreProposition).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 7, nomConference: "Cloud Nord", annee: 2025 }),
    );
  });
});

describe("runHarvestAction (repérage à la demande)", () => {
  it("respecte le consentement : cfp_sync_mode 'aucun' → refus explicite, pas de run", async () => {
    vi.mocked(getProfileByUserId).mockResolvedValue(makeProfile({ cfpSyncMode: "aucun" }));
    const r = await runHarvestAction({}, fd({}));
    expect(r.ok).toBe(false);
    expect(runHarvestForProfile).not.toHaveBeenCalled();
  });

  it("rate-limité (2/10 min)", async () => {
    vi.mocked(getProfileByUserId).mockResolvedValue(makeProfile());
    vi.mocked(isRateLimited).mockReturnValue(true);
    const r = await runHarvestAction({}, fd({}));
    expect(r.ok).toBe(false);
    expect(runHarvestForProfile).not.toHaveBeenCalled();
  });

  it("run OK : compteurs relayés pour l'affichage immédiat", async () => {
    vi.mocked(getProfileByUserId).mockResolvedValue(makeProfile({ id: 3 }));
    vi.mocked(runHarvestForProfile).mockResolvedValue({
      events: 4,
      suggestions: 2,
      majs: 1,
      erreurs: 0,
    });
    const r = await runHarvestAction({}, fd({}));
    expect(r).toMatchObject({ ok: true, suggestions: 2, majs: 1 });
    expect(runHarvestForProfile).toHaveBeenCalledWith(3);
    expect(r.message).toContain("2 talks repérés");
    // Le run peut réécrire des titres de talks AFFICHÉS sur les cartes.
    expect(vi.mocked(updateTag)).toHaveBeenCalledWith("annuaire");
  });
});

describe("revalidation du lien au registre (champs cachés falsifiables) via addOccurrenceAction", () => {
  it("editionId inexistant → erreur claire sur `conference` (pas de création silencieuse, pas de 500 de FK)", async () => {
    vi.mocked(ensureProfileId).mockResolvedValue(3);
    vi.mocked(getKnownEditionById).mockResolvedValue(null);

    const r = await addOccurrenceAction(
      {},
      fd({ talkId: "5", conference: "X", editionId: "999" }),
    );
    expect(r).toEqual({
      ok: false,
      errors: {
        conference: "Choisis une conférence dans la liste, ou donne le nom de la tienne.",
      },
    });
    expect(addOccurrence).not.toHaveBeenCalled();
  });

  it("editionId valide → conference_id DÉDUIT de l'édition + libellé SNAPSHOT posé", async () => {
    vi.mocked(ensureProfileId).mockResolvedValue(3);
    vi.mocked(getKnownEditionById).mockResolvedValue({
      editionId: 42,
      conferenceId: 7,
      libelle: "DevFest Toulouse 2026",
      ville: "Toulouse",
      pays: "France",
      url: null,
      dateDebut: null,
      dateFin: null,
    });
    vi.mocked(addOccurrence).mockResolvedValue(77);

    await expect(
      addOccurrenceAction(
        {},
        fd({
          talkId: "5",
          // Libellé et conferenceId soumis FALSIFIÉS : le registre a raison.
          conference: "Ma conf renommée à la main",
          conferenceId: "999",
          editionId: "42",
        }),
      ),
    ).rejects.toThrow("REDIRECT:/mon-espace/talks/5?ok=conf_ajoutee");

    expect(getKnownEditionById).toHaveBeenCalledWith(42);
    expect(addOccurrence).toHaveBeenCalledWith(
      5,
      3,
      expect.objectContaining({
        editionId: 42,
        conferenceId: 7,
        conference: "DevFest Toulouse 2026",
      }),
    );
  });

  it("conferenceId seul valide → lien posé sans édition (libellé = nom de la conf)", async () => {
    vi.mocked(ensureProfileId).mockResolvedValue(3);
    vi.mocked(getRegistryConferenceById).mockResolvedValue({
      id: 7,
      nom: "Sunny Tech",
      ville: "Montpellier",
      pays: "France",
    });
    vi.mocked(addOccurrence).mockResolvedValue(77);

    await expect(
      addOccurrenceAction({}, fd({ talkId: "5", conferenceId: "7" })),
    ).rejects.toThrow("REDIRECT:/mon-espace/talks/5?ok=conf_ajoutee");

    expect(getRegistryConferenceById).toHaveBeenCalledWith(7);
    expect(addOccurrence).toHaveBeenCalledWith(
      5,
      3,
      expect.objectContaining({ conferenceId: 7, editionId: null, conference: "Sunny Tech" }),
    );
  });
});

/**
 * Le cœur du correctif (migration 068) : une conférence hors registre n'arrête
 * plus la saisie. Elle part en proposition ET l'occurrence est enregistrée,
 * rattachée à cette proposition — donc gardée, mais hors des affichages publics.
 */
describe("conférence hors registre : la saisie est gardée, pas rejetée", () => {
  beforeEach(() => {
    vi.mocked(ensureProfileId).mockResolvedValue(3);
    vi.mocked(addOccurrence).mockResolvedValue(77);
    vi.mocked(soumettreProposition).mockResolvedValue({
      ok: true, propositionId: 11, reutilisee: false,
    });
    // Par défaut : aucune proposition antérieure de cette personne.
    vi.mocked(findPropositionByNom).mockResolvedValue({ aReutiliser: null, dejaEcartee: false });
  });

  it("nom saisi → proposition créée AVEC le contexte, et occurrence enregistrée en attente", async () => {
    await expect(
      addOccurrenceAction(
        {},
        fd({
          talkId: "5",
          conferenceProposee: "Cloud Nord",
          ville: "Lille",
          pays: "France",
          annee: "2025",
          lienConf: "https://cloudnord.fr",
          lienSlides: "https://slides.example/x",
        }),
      ),
    ).rejects.toThrow("REDIRECT:/mon-espace/talks/5?ok=conf_proposee");

    // L'orga arbitre avec le contexte sous les yeux (année, ville, site).
    expect(soumettreProposition).toHaveBeenCalledWith({
      userId: 7,
      nomConference: "Cloud Nord",
      annee: 2025,
      ville: "Lille",
      url: "https://cloudnord.fr",
      endpoint: null,
    });
    // Et surtout : TOUT ce qu'elle a tapé est enregistré, pas juste le nom.
    expect(addOccurrence).toHaveBeenCalledWith(
      5,
      3,
      expect.objectContaining({
        conferenceId: null,
        editionId: null,
        conference: "Cloud Nord",
        propositionId: 11,
        ville: "Lille",
        date: "2025",
        lienSlides: "https://slides.example/x",
      }),
    );
  });

  it("ni conférence choisie ni nom saisi → refus explicite (rien de proposé)", async () => {
    const r = await addOccurrenceAction({}, fd({ talkId: "5", ville: "Lille" }));
    expect(r.ok).toBe(false);
    expect(r.errors?.conference).toMatch(/choisis une conférence/i);
    expect(soumettreProposition).not.toHaveBeenCalled();
    expect(addOccurrence).not.toHaveBeenCalled();
  });

  it("nom trop court → erreur sur le champ, rien en base", async () => {
    const r = await addOccurrenceAction({}, fd({ talkId: "5", conferenceProposee: "X" }));
    expect(r.ok).toBe(false);
    expect(r.errors?.conferenceProposee).toBeTruthy();
    expect(soumettreProposition).not.toHaveBeenCalled();
    expect(addOccurrence).not.toHaveBeenCalled();
  });

  it("rate-limitée : au-delà du quota, rien de proposé NI d'enregistré", async () => {
    vi.mocked(isRateLimited).mockReturnValue(true);
    const r = await addOccurrenceAction(
      {},
      fd({ talkId: "5", conferenceProposee: "Cloud Nord" }),
    );
    expect(r.ok).toBe(false);
    expect(soumettreProposition).not.toHaveBeenCalled();
    expect(addOccurrence).not.toHaveBeenCalled();
  });

  it("rejoindre une ligne DÉJÀ en file ne consomme aucun quota", async () => {
    // Le quota protège la file de l'orga, pas la base : rattacher la même
    // conférence hors registre à six talks n'ajoute qu'UNE ligne à arbitrer.
    // Sans ce test, l'exemption n'était tenue par rien — la retirer laissait
    // la suite verte, et la sixième saisie d'une même conf tombait sur
    // « Doucement ! Réessaie dans une heure » pour zéro ligne créée.
    vi.mocked(findPropositionByNom).mockResolvedValue({
      aReutiliser: 11, dejaEcartee: false,
    });
    vi.mocked(soumettreProposition).mockResolvedValue({
      ok: true, propositionId: 11, reutilisee: true,
    });

    await expect(
      addOccurrenceAction({}, fd({ talkId: "5", conferenceProposee: "Cloud Nord" })),
    ).rejects.toThrow("REDIRECT:/mon-espace/talks/5?ok=conf_proposee");

    expect(isRateLimited).not.toHaveBeenCalled();
    expect(addOccurrence).toHaveBeenCalled();
  });

  it("une conférence du registre reste prioritaire : aucune proposition ouverte", async () => {
    vi.mocked(getRegistryConferenceById).mockResolvedValue({
      id: 7, nom: "Sunny Tech", ville: "Montpellier", pays: "France",
    });
    await expect(
      addOccurrenceAction(
        {},
        fd({ talkId: "5", conferenceId: "7", conferenceProposee: "Cloud Nord" }),
      ),
    ).rejects.toThrow("REDIRECT:/mon-espace/talks/5?ok=conf_ajoutee");
    expect(soumettreProposition).not.toHaveBeenCalled();
  });

  it("modification d'une saisie en attente : SA proposition est corrigée, pas dupliquée", async () => {
    vi.mocked(getOccurrenceById).mockResolvedValue({
      id: 9, conferenceId: null, conferenceSlug: null, editionId: null,
      conference: "Cloud Nord", ville: "Lille", codeInsee: "59350", region: "Hauts-de-France",
      pays: "France", date: "2025",
      lienConf: null, lienSlides: null, lienVideo: null, lienFeedback: null,
      propositionId: 11, etat: "en_attente",
    });
    vi.mocked(updateConferenceProposition).mockResolvedValue(true);

    await expect(
      updateOccurrenceAction(
        {},
        fd({
          talkId: "5",
          occurrenceId: "9",
          conferenceProposee: "Cloud Nord 2025",
          ville: "Lille",
        }),
      ),
    ).rejects.toThrow("REDIRECT:/mon-espace/talks/5?ok=conf_proposee");

    // L'id de la SAISIE est transmis avec celui de la proposition : c'est lui
    // qui permet à l'UPDATE de refuser dès qu'une AUTRE occurrence tient la
    // même proposition (elle serait republiée sous une édition qu'on corrige).
    expect(updateConferenceProposition).toHaveBeenCalledWith(
      { propositionId: 11, userId: 7, occurrenceId: 9 },
      expect.objectContaining({ nomConference: "Cloud Nord 2025" }),
    );
    expect(soumettreProposition).not.toHaveBeenCalled();
    expect(updateOccurrence).toHaveBeenCalledWith(
      9,
      3,
      expect.objectContaining({ propositionId: 11, conference: "Cloud Nord 2025" }),
    );
  });

  it("saisie dont la proposition est PARTAGÉE : elle se détache au lieu de la réécrire", async () => {
    vi.mocked(getOccurrenceById).mockResolvedValue(
      makeOccurrence({
        id: 9, conference: "Foo Conf", ville: null, pays: null, date: "2023",
        propositionId: 11, etat: "en_attente",
      }),
    );
    // Un autre talk attend derrière la proposition 11 : l'UPDATE refuse.
    vi.mocked(updateConferenceProposition).mockResolvedValue(false);
    vi.mocked(soumettreProposition).mockResolvedValue({
      ok: true, propositionId: 12, reutilisee: false,
    });

    await expect(
      updateOccurrenceAction(
        {},
        fd({ talkId: "5", occurrenceId: "9", conferenceProposee: "Foo Conf", annee: "2024" }),
      ),
    ).rejects.toThrow("REDIRECT:/mon-espace/talks/5?ok=conf_proposee");

    // La saisie corrigée part sur SA proposition (2024) ; l'autre talk reste
    // derrière la 11, en 2023, avec le nom que son autrice avait tapé.
    expect(soumettreProposition).toHaveBeenCalledWith(
      expect.objectContaining({ nomConference: "Foo Conf", annee: 2024 }),
    );
    expect(updateOccurrence).toHaveBeenCalledWith(
      9,
      3,
      expect.objectContaining({ propositionId: 12 }),
    );
  });

  it("corriger sa saisie vers un nom ÉCARTÉ : refusé, sans écrire (la 3ᵉ porte)", async () => {
    // La correction en place est une porte d'écriture à part entière. Elle ne
    // consultait `dejaEcartee` qu'APRÈS coup : renommer sa saisie vers un nom
    // que l'équipe avait écarté le remettait en file, exactement le
    // contournement déjà fermé sur l'autre écran (« Propose-la »).
    vi.mocked(getOccurrenceById).mockResolvedValue(
      makeOccurrence({
        id: 9, conference: "Autre Conf", ville: null, pays: null, date: null,
        propositionId: 11, etat: "en_attente",
      }),
    );
    vi.mocked(findPropositionByNom).mockResolvedValue({
      aReutiliser: null, dejaEcartee: true,
    });

    const r = await updateOccurrenceAction(
      {},
      fd({ talkId: "5", occurrenceId: "9", conferenceProposee: "Conf Bidon" }),
    );

    expect(r.ok).toBe(false);
    expect(r.errors?.conferenceProposee).toMatch(/écarté/i);
    expect(updateConferenceProposition).not.toHaveBeenCalled();
    expect(updateOccurrence).not.toHaveBeenCalled();
  });

  it("un nom écarté sur UNE année laisse corriger sa proposition d'une AUTRE année", async () => {
    // `dejaEcartee` porte sur le nom, toutes années ; la proposition corrigée
    // est datée. Refuser sur le nom seul verrouillait une saisie légitime : un
    // « Foo Conf 2023 » écarté empêchait de toucher à « Foo Conf 2025 » encore
    // en attente — y compris pour n'ajouter qu'un lien de slides.
    vi.mocked(getOccurrenceById).mockResolvedValue(
      makeOccurrence({
        id: 9, conference: "Foo Conf", ville: null, pays: null, date: "2025",
        propositionId: 11, etat: "en_attente",
      }),
    );
    // Le nom a été écarté (sur 2023), et sa proposition 2025 attend toujours :
    // c'est CELLE-LÀ qu'elle édite, donc rien de neuf n'entre dans la file.
    vi.mocked(findPropositionByNom).mockResolvedValue({
      aReutiliser: 11, dejaEcartee: true,
    });
    vi.mocked(updateConferenceProposition).mockResolvedValue(true);

    await expect(
      updateOccurrenceAction(
        {},
        fd({
          talkId: "5", occurrenceId: "9",
          conferenceProposee: "Foo Conf", annee: "2025", ville: "Lille",
        }),
      ),
    ).rejects.toThrow("REDIRECT:/mon-espace/talks/5?ok=conf_proposee");

    expect(updateConferenceProposition).toHaveBeenCalled();
  });

  it("corriger vers un (nom, année) qu'une AUTRE de ses propositions porte : rejointe, pas dupliquée", async () => {
    vi.mocked(getOccurrenceById).mockResolvedValue(
      makeOccurrence({
        id: 9, conference: "Autre Conf", ville: null, pays: null, date: null,
        propositionId: 11, etat: "en_attente",
      }),
    );
    // Elle a déjà une proposition en file pour « Cloud Nord 2025 » : la 12.
    vi.mocked(findPropositionByNom).mockResolvedValue({
      aReutiliser: 12, dejaEcartee: false,
    });
    vi.mocked(soumettreProposition).mockResolvedValue({
      ok: true, propositionId: 12, reutilisee: true,
    });

    await expect(
      updateOccurrenceAction(
        {},
        fd({
          talkId: "5", occurrenceId: "9",
          conferenceProposee: "Cloud Nord", annee: "2025",
        }),
      ),
    ).rejects.toThrow("REDIRECT:/mon-espace/talks/5?ok=conf_proposee");

    // Renommer la 11 en « Cloud Nord 2025 » aurait fait DEUX lignes identiques
    // dans la file de l'orga — ce que la clé (nom, année) existe pour empêcher.
    expect(updateConferenceProposition).not.toHaveBeenCalled();
    expect(updateOccurrence).toHaveBeenCalledWith(
      9, 3, expect.objectContaining({ propositionId: 12 }),
    );
  });

  it("proposition partagée, seule la ville change : la saisie RESTE derrière, sans doublon", async () => {
    // Le repli est décrit comme un « détachement », et il l'est dès que le nom
    // ou l'année bouge. Pas ici : la clé (nom, année) est inchangée, donc
    // `soumettreProposition` retrouve LA MÊME ligne et la saisie y reste
    // accrochée. Ce que ça coûte, et qu'on assume : la ville corrigée vaut pour
    // la saisie, pas pour la ligne d'arbitrage — on ne réécrit pas celle sur
    // laquelle le talk de l'autre repose.
    vi.mocked(getOccurrenceById).mockResolvedValue(
      makeOccurrence({
        id: 9, conference: "Foo Conf", ville: null, pays: null, date: "2023",
        propositionId: 11, etat: "en_attente",
      }),
    );
    vi.mocked(findPropositionByNom).mockResolvedValue({
      aReutiliser: 11, dejaEcartee: false,
    });
    // Un autre talk tient la 11 : l'UPDATE refuse.
    vi.mocked(updateConferenceProposition).mockResolvedValue(false);
    vi.mocked(soumettreProposition).mockResolvedValue({
      ok: true, propositionId: 11, reutilisee: true,
    });

    await expect(
      updateOccurrenceAction(
        {},
        fd({
          talkId: "5", occurrenceId: "9",
          conferenceProposee: "Foo Conf", annee: "2023", ville: "Lille",
        }),
      ),
    ).rejects.toThrow("REDIRECT:/mon-espace/talks/5?ok=conf_proposee");

    // Aucune ligne de plus pour l'orga, et la saisie garde sa ville.
    expect(isRateLimited).not.toHaveBeenCalled();
    expect(updateOccurrence).toHaveBeenCalledWith(
      9, 3, expect.objectContaining({ propositionId: 11, ville: "Lille" }),
    );
  });

  it("resoumettre à l'identique une saisie écartée : refusé, et dit", async () => {
    vi.mocked(getOccurrenceById).mockResolvedValue(
      makeOccurrence({
        id: 9, conference: "Conf Bidon", ville: null, pays: null, date: null,
        propositionId: 11, etat: "ecartee",
      }),
    );
    // Sa proposition est `refusee` : elle n'est donc pas `aReutiliser`.
    vi.mocked(findPropositionByNom).mockResolvedValue({
      aReutiliser: null, dejaEcartee: true,
    });

    const r = await updateOccurrenceAction(
      {},
      fd({ talkId: "5", occurrenceId: "9", conferenceProposee: "Conf Bidon" }),
    );

    expect(r.ok).toBe(false);
    expect(r.errors?.conferenceProposee).toMatch(/écarté/i);
    expect(updateConferenceProposition).not.toHaveBeenCalled();
  });

  it("corriger la ville de SA saisie, nom et année inchangés : sa proposition est bien corrigée", async () => {
    vi.mocked(getOccurrenceById).mockResolvedValue(
      makeOccurrence({
        id: 9, conference: "Cloud Nord", ville: null, pays: null, date: "2025",
        propositionId: 11, etat: "en_attente",
      }),
    );
    // La proposition qui porte déjà ce (nom, année), c'est LA SIENNE : la
    // rejoindre au lieu de la corriger perdrait la ville qu'elle vient de saisir.
    vi.mocked(findPropositionByNom).mockResolvedValue({
      aReutiliser: 11, dejaEcartee: false,
    });
    vi.mocked(updateConferenceProposition).mockResolvedValue(true);

    await expect(
      updateOccurrenceAction(
        {},
        fd({
          talkId: "5", occurrenceId: "9",
          conferenceProposee: "Cloud Nord", annee: "2025", ville: "Lille",
        }),
      ),
    ).rejects.toThrow("REDIRECT:/mon-espace/talks/5?ok=conf_proposee");

    expect(updateConferenceProposition).toHaveBeenCalledWith(
      expect.objectContaining({ propositionId: 11, occurrenceId: 9 }),
      expect.objectContaining({ ville: "Lille" }),
    );
    expect(soumettreProposition).not.toHaveBeenCalled();
  });

  it("saisie écartée resoumise : la proposition arbitrée est laissée, une neuve est ouverte", async () => {
    vi.mocked(getOccurrenceById).mockResolvedValue({
      id: 9, conferenceId: null, conferenceSlug: null, editionId: null,
      conference: "Cloud Nord", ville: null, codeInsee: null, region: null, pays: null, date: null,
      lienConf: null, lienSlides: null, lienVideo: null, lienFeedback: null,
      propositionId: 11, etat: "ecartee",
    });
    // Proposition déjà arbitrée → la correction sur place ne prend pas.
    vi.mocked(updateConferenceProposition).mockResolvedValue(false);

    await expect(
      updateOccurrenceAction(
        {},
        fd({ talkId: "5", occurrenceId: "9", conferenceProposee: "Cloud Nord Lille" }),
      ),
    ).rejects.toThrow("REDIRECT:/mon-espace/talks/5?ok=conf_proposee");

    expect(soumettreProposition).toHaveBeenCalled();
    expect(updateOccurrence).toHaveBeenCalledWith(
      9,
      3,
      expect.objectContaining({ propositionId: 11 }),
    );
  });

  it("même conférence sur un 2ᵉ talk : UNE seule proposition, pas une par talk", async () => {
    vi.mocked(findPropositionByNom).mockResolvedValue({ aReutiliser: 11, dejaEcartee: false });
    vi.mocked(soumettreProposition).mockResolvedValue({
      ok: true, propositionId: 11, reutilisee: true,
    });

    await expect(
      addOccurrenceAction({}, fd({ talkId: "6", conferenceProposee: "Cloud Nord" })),
    ).rejects.toThrow("REDIRECT:/mon-espace/talks/6?ok=conf_proposee");

    // L'orga arbitre UNE ligne ; refuser un doublon aurait condamné une saisie.
    expect(soumettreProposition).toHaveBeenCalledTimes(1);
    expect(addOccurrence).toHaveBeenCalledWith(
      6,
      3,
      expect.objectContaining({ propositionId: 11 }),
    );
  });

  it("talk qui n'est pas à elle : refus AVANT toute proposition (aucune ligne dans la file orga)", async () => {
    vi.mocked(talkAppartientAuProfil).mockResolvedValue(false);
    const r = await addOccurrenceAction(
      {},
      fd({ talkId: "999", conferenceProposee: "Cloud Nord" }),
    );
    expect(r.ok).toBe(false);
    // Sans cette garde, une proposition orpheline restait à arbitrer pour un
    // enregistrement qui n'a jamais eu lieu — et le quota était consommé.
    expect(soumettreProposition).not.toHaveBeenCalled();
    expect(addOccurrence).not.toHaveBeenCalled();
  });

  it("même conférence, ANNÉE différente : nouvelle proposition (une édition n'est pas l'autre)", async () => {
    // Rien à réutiliser pour cette année-là, même si le nom est déjà en file.
    vi.mocked(findPropositionByNom).mockResolvedValue({
      aReutiliser: null,
      dejaEcartee: false,
    });
    await expect(
      addOccurrenceAction(
        {},
        fd({ talkId: "5", conferenceProposee: "Foo Conf", annee: "2024" }),
      ),
    ).rejects.toThrow("REDIRECT:/mon-espace/talks/5?ok=conf_proposee");

    expect(findPropositionByNom).toHaveBeenCalledWith(7, "Foo Conf", 2024);
    expect(soumettreProposition).toHaveBeenCalledWith(
      expect.objectContaining({ nomConference: "Foo Conf", annee: 2024 }),
    );
  });

  it("re-proposer à l'identique un nom déjà écarté : refusé et expliqué, pas remis en file", async () => {
    vi.mocked(findPropositionByNom).mockResolvedValue({ aReutiliser: null, dejaEcartee: true });
    vi.mocked(soumettreProposition).mockResolvedValue({ ok: false, raison: "ecartee" });

    const r = await addOccurrenceAction(
      {},
      fd({ talkId: "5", conferenceProposee: "Conf Bidon" }),
    );
    expect(r.ok).toBe(false);
    expect(r.errors?.conferenceProposee).toMatch(/écarté/i);
    // La porte partagée tranche (elle seule connaît l'historique d'arbitrage) ;
    // ce qui compte ici, c'est que RIEN ne soit écrit derrière son refus.
    expect(addOccurrence).not.toHaveBeenCalled();
  });

  it("occurrence d'un autre profil : refus AVANT toute proposition (rien de mis en file)", async () => {
    vi.mocked(getOccurrenceById).mockResolvedValue(null);
    const r = await updateOccurrenceAction(
      {},
      fd({ talkId: "5", occurrenceId: "9", conferenceProposee: "Cloud Nord" }),
    );
    expect(r.ok).toBe(false);
    expect(soumettreProposition).not.toHaveBeenCalled();
    expect(updateOccurrence).not.toHaveBeenCalled();
  });

  it("validée pendant l'édition : renvoyer le nom saisi ne la DÉPUBLIE pas", async () => {
    // Course réelle : l'orga valide pendant que le formulaire est ouvert.
    vi.mocked(getOccurrenceById).mockResolvedValue({
      id: 9, conferenceId: 7, conferenceSlug: "cloud-nord", editionId: 42,
      conference: "Cloud Nord 2025", ville: "Lille", codeInsee: "59350", region: "Hauts-de-France",
      pays: "France", date: "2025",
      lienConf: null, lienSlides: null, lienVideo: null, lienFeedback: null,
      propositionId: null, etat: "publiee",
    });

    const r = await updateOccurrenceAction(
      {},
      fd({ talkId: "5", occurrenceId: "9", conferenceProposee: "Cloud Nord" }),
    );
    expect(r.ok).toBe(false);
    expect(r.errors?.conference).toMatch(/validé cette conférence/i);
    expect(updateOccurrence).not.toHaveBeenCalled();
    expect(soumettreProposition).not.toHaveBeenCalled();
  });

  it("repasser une saisie en attente sur une conférence du registre coupe le lien à la proposition", async () => {
    vi.mocked(getOccurrenceById).mockResolvedValue({
      id: 9, conferenceId: null, conferenceSlug: null, editionId: null,
      conference: "Cloud Nord", ville: null, codeInsee: null, region: null, pays: null, date: null,
      lienConf: null, lienSlides: null, lienVideo: null, lienFeedback: null,
      propositionId: 11, etat: "en_attente",
    });
    vi.mocked(getRegistryConferenceById).mockResolvedValue({
      id: 7, nom: "Sunny Tech", ville: "Montpellier", pays: "France",
    });
    await expect(
      updateOccurrenceAction({}, fd({ talkId: "5", occurrenceId: "9", conferenceId: "7" })),
    ).rejects.toThrow("REDIRECT:/mon-espace/talks/5?ok=conf_modifiee");

    // propositionId absent de l'input = colonne remise à NULL → la saisie publie.
    const [, , input] = vi.mocked(updateOccurrence).mock.calls[0];
    expect(input.propositionId ?? null).toBeNull();
    expect(input.conferenceId).toBe(7);
  });
});
