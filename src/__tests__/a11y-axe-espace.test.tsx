import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";

/**
 * Scan a11y (axe) des surfaces CONNECTÉES (espace speakeuse), en jsdom : les
 * pages authentifiées ne sont pas atteignables par la gate RGAA E2E (pas de
 * base ni de session en CI), mais leurs composants se scannent ici. Complète
 * `a11y-axe.test.tsx` (pages publiques) et la gate E2E.
 *
 * On isole les Server Actions (Auth.js / BDD) par des mocks : on ne teste que
 * l'accessibilité du rendu, pas l'action. Le contraste n'est pas évalué sous
 * jsdom (couvert par `contrast.test.ts` + la gate E2E).
 */

vi.mock("@/app/mon-espace/talks/importer/actions", () => ({
  previewImportAction: vi.fn(),
  confirmImportAction: vi.fn(),
}));
vi.mock("@/app/mon-espace/actions", () => ({
  saveProfile: vi.fn(),
  reprendrePhotoLinkedInAction: vi.fn(),
  reconnecterLinkedInAction: vi.fn(),
  addTalkAction: vi.fn(),
  updateTalkAction: vi.fn(),
  deleteTalkAction: vi.fn(),
  addOccurrenceAction: vi.fn(),
  updateOccurrenceAction: vi.fn(),
  submitProfileAction: vi.fn(),
  withdrawProfileAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
}));
vi.mock("next-auth/react", () => ({
  signOut: vi.fn(),
  useSession: () => ({
    data: {
      user: {
        id: "1",
        name: "Cateline Puccetti",
        email: "cateline@example.com",
        image: null,
        isOrga: true,
        isCoach: false,
      },
    },
    status: "authenticated",
  }),
}));

import ProfileForm from "@/app/mon-espace/ProfileForm";
import TalkForm from "@/app/mon-espace/TalkForm";
import OccurrenceForm from "@/app/mon-espace/OccurrenceForm";
import TalksManager from "@/app/mon-espace/TalksManager";
import ImportTalksForm from "@/app/mon-espace/talks/importer/ImportTalksForm";
import AccountMenu from "@/components/AccountMenu";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import FeuilleCreer from "@/components/FeuilleCreer";
import type { Talk, OccurrenceSuggestions } from "@/lib/talks";
import { makeProfile, makeOccurrence } from "./test-helpers";

expect.extend(toHaveNoViolations);
afterEach(cleanup);

function renderPage(node: React.ReactNode): HTMLElement {
  const { container } = render(
    <main>
      <h1>Mon espace</h1>
      {node}
    </main>,
  );
  return container;
}

const suggestions: OccurrenceSuggestions = {
  registre: [
    {
      id: 1,
      nom: "DevFest Toulouse",
      ville: "Toulouse",
      pays: "France",
      editions: [
        {
          editionId: 42,
          conferenceId: 1,
          libelle: "DevFest Toulouse 2026",
          ville: "Toulouse",
          pays: "France",
          url: "https://devfest.example",
          dateDebut: null,
          dateFin: null,
        },
      ],
    },
  ],
  villes: ["Toulouse"],
  pays: ["France"],
};

const talks: Talk[] = [
  {
    id: 1,
    profileId: 2,
    titre: "Mon talk DevFest",
    type: "Conférence",
    description: "Un retour d'expérience.",
    occurrences: [
      makeOccurrence({
        id: 11,
        conferenceId: 1,
        conferenceSlug: "devfest-toulouse",
        editionId: 42,
        conference: "DevFest Toulouse 2026",
        lienConf: "https://conf.example",
      }),
    ],
  },
];

const user = {
  name: "Cateline Puccetti",
  email: "cateline@example.com",
  image: null,
};

describe("a11y (axe) — surfaces connectées de l'espace", () => {
  it("ProfileForm (création, profil vide)", async () => {
    expect(
      await axe(renderPage(<ProfileForm initial={null} />)),
    ).toHaveNoViolations();
  });

  it("ProfileForm (édition, profil existant)", async () => {
    expect(
      await axe(
        renderPage(<ProfileForm initial={makeProfile()} nom="Marie Curie" />),
      ),
    ).toHaveNoViolations();
  });

  it("TalkForm (identité du talk)", async () => {
    expect(await axe(renderPage(<TalkForm />))).toHaveNoViolations();
  });

  it("OccurrenceForm (rattacher une conférence à un talk)", async () => {
    expect(
      await axe(
        renderPage(<OccurrenceForm talkId={1} suggestions={suggestions} />),
      ),
    ).toHaveNoViolations();
  });

  /**
   * L'état « ma conférence manque dans la liste » (migration 068) est une
   * BRANCHE D'INTERFACE À PART : un champ requis apparaît, et un encart
   * l'explique. Auditer seulement l'état fermé laissait cette moitié du
   * formulaire hors de portée d'axe — exactement le trou qui a laissé passer le
   * renvoi cassé signalé par Aurélie.
   */
  it("OccurrenceForm (conférence hors registre : le champ nom est ouvert)", async () => {
    const u = userEvent.setup();
    const container = renderPage(
      <OccurrenceForm talkId={1} suggestions={suggestions} />,
    );
    // La liste OUVERTE passe aussi sous axe (combobox déployé), puis la
    // branche « hors registre » : champ nom + encart d'explication.
    await u.click(screen.getByRole("combobox", { name: /^conférence/i }));
    expect(await axe(container)).toHaveNoViolations();
    await u.click(screen.getByRole("option", { name: /ma conférence manque/i }));
    expect(screen.getByLabelText(/nom de la conférence/i)).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("OccurrenceForm (saisie écartée par l'équipe : l'explication est annoncée)", async () => {
    expect(
      await axe(
        renderPage(
          <OccurrenceForm
            talkId={1}
            suggestions={suggestions}
            initial={makeOccurrence({
              id: 9,
              conferenceId: null,
              conferenceSlug: null,
              editionId: null,
              conference: "Conf Bidon",
              ville: null,
              pays: null,
              date: null,
              lienConf: null,
              lienSlides: null,
              lienVideo: null,
              lienFeedback: null,
              propositionId: 4,
              etat: "ecartee",
            })}
          />,
        ),
      ),
    ).toHaveNoViolations();
  });

  it("ImportTalksForm (temps 1 : coller ou téléverser)", async () => {
    expect(await axe(renderPage(<ImportTalksForm />))).toHaveNoViolations();
  });

  it("TalksManager (liste de talks)", async () => {
    expect(
      await axe(renderPage(<TalksManager talks={talks} />)),
    ).toHaveNoViolations();
  });

  it("TalksManager (aucun talk)", async () => {
    expect(
      await axe(renderPage(<TalksManager talks={[]} />)),
    ).toHaveNoViolations();
  });

  it("AccountMenu (identique pour tous les rôles, lot N1)", async () => {
    expect(
      await axe(renderPage(<AccountMenu user={user} />)),
    ).toHaveNoViolations();
  });

  it("Header connecté, burger ouvert (le site, rien que le site — lot N1)", async () => {
    const u = userEvent.setup();
    const { container } = render(<Header />);
    await u.click(screen.getByRole("button", { name: /ouvrir le menu/i }));
    expect(await axe(container)).toHaveNoViolations();
  });

  it("BottomNav canonique (lot N1)", async () => {
    expect(
      await axe(
        renderPage(
          <BottomNav
            nom="Cateline Puccetti"
            image={null}
            feuille={{ talks: [], creation: "talk", orga: false, editions: [] }}
          />,
        ),
      ),
    ).toHaveNoViolations();
  });

  it("Feuille ➕ ouverte (orga, toutes entrées)", async () => {
    // jsdom n'implémente pas showModal : le composant retombe sur `open`.
    const u = userEvent.setup();
    const { container } = render(
      <FeuilleCreer
        donnees={{
          talks: [], creation: "talk",
          orga: true,
          editions: [{ id: 5, nom: "TSH 2026" }],
        }}
      />,
    );
    await u.click(screen.getByRole("button", { name: /créer/i }));
    expect(await axe(container)).toHaveNoViolations();
  });
});
