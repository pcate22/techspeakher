import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import TremplinEspace from "@/app/mon-espace/tremplin/[edition]/TremplinEspace";
import type { Edition } from "@/lib/tremplin-editions";
import type { Atelier } from "@/lib/tremplin-ateliers";
import type { TremplinDocument } from "@/lib/tremplin-documents";

afterEach(cleanup);

const edition: Edition = {
  id: 1,
  nom: "Tremplin 2026",
  annee: 2026,
  confSlug: "devfest-toulouse",
  statut: "archive",
  description: null,
  confNom: "DevFest",
  confLieu: "Toulouse",
  confDate: "2026-11-19",
  confLien: null,
  finaleDate: "2026-06-04",
  finaleLieu: "BPCE Solutions informatiques, Toulouse",
  inscriptionsDebut: null,
  inscriptionsFin: null,
  conferenceEditionId: null,
  deletedAt: null,
};

const ateliers: Atelier[] = [
  {
    id: 10,
    editionId: 1,
    ordre: 1,
    titre: "Atelier 1 : trouver son sujet",
    date: "2026-04-28",
    dateFin: null,
    auProgrammePublic: true,
    heureDebut: "12:45",
    heureFin: "13:45",
    description: null,
    lieu: null,
    lienVisio: null,
    coachs: null,
    phase: "cfp_et_pitch",
    nature: "collectif",
    audience: "toutes" as const,
  },
];

const sharedDocs: TremplinDocument[] = [
  {
    id: 100,
    editionId: 1,
    atelierId: 10,
    registrationId: null,
    auteurId: null,
    type: "support_atelier",
    titre: "Slides atelier 1",
    lien: "https://docs.google.com/document/d/abc",
    contenu: null,
  },
];

const myDocs: TremplinDocument[] = [
  {
    id: 200,
    editionId: 1,
    atelierId: null,
    registrationId: 5,
    auteurId: null,
    type: "feedback_jury",
    titre: "Retour du jury",
    lien: "https://docs.google.com/document/d/feedback-prive",
    contenu: null,
  },
];

function renderEspace(over: Partial<Parameters<typeof TremplinEspace>[0]> = {}) {
  return render(
    <TremplinEspace
      edition={edition}
      ateliers={ateliers}
      sharedDocs={sharedDocs}
      myDocs={myDocs}
      access="registered"
      {...over}
    />,
  );
}

describe("TremplinEspace", () => {
  it("affiche l'édition et son programme (une rangée par séance)", () => {
    renderEspace();
    expect(screen.getByRole("heading", { name: "Tremplin 2026" })).toBeInTheDocument();
    expect(screen.getByText("Atelier 1 : trouver son sujet")).toBeInTheDocument();
  });

  it("chaque séance mène à SA page (une carte mène à une page, pas à une ancre)", () => {
    renderEspace();
    expect(
      screen.getByRole("link", { name: /atelier 1 : trouver son sujet/i }),
    ).toHaveAttribute("href", "/mon-espace/tremplin/1/ateliers/10");
  });

  it("affiche la date d'atelier formatée, jamais l'ISO brut", () => {
    renderEspace();
    // Abrégé à l'œil dans la colonne de droite, forme complète pour l'audio
    // (le nom accessible de la rangée) ; surtout PAS la chaîne ISO brute.
    expect(screen.getByText(/28 avr\./)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /28 avril 2026/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText("2026-04-28")).toBeNull();
  });

  /**
   * Le SUPPORT d'un atelier ne s'affiche plus dans la liste : il vit sur la
   * page de la séance (une carte mène à une page). La liste dit COMBIEN il y
   * en a — assez pour décider d'ouvrir, sans empiler les liens.
   */
  it("la liste annonce les supports d'une séance, sans les dérouler", () => {
    renderEspace();
    expect(screen.queryByRole("link", { name: /Slides atelier 1/ })).toBeNull();
    expect(screen.getByText(/1 support/)).toBeInTheDocument();
  });

  it("affiche le retour jury privé dans « Mes documents »", () => {
    renderEspace();
    const section = screen.getByLabelText("Mes documents", { selector: "section" });
    expect(
      within(section).getByRole("link", { name: /Retour du jury/ }),
    ).toHaveAttribute("href", "https://docs.google.com/document/d/feedback-prive");
  });

  it("rend le contenu texte d'un document échappé (pas de HTML brut)", () => {
    renderEspace({
      myDocs: [
        {
          ...myDocs[0],
          lien: null,
          contenu: "<script>alert(1)</script> Bravo !",
        },
      ],
    });
    // Le texte est rendu littéralement (React échappe) ; aucun <script> exécutable.
    expect(screen.getByText(/<script>alert\(1\)<\/script> Bravo !/)).toBeInTheDocument();
    expect(document.querySelector("script")).toBeNull();
  });

  it("non rattachée (guest) : message d'aide, pas de documents privés", () => {
    renderEspace({ access: "guest", myDocs: [] });
    expect(screen.getByText(/n'est pas encore rattaché/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Retour du jury/ })).toBeNull();
  });

  it("aperçu orga : message neutre, pas le texte participante « non rattaché »", () => {
    renderEspace({ access: "orga-preview", myDocs: [] });
    expect(screen.getByText(/Aperçu pour une organisatrice/i)).toBeInTheDocument();
    expect(screen.queryByText(/n'est pas encore rattaché/i)).toBeNull();
  });
});
