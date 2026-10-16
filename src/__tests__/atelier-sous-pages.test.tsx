import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * Lot C3b — sous-pages mono-fonction de l'atelier : chacune rend son
 * formulaire (l'action existante reste branchée) et le retour au sommaire.
 */

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
  redirect: vi.fn(),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/auth-guards", () => ({ requireOrgaId: vi.fn(async () => 1) }));
vi.mock("@/lib/tremplin-editions", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getEditionById: vi.fn(),
}));
vi.mock("@/lib/tremplin-ateliers", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getAteliersByEdition: vi.fn(),
  getAtelierMembers: vi.fn(async () => []),
  getAtelierPresences: vi.fn(async () => []),
  getSousGroupesByAtelier: vi.fn(async () => []),
  getCohorteAtelier: vi.fn(async () => []),
  getAtelierDeletionCounts: vi.fn(async () => ({
    nbParticipantes: 0,
    nbSousGroupes: 0,
    nbSupports: 0,
    nbCoachs: 0,
    total: 0,
  })),
}));
vi.mock("@/lib/tremplin-coachs", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getCoachsByAtelier: vi.fn(async () => []),
}));
vi.mock("@/lib/tremplin-documents", () => ({ getDocumentsByEdition: vi.fn(async () => []) }));
vi.mock("@/lib/tremplin-registrations", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getRegistrationsByEdition: vi.fn(async () => []),
}));
vi.mock("@/lib/tremplin-registration-phases", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getPhaseMembersOuVide: vi.fn(async () => new Map()),
}));
vi.mock("@/lib/users", () => ({
  getComptesPlateforme: vi.fn(async () => []),
  compteLabel: (u: { name?: string }) => u.name ?? "?",
}));
vi.mock("@/app/admin/tremplins/actions", () => ({
  setAtelierVisioAction: vi.fn(),
  updateAtelierInfosAction: vi.fn(),
  setAtelierMembreAction: vi.fn(),
  setAtelierAudienceAction: vi.fn(),
  setAtelierProgrammePublicAction: vi.fn(),
  setAtelierPresenceAction: vi.fn(),
  activerCohortePhaseAtelierAction: vi.fn(),
  marquerToutesPresentesAction: vi.fn(),
  createSousGroupeAction: vi.fn(),
  deleteAtelierAction: vi.fn(),
  updateSousGroupeAction: vi.fn(),
  deleteSousGroupeAction: vi.fn(),
  setMembreDansSousGroupeAction: vi.fn(),
  setCoachDansSousGroupeAction: vi.fn(),
  deleteDocumentAction: vi.fn(),
  removeCoachAction: vi.fn(),
}));
vi.mock("@/app/admin/tremplins/[edition]/AddCoachDialog", () => ({
  default: () => <button type="button">Ajouter un coach</button>,
}));
vi.mock("@/app/admin/tremplins/[edition]/AddDocumentDialog", () => ({
  default: () => <button type="button">Ajouter un support</button>,
}));

import { getEditionById } from "@/lib/tremplin-editions";
import {
  getAteliersByEdition,
  getAtelierMembers,
  getAtelierPresences,
} from "@/lib/tremplin-ateliers";
import { getRegistrationsByEdition } from "@/lib/tremplin-registrations";
import VisioAtelier from "@/app/admin/tremplins/[edition]/ateliers/[atelier]/visio/page";
import InfosAtelier from "@/app/admin/tremplins/[edition]/ateliers/[atelier]/infos/page";
import CoachsAtelier from "@/app/admin/tremplins/[edition]/ateliers/[atelier]/coachs/page";
import PresencesAtelier from "@/app/admin/tremplins/[edition]/ateliers/[atelier]/presences/page";
import SousGroupePage from "@/app/admin/tremplins/[edition]/ateliers/[atelier]/sous-groupes/[sg]/page";
import RepartitionSousGroupes from "@/app/admin/tremplins/[edition]/ateliers/[atelier]/sous-groupes/page";
import RetraitAtelier from "@/app/admin/tremplins/[edition]/ateliers/[atelier]/retrait/page";
import SupportsAtelier from "@/app/admin/tremplins/[edition]/ateliers/[atelier]/documents/page";
import { makeSousGroupe } from "./test-helpers";

afterEach(cleanup);

const params = Promise.resolve({ edition: "3", atelier: "10" });
const edition = { id: 3, nom: "Tremplin 2026", statut: "en_cours" } as never;
const atelier = {
  id: 10,
  editionId: 3,
  ordre: 0,
  titre: "Pitcher son talk",
  date: "2026-07-13",
  heureDebut: null,
  heureFin: null,
  description: null,
  lienVisio: "https://meet.exemple.fr/x",
  coachs: null,
  phase: "cfp_et_pitch",
  audience: "selection" as const,
  auProgrammePublic: false,
} as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getEditionById).mockResolvedValue(edition);
  vi.mocked(getAteliersByEdition).mockResolvedValue([atelier]);
});

const retour = () =>
  screen.getByRole("link", { name: /retour à l'atelier/i });

describe("sous-pages atelier — une page, une fonction", () => {
  it("visio : champ pré-rempli + enregistrement", async () => {
    render(await VisioAtelier({ params }));
    expect(screen.getByRole("heading", { level: 1, name: /lien de connexion/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/adresse de la visio/i)).toHaveValue("https://meet.exemple.fr/x");
    expect(screen.getByRole("button", { name: /enregistrer le lien/i })).toBeInTheDocument();
    expect(retour()).toHaveAttribute("href", "/admin/tremplins/3/ateliers/10");
  });

  it("infos : formulaire de fond AVEC la phase (regroupée, car liée à la date)", async () => {
    render(await InfosAtelier({ params }));
    expect(screen.getByLabelText(/titre/i)).toHaveValue("Pitcher son talk");
    // La phase vit désormais DANS le formulaire d'informations (plus de page à part).
    expect(screen.getByLabelText(/^phase/i)).toHaveValue("cfp_et_pitch");
    expect(retour()).toBeInTheDocument();
  });

  it("coachs : état vide + bouton d'ajout", async () => {
    render(await CoachsAtelier({ params }));
    expect(screen.getByRole("heading", { level: 1, name: /coachs/i })).toBeInTheDocument();
    expect(screen.getByText(/aucun coach pour l'instant/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ajouter un coach/i })).toBeInTheDocument();
  });

  it("présences : état sans inscrite + choix d'audience", async () => {
    render(await PresencesAtelier({ params }));
    expect(
      screen.getByRole("heading", { level: 1, name: /participantes et présences/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/aucune inscrite sur cette édition/i)).toBeInTheDocument();
    // QUI voit l'atelier : UNE question, trois réponses exclusives. Un atelier
    // neuf part sur la plus fermée — il ne s'ouvre à personne tant qu'on ne
    // l'a pas dit.
    expect(
      screen.getByRole("group", { name: /qui voit cet atelier/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /une sélection de participantes/i }),
    ).toBeChecked();
    expect(
      screen.getByRole("radio", { name: /toutes les inscrites de l'édition/i }),
    ).not.toBeChecked();
  });

  it("présences : chaque case « Présente » a un nom accessible UNIQUE (RGAA 11.1)", async () => {
    // Deux inscrites : sans nom distinct sur les cases, un lecteur d'écran
    // entend « Présente » deux fois sans savoir de qui il s'agit.
    vi.mocked(getRegistrationsByEdition).mockResolvedValue([
      { id: 51, participanteNom: "Alice Martin", userId: null, userName: null, userEmail: null },
      { id: 52, participanteNom: "Zoé Bernard", userId: null, userName: null, userEmail: null },
    ] as never);
    vi.mocked(getAtelierMembers).mockResolvedValue([51, 52] as never);
    vi.mocked(getAtelierPresences).mockResolvedValue([
      { registrationId: 51, presence: "non_renseignee" },
      { registrationId: 52, presence: "non_renseignee" },
    ] as never);

    render(await PresencesAtelier({ params }));
    // Le nom de chaque participante figure dans le nom accessible de SA case.
    expect(
      screen.getByRole("checkbox", { name: /présente.*alice martin/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /présente.*zoé bernard/i }),
    ).toBeInTheDocument();
    // Aucune case au nom générique « Présente » seule.
    expect(screen.queryByRole("checkbox", { name: /^présente$/i })).toBeNull();
  });

  it("supports : état vide + bouton d'ajout", async () => {
    render(await SupportsAtelier({ params }));
    expect(screen.getByRole("heading", { level: 1, name: /supports/i })).toBeInTheDocument();
    expect(screen.getByText(/aucun support pour l'instant/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ajouter un support/i })).toBeInTheDocument();
  });

  it("atelier « en sous-groupes » : l'appartenance, JAMAIS le pointage des présences", async () => {
    // Une revue croisée en duo ne se pointe pas : elle se suit par sous-groupe.
    // La page se limite donc à dire qui participe ; la répartition a sa page.
    vi.mocked(getAteliersByEdition).mockResolvedValue([
      {
        ...(atelier as Record<string, unknown>),
        nature: "sous_groupes",
        dateFin: null,
        lieu: null,
      },
    ] as never);
    vi.mocked(getRegistrationsByEdition).mockResolvedValue([
      { id: 51, participanteNom: "Alice Martin", userId: null, userName: null, userEmail: null },
      { id: 52, participanteNom: "Zoé Bernard", userId: null, userName: null, userEmail: null },
    ] as never);
    vi.mocked(getAtelierMembers).mockResolvedValue([51] as never);
    vi.mocked(getAtelierPresences).mockResolvedValue([
      { registrationId: 51, presence: "non_renseignee" },
    ] as never);

    render(await PresencesAtelier({ params }));
    expect(
      screen.getByRole("heading", { level: 1, name: /^participantes$/i }),
    ).toBeInTheDocument();
    // L'appartenance reste réglable ici…
    expect(screen.getByRole("switch", { name: /alice martin/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    // …mais aucun pointage, ni commande de pointage en lot.
    expect(screen.queryByRole("checkbox", { name: /présente/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /marquer présente/i })).toBeNull();
  });

  /**
   * LA VITRINE SE COCHE (migration 056). Elle se déduisait de l'audience, si
   * bien que l'orga réglait ce que le site montre en croyant ne régler que qui
   * voit la séance dans son espace. Deux décisions, deux contrôles.
   *
   * On vérifie surtout la PHRASE : elle nomme les champs publiés un par un
   * (l'aide disait « titre et dates » alors que la description partait aussi) et
   * elle dit que le lieu reste entre elles — la question de celle qui hésite.
   */
  it("la visibilité sur le site public est un réglage à part, qui dit ce qu'il publie", async () => {
    const { getAteliersByEdition } = await import("@/lib/tremplin-ateliers");
    vi.mocked(getAteliersByEdition).mockResolvedValue([
      { ...(atelier as Record<string, unknown>), auProgrammePublic: true },
    ] as never);

    render(await PresencesAtelier({ params }));
    const vitrine = screen.getByRole("switch", { name: /visible sur le site public/i });
    expect(vitrine).toHaveAttribute("aria-checked", "true");

    const aide = screen.getByText(/parcours de l'édition/i);
    for (const champ of [/\bnom\b/i, /dates/i, /description/i, /lieu/i]) {
      expect(aide.textContent).toMatch(champ);
    }
    // Le contrôle d'audience reste là, distinct : on n'a pas remplacé une
    // question par l'autre, on a arrêté de n'en poser qu'une pour deux.
    expect(screen.getByRole("radio", { name: /sélection de participantes/i })).toBeInTheDocument();
  });

  /** Le sous-groupe se DÉSIGNE par qui est dedans (retour orga : « Ils n'ont pas
   * besoin de noms »). Il n'y a donc AUCUN champ « nom » à remplir, et le titre
   * de la page est dérivé de ses membres. */
  const contexteSousGroupe = async (sg: object, coachs: object[] = []) => {
    const { getSousGroupesByAtelier } = await import("@/lib/tremplin-ateliers");
    const { getCoachsByAtelier } = await import("@/lib/tremplin-coachs");
    vi.mocked(getAteliersByEdition).mockResolvedValue([
      { ...(atelier as Record<string, unknown>), nature: "sous_groupes" },
    ] as never);
    vi.mocked(getSousGroupesByAtelier).mockResolvedValue([
      makeSousGroupe({ membres: [51], ...sg }),
    ] as never);
    vi.mocked(getRegistrationsByEdition).mockResolvedValue([
      { id: 51, participanteNom: "Alice Martin", userId: null, userName: null, userEmail: null },
      { id: 52, participanteNom: "Zoé Bernard", userId: null, userName: null, userEmail: null },
    ] as never);
    vi.mocked(getCoachsByAtelier).mockResolvedValue(coachs as never);
    return render(
      await SousGroupePage({ params: Promise.resolve({ edition: "3", atelier: "10", sg: "5" }) }),
    );
  };

  it("page dédiée d'un sous-groupe : titre DÉRIVÉ de ses membres, membres cochés, suppression", async () => {
    await contexteSousGroupe({ membres: [51, 52] });
    // Le titre dit qui est dedans — aucun nom saisi, donc aucun champ « nom ».
    expect(
      screen.getByRole("heading", { name: /alice martin et zoé bernard/i }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/nom du sous-groupe/i)).toBeNull();
    // Membres : une case par participante, cochée pour la membre (RGAA : nom unique).
    expect(screen.getByRole("heading", { name: /qui est dans ce sous-groupe/i })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /alice martin/i })).toHaveAttribute("aria-checked", "true");
    // Suppression sur la page de l'item (palier 2), pas sur la liste.
    expect(screen.getByRole("button", { name: /supprimer le sous-groupe/i })).toBeInTheDocument();
    // Le retour mène à la RÉPARTITION : c'est là qu'on voit qui reste à ranger.
    expect(screen.getByRole("link", { name: /retour à la répartition/i })).toHaveAttribute(
      "href",
      "/admin/tremplins/3/ateliers/10/sous-groupes",
    );
  });

  it("un groupe encore à composer se désigne par son rang (il faut pouvoir l'ouvrir)", async () => {
    await contexteSousGroupe({ membres: [] });
    expect(screen.getByRole("heading", { name: /sous-groupe 1/i })).toBeInTheDocument();
  });

  /**
   * « éventuellement une ou plusieurs coachs dedans » : un INTERRUPTEUR par
   * coach, enregistré à la bascule — le même modèle que le rangement des
   * participantes juste au-dessus. Aucune cochée = autonome, l'état par défaut,
   * donc pas d'option « Aucune » à choisir.
   *
   * Ce qui se joue ici : les deux listes doivent s'enregistrer de la MÊME façon.
   * Quand les coachs passaient par le formulaire à bouton, on cochait une coach,
   * on cochait des participantes, chaque bascule confirmait « mis à jour » — et
   * la coach n'était jamais enregistrée.
   */
  it("coachs : un interrupteur par coach de l'atelier, coché pour celles du sous-groupe", async () => {
    await contexteSousGroupe(
      { coachs: [{ userId: 42, nom: "Sofia Nguyen", email: "sofia@x.fr" }] },
      [
        { userId: 42, nom: "Sofia Nguyen", email: "sofia@x.fr", genre: null },
        { userId: 51, nom: "Lucile Martin", email: "lucile@x.fr", genre: null },
      ],
    );
    expect(screen.getByRole("heading", { name: /qui le coache/i })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /sofia nguyen/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("checkbox", { name: /lucile martin/i })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    // Aucune case de coach dans le formulaire à bouton : il ne porte plus que le
    // lien et la date, donc l'enregistrer ne peut pas effacer un coaching.
    const enregistrer = screen.getByRole("button", { name: /^enregistrer$/i });
    expect(enregistrer.closest("form")).not.toContainElement(
      screen.getByRole("checkbox", { name: /sofia nguyen/i }),
    );
  });

  /** Le titre bouge à chaque personne ajoutée : un repère STABLE reste dessous,
   * sinon l'identité de la page se dérobe pendant qu'on la remplit. */
  it("un repère stable accompagne le titre dérivé", async () => {
    await contexteSousGroupe({ membres: [51, 52] });
    expect(screen.getByText(/sous-groupe 1 de cet atelier/i)).toBeInTheDocument();
  });

  /** Une coach de l'ANCIEN modèle, restée hors des coachs de l'atelier : la
   * migration ne l'inscrit pas d'office (ce serait élargir un accès à des
   * données personnelles par script). L'écran le DIT, avec le geste à faire. */
  it("une coach héritée non reprise est NOMMÉE, avec le geste à faire", async () => {
    await contexteSousGroupe({ coachs: [], coachHeriteNom: "Sofia Nguyen" }, []);
    expect(screen.getByText(/Sofia Nguyen coachait ce sous-groupe/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ajoute-la aux coachs de l'atelier/i })).toHaveAttribute(
      "href",
      "/admin/tremplins/3/ateliers/10/coachs",
    );
  });

  /** Sans coach sur l'atelier il n'y a rien à cocher : on dit OÙ en ajouter,
   * plutôt que d'afficher un groupe de cases vide. */
  it("aucun coach sur l'atelier : aucune case, et on dit où en ajouter", async () => {
    await contexteSousGroupe({}, []);
    expect(screen.getByText(/ce sous-groupe est autonome/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /ajoute-la d'abord aux coachs de l'atelier/i }),
    ).toHaveAttribute("href", "/admin/tremplins/3/ateliers/10/coachs");
  });
});

describe("répartition en sous-groupes — la vue globale qui manquait", () => {
  const sgParams = Promise.resolve({ edition: "3", atelier: "10" });

  /** Atelier en sous-groupes, audience « les participantes de sa phase » :
   * l'ensemble à couvrir est la cohorte que résout `getCohorteAtelier`. */
  const contexte = async (sousGroupes: unknown[], cohorte: number[] = [51, 52]) => {
    const { getSousGroupesByAtelier, getCohorteAtelier } = await import(
      "@/lib/tremplin-ateliers"
    );
    vi.mocked(getAteliersByEdition).mockResolvedValue([
      { ...(atelier as Record<string, unknown>), nature: "sous_groupes", audience: "phase" },
    ] as never);
    vi.mocked(getSousGroupesByAtelier).mockResolvedValue(sousGroupes as never);
    vi.mocked(getRegistrationsByEdition).mockResolvedValue([
      { id: 51, participanteNom: "Alice Martin", userId: null, userName: null, userEmail: null },
      { id: 52, participanteNom: "Zoé Bernard", userId: null, userName: null, userEmail: null },
    ] as never);
    vi.mocked(getCohorteAtelier).mockResolvedValue(cohorte);
  };

  const binome = (o: object = {}) => makeSousGroupe({ membres: [51], ...o });

  it("dit QUI n'a pas encore de sous-groupe — la raison d'être de la répartition", async () => {
    await contexte([binome()]);
    render(await RepartitionSousGroupes({ params: sgParams }));
    expect(screen.getByText(/1 rangée sur 2/i)).toBeInTheDocument();
    expect(screen.getByText(/1 participante à ranger/i)).toBeInTheDocument();
    // Et elle est NOMMÉE : répartir, c'est nommer.
    const restantes = screen.getByRole("heading", { name: /sans sous-groupe/i })
      .parentElement as HTMLElement;
    expect(restantes).toHaveTextContent("Zoé Bernard");
  });

  it("NOMME l'audience sur laquelle on compte (sinon on devine l'effectif)", async () => {
    await contexte([binome()]);
    render(await RepartitionSousGroupes({ params: sgParams }));
    expect(screen.getByText(/participantes de « Préparation au CFP »/i)).toBeInTheDocument();
  });

  it("tout le monde rangé : on le DIT, et plus rien à traiter", async () => {
    await contexte([binome({ membres: [51, 52] })]);
    render(await RepartitionSousGroupes({ params: sgParams }));
    expect(screen.getByText(/tout le monde a un sous-groupe/i)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /sans sous-groupe/i })).toBeNull();
  });

  /** Une ligne = un sous-groupe, NOMMÉ par qui est dedans (plus de « Binôme 1 »
   * qui obligeait à ouvrir chaque groupe pour savoir qui le composait), et son
   * état de coaching à la forme positive (« Autonome », pas « aucune coach »). */
  it("chaque sous-groupe est une LIGNE vers sa page, désignée par ses membres", async () => {
    await contexte([binome({ membres: [51, 52] })]);
    render(await RepartitionSousGroupes({ params: sgParams }));
    const lien = screen.getByRole("link", { name: /alice martin et zoé bernard/i });
    expect(lien).toHaveAttribute("href", "/admin/tremplins/3/ateliers/10/sous-groupes/5");
    expect(lien).toHaveTextContent(/Autonome/);
  });

  /** Un groupe encore vide n'a qu'une chose à dire : ce qu'il reste à faire.
   * « Autonome · à faire » y serait du bruit, et son rang suffit à l'ouvrir. */
  it("un sous-groupe encore vide se désigne par son rang et dit « À composer »", async () => {
    await contexte([binome({ membres: [] })]);
    render(await RepartitionSousGroupes({ params: sgParams }));
    const lien = screen.getByRole("link", { name: /sous-groupe 1/i });
    expect(lien).toHaveTextContent(/À composer/);
    expect(lien).not.toHaveTextContent(/Autonome/);
  });

  it("CONSULTATION : un seul CTA (créer), aucun formulaire d'édition empilé", async () => {
    await contexte([binome()]);
    render(await RepartitionSousGroupes({ params: sgParams }));
    expect(screen.getByRole("button", { name: /ajouter un sous-groupe/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /enregistrer le sous-groupe/i })).toBeNull();
  });

  it("personne à répartir : on oriente, on ne réclame pas dans le vide", async () => {
    // Audience « sélection » encore vide : la cohorte est vide elle aussi.
    await contexte([], []);
    vi.mocked(getAteliersByEdition).mockResolvedValue([
      { ...(atelier as Record<string, unknown>), nature: "sous_groupes", audience: "selection" },
    ] as never);
    render(await RepartitionSousGroupes({ params: sgParams }));
    expect(screen.getByText(/personne à répartir/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /page participantes/i })).toHaveAttribute(
      "href",
      "/admin/tremplins/3/ateliers/10/presences",
    );
  });
});

describe("suppression d'un atelier — deux actions, pas plus", () => {
  const params2 = Promise.resolve({ edition: "3", atelier: "10" });
  const sansErreur = Promise.resolve({});

  const compte = async (counts: object) => {
    const { getAtelierDeletionCounts } = await import("@/lib/tremplin-ateliers");
    vi.mocked(getAtelierDeletionCounts).mockResolvedValue(counts as never);
  };
  const bouton = () => screen.getByRole("button", { name: /supprimer cet atelier/i });

  /**
   * Décision produit du 01/08 : un atelier n'est pas assez critique pour qu'on
   * fasse retaper son titre, et le geste tient en DEUX actions — ouvrir cette
   * page depuis la fiche, puis appuyer. La page ARME (elle ne fait que ça, et
   * elle chiffre ce qui va partir), le bouton CONFIRME. Pas de modale par
   * dessus : ce serait la troisième action.
   */
  it("un seul bouton, aucune modale, aucun titre à retaper", async () => {
    await compte({ nbParticipantes: 6, nbSousGroupes: 3, nbSupports: 1, nbCoachs: 2, total: 12 });
    render(await RetraitAtelier({ params: params2, searchParams: sansErreur }));
    await userEvent.click(bouton());
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.queryByLabelText(/réécris le titre/i)).toBeNull();
  });

  it("le bouton supprime pour de bon, avec l'atelier et son édition", async () => {
    await compte({ nbParticipantes: 0, nbSousGroupes: 0, nbSupports: 0, nbCoachs: 0, total: 0 });
    render(await RetraitAtelier({ params: params2, searchParams: sansErreur }));
    await userEvent.click(bouton());
    const { deleteAtelierAction } = await import("@/app/admin/tremplins/actions");
    expect(deleteAtelierAction).toHaveBeenCalledTimes(1);
    const envoye = vi.mocked(deleteAtelierAction).mock.calls[0][0] as FormData;
    expect(envoye.get("editionId")).toBe("3");
    expect(envoye.get("atelierId")).toBe("10");
  });

  it("atelier VIDE : la page dit qu'il part seul (le cas du doublon)", async () => {
    await compte({ nbParticipantes: 0, nbSousGroupes: 0, nbSupports: 0, nbCoachs: 0, total: 0 });
    render(await RetraitAtelier({ params: params2, searchParams: sansErreur }));
    expect(screen.getByText(/ne porte rien pour l'instant/i)).toBeInTheDocument();
  });

  it("atelier INVESTI : le périmètre reste CHIFFRÉ avant l'appui", async () => {
    // Le filet qui reste quand la saisie disparaît : on SAIT ce qui part.
    await compte({ nbParticipantes: 6, nbSousGroupes: 3, nbSupports: 1, nbCoachs: 2, total: 12 });
    render(await RetraitAtelier({ params: params2, searchParams: sansErreur }));
    expect(screen.getByText(/6 participantes et leurs présences/i)).toBeInTheDocument();
    expect(screen.getByText(/3 sous-groupes/i)).toBeInTheDocument();
    expect(screen.getByText(/1 support/i)).toBeInTheDocument();
    expect(screen.getByText(/le rattachement de 2 coachs/i)).toBeInTheDocument();
    // Ce qui RESTE est dit : personne ne quitte l'édition.
    expect(screen.getByText(/restent inscrites à l'édition/i)).toBeInTheDocument();
  });

  it("atelier qui ne porte QU'un coach : le périmètre le dit quand même", async () => {
    await compte({ nbParticipantes: 0, nbSousGroupes: 0, nbSupports: 0, nbCoachs: 1, total: 1 });
    render(await RetraitAtelier({ params: params2, searchParams: sansErreur }));
    expect(screen.queryByText(/ne porte rien pour l'instant/i)).toBeNull();
    expect(screen.getByText(/le rattachement de 1 coach/i)).toBeInTheDocument();
  });

  it("un refus serveur revient SUR cette page", async () => {
    await compte({ nbParticipantes: 0, nbSousGroupes: 0, nbSupports: 0, nbCoachs: 0, total: 0 });
    render(
      await RetraitAtelier({
        params: params2,
        searchParams: Promise.resolve({ err: "atelier" }),
      }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/atelier introuvable/i);
  });
});
