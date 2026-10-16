import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * Lot C3c — sous-pages mono-fonction de la participante : chacune rend son
 * bloc (l'action existante reste branchée) et le retour au sommaire.
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
vi.mock("@/lib/tremplin-registrations", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getRegistrationsByEdition: vi.fn(),
}));
vi.mock("@/lib/tremplin-registration-phases", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getPhaseMembersByEdition: vi.fn(async () => new Map()),
}));
vi.mock("@/lib/tremplin-documents", () => ({ getDocumentsByEdition: vi.fn(async () => []) }));
vi.mock("@/lib/tremplin-coachs", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getCoachsByRegistration: vi.fn(async () => []),
}));
vi.mock("@/lib/tremplin-recompenses", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getRecompensesByRegistration: vi.fn(async () => []),
}));
vi.mock("@/lib/users", () => ({
  getComptesPlateforme: vi.fn(async () => []),
  getComptesSpeakeuses: vi.fn(async () => []),
  compteLabel: (u: { name?: string }) => u.name ?? "?",
}));
vi.mock("@/app/admin/tremplins/actions", () => ({
  setRegistrationVisibilityAction: vi.fn(),
  setRegistrationFinaleAction: vi.fn(),
  setRegistrationPhaseMembershipAction: vi.fn(),
  setRegistrationPhasePublicAction: vi.fn(),
  updateRegistrationDetailsAction: vi.fn(),
  deleteRegistrationAction: vi.fn(),
  deleteDocumentAction: vi.fn(),
  removeCoachAction: vi.fn(),
}));
vi.mock("@/app/admin/tremplins/[edition]/AddCoachDialog", () => ({
  default: () => <button type="button">Ajouter un coach</button>,
}));
vi.mock("@/app/admin/tremplins/[edition]/AddDocumentDialog", () => ({
  default: () => <button type="button">Ajouter un document privé</button>,
}));
vi.mock(
  "@/app/admin/tremplins/[edition]/participantes/[registration]/AttachForm",
  () => ({ default: () => <div data-testid="attach-form" /> }),
);

import { getEditionById } from "@/lib/tremplin-editions";
import { getRegistrationsByEdition } from "@/lib/tremplin-registrations";
import Visibilite from "@/app/admin/tremplins/[edition]/participantes/[registration]/visibilite/page";
import Classement from "@/app/admin/tremplins/[edition]/participantes/[registration]/classement/page";
import Parcours from "@/app/admin/tremplins/[edition]/participantes/[registration]/parcours/page";
import Recompenses from "@/app/admin/tremplins/[edition]/participantes/[registration]/recompenses/page";
import Coaching from "@/app/admin/tremplins/[edition]/participantes/[registration]/coaching/page";
import Compte from "@/app/admin/tremplins/[edition]/participantes/[registration]/compte/page";
import Documents from "@/app/admin/tremplins/[edition]/participantes/[registration]/documents/page";
import Retrait from "@/app/admin/tremplins/[edition]/participantes/[registration]/retrait/page";

afterEach(cleanup);

const params = Promise.resolve({ edition: "3", registration: "7" });
const edition = { id: 3, nom: "Tremplin 2026", statut: "en_cours" } as never;
const registration = {
  id: 7,
  editionId: 3,
  userId: null,
  userName: null,
  userEmail: null,
  participanteNom: "Ada Lovelace",
  participanteRole: null,
  participanteLinkedin: null,
  statut: "acceptee",
  talkTitre: null,
  finalePresente: false,
  public: false,
  classement: null,
  bio: null,
  siteWeb: null,
  photoUrl: null,
  phaseEntree: "cfp_et_pitch",
} as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getEditionById).mockResolvedValue(edition);
  vi.mocked(getRegistrationsByEdition).mockResolvedValue([registration]);
});

const retour = () => screen.getByRole("link", { name: /retour à la fiche/i });

describe("sous-pages participante — une page, une fonction", () => {
  it("chaque sous-page met le NOM en titre (sujet visible, pas noyé dans le gris)", async () => {
    for (const Page of [Visibilite, Classement, Parcours, Recompenses, Coaching, Compte, Documents, Retrait]) {
      const { unmount } = render(await Page({ params }));
      expect(
        screen.getByRole("heading", { level: 1, name: /ada lovelace/i }),
      ).toBeInTheDocument();
      unmount();
    }
  });

  it("le titre embarque la fonction : titres distincts par sous-page (RGAA 9.1)", async () => {
    // Le h1 visible montre le nom, mais son libellé accessible inclut la
    // fonction → la navigation par titres reste discriminante.
    render(await Compte({ params }));
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /compte sur la plateforme.*ada lovelace/i,
      }),
    ).toBeInTheDocument();
    cleanup();
    render(await Recompenses({ params }));
    expect(
      screen.getByRole("heading", { level: 1, name: /récompenses.*ada lovelace/i }),
    ).toBeInTheDocument();
  });
  it("visibilité : bascule seule (un CTA), SANS podium ni bio/site/photo", async () => {
    render(await Visibilite({ params }));
    expect(
      screen.getByRole("button", { name: /rendre visible du public/i }),
    ).toBeInTheDocument();
    // Un seul CTA principal : le podium vit sur sa propre sous-page, la
    // bio/site/photo restent gérés par la speakeuse sur sa fiche.
    expect(screen.queryByLabelText(/classement au podium/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /enregistrer le classement/i })).toBeNull();
    expect(screen.queryByLabelText(/biographie/i)).toBeNull();
    expect(screen.getByText(/viennent\s+de sa fiche speakeuse/i)).toBeInTheDocument();
    expect(retour()).toHaveAttribute("href", "/admin/tremplins/3/participantes/7");
  });

  it("classement : le podium, seul CTA de sa sous-page", async () => {
    render(await Classement({ params }));
    expect(screen.getByLabelText(/classement au podium \(optionnel/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /enregistrer le classement/i }),
    ).toBeInTheDocument();
    // Pas de bascule de visibilité ici : chaque page porte un seul rôle.
    expect(screen.queryByRole("button", { name: /rendre visible du public/i })).toBeNull();
    expect(retour()).toHaveAttribute("href", "/admin/tremplins/3/participantes/7");
  });

  it("parcours : les trois phases", async () => {
    render(await Parcours({ params }));
    expect(screen.getByText(/phase 1 · préparation au cfp/i)).toBeInTheDocument();
    expect(screen.getByText(/phase 3 · préparation à la conférence/i)).toBeInTheDocument();
  });

  it("récompenses : état vide avec renvoi vers la page de l'édition", async () => {
    render(await Recompenses({ params }));
    expect(screen.getByText(/aucune récompense pour l'instant/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /récompenses de l'édition/i }),
    ).toHaveAttribute("href", "/admin/tremplins/3/recompenses");
  });

  it("coaching : état vide + bouton d'ajout", async () => {
    render(await Coaching({ params }));
    expect(screen.getByText(/aucun coach individuel/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ajouter un coach/i })).toBeInTheDocument();
  });

  it("compte : sans compte relié → formulaire de rattachement", async () => {
    render(await Compte({ params }));
    expect(screen.getByTestId("attach-form")).toBeInTheDocument();
  });

  it("documents : état vide + bouton d'ajout", async () => {
    render(await Documents({ params }));
    expect(screen.getByText(/aucun document pour l'instant/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /ajouter un document privé/i }),
    ).toBeInTheDocument();
  });

  it("retrait : zone danger, palier 3 (le nom est à retaper)", async () => {
    const u = userEvent.setup();
    render(await Retrait({ params, searchParams: Promise.resolve({}) }));
    const declencheur = screen.getByRole("button", {
      name: /retirer ada lovelace de l'édition/i,
    });
    expect(declencheur).toBeInTheDocument();
    // Le retrait emporte les données d'une AUTRE personne : un clic ne suffit pas.
    await u.click(declencheur);
    expect(screen.getByLabelText(/réécris le nom de la participante/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /retirer définitivement/i }),
    ).toHaveAttribute("aria-disabled", "true");
  });

  // Le refus du serveur doit se VOIR : sinon la modale se referme, la page se
  // recharge à l'identique et on croit le bouton cassé.
  it("retrait : le refus serveur s'affiche en alerte", async () => {
    render(
      await Retrait({ params, searchParams: Promise.resolve({ err: "participante_nom" }) }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/réécris le nom de la participante/i);
  });
});
