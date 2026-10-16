import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((p: string) => {
    throw new Error(`REDIRECT:${p}`);
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("@/auth", () => ({ auth: vi.fn(), signOut: vi.fn() }));
vi.mock("@/lib/profiles", () => ({
  getProfileByUserId: vi.fn(),
  raisonBlocageAnnuaire: vi.fn(),
  submitForValidation: vi.fn(),
  withdrawOwnProfile: vi.fn(),
  upsertProfile: vi.fn(),
  ensureProfileId: vi.fn(),
  isSlugAvailable: vi.fn(),
  deriveAvailableSlug: vi.fn(),
}));
vi.mock("@/lib/suppression-compte", () => ({ supprimerCompte: vi.fn() }));
vi.mock("@/lib/talks", () => ({
  addTalk: vi.fn(),
  updateTalk: vi.fn(),
  deleteTalk: vi.fn(),
  getTalkById: vi.fn(),
  talkAppartientAuProfil: vi.fn(),
  addOccurrence: vi.fn(),
  updateOccurrence: vi.fn(),
  removeOccurrence: vi.fn(),
  getKnownEditionById: vi.fn(),
  getRegistryConferenceById: vi.fn(),
}));
// importOriginal : conference-form (importé par les actions) consomme les
// helpers Zod réels (optionalText/optionalUrl) ; seul l'accès formulaire
// profil est mocké.
vi.mock("@/lib/profile-form", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/profile-form")>();
  return { ...actual, parseProfileForm: vi.fn() };
});
vi.mock("@/lib/users", () => ({ setUserName: vi.fn(), getUserById: vi.fn() }));
vi.mock("@/lib/talk-form", () => ({
  parseTalkIdentityForm: vi.fn(),
  parseOccurrenceForm: vi.fn(),
}));

import { revalidatePath, updateTag } from "next/cache";
import { auth, signOut } from "@/auth";
import {
  getProfileByUserId,
  raisonBlocageAnnuaire,
  submitForValidation,
  withdrawOwnProfile,
  upsertProfile,
  ensureProfileId,
  isSlugAvailable,
  deriveAvailableSlug,
} from "@/lib/profiles";
import { supprimerCompte } from "@/lib/suppression-compte";
import {
  addTalk,
  updateTalk,
  deleteTalk,
  addOccurrence,
  removeOccurrence,
  getKnownEditionById,
  getRegistryConferenceById,
  type OccurrenceInput,
} from "@/lib/talks";
import { parseProfileForm } from "@/lib/profile-form";
import { parseTalkIdentityForm, parseOccurrenceForm } from "@/lib/talk-form";
import {
  submitProfileAction,
  withdrawProfileAction,
  saveProfile,
  addTalkAction,
  updateTalkAction,
  deleteTalkAction,
  addOccurrenceAction,
  addOccurrenceRapideAction,
  removeOccurrenceAction,
  deleteProfileAction,
} from "@/app/mon-espace/actions";

import { setUserName, getUserById } from "@/lib/users";
import { fd } from "./test-helpers";

beforeEach(() => vi.clearAllMocks());

describe("submitProfileAction — garde-fous de soumission", () => {
  it("sans session → /connexion", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    await expect(submitProfileAction()).rejects.toThrow("REDIRECT:/connexion");
    expect(submitForValidation).not.toHaveBeenCalled();
  });

  // L'action ne réévalue plus les conditions : elle traduit le MOTIF que
  // `raisonBlocageAnnuaire` (source unique de la règle) lui renvoie.
  it.each(["nom", "contact", "attestation"] as const)(
    "motif « %s » → redirige avec ce motif, sans soumettre",
    async (motif) => {
      vi.mocked(auth).mockResolvedValue({ user: { id: "7" } } as never);
      vi.mocked(getProfileByUserId).mockResolvedValue({} as never);
      vi.mocked(raisonBlocageAnnuaire).mockReturnValue(motif);
      await expect(submitProfileAction()).rejects.toThrow(
        `REDIRECT:/mon-espace/fiche?error=${motif}`,
      );
      expect(submitForValidation).not.toHaveBeenCalled();
    },
  );

  it("aucun blocage → soumet puis /mon-espace", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7" } } as never);
    vi.mocked(getProfileByUserId).mockResolvedValue({} as never);
    vi.mocked(raisonBlocageAnnuaire).mockReturnValue(null);
    await expect(submitProfileAction()).rejects.toThrow("REDIRECT:/mon-espace/fiche");
    expect(submitForValidation).toHaveBeenCalledWith(7);
    // Une fiche PUBLIÉE re-soumise QUITTE l'annuaire (3e sortie de « publié ») :
    // le cache de données expire aussitôt, comme modération et retrait.
    expect(vi.mocked(updateTag)).toHaveBeenCalledWith("annuaire");
    expect(vi.mocked(revalidatePath).mock.calls.map((c) => c[0])).toContain("/speakeuses");
  });
});

describe("retrait par la speakeuse", () => {
  it("retire sa fiche (retour en brouillon)", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7" } } as never);
    await expect(withdrawProfileAction()).rejects.toThrow("REDIRECT:/mon-espace/fiche");
    expect(withdrawOwnProfile).toHaveBeenCalledWith(7);
  });

  it("sans session → /connexion, aucun retrait", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    await expect(withdrawProfileAction()).rejects.toThrow("REDIRECT:/connexion");
    expect(withdrawOwnProfile).not.toHaveBeenCalled();
  });
});

describe("saveProfile — garde-fous", () => {
  it("sans session → /connexion, pas d'écriture", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    await expect(saveProfile({}, fd({}))).rejects.toThrow("REDIRECT:/connexion");
    expect(upsertProfile).not.toHaveBeenCalled();
  });

  it("entrées invalides → renvoie les erreurs, pas d'écriture", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7" } } as never);
    vi.mocked(parseProfileForm).mockReturnValue({
      ok: false,
      errors: { bio: "Trop court" },
    } as never);
    const res = await saveProfile({}, fd({}));
    expect(res).toEqual({ ok: false, errors: { bio: "Trop court" } });
    expect(upsertProfile).not.toHaveBeenCalled();
  });

  // Cohorte lien-magique : sans compte Google/LinkedIn, users.name est vide
  // pour toujours (fiche « Speakeuse », introuvable dans l'annuaire). Le
  // profil porte donc un champ « Prénom et nom » self-service.
  it("nomComplet renseigné → met à jour le nom du compte (trim)", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7" } } as never);
    vi.mocked(parseProfileForm).mockReturnValue({ ok: true, data: { bio: "ok" } } as never);
    await expect(
      saveProfile({}, fd({ nomComplet: "  Rachel Dubois  " })),
    ).rejects.toThrow("REDIRECT:/mon-espace/fiche");
    expect(setUserName).toHaveBeenCalledWith(7, "Rachel Dubois");
  });

  it("nomComplet vide → ne touche pas au nom du compte", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7" } } as never);
    vi.mocked(parseProfileForm).mockReturnValue({ ok: true, data: { bio: "ok" } } as never);
    await expect(saveProfile({}, fd({ nomComplet: "  " }))).rejects.toThrow(
      "REDIRECT:/mon-espace",
    );
    expect(setUserName).not.toHaveBeenCalled();
  });

  it("OK → écrit avec l'id de session puis /mon-espace", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7" } } as never);
    vi.mocked(parseProfileForm).mockReturnValue({
      ok: true,
      data: { bio: "ok", slug: null },
    } as never);
    vi.mocked(deriveAvailableSlug).mockResolvedValue(null as never);
    await expect(saveProfile({}, fd({}))).rejects.toThrow("REDIRECT:/mon-espace/fiche");
    expect(upsertProfile).toHaveBeenCalledWith(7, { bio: "ok", slug: null });
  });

  it("revalide la fiche + l'annuaire (sinon la prévisualisation reste en cache)", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7" } } as never);
    vi.mocked(parseProfileForm).mockReturnValue({ ok: true, data: { bio: "ok", slug: null } } as never);
    vi.mocked(getProfileByUserId).mockResolvedValue({ id: 42 } as never);
    vi.mocked(deriveAvailableSlug).mockResolvedValue(null as never);
    await expect(saveProfile({}, fd({}))).rejects.toThrow("REDIRECT:/mon-espace/fiche");
    const paths = vi.mocked(revalidatePath).mock.calls.map((c) => c[0]);
    expect(paths).toContain("/mon-espace/fiche");
    expect(paths).toContain("/speakeuses");
    // Route dynamique (id OU slug) revalidée par motif.
    expect(paths).toContain("/speakeuses/[id]");
    // Et le cache de DONNÉES de l'annuaire expire immédiatement (updateTag).
    expect(vi.mocked(updateTag)).toHaveBeenCalledWith("annuaire");
  });

  it("slug personnalisé déjà pris → erreur, pas d'écriture", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7" } } as never);
    vi.mocked(parseProfileForm).mockReturnValue({
      ok: true,
      data: { bio: "ok", slug: "marie-curie" },
    } as never);
    vi.mocked(isSlugAvailable).mockResolvedValue(false as never);
    const res = await saveProfile({}, fd({}));
    expect(res).toEqual({ ok: false, errors: { slug: expect.any(String) } });
    expect(upsertProfile).not.toHaveBeenCalled();
  });

  it("slug personnalisé libre → écrit avec ce slug", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7" } } as never);
    vi.mocked(parseProfileForm).mockReturnValue({
      ok: true,
      data: { bio: "ok", slug: "marie-curie" },
    } as never);
    vi.mocked(isSlugAvailable).mockResolvedValue(true as never);
    await expect(saveProfile({}, fd({}))).rejects.toThrow("REDIRECT:/mon-espace/fiche");
    expect(upsertProfile).toHaveBeenCalledWith(7, { bio: "ok", slug: "marie-curie" });
    // Auto-dérivation évitée : l'adresse est explicite.
    expect(deriveAvailableSlug).not.toHaveBeenCalled();
  });

  it("champ slug vide → conserve le slug existant (aucune casse d'URL)", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7" } } as never);
    vi.mocked(parseProfileForm).mockReturnValue({
      ok: true,
      data: { bio: "ok", slug: null },
    } as never);
    vi.mocked(getProfileByUserId).mockResolvedValue({ id: 42, slug: "ada-lovelace" } as never);
    await expect(saveProfile({}, fd({}))).rejects.toThrow("REDIRECT:/mon-espace/fiche");
    expect(upsertProfile).toHaveBeenCalledWith(7, { bio: "ok", slug: "ada-lovelace" });
    expect(deriveAvailableSlug).not.toHaveBeenCalled();
  });

  it("collision d'index (course) → erreur slug retraduite", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7" } } as never);
    vi.mocked(parseProfileForm).mockReturnValue({
      ok: true,
      data: { bio: "ok", slug: "marie-curie" },
    } as never);
    vi.mocked(isSlugAvailable).mockResolvedValue(true as never);
    vi.mocked(upsertProfile).mockRejectedValueOnce(
      Object.assign(new Error("duplicate"), { code: "23505" }),
    );
    const res = await saveProfile({}, fd({}));
    expect(res).toEqual({ ok: false, errors: { slug: expect.any(String) } });
  });

  it("panne base : l'erreur remonte (pas de succès trompeur, pas de redirect)", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7" } } as never);
    vi.mocked(parseProfileForm).mockReturnValue({ ok: true, data: { bio: "ok" } } as never);
    vi.mocked(upsertProfile).mockRejectedValueOnce(new Error("Neon indisponible"));
    // On documente le comportement actuel : l'exception se propage (Next
    // affiche sa page d'erreur) plutôt que de retourner un { ok } mensonger.
    await expect(saveProfile({}, fd({}))).rejects.toThrow("Neon indisponible");
  });
});

describe("addTalkAction — garde-fous", () => {
  it("sans session → /connexion, aucun ajout", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    await expect(addTalkAction({}, fd({}))).rejects.toThrow("REDIRECT:/connexion");
    expect(addTalk).not.toHaveBeenCalled();
  });

  it("entrées invalides → erreurs, aucun ajout", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7" } } as never);
    vi.mocked(parseTalkIdentityForm).mockReturnValue({
      ok: false,
      errors: { titre: "Requis" },
    } as never);
    const res = await addTalkAction({}, fd({}));
    expect(res).toEqual({ ok: false, errors: { titre: "Requis" } });
    expect(addTalk).not.toHaveBeenCalled();
  });

  it("OK → ajoute l'identité au profil de la session puis ouvre la page du talk", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7" } } as never);
    vi.mocked(parseTalkIdentityForm).mockReturnValue({
      ok: true,
      data: { titre: "Mon talk" },
    } as never);
    vi.mocked(ensureProfileId).mockResolvedValue(42 as never);
    vi.mocked(addTalk).mockResolvedValue(88 as never);
    await expect(addTalkAction({}, fd({}))).rejects.toThrow(
      "REDIRECT:/mon-espace/talks/88?ok=talk_ajoute",
    );
    expect(ensureProfileId).toHaveBeenCalledWith(7);
    expect(addTalk).toHaveBeenCalledWith(42, { titre: "Mon talk" });
  });

  it("rafraîchit la fiche publique + l'annuaire (le talk doit y apparaître)", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7" } } as never);
    vi.mocked(parseTalkIdentityForm).mockReturnValue({ ok: true, data: { titre: "T" } } as never);
    vi.mocked(ensureProfileId).mockResolvedValue(42 as never);
    vi.mocked(addTalk).mockResolvedValue(88 as never);
    await expect(addTalkAction({}, fd({}))).rejects.toThrow("REDIRECT:/mon-espace/talks/88?ok=talk_ajoute");
    const paths = vi.mocked(revalidatePath).mock.calls.map((c) => c[0]);
    expect(paths).toContain("/speakeuses");
    expect(paths).toContain("/speakeuses/[id]");
  });
});

describe("updateTalkAction — ownership", () => {
  it("sans session → /connexion", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    await expect(updateTalkAction({}, fd({ talkId: "5" }))).rejects.toThrow(
      "REDIRECT:/connexion",
    );
    expect(updateTalk).not.toHaveBeenCalled();
  });

  it("talkId invalide → erreur, pas de mise à jour", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7" } } as never);
    const res = await updateTalkAction({}, fd({ talkId: "abc" }));
    expect(res).toEqual({ ok: false, errors: { titre: "Talk introuvable." } });
    expect(updateTalk).not.toHaveBeenCalled();
  });

  it("talkId non entier (1.5) → erreur AVANT la base (pas de 500 au cast)", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7" } } as never);
    const res = await updateTalkAction({}, fd({ talkId: "1.5" }));
    expect(res).toEqual({ ok: false, errors: { titre: "Talk introuvable." } });
    expect(updateTalk).not.toHaveBeenCalled();
  });

  it("OK → met à jour avec le profileId DE LA SESSION (pas du client)", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7" } } as never);
    vi.mocked(parseTalkIdentityForm).mockReturnValue({
      ok: true,
      data: { titre: "MAJ" },
    } as never);
    vi.mocked(ensureProfileId).mockResolvedValue(42 as never);
    await expect(
      updateTalkAction({}, fd({ talkId: "5", profileId: "999" })),
    ).rejects.toThrow("REDIRECT:/mon-espace/talks/5?ok=talk_modifie");
    // profileId vient de la session (42), jamais du champ client "999".
    expect(ensureProfileId).toHaveBeenCalledWith(7);
    expect(updateTalk).toHaveBeenCalledWith(5, 42, { titre: "MAJ" });
  });

  it("rafraîchit la fiche publique + l'annuaire après édition", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7" } } as never);
    vi.mocked(parseTalkIdentityForm).mockReturnValue({ ok: true, data: { titre: "MAJ" } } as never);
    vi.mocked(ensureProfileId).mockResolvedValue(42 as never);
    await expect(updateTalkAction({}, fd({ talkId: "5" }))).rejects.toThrow(
      "REDIRECT:/mon-espace/talks/5?ok=talk_modifie",
    );
    const paths = vi.mocked(revalidatePath).mock.calls.map((c) => c[0]);
    expect(paths).toContain("/speakeuses");
    expect(paths).toContain("/speakeuses/[id]");
  });
});

/** Données d'occurrence complètes, surchargeables champ par champ. */
function occurrence(over: Partial<OccurrenceInput> = {}): OccurrenceInput {
  return {
    conferenceId: null,
    editionId: null,
    conference: null,
    ville: null,
    codeInsee: null,
    region: null,
    pays: null,
    date: null,
    lienConf: null,
    lienSlides: null,
    lienVideo: null,
    lienFeedback: null,
    ...over,
  };
}

describe("addOccurrenceAction — garde-fous", () => {
  it("sans session → /connexion, aucune écriture", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    await expect(addOccurrenceAction({}, fd({ talkId: "5" }))).rejects.toThrow(
      "REDIRECT:/connexion",
    );
    expect(addOccurrence).not.toHaveBeenCalled();
  });

  it("talkId invalide → erreur, aucune écriture", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7" } } as never);
    const res = await addOccurrenceAction({}, fd({ talkId: "abc" }));
    expect(res).toEqual({ ok: false, errors: { conference: "Talk introuvable." } });
    expect(addOccurrence).not.toHaveBeenCalled();
  });

  it("ni conférence du registre ni nom proposé → erreur et AUCUNE écriture", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7" } } as never);
    vi.mocked(parseOccurrenceForm).mockReturnValue({
      ok: true,
      conferenceProposee: null,
      data: occurrence({ conference: "Conf tapée à la main" }),
    } as never);
    const res = await addOccurrenceAction({}, fd({ talkId: "5" }));
    expect(res).toEqual({
      ok: false,
      errors: {
        conference: "Choisis une conférence dans la liste, ou donne le nom de la tienne.",
      },
    });
    expect(addOccurrence).not.toHaveBeenCalled();
  });

  it("editionId d'une conf X + conferenceId falsifié d'une conf Y → conferenceId FORCÉ à X (et libellé snapshot)", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7" } } as never);
    vi.mocked(parseOccurrenceForm).mockReturnValue({
      ok: true,
      // Le client soumet l'édition 42 (conf X = 5) MAIS un conferenceId 999 falsifié.
      data: occurrence({ editionId: 42, conferenceId: 999, conference: "Nom falsifié" }),
    } as never);
    vi.mocked(getKnownEditionById).mockResolvedValue({
      editionId: 42,
      conferenceId: 5,
      libelle: "DevFest Toulouse 2026",
      ville: "Toulouse",
      pays: "France",
      url: null,
    } as never);
    vi.mocked(ensureProfileId).mockResolvedValue(42 as never);
    vi.mocked(addOccurrence).mockResolvedValue(77 as never);

    await expect(addOccurrenceAction({}, fd({ talkId: "5" }))).rejects.toThrow(
      "REDIRECT:/mon-espace/talks/5?ok=conf_ajoutee",
    );
    expect(getKnownEditionById).toHaveBeenCalledWith(42);
    // La vérité vient du registre : conf de l'ÉDITION, libellé SNAPSHOT.
    expect(addOccurrence).toHaveBeenCalledWith(
      5,
      42,
      expect.objectContaining({
        editionId: 42,
        conferenceId: 5,
        conference: "DevFest Toulouse 2026",
      }),
    );
  });

  it("édition à date exacte + date d'occurrence imprécise → hérite de la date de l'édition", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7" } } as never);
    vi.mocked(parseOccurrenceForm).mockReturnValue({
      ok: true,
      // La membre n'a saisi que l'année : l'édition, elle, connaît le jour exact.
      data: occurrence({ editionId: 42, conferenceId: 999, date: "2026" }),
    } as never);
    vi.mocked(getKnownEditionById).mockResolvedValue({
      editionId: 42,
      conferenceId: 5,
      libelle: "DevFest Toulouse 2026",
      ville: "Toulouse",
      pays: "France",
      url: null,
      dateDebut: "2026-11-19",
    } as never);
    vi.mocked(ensureProfileId).mockResolvedValue(42 as never);
    vi.mocked(addOccurrence).mockResolvedValue(77 as never);

    await expect(addOccurrenceAction({}, fd({ talkId: "5" }))).rejects.toThrow(
      "REDIRECT:/mon-espace/talks/5?ok=conf_ajoutee",
    );
    expect(addOccurrence).toHaveBeenCalledWith(
      5,
      42,
      expect.objectContaining({ date: "2026-11-19" }),
    );
  });

  it("édition MULTI-JOURS → l'occurrence hérite du MOIS, jamais d'un faux jour précis", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7" } } as never);
    vi.mocked(parseOccurrenceForm).mockReturnValue({
      ok: true,
      // Année seule saisie : l'édition court du 19 au 21 — le talk tombe
      // l'UN des jours, personne ne sait lequel.
      data: occurrence({ editionId: 42, conferenceId: 999, date: "2026" }),
    } as never);
    vi.mocked(getKnownEditionById).mockResolvedValue({
      editionId: 42,
      conferenceId: 5,
      libelle: "DevFest Toulouse 2026",
      ville: "Toulouse",
      pays: "France",
      url: null,
      dateDebut: "2026-11-19",
      dateFin: "2026-11-21",
    } as never);
    vi.mocked(ensureProfileId).mockResolvedValue(42 as never);
    vi.mocked(addOccurrence).mockResolvedValue(77 as never);

    await expect(addOccurrenceAction({}, fd({ talkId: "5" }))).rejects.toThrow(
      "REDIRECT:/mon-espace/talks/5?ok=conf_ajoutee",
    );
    expect(addOccurrence).toHaveBeenCalledWith(
      5,
      42,
      expect.objectContaining({ date: "2026-11" }),
    );
  });

  it("date d'occurrence déjà exacte → n'est PAS écrasée par celle de l'édition (talk sur un autre jour du même événement)", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7" } } as never);
    vi.mocked(parseOccurrenceForm).mockReturnValue({
      ok: true,
      data: occurrence({ editionId: 42, conferenceId: 999, date: "2026-11-20" }),
    } as never);
    vi.mocked(getKnownEditionById).mockResolvedValue({
      editionId: 42,
      conferenceId: 5,
      libelle: "DevFest Toulouse 2026",
      ville: "Toulouse",
      pays: "France",
      url: null,
      dateDebut: "2026-11-19",
    } as never);
    vi.mocked(ensureProfileId).mockResolvedValue(42 as never);
    vi.mocked(addOccurrence).mockResolvedValue(77 as never);

    await expect(addOccurrenceAction({}, fd({ talkId: "5" }))).rejects.toThrow(
      "REDIRECT:/mon-espace/talks/5?ok=conf_ajoutee",
    );
    expect(addOccurrence).toHaveBeenCalledWith(
      5,
      42,
      expect.objectContaining({ date: "2026-11-20" }),
    );
  });

  it("talk d'un autre profil → erreur « Ce talk est introuvable. », rien de rattaché", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7" } } as never);
    vi.mocked(parseOccurrenceForm).mockReturnValue({
      ok: true,
      data: occurrence({ conferenceId: 5 }),
    } as never);
    vi.mocked(getRegistryConferenceById).mockResolvedValue({
      id: 5,
      nom: "Sunny Tech",
      ville: "Montpellier",
      pays: "France",
    } as never);
    vi.mocked(ensureProfileId).mockResolvedValue(42 as never);
    // addOccurrence renvoie null : le talk n'appartient pas au profil de la session.
    vi.mocked(addOccurrence).mockResolvedValue(null as never);

    const res = await addOccurrenceAction({}, fd({ talkId: "5" }));
    expect(res).toEqual({ ok: false, errors: { conference: "Ce talk est introuvable." } });
  });
});

/**
 * L'ajout RAPIDE d'une date (fenêtre ouverte depuis la fiche, refonte de la
 * navigation connectée du 2026-10-15). Mêmes garde-fous que
 * `addOccurrenceAction` — c'est le même noyau —, une seule différence : une
 * micro-action dans une liste ne redirige pas (principes UI §4), elle RÉPOND,
 * et la fenêtre affiche la confirmation à côté du talk.
 */
describe("addOccurrenceRapideAction — même noyau, sans redirection", () => {
  const conferenceDuRegistre = () => {
    vi.mocked(parseOccurrenceForm).mockReturnValue({
      ok: true,
      data: occurrence({ conferenceId: 5, conference: "DevFest Toulouse" }),
    } as never);
    vi.mocked(getRegistryConferenceById).mockResolvedValue({
      id: 5,
      nom: "DevFest Toulouse",
    } as never);
  };

  it("sans session → /connexion, aucune écriture", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    await expect(addOccurrenceRapideAction({}, fd({ talkId: "5" }))).rejects.toThrow(
      "REDIRECT:/connexion",
    );
    expect(addOccurrence).not.toHaveBeenCalled();
  });

  it("talkId invalide → erreur, aucune écriture", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7" } } as never);
    const res = await addOccurrenceRapideAction({}, fd({ talkId: "abc" }));
    expect(res).toEqual({ ok: false, errors: { conference: "Talk introuvable." } });
    expect(addOccurrence).not.toHaveBeenCalled();
  });

  it("conférence du registre → écrit sous le profil de la SESSION, répond sans rediriger", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7" } } as never);
    conferenceDuRegistre();
    vi.mocked(ensureProfileId).mockResolvedValue(42 as never);
    vi.mocked(addOccurrence).mockResolvedValue(77 as never);

    const res = await addOccurrenceRapideAction({}, fd({ talkId: "5" }));

    expect(res).toEqual({ ok: true, issue: "conf_ajoutee" });
    expect(ensureProfileId).toHaveBeenCalledWith(7);
    expect(addOccurrence).toHaveBeenCalledWith(5, 42, expect.objectContaining({ conferenceId: 5 }));
    // La fiche, le profil ET l'annuaire voient la date tout de suite.
    const paths = vi.mocked(revalidatePath).mock.calls.map((c) => c[0]);
    expect(paths).toContain("/mon-espace/fiche");
    expect(paths).toContain("/speakeuses/[id]");
  });

  it("talk d'une autre (addOccurrence ne trouve rien) → erreur, et AUCUN ok", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7" } } as never);
    conferenceDuRegistre();
    vi.mocked(ensureProfileId).mockResolvedValue(42 as never);
    vi.mocked(addOccurrence).mockResolvedValue(null as never);

    const res = await addOccurrenceRapideAction({}, fd({ talkId: "5" }));

    expect(res).toEqual({ ok: false, errors: { conference: "Ce talk est introuvable." } });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("saisie invalide → les erreurs du formulaire, aucune écriture", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7" } } as never);
    vi.mocked(parseOccurrenceForm).mockReturnValue({
      ok: false,
      errors: { date: "Année invalide." },
    } as never);
    const res = await addOccurrenceRapideAction({}, fd({ talkId: "5" }));
    expect(res).toEqual({ ok: false, errors: { date: "Année invalide." } });
    expect(addOccurrence).not.toHaveBeenCalled();
  });
});

describe("removeOccurrenceAction — ownership", () => {
  it("sans session → /connexion, aucun retrait", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    await expect(
      removeOccurrenceAction(fd({ talkId: "5", occurrenceId: "9" })),
    ).rejects.toThrow("REDIRECT:/connexion");
    expect(removeOccurrence).not.toHaveBeenCalled();
  });

  it("occurrenceId invalide → no-op (pas de retrait, pas de redirection)", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7" } } as never);
    await expect(
      removeOccurrenceAction(fd({ talkId: "5", occurrenceId: "abc" })),
    ).resolves.toBeUndefined();
    expect(removeOccurrence).not.toHaveBeenCalled();
  });

  it("occurrenceId non entier (2.5) → no-op AVANT la base (pas de 500 au cast)", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7" } } as never);
    await expect(
      removeOccurrenceAction(fd({ talkId: "5", occurrenceId: "2.5" })),
    ).resolves.toBeUndefined();
    expect(removeOccurrence).not.toHaveBeenCalled();
  });

  it("OK → retire avec le profileId DE LA SESSION puis revient au talk", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7" } } as never);
    vi.mocked(ensureProfileId).mockResolvedValue(42 as never);
    await expect(
      removeOccurrenceAction(fd({ talkId: "5", occurrenceId: "9", profileId: "999" })),
    ).rejects.toThrow("REDIRECT:/mon-espace/talks/5?ok=conf_retiree");
    // profileId vient de la session (42), jamais du champ client "999".
    expect(ensureProfileId).toHaveBeenCalledWith(7);
    expect(removeOccurrence).toHaveBeenCalledWith(9, 42);
  });
});

describe("deleteTalkAction — ownership", () => {
  it("sans session → /connexion, aucune suppression", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    await expect(deleteTalkAction(fd({ talkId: "5" }))).rejects.toThrow(
      "REDIRECT:/connexion",
    );
    expect(deleteTalk).not.toHaveBeenCalled();
  });

  it("talkId invalide → no-op (pas de suppression, pas de redirection)", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7" } } as never);
    await expect(deleteTalkAction(fd({ talkId: "abc" }))).resolves.toBeUndefined();
    expect(deleteTalk).not.toHaveBeenCalled();
  });

  it("OK → supprime avec le profileId DE LA SESSION", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7" } } as never);
    vi.mocked(ensureProfileId).mockResolvedValue(42 as never);
    await expect(
      deleteTalkAction(fd({ talkId: "5", profileId: "999" })),
    ).rejects.toThrow("REDIRECT:/mon-espace/talks?ok=talk_supprime");
    expect(ensureProfileId).toHaveBeenCalledWith(7);
    expect(deleteTalk).toHaveBeenCalledWith(5, 42);
  });

  it("rafraîchit la fiche publique + l'annuaire après suppression", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7" } } as never);
    vi.mocked(ensureProfileId).mockResolvedValue(42 as never);
    await expect(deleteTalkAction(fd({ talkId: "5" }))).rejects.toThrow(
      "REDIRECT:/mon-espace/talks?ok=talk_supprime",
    );
    const paths = vi.mocked(revalidatePath).mock.calls.map((c) => c[0]);
    expect(paths).toContain("/speakeuses");
    expect(paths).toContain("/speakeuses/[id]");
    expect(vi.mocked(updateTag)).toHaveBeenCalledWith("annuaire");
  });
});

describe("deleteProfileAction — RGPD", () => {
  const compte = { id: 7, name: "Camille Roux", email: "camille@example.com" };

  it("sans session → /connexion, aucune suppression", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    await expect(deleteProfileAction(fd({ confirmation: "camille@example.com" }))).rejects.toThrow(
      "REDIRECT:/connexion",
    );
    expect(supprimerCompte).not.toHaveBeenCalled();
  });

  // Palier 3 : la saisie du type-to-confirm est REVÉRIFIÉE ici. La garde du
  // navigateur se contourne en deux clics de DevTools ; celle-ci, non.
  it("saisie qui ne correspond pas → refus, aucune suppression", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7" } } as never);
    vi.mocked(getUserById).mockResolvedValue(compte as never);
    await expect(
      deleteProfileAction(fd({ confirmation: "peu importe" })),
    ).rejects.toThrow("REDIRECT:/mon-espace/supprimer?err=confirmation");
    expect(supprimerCompte).not.toHaveBeenCalled();
  });

  it("saisie absente → refus, aucune suppression", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7" } } as never);
    vi.mocked(getUserById).mockResolvedValue(compte as never);
    await expect(deleteProfileAction(fd({}))).rejects.toThrow(
      "REDIRECT:/mon-espace/supprimer?err=confirmation",
    );
    expect(supprimerCompte).not.toHaveBeenCalled();
  });

  it("le nom convient aussi, casse et accents pliés comme au client", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7" } } as never);
    vi.mocked(getUserById).mockResolvedValue(compte as never);
    await deleteProfileAction(fd({ confirmation: "  CAMILLE ROUX  " }));
    expect(supprimerCompte).toHaveBeenCalledWith(7);
  });

  it("OK → supprime le compte de la session puis déconnecte avec confirmation", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7" } } as never);
    vi.mocked(getUserById).mockResolvedValue(compte as never);
    await deleteProfileAction(fd({ confirmation: "camille@example.com" }));
    expect(supprimerCompte).toHaveBeenCalledWith(7);
    // La fiche supprimée sort de l'annuaire TOUT DE SUITE (cache de données).
    expect(vi.mocked(updateTag)).toHaveBeenCalledWith("annuaire");
    expect(signOut).toHaveBeenCalledWith({ redirectTo: "/connexion?compte=supprime" });
  });

  /**
   * La suppression va jusqu'à Brevo et RENONCE si le sous-traitant est en panne
   * (sinon l'adresse partirait avec le compte, et le contact resterait chez lui
   * sans moyen d'aller le chercher). Le geste échoue donc parfois : sans ce
   * chemin, la personne tomberait sur la page d'erreur générique, et croirait
   * son compte supprimé — ou son bouton cassé. Et elle serait toujours
   * connectée : la déconnexion suit la suppression, jamais l'inverse.
   */
  it("une suppression qui échoue le DIT, garde la session, et laisse retenter", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "7" } } as never);
    vi.mocked(getUserById).mockResolvedValue(compte as never);
    vi.mocked(supprimerCompte).mockRejectedValue(new Error("Brevo 503"));

    await expect(
      deleteProfileAction(fd({ confirmation: "camille@example.com" })),
    ).rejects.toThrow("REDIRECT:/mon-espace/supprimer?err=echec");

    expect(signOut).not.toHaveBeenCalled();
  });
});
