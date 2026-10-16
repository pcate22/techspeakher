import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";

expect.extend(toHaveNoViolations);

/**
 * `/agenda/[annee]` — LE COMPTE RENDU D'UNE ANNÉE, et son entrée.
 *
 * La décision du 16/08 (§8 de `docs/audit-ux-agenda-2026-08.md`) donne deux
 * modèles d'URL qui ne disent pas la même chose : l'année SÉLECTIONNE un
 * document, ville / région / conférence FILTRENT à l'intérieur. Cette page doit
 * donc porter les mêmes facettes que l'horizon — et surtout : un filtre qui ne
 * ramène rien ne ferme PAS la page. Le document existe ; il n'a simplement rien
 * à Lyon cette année-là. Répondre 404 dirait « cette année n'existe pas », ce
 * qui est faux et inviterait les moteurs à désindexer une archive réelle.
 */

vi.mock("@/lib/agenda-public", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getScenesDeLAnnee: vi.fn(),
  getAnneesArchive: vi.fn(),
}));
vi.mock("@/lib/tremplin-statut", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  aujourdhuiParis: vi.fn(() => "2026-07-31"),
}));

import {
  getScenesDeLAnnee,
  getAnneesArchive,
  type ScenePublique,
} from "@/lib/agenda-public";
import AgendaAnnee from "@/app/agenda/[annee]/page";

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getScenesDeLAnnee).mockResolvedValue([]);
  vi.mocked(getAnneesArchive).mockResolvedValue([{ annee: 2025, nombre: 2 }]);
});

const scene = (o: Partial<ScenePublique> & { date: string }): ScenePublique => ({
  occurrenceId: 1,
  conference: "Capitole du Libre",
  conferenceCle: "capitole-du-libre",
  conferenceLibelle: "Capitole du Libre",
  ville: "Toulouse",
  region: "Occitanie",
  pays: "France",
  lienConf: null,
  talkTitre: "Observer sans se noyer",
  talkType: "Conférence",
  speakeuseNom: "Léa Dubois",
  speakeuseHref: "/speakeuses/lea-dubois",
  profileId: 5,
  image: null,
  ...o,
});

const deuxVilles = () => [
  scene({ occurrenceId: 1, date: "2025-11-15" }),
  scene({
    occurrenceId: 2,
    date: "2025-06-03",
    ville: "Paris",
    region: "Île-de-France",
    conference: "Devoxx France 2025",
    conferenceCle: "devoxx-france",
    conferenceLibelle: "Devoxx France",
    talkTitre: "Migrer sans réveiller personne",
  }),
];

/** Le rendu réel de la page : deux promesses, comme Next les passe. */
const rendreAnnee = async (annee: string, params: Record<string, string> = {}) =>
  render(
    await AgendaAnnee({
      params: Promise.resolve({ annee }),
      searchParams: Promise.resolve(params),
    }),
  );

describe("/agenda/[annee] — le compte rendu et ses filtres", () => {
  it("porte le compte de l'année dans une région vivante, sous la barre", async () => {
    vi.mocked(getScenesDeLAnnee).mockResolvedValue(deuxVilles());
    await rendreAnnee("2025");
    expect(screen.getByRole("status")).toHaveTextContent("2 interventions en 2025.");
    // Le compte ne vit qu'À UN endroit : le sous-titre le répétait, et le
    // second aurait menti dès le premier filtre.
    expect(screen.getAllByText(/2 interventions en 2025/)).toHaveLength(1);
  });

  it("les mêmes facettes que l'horizon, sur l'adresse de l'année", async () => {
    vi.mocked(getScenesDeLAnnee).mockResolvedValue(deuxVilles());
    const { container } = await rendreAnnee("2025");
    expect(container.querySelector("form")).toHaveAttribute("action", "/agenda/2025");
    expect(screen.getByRole("combobox", { name: "Ville" })).toBeInTheDocument();
  });

  it("un filtre filtre la liste et se dit dans le résumé", async () => {
    vi.mocked(getScenesDeLAnnee).mockResolvedValue(deuxVilles());
    await rendreAnnee("2025", { ville: "paris" });
    expect(screen.getByText(/Migrer sans réveiller personne/)).toBeInTheDocument();
    expect(screen.queryByText(/Observer sans se noyer/)).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(
      "1 intervention en 2025 à Paris ou en ligne.",
    );
  });

  it("un filtre à vide garde la page ouverte, il ne la ferme pas", async () => {
    // La garde de la décision : seule une année VIDE ferme (404). Un filtre qui
    // ne ramène rien est une vue du document, pas une adresse inexistante.
    vi.mocked(getScenesDeLAnnee).mockResolvedValue(deuxVilles());
    await rendreAnnee("2025", { ville: "lyon" });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("2025");
    // L'année reste dans la phrase, même à zéro : c'est le seul mot qui situe
    // la page, et son rôle entier est d'être le document citable d'une année.
    expect(screen.getByRole("status")).toHaveTextContent(
      "Aucune intervention en 2025 à Lyon ou en ligne.",
    );
    // Et la porte de sortie du filtre reste à portée.
    expect(screen.getByRole("link", { name: "Tout effacer" })).toHaveAttribute(
      "href",
      "/agenda/2025",
    );
  });

  it("une année sans la moindre intervention ferme la porte", async () => {
    await expect(rendreAnnee("2024")).rejects.toThrow();
  });

  it("aucune violation a11y sur une année filtrée (axe)", async () => {
    vi.mocked(getScenesDeLAnnee).mockResolvedValue(deuxVilles());
    const { container } = await rendreAnnee("2025", { ville: "paris" });
    expect(await axe(container)).toHaveNoViolations();
  });
});
