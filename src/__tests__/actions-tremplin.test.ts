import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((p: string) => {
    throw new Error(`REDIRECT:${p}`);
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { revalidatePath } from "next/cache";
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/tremplin-import", () => ({ importTremplin1: vi.fn() }));
vi.mock("@/lib/tremplin-editions", () => ({ getEditionById: vi.fn(), createEdition: vi.fn(), updateEdition: vi.fn(),
  setEditionStatut: vi.fn(), deleteEdition: vi.fn(), getEditionDeletionCounts: vi.fn() }));
vi.mock("@/lib/tremplin-duplicate", () => ({ duplicateEdition: vi.fn() }));
// importOriginal : on garde les helpers PURS réels (isConsentBase, guards de
// type) et on ne remplace que les accès BDD.
vi.mock("@/lib/tremplin-registrations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tremplin-registrations")>();
  return {
    ...actual,
    attachUserToRegistration: vi.fn(),
    setRegistrationVisibility: vi.fn(),
    updateRegistrationDetails: vi.fn(),
    registerUserToEdition: vi.fn(),
    setRegistrationFinale: vi.fn(),
    deleteRegistration: vi.fn(),
    getRegistrationById: vi.fn(),
  };
});
// importOriginal OBLIGATOIRE ici : `actions.ts` importe SEPT autres fonctions de
// ce module (addCoachToAtelier, removeCoachFromAtelier, addCoachToRegistration,
// removeCoachFromRegistration, setUserGenre, setUserGenreIfUnset,
// markUserAsCoach) et les tests d'autorisation voisins comptent dessus. Seul le
// prédicat de rattachement est remplacé.
vi.mock("@/lib/tremplin-coachs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tremplin-coachs")>();
  return { ...actual, estCoachRattache: vi.fn() };
});
vi.mock("@/lib/coach-profiles", () => ({
  upsertCoachProfile: vi.fn(),
  setCoachProfilePublic: vi.fn(),
  getCoachProfile: vi.fn(),
}));
// importOriginal : on garde le garde de type PUR (isMembershipPhase) réel, on ne
// remplace que l'accès BDD.
vi.mock("@/lib/tremplin-registration-phases", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tremplin-registration-phases")>();
  return {
    ...actual,
    setRegistrationPhaseMembership: vi.fn(),
    setRegistrationPhasePublic: vi.fn(),
    getPhaseMembersByEdition: vi.fn(),
  };
});
// importOriginal : on garde les fonctions PURES réelles (isPhaseAtelier,
// phaseDateCoherente, labels) et on ne remplace que les accès BDD.
vi.mock("@/lib/tremplin-ateliers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tremplin-ateliers")>();
  return {
    ...actual,
    setAtelierVisio: vi.fn(),
    updateAtelierInfos: vi.fn(),
    createAtelierWithMembers: vi.fn(),
    setAtelierMembers: vi.fn(),
    setAtelierMembre: vi.fn(),
    setAtelierPresences: vi.fn(),
    setAtelierPresence: vi.fn(),
    getAtelierMembers: vi.fn(),
    getAtelierPresences: vi.fn(),
    getCohorteAtelier: vi.fn(),
    getAtelierById: vi.fn(),
    setAtelierPhase: vi.fn(),
    setAtelierNature: vi.fn(),
    setAtelierAudience: vi.fn(),
    setAtelierProgrammePublic: vi.fn(),
    echangerOrdreAteliers: vi.fn(),
    getAteliersByEdition: vi.fn(),
    createSousGroupe: vi.fn(),
    updateSousGroupe: vi.fn(),
    setCoachDansSousGroupe: vi.fn(),
    deleteSousGroupe: vi.fn(),
    assignMembreSousGroupe: vi.fn(),
    deleteAtelier: vi.fn(),
    getAtelierDeletionCounts: vi.fn(),
  };
});
vi.mock("@/lib/tremplin-jury", () => ({ addJury: vi.fn(), deleteJury: vi.fn() }));
vi.mock("@/lib/tremplin-documents", () => ({ addDocument: vi.fn(), deleteDocument: vi.fn() }));
vi.mock("@/lib/tremplin-photos", () => ({ addPhotoWithPersons: vi.fn() }));
vi.mock("@/lib/users", () => ({
  getOrCreateUserByEmail: vi.fn(),
  getUserById: vi.fn(),
  setUserNameIfEmpty: vi.fn(),
}));
vi.mock("@/lib/magic-link", () => ({ isMagicLinkEnabled: vi.fn(() => false) }));
vi.mock("@/lib/email", () => ({ sendBrevoEmail: vi.fn() }));
vi.mock("@/lib/tremplin-email", () => ({
  buildTremplinReadyEmail: vi.fn(() => ({ subject: "s", htmlContent: "<p>h</p>", textContent: "t" })),
  sendEditionInviteEmail: vi.fn(async () => false),
}));

import { auth } from "@/auth";
import {
  getRegistrationById,
  attachUserToRegistration,
  setRegistrationVisibility,
  updateRegistrationDetails,
  registerUserToEdition,
  setRegistrationFinale,
  deleteRegistration,
} from "@/lib/tremplin-registrations";
import {
  setAtelierVisio,
  updateAtelierInfos,
  createAtelierWithMembers,
  setAtelierMembers,
  setAtelierMembre,
  setAtelierPresence,
  setAtelierPresences,
  getAtelierMembers,
  getAtelierPresences,
  getCohorteAtelier,
  getAtelierById,
  setAtelierPhase,
  setAtelierNature,
  setAtelierAudience,
  setAtelierProgrammePublic,
  echangerOrdreAteliers,
  getAteliersByEdition,
  createSousGroupe,
  updateSousGroupe,
  setCoachDansSousGroupe,
  deleteSousGroupe,
  assignMembreSousGroupe,
  deleteAtelier,
  getAtelierDeletionCounts,
} from "@/lib/tremplin-ateliers";
import {
  setRegistrationPhaseMembership,
  setRegistrationPhasePublic,
  getPhaseMembersByEdition,
} from "@/lib/tremplin-registration-phases";
import { upsertCoachProfile, setCoachProfilePublic } from "@/lib/coach-profiles";
import { estCoachRattache } from "@/lib/tremplin-coachs";
import { addJury, deleteJury } from "@/lib/tremplin-jury";
import { addDocument, deleteDocument } from "@/lib/tremplin-documents";
import { addPhotoWithPersons } from "@/lib/tremplin-photos";
import { getOrCreateUserByEmail, getUserById, setUserNameIfEmpty } from "@/lib/users";
import {
  getEditionById,
  createEdition,
  updateEdition,
  setEditionStatut,
  deleteEdition,
  getEditionDeletionCounts,
} from "@/lib/tremplin-editions";
import { duplicateEdition } from "@/lib/tremplin-duplicate";
import { sendEditionInviteEmail } from "@/lib/tremplin-email";
import {
  attachRegistrationAction,
  createDocumentAction,
  createEditionAction,
  updateEditionAction,
  setEditionStatutAction,
  setAtelierVisioAction,
  updateAtelierInfosAction,
  createAtelierAction,
  setAtelierMembresAction,
  setRegistrationVisibilityAction,
  updateRegistrationDetailsAction,
  addParticipanteAction,
  setRegistrationFinaleAction,
  setRegistrationPhaseMembershipAction,
  deleteEditionAction,
  setAtelierMembreAction,
  setAtelierAudienceAction,
  setAtelierProgrammePublicAction,
  setRegistrationPhasePublicAction,
  setCoachProfileAction,
  setCoachProfilePublicAction,
  setAtelierPresenceAction,
  createSousGroupeAction,
  updateSousGroupeAction,
  setCoachDansSousGroupeAction,
  deleteSousGroupeAction,
  setMembreDansSousGroupeAction,
  activerCohortePhaseAtelierAction,
  marquerToutesPresentesAction,
  deplacerAtelierAction,
  addJuryAction,
  deleteJuryAction,
  deleteRegistrationAction,
  deleteAtelierAction,
  retirerAtelierAction,
  deleteDocumentAction,
  addPhotoAction,
} from "@/app/admin/tremplins/actions";
import { fd } from "./test-helpers";

/** Helper : compte trouvé (created=false) ou pré-créé (created=true). */
const userResult = (created: boolean) => ({
  user: { id: 42, name: "X", email: "a@b.fr" },
  created,
});

const orga = { user: { id: "1", isOrga: true } } as never;
const membre = { user: { id: "2", isOrga: false } } as never;

beforeEach(() => vi.clearAllMocks());

const idle = { status: "idle" as const };

describe("attachRegistrationAction", () => {
  it("refuse une non-orga", async () => {
    vi.mocked(auth).mockResolvedValue(membre);
    await expect(
      attachRegistrationAction(idle, fd({ editionId: "1", registrationId: "5", email: "a@b.fr" })),
    ).rejects.toThrow("REDIRECT:/connexion");
    expect(attachUserToRegistration).not.toHaveBeenCalled();
  });

  it("orga + compte existant : rattache (scopé édition) → ?ok=rattachee", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(getOrCreateUserByEmail).mockResolvedValue(userResult(false));
    vi.mocked(attachUserToRegistration).mockResolvedValue("attached");
    expect((await attachRegistrationAction(idle, fd({ editionId: "1", registrationId: "5", email: "a@b.fr" }))).status).toBe("success");
    expect(attachUserToRegistration).toHaveBeenCalledWith(5, 42, 1);
  });

  it("orga + e-mail inconnu : pré-crée le compte et invite → ?ok=invitee", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(getOrCreateUserByEmail).mockResolvedValue(userResult(true));
    vi.mocked(attachUserToRegistration).mockResolvedValue("attached");
    vi.mocked(sendEditionInviteEmail).mockResolvedValue(true);
    expect((await attachRegistrationAction(idle, fd({ editionId: "1", registrationId: "5", email: "a@b.fr" }))).status).toBe("success");
    expect(getOrCreateUserByEmail).toHaveBeenCalledWith("a@b.fr", undefined); // pas de nom saisi
    // Chemin sensible (RGPD) : l'invitation part bien au compte de l'e-mail saisi.
    expect(sendEditionInviteEmail).toHaveBeenCalledWith(userResult(true).user, 1);
  });

  it("orga + prénom/nom saisi : le transmet pour compléter le compte", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(getOrCreateUserByEmail).mockResolvedValue(userResult(true));
    vi.mocked(attachUserToRegistration).mockResolvedValue("attached");
    vi.mocked(sendEditionInviteEmail).mockResolvedValue(true);
    await attachRegistrationAction(
      idle,
      fd({ editionId: "1", registrationId: "5", email: "a@b.fr", nom: "Ada Lovelace" }),
    );
    expect(getOrCreateUserByEmail).toHaveBeenCalledWith("a@b.fr", "Ada Lovelace");
  });

  it("orga + compte existant : envoie l'e-mail « espace prêt » au compte rattaché", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(getOrCreateUserByEmail).mockResolvedValue(userResult(false));
    vi.mocked(attachUserToRegistration).mockResolvedValue("attached");
    vi.mocked(sendEditionInviteEmail).mockResolvedValue(true);
    expect((await attachRegistrationAction(idle, fd({ editionId: "1", registrationId: "5", email: "a@b.fr" }))).status).toBe("success");
    expect(sendEditionInviteEmail).toHaveBeenCalledWith(userResult(false).user, 1);
  });

  it("orga + inscription déjà rattachée / hors édition (0 ligne) : ?err, PAS de succès ni d'e-mail", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(getOrCreateUserByEmail).mockResolvedValue(userResult(false));
    vi.mocked(attachUserToRegistration).mockResolvedValue("occupee");
    expect((await attachRegistrationAction(idle, fd({ editionId: "1", registrationId: "5", email: "a@b.fr" }))).status).toBe("error");
    expect(sendEditionInviteEmail).not.toHaveBeenCalled();
  });

  it("orga + e-mail invalide : ?err=attach (pas de no-op muet), ne crée ni ne rattache", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    expect((await attachRegistrationAction(idle, fd({ editionId: "1", registrationId: "5", email: "pas-un-email" }))).status).toBe("error");
    expect(getOrCreateUserByEmail).not.toHaveBeenCalled();
    expect(attachUserToRegistration).not.toHaveBeenCalled();
  });

  it("orga + compte déjà rattaché ailleurs (UNIQUE) : ?err=deja_rattache", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(getOrCreateUserByEmail).mockResolvedValue(userResult(false));
    vi.mocked(attachUserToRegistration).mockResolvedValue("deja_rattache");
    expect((await attachRegistrationAction(idle, fd({ editionId: "1", registrationId: "5", email: "a@b.fr" }))).status).toBe("error");
  });

  it("orga + compte choisi (compteId) : rattache SANS créer ni inviter", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(getUserById).mockResolvedValue({ id: 42, name: "X", email: "a@b.fr" });
    vi.mocked(attachUserToRegistration).mockResolvedValue("attached");
    const res = await attachRegistrationAction(idle, fd({ editionId: "1", registrationId: "5", compteId: "42" }));
    expect(res.status).toBe("success");
    if (res.status === "success") expect(res.parCompte).toBe(true);
    expect(attachUserToRegistration).toHaveBeenCalledWith(5, 42, 1);
    // Compte déjà joignable : ni création par e-mail, ni invitation.
    expect(getOrCreateUserByEmail).not.toHaveBeenCalled();
    expect(sendEditionInviteEmail).not.toHaveBeenCalled();
  });

  it("orga + compte choisi introuvable (supprimé) : ?err, ne rattache pas", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(getUserById).mockResolvedValue(null);
    expect((await attachRegistrationAction(idle, fd({ editionId: "1", registrationId: "5", compteId: "999" }))).status).toBe("error");
    expect(attachUserToRegistration).not.toHaveBeenCalled();
  });

  it("orga + compte choisi + nom saisi : complète le compte sans nom (setUserNameIfEmpty)", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(getUserById).mockResolvedValue({ id: 42, name: null, email: "a@b.fr" });
    vi.mocked(attachUserToRegistration).mockResolvedValue("attached");
    await attachRegistrationAction(
      idle,
      fd({ editionId: "1", registrationId: "5", compteId: "42", nom: "Ada Lovelace" }),
    );
    expect(setUserNameIfEmpty).toHaveBeenCalledWith(42, "Ada Lovelace");
  });
});

describe("createDocumentAction (résultat, pour saisie à la chaîne)", () => {
  const idle = { status: "idle" as const };

  it("refuse une non-orga (redirige, aucune insertion)", async () => {
    vi.mocked(auth).mockResolvedValue(membre);
    await expect(
      createDocumentAction(idle, fd({ editionId: "1", titre: "Doc", lien: "https://x" })),
    ).rejects.toThrow("REDIRECT:/connexion");
    expect(addDocument).not.toHaveBeenCalled();
  });

  it("orga sans support (ni lien ni contenu) : renvoie une erreur, aucune insertion", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    const res = await createDocumentAction(idle, fd({ editionId: "1", titre: "Doc" }));
    expect(res.status).toBe("error");
    expect(addDocument).not.toHaveBeenCalled();
  });

  it("orga + lien valide : insère (auteur = orga) et renvoie success + titre", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(addDocument).mockResolvedValue(9);
    const res = await createDocumentAction(
      idle,
      fd({
        editionId: "1",
        portee: "atelier",
        atelierId: "10",
        type: "support_atelier",
        titre: "Slides",
        lien: "https://docs.google.com/x",
      }),
    );
    expect(res).toEqual({ status: "success", titre: "Slides" });
    expect(addDocument).toHaveBeenCalledTimes(1);
    const [editionId, doc] = vi.mocked(addDocument).mock.calls[0];
    expect(editionId).toBe(1);
    expect(doc.atelierId).toBe(10);
    expect(doc.type).toBe("support_atelier");
    expect(doc.auteurId).toBe(1);
  });

  it("orga + addDocument lève (cible hors édition) : renvoie une erreur", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(addDocument).mockRejectedValueOnce(new Error("Atelier hors de cette édition"));
    const res = await createDocumentAction(
      idle,
      fd({ editionId: "1", portee: "atelier", atelierId: "99", titre: "Slides", lien: "https://x" }),
    );
    expect(res.status).toBe("error");
  });

  it("orga + editionId invalide : renvoie une erreur, aucune insertion", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    const res = await createDocumentAction(idle, fd({ editionId: "0", titre: "Doc", lien: "https://x.fr" }));
    expect(res.status).toBe("error");
    expect(addDocument).not.toHaveBeenCalled();
  });
});

describe("updateAtelierInfosAction", () => {
  it("refuse une non-orga", async () => {
    vi.mocked(auth).mockResolvedValue(membre);
    await expect(
      updateAtelierInfosAction(idle, fd({ editionId: "1", atelierId: "3", titre: "X" })),
    ).rejects.toThrow("REDIRECT:/connexion");
    expect(updateAtelierInfos).not.toHaveBeenCalled();
  });

  it("orga + titre vide : erreur, rien enregistré", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    const res = await updateAtelierInfosAction(idle, fd({ editionId: "1", atelierId: "3", titre: "   " }));
    expect(res.status).toBe("error");
    expect(updateAtelierInfos).not.toHaveBeenCalled();
  });

  it("orga + valide : nettoie les champs vides (null), enregistre les infos, la phase ET la nature", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(getAtelierById).mockResolvedValue({ phase: "cfp_et_pitch", date: "2026-05-01" } as never);
    vi.mocked(getEditionById).mockResolvedValue({ finaleDate: "2026-06-04" } as never);
    vi.mocked(updateAtelierInfos).mockResolvedValue(true);
    vi.mocked(setAtelierPhase).mockResolvedValue(true);
    vi.mocked(setAtelierNature).mockResolvedValue(true);
    const res = await updateAtelierInfosAction(
      idle,
      fd({ editionId: "1", atelierId: "3", titre: "Atelier X", phase: "cfp_et_pitch", nature: "collectif", date: "2026-05-01", dateFin: "", heureDebut: "", heureFin: "", lieu: "  BPCE, Toulouse  ", description: "  desc  " }),
    );
    expect(res.status).toBe("success");
    expect(updateAtelierInfos).toHaveBeenCalledWith(3, 1, {
      titre: "Atelier X",
      date: "2026-05-01",
      dateFin: null,
      heureDebut: null,
      heureFin: null,
      lieu: "BPCE, Toulouse",
      description: "desc",
    });
    // Phase ET nature éditées dans le même formulaire (elles dépendent de la date / du suivi).
    expect(setAtelierPhase).toHaveBeenCalledWith(3, 1, "cfp_et_pitch");
    expect(setAtelierNature).toHaveBeenCalledWith(3, 1, "collectif");
  });

  it("orga + nature inconnue : erreur, rien enregistré", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    const res = await updateAtelierInfosAction(
      idle,
      fd({ editionId: "1", atelierId: "3", titre: "X", phase: "cfp_et_pitch", nature: "n_importe" }),
    );
    expect(res.status).toBe("error");
    expect(updateAtelierInfos).not.toHaveBeenCalled();
    expect(setAtelierNature).not.toHaveBeenCalled();
  });

  it("orga + fenêtre incohérente (fin avant début) : erreur, rien enregistré", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    const res = await updateAtelierInfosAction(
      idle,
      fd({ editionId: "1", atelierId: "3", titre: "X", phase: "cfp_et_pitch", nature: "sous_groupes", date: "2026-09-20", dateFin: "2026-09-10" }),
    );
    expect(res.status).toBe("error");
    expect(updateAtelierInfos).not.toHaveBeenCalled();
  });

  it("orga + phase inconnue : erreur, rien enregistré", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    const res = await updateAtelierInfosAction(
      idle,
      fd({ editionId: "1", atelierId: "3", titre: "X", phase: "n_importe" }),
    );
    expect(res.status).toBe("error");
    expect(updateAtelierInfos).not.toHaveBeenCalled();
    expect(setAtelierPhase).not.toHaveBeenCalled();
  });

  it("orga + phase incohérente avec la date (après la finale) : erreur, rien enregistré", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    // On date l'atelier APRÈS la finale tout en le voulant « avant la soirée ».
    vi.mocked(getAtelierById).mockResolvedValue({ phase: "montee_sur_scene", date: "2026-09-01" } as never);
    vi.mocked(getEditionById).mockResolvedValue({ finaleDate: "2026-06-04" } as never);
    const res = await updateAtelierInfosAction(
      idle,
      fd({ editionId: "1", atelierId: "3", titre: "X", phase: "cfp_et_pitch", nature: "collectif", date: "2026-09-01" }),
    );
    expect(res.status).toBe("error");
    expect(updateAtelierInfos).not.toHaveBeenCalled();
    expect(setAtelierPhase).not.toHaveBeenCalled();
  });

  it("orga + atelier hors édition : erreur (introuvable)", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(getAtelierById).mockResolvedValue({ phase: "cfp_et_pitch", date: null } as never);
    vi.mocked(getEditionById).mockResolvedValue({ finaleDate: null } as never);
    vi.mocked(updateAtelierInfos).mockResolvedValue(false);
    const res = await updateAtelierInfosAction(idle, fd({ editionId: "1", atelierId: "9", titre: "X", phase: "cfp_et_pitch", nature: "collectif" }));
    expect(res.status).toBe("error");
  });

  it("orga + date impossible : erreur AVANT la base (pas de 500 sur la contrainte)", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    const res = await updateAtelierInfosAction(
      idle,
      fd({ editionId: "1", atelierId: "3", titre: "X", phase: "cfp_et_pitch", date: "2026-02-31" }),
    );
    expect(res.status).toBe("error");
    expect(updateAtelierInfos).not.toHaveBeenCalled();
  });

  it("orga + heure mal formée : erreur, rien enregistré", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    const res = await updateAtelierInfosAction(
      idle,
      fd({ editionId: "1", atelierId: "3", titre: "X", phase: "cfp_et_pitch", heureDebut: "25:99" }),
    );
    expect(res.status).toBe("error");
    expect(updateAtelierInfos).not.toHaveBeenCalled();
  });
});

describe("sous-groupes (actions orga)", () => {
  it("createSousGroupe : refuse une non-orga", async () => {
    vi.mocked(auth).mockResolvedValue(membre);
    await expect(
      createSousGroupeAction(idle, fd({ editionId: "1", atelierId: "3" })),
    ).rejects.toThrow("REDIRECT:/connexion");
    expect(createSousGroupe).not.toHaveBeenCalled();
  });

  /**
   * Retour orga : « Ils n'ont pas besoin de noms ». Créer un sous-groupe ne
   * demande donc RIEN — un champ « Binôme 1 » à remplir avant de pouvoir
   * composer ne servait personne, et un nom saisi finissait en désaccord avec
   * qui était dedans.
   *
   * Et créer OUVRE le groupe : c'est ce que l'écran annonce, et sans ça l'orga
   * restait sur la liste, avec une ligne vide apparue en bas — parfois hors
   * écran — et un bouton devenu « Enregistré ✓ » là où elle en attendait un
   * deuxième.
   */
  it("createSousGroupe : orga → sans nom à donner, scopé, et OUVRE le groupe créé", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(createSousGroupe).mockResolvedValue(7);
    await expect(
      createSousGroupeAction(idle, fd({ editionId: "1", atelierId: "3" })),
    ).rejects.toThrow("REDIRECT:/admin/tremplins/1/ateliers/3/sous-groupes/7");
    expect(createSousGroupe).toHaveBeenCalledWith(3, 1);
  });

  it("createSousGroupe : atelier hors édition (null) → erreur", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(createSousGroupe).mockResolvedValue(null);
    expect(
      (await createSousGroupeAction(idle, fd({ editionId: "1", atelierId: "3" }))).status,
    ).toBe("error");
  });

  it("setMembreDansSousGroupe : interrupteur — cochée → CE sous-groupe, décochée → null", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(assignMembreSousGroupe).mockResolvedValue(true);
    await setMembreDansSousGroupeAction(idle, fd({ editionId: "1", atelierId: "3", registrationId: "5", sousGroupeId: "9", present: "true" }));
    expect(assignMembreSousGroupe).toHaveBeenCalledWith(3, 1, 5, 9);
    await setMembreDansSousGroupeAction(idle, fd({ editionId: "1", atelierId: "3", registrationId: "5", sousGroupeId: "9", present: "false" }));
    expect(assignMembreSousGroupe).toHaveBeenCalledWith(3, 1, 5, null);
  });

  it("setMembreDansSousGroupe : hors périmètre (false) → erreur ; refuse une non-orga", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(assignMembreSousGroupe).mockResolvedValue(false);
    expect(
      (await setMembreDansSousGroupeAction(idle, fd({ editionId: "1", atelierId: "3", registrationId: "5", sousGroupeId: "9", present: "true" }))).status,
    ).toBe("error");
    vi.mocked(auth).mockResolvedValue(membre);
    await expect(
      setMembreDansSousGroupeAction(idle, fd({ editionId: "1", atelierId: "3", registrationId: "5", sousGroupeId: "9", present: "true" })),
    ).rejects.toThrow("REDIRECT:/connexion");
  });

  it("updateSousGroupe : orga → lien + réalisation transmis (les coachs ont leur propre geste)", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(updateSousGroupe).mockResolvedValue(true);
    const res = await updateSousGroupeAction(
      idle,
      fd({ editionId: "1", sousGroupeId: "7", lienVisio: "https://meet.example.fr/x", faitLe: "2026-09-16" }),
    );
    expect(res.status).toBe("success");
    expect(updateSousGroupe).toHaveBeenCalledWith(7, 1, {
      lienVisio: "https://meet.example.fr/x",
      faitLe: "2026-09-16",
    });
  });

  it("updateSousGroupe : vides → null", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(updateSousGroupe).mockResolvedValue(true);
    await updateSousGroupeAction(idle, fd({ editionId: "1", sousGroupeId: "7", lienVisio: "", faitLe: "" }));
    expect(updateSousGroupe).toHaveBeenCalledWith(7, 1, { lienVisio: null, faitLe: null });
  });

  it("updateSousGroupe : lien/date invalides rejetés (rien transmis)", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    const cas: Record<string, string>[] = [
      { lienVisio: "javascript:alert(1)" },
      { faitLe: "31/12/2026" },
    ];
    for (const bad of cas) {
      const res = await updateSousGroupeAction(idle, fd({ editionId: "1", sousGroupeId: "7", ...bad }));
      expect(res.status).toBe("error");
    }
    expect(updateSousGroupe).not.toHaveBeenCalled();
  });

  /**
   * « éventuellement une ou plusieurs coachs dedans » : un INTERRUPTEUR par
   * coach, enregistré à la bascule — comme le rangement d'une participante juste
   * en dessous sur le même écran.
   *
   * Les faire passer par le formulaire posait un piège : un ensemble de cases
   * vide et un champ non rendu arrivent tous deux « vide » côté serveur, donc
   * enregistrer le lien effaçait les coachs en place.
   */
  it("setCoachDansSousGroupe : cochée → confiée, décochée → retirée", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(setCoachDansSousGroupe).mockResolvedValue(true);
    await setCoachDansSousGroupeAction(idle, fd({ editionId: "1", sousGroupeId: "7", userId: "42", present: "true" }));
    expect(setCoachDansSousGroupe).toHaveBeenCalledWith(7, 1, 42, true);
    await setCoachDansSousGroupeAction(idle, fd({ editionId: "1", sousGroupeId: "7", userId: "42", present: "false" }));
    expect(setCoachDansSousGroupe).toHaveBeenCalledWith(7, 1, 42, false);
  });

  it("setCoachDansSousGroupe : ids invalides rejetés, hors périmètre → erreur, non-orga refusée", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    for (const bad of [{ userId: "-3" }, { userId: "pas-un-id" }, { userId: "0" }]) {
      const res = await setCoachDansSousGroupeAction(
        idle,
        fd({ editionId: "1", sousGroupeId: "7", present: "true", ...bad }),
      );
      expect(res.status).toBe("error");
    }
    expect(setCoachDansSousGroupe).not.toHaveBeenCalled();

    // Compte qui n'est pas coach de l'atelier : la base refuse, l'action le dit.
    vi.mocked(setCoachDansSousGroupe).mockResolvedValue(false);
    expect(
      (await setCoachDansSousGroupeAction(idle, fd({ editionId: "1", sousGroupeId: "7", userId: "42", present: "true" }))).status,
    ).toBe("error");

    vi.mocked(auth).mockResolvedValue(membre);
    await expect(
      setCoachDansSousGroupeAction(idle, fd({ editionId: "1", sousGroupeId: "7", userId: "42", present: "true" })),
    ).rejects.toThrow("REDIRECT:/connexion");
  });

  it("update / delete : refusent une non-orga", async () => {
    vi.mocked(auth).mockResolvedValue(membre);
    await expect(
      updateSousGroupeAction(idle, fd({ editionId: "1", sousGroupeId: "7" })),
    ).rejects.toThrow("REDIRECT:/connexion");
    await expect(
      deleteSousGroupeAction(idle, fd({ editionId: "1", sousGroupeId: "7" })),
    ).rejects.toThrow("REDIRECT:/connexion");
    expect(updateSousGroupe).not.toHaveBeenCalled();
    expect(deleteSousGroupe).not.toHaveBeenCalled();
  });
});

describe("setAtelierVisioAction", () => {
  it("refuse une non-orga", async () => {
    vi.mocked(auth).mockResolvedValue(membre);
    await expect(
      setAtelierVisioAction(idle, fd({ editionId: "1", atelierId: "3", lienVisio: "https://meet/x" })),
    ).rejects.toThrow("REDIRECT:/connexion");
    expect(setAtelierVisio).not.toHaveBeenCalled();
  });

  it("orga + lien valide : enregistre (normalisé) → ?ok=atelier_visio", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(setAtelierVisio).mockResolvedValue(true);
    expect((await setAtelierVisioAction(idle, fd({ editionId: "1", atelierId: "3", lienVisio: "meet.example/x" }))).status).toBe("success");
    const [atelierId, editionId, lien] = vi.mocked(setAtelierVisio).mock.calls[0];
    expect(atelierId).toBe(3);
    expect(editionId).toBe(1);
    expect(lien).toBe("https://meet.example/x"); // https:// préfixé
  });

  it("orga + lien vide : efface (null) → ?ok=atelier_visio", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(setAtelierVisio).mockResolvedValue(true);
    expect((await setAtelierVisioAction(idle, fd({ editionId: "1", atelierId: "3", lienVisio: "" }))).status).toBe("success");
    expect(vi.mocked(setAtelierVisio).mock.calls[0][2]).toBeNull();
  });

  it("orga + lien non http(s) : ?err=visio, n'enregistre pas", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    expect((await setAtelierVisioAction(idle, fd({ editionId: "1", atelierId: "3", lienVisio: "javascript:alert(1)" }))).status).toBe("error");
    expect(setAtelierVisio).not.toHaveBeenCalled();
  });
});

describe("setRegistrationVisibilityAction", () => {
  it("refuse une non-orga (aucun changement)", async () => {
    vi.mocked(auth).mockResolvedValue(membre);
    await expect(
      setRegistrationVisibilityAction(idle, fd({ editionId: "1", registrationId: "5", public: "true" })),
    ).rejects.toThrow("REDIRECT:/connexion");
    expect(setRegistrationVisibility).not.toHaveBeenCalled();
  });

  it("orga + public=true + base : rend publique avec provenance → succès", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(setRegistrationVisibility).mockResolvedValue(true);
    expect(
      (
        await setRegistrationVisibilityAction(
          idle,
          fd({ editionId: "1", registrationId: "5", public: "true", base: "formulaire_inscription" }),
        )
      ).status,
    ).toBe("success");
    expect(setRegistrationVisibility).toHaveBeenCalledWith(5, 1, true, "formulaire_inscription", null);
  });

  it("orga + octroi SANS base : refus, aucun changement (démontrabilité)", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    expect(
      (await setRegistrationVisibilityAction(idle, fd({ editionId: "1", registrationId: "5", public: "true" }))).status,
    ).toBe("error");
    expect(setRegistrationVisibility).not.toHaveBeenCalled();
  });

  it("orga + octroi base=self : refus (l'orga ne maquille pas un self) ", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    expect(
      (
        await setRegistrationVisibilityAction(
          idle,
          fd({ editionId: "1", registrationId: "5", public: "true", base: "self" }),
        )
      ).status,
    ).toBe("error");
    expect(setRegistrationVisibility).not.toHaveBeenCalled();
  });

  it("orga + octroi + lien de preuve : normalisé et transmis", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(setRegistrationVisibility).mockResolvedValue(true);
    expect(
      (
        await setRegistrationVisibilityAction(
          idle,
          fd({ editionId: "1", registrationId: "5", public: "true", base: "email", preuveLien: "exemple.com/p" }),
        )
      ).status,
    ).toBe("success");
    expect(setRegistrationVisibility).toHaveBeenCalledWith(5, 1, true, "email", "https://exemple.com/p");
  });

  it("orga + public=false : masque (base 'self', pas de preuve) → succès", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(setRegistrationVisibility).mockResolvedValue(true);
    expect((await setRegistrationVisibilityAction(idle, fd({ editionId: "1", registrationId: "5", public: "false" }))).status).toBe("success");
    expect(setRegistrationVisibility).toHaveBeenCalledWith(5, 1, false, "self", null);
  });

  it("orga + inscription hors édition (0 ligne) : ?err=visibilite", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(setRegistrationVisibility).mockResolvedValue(false);
    expect(
      (
        await setRegistrationVisibilityAction(
          idle,
          fd({ editionId: "1", registrationId: "5", public: "true", base: "autre" }),
        )
      ).status,
    ).toBe("error");
  });

  it("orga + editionId invalide : retour au listing, aucun changement", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    expect((await setRegistrationVisibilityAction(idle, fd({ editionId: "0", registrationId: "5", public: "true" }))).status).toBe("error");
    expect(setRegistrationVisibility).not.toHaveBeenCalled();
  });

  it("orga + registrationId invalide : ?err=visibilite, aucun changement", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    expect((await setRegistrationVisibilityAction(idle, fd({ editionId: "1", registrationId: "abc", public: "true" }))).status).toBe("error");
    expect(setRegistrationVisibility).not.toHaveBeenCalled();
  });

  it("orga + public omis : masque par défaut (=== \"true\" strict) → ?ok=masquee", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(setRegistrationVisibility).mockResolvedValue(true);
    expect((await setRegistrationVisibilityAction(idle, fd({ editionId: "1", registrationId: "5" }))).status).toBe("success");
    expect(setRegistrationVisibility).toHaveBeenCalledWith(5, 1, false, "self", null);
  });
});

describe("updateRegistrationDetailsAction", () => {
  it("refuse une non-orga", async () => {
    vi.mocked(auth).mockResolvedValue(membre);
    await expect(
      updateRegistrationDetailsAction(idle, fd({ editionId: "1", registrationId: "5", recompense: "1er prix" })),
    ).rejects.toThrow("REDIRECT:/connexion");
    expect(updateRegistrationDetails).not.toHaveBeenCalled();
  });

  it("orga + détails valides : met à jour le classement → ?ok=details", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(updateRegistrationDetails).mockResolvedValue(true);
    const res = await updateRegistrationDetailsAction(
      idle,
      fd({ editionId: "1", registrationId: "5", classement: "1" }),
    );
    expect(res.status).toBe("success");
    const [registrationId, editionId, details] = vi.mocked(updateRegistrationDetails).mock.calls[0];
    expect(registrationId).toBe(5);
    expect(editionId).toBe(1);
    expect(details.classement).toBe(1);
  });

  it("orga + inscription hors édition (0 ligne) : ?err=details", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(updateRegistrationDetails).mockResolvedValue(false);
    expect((await updateRegistrationDetailsAction(idle, fd({ editionId: "1", registrationId: "5", recompense: "x" }))).status).toBe("error");
  });

  it("orga + editionId manquant et saisie invalide : repli sur le listing (?err=details)", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    expect((await updateRegistrationDetailsAction(idle, fd({ registrationId: "5", photoUrl: "javascript:alert(1)" }))).status).toBe("error");
    expect(updateRegistrationDetails).not.toHaveBeenCalled();
  });
});

describe("addPhotoAction", () => {
  it("refuse une non-orga", async () => {
    vi.mocked(auth).mockResolvedValue(membre);
    await expect(
      addPhotoAction(idle, fd({ editionId: "1", url: "https://x.fr/p.jpg" })),
    ).rejects.toThrow("REDIRECT:/connexion");
    expect(addPhotoWithPersons).not.toHaveBeenCalled();
  });

  it("orga + photo valide + personnes : ajoute+tague atomiquement (URL normalisée) → ?ok=photo", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(addPhotoWithPersons).mockResolvedValue(50);
    const f = new FormData();
    f.append("editionId", "1");
    f.append("url", "exemple.fr/p.jpg");
    f.append("kind", "podium");
    f.append("personnes", "5");
    f.append("personnes", "8");
    expect((await addPhotoAction(idle, f)).status).toBe("success");
    const [editionId, photo, ids] = vi.mocked(addPhotoWithPersons).mock.calls[0];
    expect(editionId).toBe(1);
    expect(photo.url).toBe("https://exemple.fr/p.jpg"); // schéma préfixé
    expect(photo.kind).toBe("podium");
    expect(ids).toEqual([5, 8]);
  });

  it("orga + photo sans personne (ambiance) : ajoute avec tags vides → ?ok=photo", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(addPhotoWithPersons).mockResolvedValue(51);
    expect((await addPhotoAction(idle, fd({ editionId: "1", url: "https://x.fr/ambiance.jpg" }))).status).toBe("success");
    expect(vi.mocked(addPhotoWithPersons).mock.calls[0][2]).toEqual([]);
  });

  it("orga + URL non http(s) : ?err=photo, n'ajoute rien", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    expect((await addPhotoAction(idle, fd({ editionId: "1", url: "javascript:alert(1)" }))).status).toBe("error");
    expect(addPhotoWithPersons).not.toHaveBeenCalled();
  });

  it("orga + échec de l'ajout atomique : ?err=photo", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(addPhotoWithPersons).mockRejectedValue(new Error("boom"));
    expect((await addPhotoAction(idle, fd({ editionId: "1", url: "https://x.fr/p.jpg" }))).status).toBe("error");
  });
});

describe("addParticipanteAction (multi : comptes choisis + e-mail cumulables)", () => {
  const idle = { status: "idle" as const };
  const editionOk = () =>
    vi.mocked(getEditionById).mockResolvedValue({ id: 1, nom: "Tremplin 2026" } as never);

  it("refuse une non-orga", async () => {
    vi.mocked(auth).mockResolvedValue(membre);
    await expect(
      addParticipanteAction(idle, fd({ editionId: "1", email: "a@b.fr" })),
    ).rejects.toThrow("REDIRECT:/connexion");
    expect(getOrCreateUserByEmail).not.toHaveBeenCalled();
    expect(registerUserToEdition).not.toHaveBeenCalled();
  });

  it("orga + e-mail invalide : erreur, ne crée rien", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    const res = await addParticipanteAction(idle, fd({ editionId: "1", email: "pas-un-email" }));
    expect(res.status).toBe("error");
    expect(getOrCreateUserByEmail).not.toHaveBeenCalled();
  });

  it("orga + ni compte ni e-mail : erreur explicite", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    const res = await addParticipanteAction(idle, fd({ editionId: "1", compteId: "", email: "" }));
    expect(res.status).toBe("error");
    expect(registerUserToEdition).not.toHaveBeenCalled();
  });

  it("orga + édition introuvable : erreur AVANT de créer le compte (pas de users orphelin)", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(getEditionById).mockResolvedValue(null);
    const res = await addParticipanteAction(idle, fd({ editionId: "99", email: "a@b.fr" }));
    expect(res.status).toBe("error");
    expect(getOrCreateUserByEmail).not.toHaveBeenCalled();
  });

  it("orga + erreur DB (FK, réseau…) : renvoie un état d'erreur, ne jette pas", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    editionOk();
    vi.mocked(getOrCreateUserByEmail).mockResolvedValue(userResult(true));
    vi.mocked(registerUserToEdition).mockRejectedValue({ code: "23503" });
    const res = await addParticipanteAction(idle, fd({ editionId: "1", email: "a@b.fr" }));
    expect(res.status).toBe("error");
  });

  it("orga + invitation partie : inscrit et renvoie success (e-mail normalisé)", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    editionOk();
    vi.mocked(getOrCreateUserByEmail).mockResolvedValue(userResult(true));
    vi.mocked(registerUserToEdition).mockResolvedValue("inscrite");
    vi.mocked(sendEditionInviteEmail).mockResolvedValue(true);
    const res = await addParticipanteAction(idle, fd({ editionId: "1", email: "A@B.fr" }));
    expect(res.status).toBe("success");
    expect(res.status === "success" && res.resume).toContain("a@b.fr");
    expect(res.status === "success" && res.resume).toContain("invitée");
    expect(registerUserToEdition).toHaveBeenCalledWith(1, 42, "cfp_et_pitch");
    expect(sendEditionInviteEmail).toHaveBeenCalledWith(userResult(true).user, 1);
  });

  it("orga + Brevo inactif : inscrit et PRÉVIENT que l'invitation n'est pas partie", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    editionOk();
    vi.mocked(getOrCreateUserByEmail).mockResolvedValue(userResult(true));
    vi.mocked(registerUserToEdition).mockResolvedValue("inscrite");
    vi.mocked(sendEditionInviteEmail).mockResolvedValue(false);
    const res = await addParticipanteAction(idle, fd({ editionId: "1", email: "a@b.fr" }));
    expect(res.status).toBe("success");
    expect(res.status === "success" && res.resume).toMatch(/pas parti/);
  });

  // Sélecteur : la participante vient des comptes de la plateforme, sans
  // ressaisir d'e-mail (moins d'erreurs de frappe, comptes reliés d'office).
  it("orga + compte choisi dans la liste : inscrit CE compte et prévient", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    editionOk();
    vi.mocked(getUserById).mockResolvedValue({ id: 42, name: "X", email: "a@b.fr" });
    vi.mocked(registerUserToEdition).mockResolvedValue("inscrite");
    vi.mocked(sendEditionInviteEmail).mockResolvedValue(true);
    const res = await addParticipanteAction(idle, fd({ editionId: "1", compteId: "42" }));
    expect(res.status).toBe("success");
    expect(registerUserToEdition).toHaveBeenCalledWith(1, 42, "cfp_et_pitch");
    expect(getOrCreateUserByEmail).not.toHaveBeenCalled(); // pas de compte créé
  });

  it("orga + compte choisi inconnu : erreur, RIEN n'est inscrit (même les valides)", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    editionOk();
    vi.mocked(getUserById).mockImplementation(async (id: number) =>
      id === 42 ? ({ id: 42, name: "X", email: "a@b.fr" } as never) : null,
    );
    const res = await addParticipanteAction(
      idle,
      fd({ editionId: "1", compteId: ["42", "999"] }),
    );
    expect(res.status).toBe("error");
    expect(registerUserToEdition).not.toHaveBeenCalled();
  });

  // Bug preview : « j'ajoute une connue puis une inconnue, je perds la connue ».
  it("orga + DEUX comptes choisis ET un e-mail : les trois sont inscrites et invitées", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    editionOk();
    vi.mocked(getUserById).mockImplementation(async (id: number) =>
      ({ id, name: `Compte ${id}`, email: `c${id}@b.fr` }) as never,
    );
    vi.mocked(getOrCreateUserByEmail).mockResolvedValue({
      user: { id: 77, name: null, email: "inconnue@b.fr" },
      created: true,
    } as never);
    vi.mocked(registerUserToEdition).mockResolvedValue("inscrite");
    vi.mocked(sendEditionInviteEmail).mockResolvedValue(true);
    const res = await addParticipanteAction(
      idle,
      fd({ editionId: "1", compteId: ["42", "43"], email: "inconnue@b.fr" }),
    );
    expect(res.status).toBe("success");
    expect(res.status === "success" && res.resume).toMatch(/3 speakeuses inscrites/);
    expect(registerUserToEdition).toHaveBeenCalledTimes(3);
    expect(sendEditionInviteEmail).toHaveBeenCalledTimes(3);
  });

  it("orga + même personne choisie ET saisie par e-mail : une seule inscription (pas de faux « déjà inscrite »)", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(getEditionById).mockResolvedValue({ id: 1, nom: "Tremplin 2026" } as never);
    vi.mocked(getUserById).mockResolvedValue({ id: 42, name: "X", email: "a@b.fr" });
    vi.mocked(getOrCreateUserByEmail).mockResolvedValue(userResult(false)); // même compte 42
    vi.mocked(registerUserToEdition).mockResolvedValue("inscrite");
    vi.mocked(sendEditionInviteEmail).mockResolvedValue(true);
    const res = await addParticipanteAction(
      idle,
      fd({ editionId: "1", compteId: "42", email: "a@b.fr" }),
    );
    expect(res.status).toBe("success");
    expect(res.status === "success" && res.resume).not.toMatch(/déjà inscrite/i);
    expect(registerUserToEdition).toHaveBeenCalledTimes(1);
  });

  it("orga + une déjà inscrite parmi les choisies : les autres passent, la doublonne est nommée", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    editionOk();
    vi.mocked(getUserById).mockImplementation(async (id: number) =>
      ({ id, name: `Compte ${id}`, email: `c${id}@b.fr` }) as never,
    );
    vi.mocked(registerUserToEdition).mockImplementation(async (_e: number, userId: number) =>
      userId === 43 ? "deja_inscrite" : "inscrite",
    );
    vi.mocked(sendEditionInviteEmail).mockResolvedValue(true);
    const res = await addParticipanteAction(
      idle,
      fd({ editionId: "1", compteId: ["42", "43"] }),
    );
    expect(res.status).toBe("success");
    expect(res.status === "success" && res.resume).toMatch(/[Dd]éjà inscrite/);
    expect(res.status === "success" && res.resume).toContain("c43@b.fr");
    // L'invitation ne part qu'aux nouvelles inscrites.
    expect(sendEditionInviteEmail).toHaveBeenCalledTimes(1);
  });

  it("orga + toutes déjà inscrites : erreur (rien de nouveau)", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    editionOk();
    vi.mocked(getUserById).mockResolvedValue({ id: 42, name: "X", email: "a@b.fr" });
    vi.mocked(registerUserToEdition).mockResolvedValue("deja_inscrite");
    const res = await addParticipanteAction(idle, fd({ editionId: "1", compteId: "42" }));
    expect(res.status).toBe("error");
    expect(sendEditionInviteEmail).not.toHaveBeenCalled();
  });
});

describe("setRegistrationPhasePublicAction (l'accord d'être nommée sur une phase)", () => {
  const idle = { status: "idle" as const };
  const champs = (present: string, phase = "montee_sur_scene") =>
    fd({ editionId: "1", registrationId: "7", phase, present });

  it("refuse une non-orga", async () => {
    vi.mocked(auth).mockResolvedValue(membre);
    await expect(setRegistrationPhasePublicAction(idle, champs("true"))).rejects.toThrow(
      "REDIRECT:/connexion",
    );
    expect(setRegistrationPhasePublic).not.toHaveBeenCalled();
  });

  it("orga : recueille l'accord, scopé à l'édition ET à la phase", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(setRegistrationPhasePublic).mockResolvedValue(true);
    const res = await setRegistrationPhasePublicAction(idle, champs("true"));
    expect(res.status).toBe("success");
    expect(setRegistrationPhasePublic).toHaveBeenCalledWith(7, 1, "montee_sur_scene", true);
  });

  /** Toute valeur qui n'est pas « true » RETIRE l'accord : le repli va du côté
   * prudent, jamais vers la publication. */
  it.each(["", "TRUE", "on", "oui"])("orga : « %s » retire l'accord", async (recu) => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(setRegistrationPhasePublic).mockResolvedValue(true);
    await setRegistrationPhasePublicAction(idle, champs(recu));
    expect(setRegistrationPhasePublic).toHaveBeenCalledWith(7, 1, "montee_sur_scene", false);
  });

  it.each(["", "finale", "__proto__", "PHASE"])(
    "orga : « %s » n'est pas une phase — refus sans écriture",
    async (phase) => {
      vi.mocked(auth).mockResolvedValue(orga);
      const res = await setRegistrationPhasePublicAction(idle, champs("true", phase));
      expect(res.status).toBe("error");
      expect(setRegistrationPhasePublic).not.toHaveBeenCalled();
    },
  );

  /**
   * 0 ligne = l'inscrite n'est PAS rattachée à cette phase (ou pas à cette
   * édition). On le dit au lieu de créer le rattachement en douce : publier
   * quelqu'un dans une cohorte où elle ne figure pas serait un fait inventé.
   */
  it("orga + phase non rattachée : erreur explicite, rien de créé", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(setRegistrationPhasePublic).mockResolvedValue(false);
    const res = await setRegistrationPhasePublicAction(idle, champs("true"));
    expect(res.status).toBe("error");
    // Le message DIT quoi faire : sans lui, l'orga voit un refus sans savoir que
    // c'est le rattachement qui manque.
    expect(res.status === "error" && res.error).toMatch(/rattache/i);
  });

  it("orga + ids invalides : erreur sans écriture", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    const res = await setRegistrationPhasePublicAction(
      idle,
      fd({ editionId: "0", registrationId: "7", phase: "montee_sur_scene", present: "true" }),
    );
    expect(res.status).toBe("error");
    expect(setRegistrationPhasePublic).not.toHaveBeenCalled();
  });
});

describe("fiche coach (rôle, lien, accord d'être citée)", () => {
  const idle = { status: "idle" as const };

  // Le compte visé accompagne un atelier, sauf mention contraire : c'est le cas
  // normal, celui où l'orga arrive depuis la liste des coachs de l'atelier.
  beforeEach(() => {
    vi.mocked(estCoachRattache).mockResolvedValue(true);
  });

  it("refuse une non-orga, sur les deux gestes", async () => {
    vi.mocked(auth).mockResolvedValue(membre);
    await expect(
      setCoachProfileAction(idle, fd({ userId: "9", role: "Coach", lien: "" })),
    ).rejects.toThrow("REDIRECT:/connexion");
    await expect(
      setCoachProfilePublicAction(idle, fd({ userId: "9", present: "true" })),
    ).rejects.toThrow("REDIRECT:/connexion");
    expect(upsertCoachProfile).not.toHaveBeenCalled();
    expect(setCoachProfilePublic).not.toHaveBeenCalled();
  });

  it("orga : enregistre rôle et lien", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    const res = await setCoachProfileAction(
      idle,
      fd({ userId: "9", role: "Coach produit", lien: "https://exemple.fr" }),
    );
    expect(res.status).toBe("success");
    expect(upsertCoachProfile).toHaveBeenCalledWith(9, {
      role: "Coach produit",
      lien: "https://exemple.fr",
    });
  });

  /**
   * Ce lien s'affiche sur une page publique mise en cache : une URL non http(s)
   * y deviendrait un `javascript:` cliquable. Refusé à L'ÉCRITURE, en plus de la
   * dégradation au rendu (`ExternalLink`) — une seule garde finit par sauter.
   */
  it.each(["javascript:alert(1)", "data:text/html,x", "ftp://x.fr", "exemple.fr"])(
    "orga : « %s » est refusé à l'écriture",
    async (lien) => {
      vi.mocked(auth).mockResolvedValue(orga);
      const res = await setCoachProfileAction(idle, fd({ userId: "9", role: "", lien }));
      expect(res.status).toBe("error");
      expect(upsertCoachProfile).not.toHaveBeenCalled();
    },
  );

  it("orga : un lien vide reste permis (le champ est facultatif)", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    const res = await setCoachProfileAction(idle, fd({ userId: "9", role: "Coach", lien: "" }));
    expect(res.status).toBe("success");
  });

  it.each([
    ["true", true],
    ["false", false],
  ] as const)("orga : « %s » enregistre l'accord %s", async (recu, attendu) => {
    vi.mocked(auth).mockResolvedValue(orga);
    const res = await setCoachProfilePublicAction(idle, fd({ userId: "9", present: recu }));
    expect(res.status).toBe("success");
    expect(setCoachProfilePublic).toHaveBeenCalledWith(9, attendu);
  });

  it("orga + compte invalide : erreur sans écriture", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    expect((await setCoachProfileAction(idle, fd({ userId: "0" }))).status).toBe("error");
    expect((await setCoachProfilePublicAction(idle, fd({ userId: "0" }))).status).toBe("error");
    expect(upsertCoachProfile).not.toHaveBeenCalled();
    expect(setCoachProfilePublic).not.toHaveBeenCalled();
  });

  /**
   * Précondition et raisons : cf. `estCoachRattache` (src/lib/tremplin-coachs.ts).
   * En deux mots : le `userId` vient du formulaire, donc du client, et un POST
   * forgé saute la page qui, elle, vérifie bien le rattachement.
   */
  it("orga : un compte qui accompagne personne est refusé, sur les deux gestes", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(estCoachRattache).mockResolvedValue(false);

    const fiche = await setCoachProfileAction(
      idle,
      fd({ userId: "9", role: "Coach produit", lien: "https://exemple.fr" }),
    );
    const accord = await setCoachProfilePublicAction(idle, fd({ userId: "9", present: "true" }));

    expect(fiche.status).toBe("error");
    expect(accord.status).toBe("error");
    expect(upsertCoachProfile).not.toHaveBeenCalled();
    expect(setCoachProfilePublic).not.toHaveBeenCalled();
  });

  it("orga : le refus se dit, et rend la saisie pour la corriger sans la retaper", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(estCoachRattache).mockResolvedValue(false);
    const res = await setCoachProfileAction(idle, fd({ userId: "9", role: "Coach produit", lien: "" }));
    expect(res.status).toBe("error");
    if (res.status === "error") {
      expect(res.error).toMatch(/rattache d'abord/i);
      expect(res.values.role).toBe("Coach produit");
    }
  });

  /** Une base en panne refuse, elle n'ouvre pas l'écriture par défaut. */
  it("orga : base indisponible pour la vérification, écriture refusée", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(estCoachRattache).mockRejectedValue(new Error("db down"));
    expect((await setCoachProfileAction(idle, fd({ userId: "9", role: "C", lien: "" }))).status).toBe(
      "error",
    );
    expect((await setCoachProfilePublicAction(idle, fd({ userId: "9", present: "true" }))).status).toBe(
      "error",
    );
    expect(upsertCoachProfile).not.toHaveBeenCalled();
    expect(setCoachProfilePublic).not.toHaveBeenCalled();
  });

  /**
   * RETIRER UN ACCORD RESTE POSSIBLE, toujours (RGPD art. 7-3 : aussi simple à
   * retirer qu'à donner). Garder le retrait derrière la précondition rendait un
   * `public = true` indélébile dès le dernier rattachement défait — et republié
   * le jour où la personne accompagne à nouveau, sur la foi d'un accord donné
   * pour une autre édition.
   */
  it("orga : l'accord se retire même une fois le dernier rattachement défait", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(estCoachRattache).mockResolvedValue(false);
    const res = await setCoachProfilePublicAction(idle, fd({ userId: "9", present: "false" }));
    expect(res.status).toBe("success");
    expect(setCoachProfilePublic).toHaveBeenCalledWith(9, false);
    // Le retrait se passe de la requête : il vaut quoi qu'elle réponde.
    expect(estCoachRattache).not.toHaveBeenCalled();
  });

  it("orga : un retrait sur un compte invalide reste refusé", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    const res = await setCoachProfilePublicAction(idle, fd({ userId: "0", present: "false" }));
    expect(res.status).toBe("error");
    expect(setCoachProfilePublic).not.toHaveBeenCalled();
  });

  /**
   * `users.id` est un INTEGER : au-delà, Postgres lève un 22003 qu'on
   * rapporterait comme une panne de base. C'est une saisie invalide.
   */
  it("orga : un identifiant hors INTEGER est une saisie invalide, sans requête", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    const res = await setCoachProfileAction(
      idle,
      fd({ userId: "9999999999", role: "Coach", lien: "" }),
    );
    expect(res.status).toBe("error");
    if (res.status === "error") expect(res.error).toBe("Compte invalide.");
    expect(estCoachRattache).not.toHaveBeenCalled();
    expect(upsertCoachProfile).not.toHaveBeenCalled();
  });

  /** Un lien malformé se refuse sur place : la requête de rattachement attend. */
  it("orga : un lien refusé coûte zéro requête", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    const res = await setCoachProfileAction(idle, fd({ userId: "9", role: "", lien: "exemple.fr" }));
    expect(res.status).toBe("error");
    expect(estCoachRattache).not.toHaveBeenCalled();
  });
});

describe("setAtelierProgrammePublicAction (ce que le site public annonce)", () => {
  const idle = { status: "idle" as const };
  const champs = (present: string) => fd({ editionId: "1", atelierId: "3", present });

  /**
   * L'action publie une séance sur une page indexée : sans cette garde, n'importe
   * quel compte connecté pourrait mettre le programme d'une édition à la vue de
   * tous — ou l'en retirer.
   */
  it("refuse une non-orga", async () => {
    vi.mocked(auth).mockResolvedValue(membre);
    await expect(setAtelierProgrammePublicAction(idle, champs("true"))).rejects.toThrow(
      "REDIRECT:/connexion",
    );
    expect(setAtelierProgrammePublic).not.toHaveBeenCalled();
  });

  it.each([
    ["true", true],
    ["false", false],
  ] as const)("orga : « %s » enregistre la visibilité %s", async (recu, attendu) => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(setAtelierProgrammePublic).mockResolvedValue(true);
    const res = await setAtelierProgrammePublicAction(idle, champs(recu));
    expect(res.status).toBe("success");
    // L'ÉDITION est passée, toujours : c'est elle qui borne l'écriture côté
    // base. Un appel à deux arguments publierait l'atelier d'une autre édition.
    expect(setAtelierProgrammePublic).toHaveBeenCalledWith(3, 1, attendu);
  });

  /**
   * Toute valeur qui n'est pas « true » ferme la vitrine. Le repli va donc du
   * côté PRUDENT : une valeur inattendue réserve la séance, elle ne la publie
   * jamais.
   */
  it.each(["", "TRUE", "on", "1", "oui"])(
    "orga : « %s » ferme la vitrine plutôt que de l'ouvrir",
    async (recu) => {
      vi.mocked(auth).mockResolvedValue(orga);
      vi.mocked(setAtelierProgrammePublic).mockResolvedValue(true);
      await setAtelierProgrammePublicAction(idle, champs(recu));
      expect(setAtelierProgrammePublic).toHaveBeenCalledWith(3, 1, false);
    },
  );

  it("orga + atelier hors édition (0 ligne) : erreur", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(setAtelierProgrammePublic).mockResolvedValue(false);
    const res = await setAtelierProgrammePublicAction(idle, champs("true"));
    expect(res.status).toBe("error");
  });

  it("orga + ids invalides : erreur sans écriture", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    const res = await setAtelierProgrammePublicAction(
      idle,
      fd({ editionId: "0", atelierId: "3", present: "true" }),
    );
    expect(res.status).toBe("error");
    expect(setAtelierProgrammePublic).not.toHaveBeenCalled();
  });
});

describe("setAtelierAudienceAction (qui voit l'atelier, enregistrement à la volée)", () => {
  const idle = { status: "idle" as const };
  const champs = (audience: string) => fd({ editionId: "1", atelierId: "3", audience });

  it("refuse une non-orga", async () => {
    vi.mocked(auth).mockResolvedValue(membre);
    await expect(setAtelierAudienceAction(idle, champs("toutes"))).rejects.toThrow(
      "REDIRECT:/connexion",
    );
    expect(setAtelierAudience).not.toHaveBeenCalled();
  });

  it.each(["selection", "phase", "toutes"] as const)(
    "orga : enregistre l'audience « %s »",
    async (audience) => {
      vi.mocked(auth).mockResolvedValue(orga);
      vi.mocked(setAtelierAudience).mockResolvedValue(true);
      const res = await setAtelierAudienceAction(idle, champs(audience));
      expect(res.status).toBe("success");
      expect(setAtelierAudience).toHaveBeenCalledWith(3, 1, audience);
    },
  );

  /**
   * Une clé inventée est REFUSÉE, jamais repliée en silence : le repli
   * naturel d'un `??` serait la valeur par défaut, et se tromper de côté ici
   * ouvrirait un atelier à des gens qu'il ne concerne pas.
   */
  it.each(["", "TOUTES", "constructor", "__proto__", "ouvert"])(
    "orga : « %s » n'est pas une audience — refus sans écriture",
    async (audience) => {
      vi.mocked(auth).mockResolvedValue(orga);
      const res = await setAtelierAudienceAction(idle, champs(audience));
      expect(res.status).toBe("error");
      expect(setAtelierAudience).not.toHaveBeenCalled();
    },
  );

  it("orga + atelier hors édition (0 ligne) : erreur", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(setAtelierAudience).mockResolvedValue(false);
    const res = await setAtelierAudienceAction(idle, champs("toutes"));
    expect(res.status).toBe("error");
  });

  it("orga + ids invalides : erreur sans écriture", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    const res = await setAtelierAudienceAction(idle, fd({ editionId: "0", atelierId: "3", audience: "toutes" }));
    expect(res.status).toBe("error");
    expect(setAtelierAudience).not.toHaveBeenCalled();
  });
});

describe("deleteRegistrationAction (retirer une participante)", () => {
  it("refuse une non-orga", async () => {
    vi.mocked(auth).mockResolvedValue(membre);
    await expect(
      deleteRegistrationAction(fd({ editionId: "1", registrationId: "5" })),
    ).rejects.toThrow("REDIRECT:/connexion");
    expect(deleteRegistration).not.toHaveBeenCalled();
  });

  it("orga + retrait OK → ?ok=participante_retiree", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(getRegistrationById).mockResolvedValue({ id: 5, participanteNom: "Camille Roux" } as never);
    vi.mocked(deleteRegistration).mockResolvedValue(true);
    await expect(
      deleteRegistrationAction(
        fd({ editionId: "1", registrationId: "5", confirmation: "Camille Roux" }),
      ),
    ).rejects.toThrow("REDIRECT:/admin/tremplins/1?ok=participante_retiree");
    expect(deleteRegistration).toHaveBeenCalledWith(5, 1);
  });

  it("orga + inscription hors édition (0 ligne) : ?err=retrait", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(getRegistrationById).mockResolvedValue({ id: 5, participanteNom: "Camille Roux" } as never);
    vi.mocked(deleteRegistration).mockResolvedValue(false);
    await expect(
      deleteRegistrationAction(
        fd({ editionId: "1", registrationId: "5", confirmation: "Camille Roux" }),
      ),
    ).rejects.toThrow("REDIRECT:/admin/tremplins/1?err=retrait");
  });
});

describe("deleteDocumentAction", () => {
  it("refuse une non-orga", async () => {
    vi.mocked(auth).mockResolvedValue(membre);
    await expect(
      deleteDocumentAction(idle, fd({ editionId: "1", documentId: "9" })),
    ).rejects.toThrow("REDIRECT:/connexion");
    expect(deleteDocument).not.toHaveBeenCalled();
  });

  it("orga + suppression OK → ?ok=doc_supprime", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(deleteDocument).mockResolvedValue(true);
    expect((await deleteDocumentAction(idle, fd({ editionId: "1", documentId: "9" }))).status).toBe("success");
    expect(deleteDocument).toHaveBeenCalledWith(9, 1);
  });

  it("orga + document hors édition (0 ligne) : ?err=doc_suppr", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(deleteDocument).mockResolvedValue(false);
    expect((await deleteDocumentAction(idle, fd({ editionId: "1", documentId: "9" }))).status).toBe("error");
  });
});

describe("setAtelierMembresAction (modifier la composition)", () => {
  it("refuse une non-orga", async () => {
    vi.mocked(auth).mockResolvedValue(membre);
    await expect(
      setAtelierMembresAction(idle, fd({ editionId: "1", atelierId: "3" })),
    ).rejects.toThrow("REDIRECT:/connexion");
    expect(setAtelierMembers).not.toHaveBeenCalled();
  });

  it("orga + sélection : remplace les membres (ids filtrés) → ?ok=atelier_membres", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(setAtelierMembers).mockResolvedValue(true);
    const f = new FormData();
    f.append("editionId", "1");
    f.append("atelierId", "3");
    f.append("membres", "5");
    f.append("membres", "abc");
    f.append("membres", "8");
    expect((await setAtelierMembresAction(idle, f)).status).toBe("success");
    expect(setAtelierMembers).toHaveBeenCalledWith(3, 1, [5, 8]);
  });

  it("orga + aucune cochée : liste vide (atelier redevient ouvert)", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(setAtelierMembers).mockResolvedValue(true);
    expect((await setAtelierMembresAction(idle, fd({ editionId: "1", atelierId: "3" }))).status).toBe("success");
    expect(setAtelierMembers).toHaveBeenCalledWith(3, 1, []);
  });

  it("orga + atelier hors édition : ?err=membres", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(setAtelierMembers).mockResolvedValue(false);
    expect((await setAtelierMembresAction(idle, fd({ editionId: "1", atelierId: "3" }))).status).toBe("error");
  });
});

describe("setRegistrationFinaleAction (bascule finaliste)", () => {
  it("refuse une non-orga", async () => {
    vi.mocked(auth).mockResolvedValue(membre);
    await expect(
      setRegistrationFinaleAction(idle, fd({ editionId: "1", registrationId: "5", present: "true" })),
    ).rejects.toThrow("REDIRECT:/connexion");
    expect(setRegistrationFinale).not.toHaveBeenCalled();
  });

  it("orga + editionId invalide : retour au listing, aucun changement", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    expect((await setRegistrationFinaleAction(idle, fd({ editionId: "0", registrationId: "5", present: "true" }))).status).toBe("error");
    expect(setRegistrationFinale).not.toHaveBeenCalled();
  });

  it("orga + present=true → succès ET garantit l'appartenance phase 1 (invariant phase 2 ⊂ phase 1)", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(setRegistrationPhaseMembership).mockResolvedValue(true);
    vi.mocked(setRegistrationFinale).mockResolvedValue(true);
    expect((await setRegistrationFinaleAction(idle, fd({ editionId: "1", registrationId: "5", present: "true" }))).status).toBe("success");
    // La phase 1 est semée AVANT la pose de la finale.
    expect(setRegistrationPhaseMembership).toHaveBeenCalledWith(5, 1, "cfp_et_pitch", true);
    expect(setRegistrationFinale).toHaveBeenCalledWith(5, 1, true);
  });

  it("orga + present=false → succès, ne sème PAS d'appartenance de phase", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(setRegistrationFinale).mockResolvedValue(true);
    expect((await setRegistrationFinaleAction(idle, fd({ editionId: "1", registrationId: "5", present: "false" }))).status).toBe("success");
    expect(setRegistrationFinale).toHaveBeenCalledWith(5, 1, false);
    expect(setRegistrationPhaseMembership).not.toHaveBeenCalled();
  });

  it("orga + inscription hors édition (0 ligne) : erreur", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(setRegistrationPhaseMembership).mockResolvedValue(true);
    vi.mocked(setRegistrationFinale).mockResolvedValue(false);
    expect((await setRegistrationFinaleAction(idle, fd({ editionId: "1", registrationId: "5", present: "true" }))).status).toBe("error");
  });
});

describe("setRegistrationPhaseMembershipAction (appartenance multi-phase)", () => {
  it("refuse une non-orga", async () => {
    vi.mocked(auth).mockResolvedValue(membre);
    await expect(
      setRegistrationPhaseMembershipAction(
        idle,
        fd({ editionId: "1", registrationId: "5", phase: "cfp_et_pitch", present: "true" }),
      ),
    ).rejects.toThrow("REDIRECT:/connexion");
    expect(setRegistrationPhaseMembership).not.toHaveBeenCalled();
  });

  it("refuse une phase inconnue (dont « finale », pilotée par finale_presente)", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    expect(
      (
        await setRegistrationPhaseMembershipAction(
          idle,
          fd({ editionId: "1", registrationId: "5", phase: "finale", present: "true" }),
        )
      ).status,
    ).toBe("error");
    expect(setRegistrationPhaseMembership).not.toHaveBeenCalled();
  });

  it("ajoute la phase 3 sans toucher au statut finaliste", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(setRegistrationPhaseMembership).mockResolvedValue(true);
    expect(
      (
        await setRegistrationPhaseMembershipAction(
          idle,
          fd({ editionId: "1", registrationId: "5", phase: "montee_sur_scene", present: "true" }),
        )
      ).status,
    ).toBe("success");
    expect(setRegistrationPhaseMembership).toHaveBeenCalledWith(5, 1, "montee_sur_scene", true);
    expect(setRegistrationFinale).not.toHaveBeenCalled();
  });

  it("retirer la phase 1 retire AUSSI le statut finaliste (invariant phase 2 ⊂ phase 1)", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(setRegistrationPhaseMembership).mockResolvedValue(true);
    vi.mocked(setRegistrationFinale).mockResolvedValue(true);
    expect(
      (
        await setRegistrationPhaseMembershipAction(
          idle,
          fd({ editionId: "1", registrationId: "5", phase: "cfp_et_pitch", present: "false" }),
        )
      ).status,
    ).toBe("success");
    expect(setRegistrationPhaseMembership).toHaveBeenCalledWith(5, 1, "cfp_et_pitch", false);
    expect(setRegistrationFinale).toHaveBeenCalledWith(5, 1, false);
  });

  it("ajouter la phase 1 ne touche pas au statut finaliste", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(setRegistrationPhaseMembership).mockResolvedValue(true);
    await setRegistrationPhaseMembershipAction(
      idle,
      fd({ editionId: "1", registrationId: "5", phase: "cfp_et_pitch", present: "true" }),
    );
    expect(setRegistrationFinale).not.toHaveBeenCalled();
  });

  it("inscription hors édition (0 ligne) : erreur", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(setRegistrationPhaseMembership).mockResolvedValue(false);
    expect(
      (
        await setRegistrationPhaseMembershipAction(
          idle,
          fd({ editionId: "1", registrationId: "5", phase: "cfp_et_pitch", present: "true" }),
        )
      ).status,
    ).toBe("error");
  });
});

describe("deleteRegistrationAction — palier 3 (cascade RGPD)", () => {
  // Retirer une participante efface SES données (documents, tags photo,
  // ateliers, journal de consentement) : c'est la donnée d'une AUTRE personne
  // que celle qui clique. Palier 3, revérifié serveur.
  it("nom saisi FAUX → refus, aucun retrait", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(getRegistrationById).mockResolvedValue({ id: 5, participanteNom: "Camille Roux" } as never);
    await expect(
      deleteRegistrationAction(
        fd({ editionId: "1", registrationId: "5", confirmation: "quelqu'un d'autre" }),
      ),
    ).rejects.toThrow("REDIRECT:/admin/tremplins/1/participantes/5/retrait?err=participante_nom");
    expect(deleteRegistration).not.toHaveBeenCalled();
  });

  it("sans saisie → refus, aucun retrait", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(getRegistrationById).mockResolvedValue({ id: 5, participanteNom: "Camille Roux" } as never);
    await expect(
      deleteRegistrationAction(fd({ editionId: "1", registrationId: "5" })),
    ).rejects.toThrow("REDIRECT:/admin/tremplins/1/participantes/5/retrait?err=participante_nom");
    expect(deleteRegistration).not.toHaveBeenCalled();
  });

  it("nom EXACT (casse et accents pliés) → retire", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(getRegistrationById).mockResolvedValue({ id: 5, participanteNom: "Camille Roux" } as never);
    vi.mocked(deleteRegistration).mockResolvedValue(true as never);
    await expect(
      deleteRegistrationAction(
        fd({ editionId: "1", registrationId: "5", confirmation: "  CAMILLE ROUX " }),
      ),
    ).rejects.toThrow("REDIRECT:/admin/tremplins/1?ok=participante_retiree");
    expect(deleteRegistration).toHaveBeenCalledWith(5, 1);
  });
});

describe("deleteEditionAction (suppression d'édition)", () => {
  it("refuse une non-orga (aucune suppression)", async () => {
    vi.mocked(auth).mockResolvedValue(membre);
    await expect(deleteEditionAction(fd({ editionId: "1" }))).rejects.toThrow("REDIRECT:/connexion");
    expect(deleteEdition).not.toHaveBeenCalled();
  });

  it("editionId invalide → retour à la liste, aucune suppression", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    await expect(deleteEditionAction(fd({ editionId: "0" }))).rejects.toThrow("REDIRECT:/admin/tremplins");
    expect(deleteEdition).not.toHaveBeenCalled();
  });

  it("édition introuvable (déjà supprimée) → retour à la liste, aucune suppression", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(getEditionById).mockResolvedValue(null);
    await expect(deleteEditionAction(fd({ editionId: "1" }))).rejects.toThrow("REDIRECT:/admin/tremplins");
    expect(deleteEdition).not.toHaveBeenCalled();
  });

  it("publiée + nom saisi FAUX → refus (err=edition_nom), aucune suppression", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(getEditionDeletionCounts).mockResolvedValue({ total: 3 } as never);
    vi.mocked(getEditionById).mockResolvedValue({ statut: "archive", nom: "Tremplin 2026" } as never);
    await expect(
      deleteEditionAction(fd({ editionId: "1", confirmation: "Tremplin 2025" })),
    ).rejects.toThrow("REDIRECT:/admin/tremplins/1/retrait?err=edition_nom");
    expect(deleteEdition).not.toHaveBeenCalled();
  });

  it("publiée + nom EXACT → supprime et redirige vers la liste", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(getEditionDeletionCounts).mockResolvedValue({ total: 3 } as never);
    vi.mocked(getEditionById).mockResolvedValue({ statut: "archive", nom: "Tremplin 2026" } as never);
    vi.mocked(deleteEdition).mockResolvedValue("soft");
    await expect(
      deleteEditionAction(fd({ editionId: "1", confirmation: "  Tremplin 2026  " })),
    ).rejects.toThrow("REDIRECT:/admin/tremplins");
    expect(deleteEdition).toHaveBeenCalledWith(1);
  });

  // Le palier se lit sur l'EFFET (§10) : une édition qui n'a RIEN (brouillon
  // créé par erreur, le cas fréquent) n'emporte rien en partant, donc pas de
  // saisie à retaper. Dès qu'elle porte une participante, un atelier, une
  // photo, un juré, une récompense ou un document, le palier 3 s'applique.
  it("édition VIDE → supprime sans exiger de nom", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(getEditionById).mockResolvedValue({ statut: "preparation", nom: "Brouillon" } as never);
    vi.mocked(getEditionDeletionCounts).mockResolvedValue({
      nbParticipantes: 0, nbAteliers: 0, nbPhotos: 0, total: 0,
    } as never);
    vi.mocked(deleteEdition).mockResolvedValue("hard");
    await expect(deleteEditionAction(fd({ editionId: "1" }))).rejects.toThrow(
      "REDIRECT:/admin/tremplins",
    );
    expect(deleteEdition).toHaveBeenCalledWith(1);
  });

  it("édition qui porte ne serait-ce qu'un juré → exige le nom", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(getEditionById).mockResolvedValue({ statut: "preparation", nom: "Brouillon" } as never);
    vi.mocked(getEditionDeletionCounts).mockResolvedValue({
      nbParticipantes: 0, nbAteliers: 0, nbPhotos: 0, total: 1,
    } as never);
    await expect(deleteEditionAction(fd({ editionId: "1" }))).rejects.toThrow(
      "REDIRECT:/admin/tremplins/1/retrait?err=edition_nom",
    );
    expect(deleteEdition).not.toHaveBeenCalled();
  });

  // Palier 3 des deux côtés : une édition « en préparation » n'est pas publique,
  // mais son `DELETE` est un HARD delete qui cascade sur les participantes, les
  // ateliers, les photos, le jury et les documents — il efface PLUS que le
  // soft-delete d'une édition publiée. Le statut ne dégrade donc pas le palier.
  it("préparation + nom saisi FAUX → refus, aucune suppression", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(getEditionDeletionCounts).mockResolvedValue({ total: 3 } as never);
    vi.mocked(getEditionById).mockResolvedValue({ statut: "preparation", nom: "Brouillon" } as never);
    await expect(
      deleteEditionAction(fd({ editionId: "1", confirmation: "autre chose" })),
    ).rejects.toThrow("REDIRECT:/admin/tremplins/1/retrait?err=edition_nom");
    expect(deleteEdition).not.toHaveBeenCalled();
  });

  it("préparation sans saisie du tout → refus, aucune suppression", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(getEditionDeletionCounts).mockResolvedValue({ total: 3 } as never);
    vi.mocked(getEditionById).mockResolvedValue({ statut: "preparation", nom: "Brouillon" } as never);
    await expect(deleteEditionAction(fd({ editionId: "1" }))).rejects.toThrow(
      "REDIRECT:/admin/tremplins/1/retrait?err=edition_nom",
    );
    expect(deleteEdition).not.toHaveBeenCalled();
  });

  it("préparation + nom EXACT → supprime", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(getEditionDeletionCounts).mockResolvedValue({ total: 3 } as never);
    vi.mocked(getEditionById).mockResolvedValue({ statut: "preparation", nom: "Brouillon" } as never);
    vi.mocked(deleteEdition).mockResolvedValue("hard");
    await expect(
      deleteEditionAction(fd({ editionId: "1", confirmation: "Brouillon" })),
    ).rejects.toThrow("REDIRECT:/admin/tremplins");
    expect(deleteEdition).toHaveBeenCalledWith(1);
  });

  // Le serveur plie comme le client (`plierConfirmation`) : sinon une saisie
  // acceptée à l'écran serait refusée ici, et le bouton paraîtrait cassé.
  it("nom à apostrophe courbe : la saisie clavier convient", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(getEditionDeletionCounts).mockResolvedValue({ total: 3 } as never);
    vi.mocked(getEditionById).mockResolvedValue({ statut: "archive", nom: "L’édition d’hiver" } as never);
    vi.mocked(deleteEdition).mockResolvedValue("soft");
    await expect(
      deleteEditionAction(fd({ editionId: "1", confirmation: "l'edition d'hiver" })),
    ).rejects.toThrow("REDIRECT:/admin/tremplins");
    expect(deleteEdition).toHaveBeenCalledWith(1);
  });

  it("course (deleteEdition renvoie introuvable) → retour à la liste", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(getEditionDeletionCounts).mockResolvedValue({ total: 3 } as never);
    vi.mocked(getEditionById).mockResolvedValue({ statut: "preparation", nom: "Brouillon" } as never);
    vi.mocked(deleteEdition).mockResolvedValue("introuvable");
    await expect(
      deleteEditionAction(fd({ editionId: "1", confirmation: "Brouillon" })),
    ).rejects.toThrow("REDIRECT:/admin/tremplins");
  });
});

describe("setAtelierMembreAction / setAtelierPresenceAction (interrupteur par inscrite)", () => {
  it("membre : refuse une non-orga", async () => {
    vi.mocked(auth).mockResolvedValue(membre);
    await expect(
      setAtelierMembreAction(idle, fd({ editionId: "1", atelierId: "3", registrationId: "5", present: "true" })),
    ).rejects.toThrow("REDIRECT:/connexion");
    expect(setAtelierMembre).not.toHaveBeenCalled();
  });

  it("membre : orga ajoute une inscrite → succès", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(setAtelierMembre).mockResolvedValue(true);
    expect(
      (await setAtelierMembreAction(idle, fd({ editionId: "1", atelierId: "3", registrationId: "5", present: "true" }))).status,
    ).toBe("success");
    expect(setAtelierMembre).toHaveBeenCalledWith(3, 1, 5, true);
  });

  it("membre : atelier hors édition (0 ligne) → erreur", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(setAtelierMembre).mockResolvedValue(false);
    expect(
      (await setAtelierMembreAction(idle, fd({ editionId: "1", atelierId: "3", registrationId: "5", present: "false" }))).status,
    ).toBe("error");
  });

  it("présence : cochée → 'presente', décochée → 'absente'", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(setAtelierPresence).mockResolvedValue(true);
    await setAtelierPresenceAction(idle, fd({ editionId: "1", atelierId: "3", registrationId: "5", present: "true" }));
    expect(setAtelierPresence).toHaveBeenCalledWith(3, 1, 5, "presente");
    await setAtelierPresenceAction(idle, fd({ editionId: "1", atelierId: "3", registrationId: "5", present: "false" }));
    expect(setAtelierPresence).toHaveBeenCalledWith(3, 1, 5, "absente");
  });

  it("présence : refuse une non-orga", async () => {
    vi.mocked(auth).mockResolvedValue(membre);
    await expect(
      setAtelierPresenceAction(idle, fd({ editionId: "1", atelierId: "3", registrationId: "5", present: "true" })),
    ).rejects.toThrow("REDIRECT:/connexion");
    expect(setAtelierPresence).not.toHaveBeenCalled();
  });
});

describe("addJuryAction / deleteJuryAction (jury)", () => {
  it("refuse une non-orga (aucun ajout)", async () => {
    vi.mocked(auth).mockResolvedValue(membre);
    await expect(
      addJuryAction(idle, fd({ editionId: "1", nom: "Lovelace" })),
    ).rejects.toThrow("REDIRECT:/connexion");
    expect(addJury).not.toHaveBeenCalled();
  });

  it("nom obligatoire", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    expect((await addJuryAction(idle, fd({ editionId: "1", nom: "  " }))).status).toBe("error");
    expect(addJury).not.toHaveBeenCalled();
  });

  it("e-mail invalide refusé", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    expect(
      (await addJuryAction(idle, fd({ editionId: "1", nom: "Lovelace", email: "pasunemail" })))
        .status,
    ).toBe("error");
    expect(addJury).not.toHaveBeenCalled();
  });

  it("orga : ajout complet (e-mail interne accepté)", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(addJury).mockResolvedValue(9);
    const res = await addJuryAction(
      idle,
      fd({
        editionId: "1",
        prenom: "Ada",
        nom: "Lovelace",
        fonction: "CTO",
        entreprise: "Acme",
        email: "ada@example.fr",
      }),
    );
    expect(res.status).toBe("success");
    expect(addJury).toHaveBeenCalledWith(1, {
      nom: "Lovelace",
      prenom: "Ada",
      fonction: "CTO",
      entreprise: "Acme",
      email: "ada@example.fr",
    });
  });

  it("deleteJuryAction : refuse une non-orga", async () => {
    vi.mocked(auth).mockResolvedValue(membre);
    await expect(
      deleteJuryAction(idle, fd({ editionId: "1", juryId: "9" })),
    ).rejects.toThrow("REDIRECT:/connexion");
    expect(deleteJury).not.toHaveBeenCalled();
  });

  it("deleteJuryAction : juré hors édition (0 ligne) → erreur", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(deleteJury).mockResolvedValue(false);
    expect((await deleteJuryAction(idle, fd({ editionId: "1", juryId: "9" }))).status).toBe(
      "error",
    );
  });

  it("deleteJuryAction : orga + juré de l'édition → succès", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(deleteJury).mockResolvedValue(true);
    expect((await deleteJuryAction(idle, fd({ editionId: "1", juryId: "9" }))).status).toBe(
      "success",
    );
    expect(deleteJury).toHaveBeenCalledWith(9, 1);
  });
});

describe("createAtelierAction (atelier + membres, saisie à la chaîne)", () => {
  const idle = { status: "idle" as const };

  it("refuse une non-orga", async () => {
    vi.mocked(auth).mockResolvedValue(membre);
    await expect(
      createAtelierAction(idle, fd({ editionId: "1", titre: "Coaching" })),
    ).rejects.toThrow("REDIRECT:/connexion");
    expect(createAtelierWithMembers).not.toHaveBeenCalled();
  });

  it("orga + titre manquant : erreur, aucune création", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    const res = await createAtelierAction(idle, fd({ editionId: "1", titre: "" }));
    expect(res.status).toBe("error");
    expect(createAtelierWithMembers).not.toHaveBeenCalled();
  });

  it("orga + valide : crée l'atelier + membres et renvoie success", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(createAtelierWithMembers).mockResolvedValue(77);
    const f = new FormData();
    f.append("editionId", "1");
    f.append("titre", "Coaching DevFest");
    f.append("coachs", "Lucile");
    f.append("membres", "5");
    f.append("membres", "8");
    const res = await createAtelierAction(idle, f);
    expect(res).toEqual({ status: "success", titre: "Coaching DevFest" });
    const [editionId, atelier, ids] = vi.mocked(createAtelierWithMembers).mock.calls[0];
    expect(editionId).toBe(1);
    expect(atelier.titre).toBe("Coaching DevFest");
    expect(atelier.coachs).toBe("Lucile");
    expect(ids).toEqual([5, 8]);
  });

  it("orga + échec de création : renvoie une erreur", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(createAtelierWithMembers).mockRejectedValue(new Error("boom"));
    const res = await createAtelierAction(idle, fd({ editionId: "1", titre: "A" }));
    expect(res.status).toBe("error");
  });
});

describe("createEditionAction (nouvelle édition pour une conférence)", () => {
  const idle = { status: "idle" as const };
  const form = () =>
    fd({ nom: "Tremplin 2027", annee: "2027", confNom: "Devoxx France" });

  it("refuse une non-orga", async () => {
    vi.mocked(auth).mockResolvedValue(membre);
    await expect(createEditionAction(idle, form())).rejects.toThrow("REDIRECT:/connexion");
    expect(createEdition).not.toHaveBeenCalled();
  });

  it("orga + saisie invalide : état d'erreur, rien créé", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    const res = await createEditionAction(idle, fd({ nom: "", annee: "2027", confNom: "Devoxx" }));
    expect(res.status).toBe("error");
    expect(createEdition).not.toHaveBeenCalled();
  });

  it("orga + valide : crée en préparation (slug déduit) puis REDIRIGE vers la fiche", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(createEdition).mockResolvedValue(12);
    await expect(createEditionAction(idle, form())).rejects.toThrow(
      "REDIRECT:/admin/tremplins/12",
    );
    const [input] = vi.mocked(createEdition).mock.calls[0];
    expect(input.statut).toBe("preparation"); // invisible du public à la création
    expect(input.confSlug).toBe("devoxx-france");
    expect(input.annee).toBe(2027);
  });

  it("orga + doublon (conf, année) : message clair, saisie conservée", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(createEdition).mockRejectedValue({ code: "23505" });
    const res = await createEditionAction(idle, form());
    expect(res.status).toBe("error");
    if (res.status === "error") {
      expect(res.error).toMatch(/existe déjà/i);
      expect(res.values.nom).toBe("Tremplin 2027"); // restaurée dans le formulaire
    }
  });

  it("orga + erreur DB inattendue : état d'erreur, ne jette pas", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(createEdition).mockRejectedValue(new Error("boom"));
    const res = await createEditionAction(idle, form());
    expect(res.status).toBe("error");
  });
});

describe("createEditionAction avec sourceId (création = duplication d'un modèle)", () => {
  const idle = { status: "idle" as const };
  const form = () =>
    fd({ sourceId: "5", nom: "Tremplin 2027", annee: "2027", confNom: "DevFest", confLieu: "Toulouse" });

  it("refuse une non-orga", async () => {
    vi.mocked(auth).mockResolvedValue(membre);
    await expect(createEditionAction(idle, form())).rejects.toThrow("REDIRECT:/connexion");
    expect(duplicateEdition).not.toHaveBeenCalled();
  });

  it("orga + sourceId vide : édition VIERGE (createEdition, pas de duplication)", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(createEdition).mockResolvedValue(12);
    await expect(
      createEditionAction(idle, fd({ sourceId: "", nom: "Tremplin 2027", annee: "2027", confNom: "Devoxx" })),
    ).rejects.toThrow("REDIRECT:/admin/tremplins/12");
    expect(duplicateEdition).not.toHaveBeenCalled();
  });

  it("orga + sourceId invalide : erreur, ni création ni duplication", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    const res = await createEditionAction(
      idle,
      fd({ sourceId: "abc", nom: "X", annee: "2027", confNom: "Y" }),
    );
    expect(res.status).toBe("error");
    expect(duplicateEdition).not.toHaveBeenCalled();
    expect(createEdition).not.toHaveBeenCalled();
  });

  it("orga + cible invalide (année) : erreur, aucune duplication", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    const res = await createEditionAction(
      idle,
      fd({ sourceId: "5", nom: "X", annee: "abcd", confNom: "Y" }),
    );
    expect(res.status).toBe("error");
    expect(duplicateEdition).not.toHaveBeenCalled();
  });

  it("orga + valide : duplique (slug déduit) puis REDIRIGE vers la copie", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(duplicateEdition).mockResolvedValue(21);
    await expect(createEditionAction(idle, form())).rejects.toThrow(
      "REDIRECT:/admin/tremplins/21",
    );
    expect(createEdition).not.toHaveBeenCalled(); // modèle choisi → pas de vierge
    const [sourceId, target] = vi.mocked(duplicateEdition).mock.calls[0];
    expect(sourceId).toBe(5);
    expect(target.annee).toBe(2027);
    expect(target.confSlug).toBe("devfest-toulouse");
    expect(target.nom).toBe("Tremplin 2027");
  });

  it("orga + modèle introuvable (null) : message clair, saisie conservée", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(duplicateEdition).mockResolvedValue(null);
    const res = await createEditionAction(idle, form());
    expect(res.status).toBe("error");
    if (res.status === "error") {
      expect(res.error).toMatch(/introuvable/i);
      expect(res.values.nom).toBe("Tremplin 2027");
    }
  });

  it("orga + doublon (conf, année) : message clair, saisie conservée", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(duplicateEdition).mockRejectedValue({ code: "23505" });
    const res = await createEditionAction(idle, form());
    expect(res.status).toBe("error");
    if (res.status === "error") {
      expect(res.error).toMatch(/existe déjà/i);
      expect(res.values.nom).toBe("Tremplin 2027");
    }
  });

  it("orga + erreur DB inattendue : état d'erreur, ne jette pas", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(duplicateEdition).mockRejectedValue(new Error("boom"));
    const res = await createEditionAction(idle, form());
    expect(res.status).toBe("error");
  });
});

describe("updateEditionAction (champs éditoriaux — le statut a sa propre action)", () => {

  const idle = { status: "idle" as const };
  const form = () =>
    fd({ editionId: "3", nom: "Tremplin 2027", confNom: "Devoxx France" });

  it("refuse une non-orga", async () => {
    vi.mocked(auth).mockResolvedValue(membre);
    await expect(updateEditionAction(idle, form())).rejects.toThrow("REDIRECT:/connexion");
    expect(updateEdition).not.toHaveBeenCalled();
  });

  it("orga + valide : met à jour les champs, sans toucher au statut", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(updateEdition).mockResolvedValue(true);
    const res = await updateEditionAction(idle, form());
    expect(res.status).toBe("success");
    const [id, update] = vi.mocked(updateEdition).mock.calls[0];
    expect(id).toBe(3);
    expect("statut" in update).toBe(false);
  });

  it("orga + fin des inscriptions avant le début : erreur nommée, rien écrit", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    const res = await updateEditionAction(
      idle,
      fd({
        editionId: "3",
        nom: "Tremplin 2027",
        confNom: "Devoxx France",
        inscriptionsDebut: "2027-02-28",
        inscriptionsFin: "2027-01-10",
      }),
    );
    expect(res.status).toBe("error");
    if (res.status === "error") expect(res.error).toMatch(/fin des inscriptions/i);
    expect(updateEdition).not.toHaveBeenCalled();
  });

  it("orga + édition inexistante (0 ligne) : état d'erreur", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(updateEdition).mockResolvedValue(false);
    const res = await updateEditionAction(idle, form());
    expect(res.status).toBe("error");
  });
});

describe("setEditionStatutAction (sous-page statut — c'est ici qu'on OUVRE)", () => {
  const idle = { status: "idle" as const };

  it("refuse une non-orga", async () => {
    vi.mocked(auth).mockResolvedValue(membre);
    await expect(
      setEditionStatutAction(idle, fd({ editionId: "3", statut: "ouvert" })),
    ).rejects.toThrow("REDIRECT:/connexion");
    expect(setEditionStatut).not.toHaveBeenCalled();
  });

  it("orga + statut valide : ouvre l'édition", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(setEditionStatut).mockResolvedValue(true);
    const res = await setEditionStatutAction(idle, fd({ editionId: "3", statut: "ouvert" }));
    expect(res.status).toBe("success");
    expect(setEditionStatut).toHaveBeenCalledWith(3, "ouvert");
  });

  it("orga + statut inconnu : erreur, rien écrit", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    const res = await setEditionStatutAction(idle, fd({ editionId: "3", statut: "n_importe" }));
    expect(res.status).toBe("error");
    expect(setEditionStatut).not.toHaveBeenCalled();
  });

  it("orga + édition inexistante (0 ligne) : erreur", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(setEditionStatut).mockResolvedValue(false);
    const res = await setEditionStatutAction(idle, fd({ editionId: "3", statut: "clos" }));
    expect(res.status).toBe("error");
  });
});

describe("activerCohortePhaseAtelierAction (#29 — activer la cohorte de phase)", () => {
  const args = fd({ editionId: "1", atelierId: "3" });

  it("refuse une non-orga (rien écrit)", async () => {
    vi.mocked(auth).mockResolvedValue(membre);
    await expect(activerCohortePhaseAtelierAction(idle, args)).rejects.toThrow("REDIRECT:/connexion");
    expect(setAtelierMembers).not.toHaveBeenCalled();
  });

  it("atelier introuvable pour l'édition : erreur, rien écrit", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(getAtelierById).mockResolvedValue(null);
    const res = await activerCohortePhaseAtelierAction(idle, args);
    expect(res.status).toBe("error");
    expect(setAtelierMembers).not.toHaveBeenCalled();
  });

  it("orga : réserve l'atelier à l'UNION des membres actuels et de la cohorte de sa phase", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(getAtelierById).mockResolvedValue({ phase: "cfp_et_pitch", date: "2026-05-01" } as never);
    // Membre déjà là, hors cohorte de phase (10) : jamais retiré.
    vi.mocked(getAtelierMembers).mockResolvedValue([10]);
    // 5 et 7 sont dans la phase cfp_et_pitch ; 6 seulement montée sur scène → exclue.
    vi.mocked(getPhaseMembersByEdition).mockResolvedValue(
      new Map([
        [5, new Set(["cfp_et_pitch"])],
        [6, new Set(["montee_sur_scene"])],
        [7, new Set(["cfp_et_pitch", "montee_sur_scene"])],
      ]) as never,
    );
    vi.mocked(setAtelierMembers).mockResolvedValue(true);

    const res = await activerCohortePhaseAtelierAction(idle, args);
    expect(res.status).toBe("success");
    expect(setAtelierMembers).toHaveBeenCalledTimes(1);
    const [atelierId, editionId, cible] = vi.mocked(setAtelierMembers).mock.calls[0];
    expect(atelierId).toBe(3);
    expect(editionId).toBe(1);
    expect([...cible].sort((a, b) => a - b)).toEqual([5, 7, 10]); // union additive, sans doublon
  });
});

describe("marquerToutesPresentesAction (#29 — marquer les non pointées présentes)", () => {
  /**
   * Comme la suppression d'un atelier : une revalidation ici ramènerait l'arbre
   * RSC dans la réponse même de l'action, et ce geste SE SUPPRIME lui-même
   * (« Marquer présentes les N » disparaît quand N tombe à zéro). Son compte
   * rendu était démonté avant d'exister — succès silencieux, mesuré au
   * navigateur : zéro région vive alors que la base était bien à jour.
   */
  it("ne revalide pas la page qui l'affiche (le compte rendu serait démonté)", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(getAtelierById).mockResolvedValue({ id: 10, editionId: 1 } as never);
    vi.mocked(getCohorteAtelier).mockResolvedValue([1, 2]);
    vi.mocked(getAtelierPresences).mockResolvedValue([]);
    vi.mocked(setAtelierPresences).mockResolvedValue(true);
    await marquerToutesPresentesAction(idle, args);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  const args = fd({ editionId: "1", atelierId: "3" });

  it("refuse une non-orga (rien écrit)", async () => {
    vi.mocked(auth).mockResolvedValue(membre);
    await expect(marquerToutesPresentesAction(idle, args)).rejects.toThrow("REDIRECT:/connexion");
    expect(setAtelierPresences).not.toHaveBeenCalled();
  });

  it("orga : ne passe présentes QUE les présences « non renseignée » (n'écrase pas une absence)", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(getAtelierById).mockResolvedValue({ phase: "cfp_et_pitch", date: "2026-05-01" } as never);
    // La CIBLE vient de l'audience (cohorte), pas des lignes déjà créées : 9
    // est concernée sans avoir jamais été pointée, elle doit être marquée.
    vi.mocked(getCohorteAtelier).mockResolvedValue([5, 6, 7, 8, 9]);
    vi.mocked(getAtelierPresences).mockResolvedValue([
      { registrationId: 5, presence: "non_renseignee" },
      { registrationId: 6, presence: "absente" },
      { registrationId: 7, presence: "presente" },
      { registrationId: 8, presence: "non_renseignee" },
    ]);
    vi.mocked(setAtelierPresences).mockResolvedValue(true);

    const res = await marquerToutesPresentesAction(idle, args);
    expect(res.status).toBe("success");
    const [, , entrees] = vi.mocked(setAtelierPresences).mock.calls[0];
    expect(entrees).toEqual([
      { registrationId: 5, presence: "presente" },
      { registrationId: 8, presence: "presente" },
      { registrationId: 9, presence: "presente" },
    ]);
  });

  it("orga : aucune présence à renseigner → succès sans écriture", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(getAtelierById).mockResolvedValue({ phase: "cfp_et_pitch", date: "2026-05-01" } as never);
    vi.mocked(getCohorteAtelier).mockResolvedValue([5, 6]);
    vi.mocked(getAtelierPresences).mockResolvedValue([
      { registrationId: 5, presence: "presente" },
      { registrationId: 6, presence: "absente" },
    ]);
    const res = await marquerToutesPresentesAction(idle, args);
    expect(res.status).toBe("success");
    expect(setAtelierPresences).not.toHaveBeenCalled();
  });
});

describe("deleteAtelierAction (supprimer un atelier, depuis sa page de retrait)", () => {
  const atelier = { id: 10, editionId: 1, titre: "Revue croisée entre speakeuses (séance 1)" };

  it("refuse une non-orga", async () => {
    vi.mocked(auth).mockResolvedValue(membre);
    await expect(deleteAtelierAction(fd({ editionId: "1", atelierId: "10" }))).rejects.toThrow(
      "REDIRECT:/connexion",
    );
    expect(deleteAtelier).not.toHaveBeenCalled();
  });

  /**
   * Décision produit du 01/08 : un atelier n'est pas assez critique pour qu'on
   * fasse retaper son titre, et le geste tient en DEUX actions. La page de
   * retrait chiffre ce qui va partir, l'appui suffit — même quand l'atelier
   * porte des présences pointées. (L'ÉDITION, elle, garde son palier 3 : sa
   * suppression emporte le travail de toute une promotion.)
   */
  it("atelier INVESTI : supprime sans réclamer de saisie → liste + ?ok", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(getAtelierById).mockResolvedValue(atelier as never);
    vi.mocked(deleteAtelier).mockResolvedValue(true);
    await expect(deleteAtelierAction(fd({ editionId: "1", atelierId: "10" }))).rejects.toThrow(
      "REDIRECT:/admin/tremplins/1/ateliers?ok=atelier_supprime",
    );
    expect(deleteAtelier).toHaveBeenCalledWith(10, 1);
    // Plus de comptage pour arbitrer un palier : une requête de moins.
    expect(getAtelierDeletionCounts).not.toHaveBeenCalled();
  });

  it("atelier d'une AUTRE édition (id forgé) : introuvable, rien n'est supprimé", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(getAtelierById).mockResolvedValue(null);
    await expect(deleteAtelierAction(fd({ editionId: "1", atelierId: "999" }))).rejects.toThrow(
      "REDIRECT:/admin/tremplins/1/ateliers?err=atelier",
    );
    expect(deleteAtelier).not.toHaveBeenCalled();
  });
});

describe("retirerAtelierAction (poubelle au bout du glissement, dans la liste)", () => {
  const atelier = { id: 10, editionId: 1, titre: "Atelier créé en double" };
  const champs = fd({ editionId: "1", atelierId: "10" });

  it("refuse une non-orga (rien écrit)", async () => {
    vi.mocked(auth).mockResolvedValue(membre);
    await expect(retirerAtelierAction(idle, champs)).rejects.toThrow("REDIRECT:/connexion");
    expect(deleteAtelier).not.toHaveBeenCalled();
  });

  it("supprime sur place, sans quitter la liste (pattern résultat)", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(getAtelierById).mockResolvedValue(atelier as never);
    vi.mocked(deleteAtelier).mockResolvedValue(true);
    const res = await retirerAtelierAction(idle, champs);
    expect(res.status).toBe("success");
    expect(deleteAtelier).toHaveBeenCalledWith(10, 1);
  });

  it("atelier d'une AUTRE édition (id forgé) : introuvable, rien n'est supprimé", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(getAtelierById).mockResolvedValue(null);
    const res = await retirerAtelierAction(idle, champs);
    expect(res.status).toBe("error");
    expect(deleteAtelier).not.toHaveBeenCalled();
  });

  it("identifiant invalide : refus net, sans requête de suppression", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    const res = await retirerAtelierAction(idle, fd({ editionId: "1", atelierId: "0" }));
    expect(res.status).toBe("error");
    expect(deleteAtelier).not.toHaveBeenCalled();
  });

  /**
   * LA raison pour laquelle le compte rendu n'apparaissait jamais.
   *
   * L'action revalidait l'arbre ADMIN. La réponse d'une Server Action embarque
   * alors le nouvel arbre RSC — sans la rangée supprimée — et React l'applique
   * dans le même commit que l'état retourné : la rangée est démontée AVANT
   * d'avoir pu rendre sa confirmation. L'action réussissait, `status: "success"`
   * revenait bien, et personne ne voyait jamais rien (0 région vive observée sur
   * six essais, clavier comme souris).
   *
   * Le rafraîchissement appartient donc au client, qui le déclenche APRÈS avoir
   * montré et focalisé la confirmation (`RangeeGlissante`). La page est
   * `force-dynamic` : elle dit la vérité au rafraîchissement comme au retour.
   *
   * La page PUBLIQUE, elle, se revalide bien ici — personne ne la regarde
   * pendant le geste, donc rien à démonter.
   */
  it("ne revalide RIEN (sinon la confirmation est démontée avant d'exister)", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    vi.mocked(getAtelierById).mockResolvedValue(atelier as never);
    vi.mocked(deleteAtelier).mockResolvedValue(true);
    await retirerAtelierAction(idle, champs);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("deplacerAtelierAction (monter / descendre dans la phase)", () => {
  const idle = { status: "idle" as const };
  const champs = (o: Record<string, string>) => fd({ editionId: "1", atelierId: "11", ...o });
  const programme = [
    { id: 10, phase: "cfp_et_pitch", ordre: 1 },
    { id: 11, phase: "cfp_et_pitch", ordre: 2 },
    { id: 12, phase: "cfp_et_pitch", ordre: 3 },
    { id: 20, phase: "montee_sur_scene", ordre: 4 },
  ] as never;

  beforeEach(() => {
    vi.mocked(getAteliersByEdition).mockResolvedValue(programme);
    vi.mocked(echangerOrdreAteliers).mockResolvedValue(true);
  });

  it("refuse une non-orga (rien écrit)", async () => {
    vi.mocked(auth).mockResolvedValue(membre);
    await expect(deplacerAtelierAction(idle, champs({ sens: "haut" }))).rejects.toThrow(
      "REDIRECT:/connexion",
    );
    expect(echangerOrdreAteliers).not.toHaveBeenCalled();
  });

  it("monter échange avec la séance du dessus", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    const res = await deplacerAtelierAction(idle, champs({ sens: "haut" }));
    expect(res.status).toBe("success");
    expect(echangerOrdreAteliers).toHaveBeenCalledWith(1, 11, 10);
  });

  it("descendre échange avec la séance du dessous", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    const res = await deplacerAtelierAction(idle, champs({ sens: "bas" }));
    expect(res.status).toBe("success");
    expect(echangerOrdreAteliers).toHaveBeenCalledWith(1, 11, 12);
  });

  /**
   * LE contrôle qui compte : le client n'envoie qu'un SENS. Le voisin est
   * calculé côté serveur, donc on ne peut pas faire échanger deux séances
   * quelconques — ni franchir une phase, ce que le geste n'autorise pas.
   */
  it("un id de voisin glissé dans le POST est ignoré", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    await deplacerAtelierAction(idle, champs({ sens: "haut", voisinId: "20", cibleId: "20" }));
    expect(echangerOrdreAteliers).toHaveBeenCalledWith(1, 11, 10);
  });

  it("en bout de phase : succès sans écriture (jamais de saut vers l'autre phase)", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    const res = await deplacerAtelierAction(
      idle,
      fd({ editionId: "1", atelierId: "12", sens: "bas" }),
    );
    expect(res.status).toBe("success");
    expect(echangerOrdreAteliers).not.toHaveBeenCalled();
  });

  it("un sens inconnu est refusé, sans écriture", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    for (const sens of ["", "up", "HAUT", "constructor"]) {
      const res = await deplacerAtelierAction(idle, champs({ sens }));
      expect(res.status, sens).toBe("error");
    }
    expect(echangerOrdreAteliers).not.toHaveBeenCalled();
  });

  it("un atelier d'une AUTRE édition : erreur sans écriture", async () => {
    vi.mocked(auth).mockResolvedValue(orga);
    const res = await deplacerAtelierAction(
      idle,
      fd({ editionId: "1", atelierId: "999", sens: "haut" }),
    );
    expect(res.status).toBe("error");
    expect(echangerOrdreAteliers).not.toHaveBeenCalled();
  });
});
