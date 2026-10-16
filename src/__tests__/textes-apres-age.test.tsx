import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("@/lib/profiles", () => ({ countPublishedProfiles: async () => 42 }));

import MentionsLegales from "@/app/mentions-legales/page";
import CodeDeConduite from "@/app/code-de-conduite/page";
import { codeDeConduite, VERSION_CODE_DE_CONDUITE } from "@/data/charte";
import { CONTACT_EMAIL } from "@/constants/site";

/**
 * LES TEXTES ADOPTÉS APRÈS L'AGE DU 29 SEPTEMBRE 2026.
 *
 * Le PV du collège (3e résolution) interdit d'ouvrir les adhésions avant que
 * les mentions légales soient à jour et le code de conduite publié. Ces tests
 * tiennent ce que ces deux pages doivent dire : une valeur fausse ici est une
 * mention légale fausse, pas une coquille.
 */

afterEach(cleanup);

describe("mentions légales — textes du 13 octobre 2026", () => {
  it("nomme la directrice de la publication, co-représentante légale", async () => {
    render(await MentionsLegales());
    expect(
      screen.getByText(/directrice de la publication est Cateline Puccetti,\s+co-représentante légale/i),
    ).toBeInTheDocument();
  });

  it("donne le numéro de la déléguée à la protection des données", async () => {
    render(await MentionsLegales());
    expect(screen.getByText(/DPO-176240 auprès de la CNIL/)).toBeInTheDocument();
  });

  it("dit comment exercer ses droits, avec l'adresse et le délai", async () => {
    render(await MentionsLegales());
    const droits = screen.getByText(/Pour exercer vos droits/);
    expect(droits).toHaveTextContent(/limitation, de portabilité et d.opposition/);
    expect(droits).toHaveTextContent(CONTACT_EMAIL);
    expect(droits).toHaveTextContent(/Nous répondons sous un mois/);
  });

  it("décrit le refus d'apparaître sur les images : case et badge", async () => {
    render(await MentionsLegales());
    const photos = screen.getByText(/Nous prenons des photos et des vidéos/);
    expect(photos).toHaveTextContent(/cocher\s+la case de refus/);
    expect(photos).toHaveTextContent(/badge/);
    expect(photos).toHaveTextContent(/sous trente jours/);
  });

  it("ne dépose aucun traceur non nécessaire sans consentement", async () => {
    render(await MentionsLegales());
    expect(
      screen.getByText("Nous ne déposons aucun traceur non nécessaire sans votre consentement."),
    ).toBeInTheDocument();
  });
});

describe("code de conduite — annexe 1 du RI", () => {
  it("affiche sa version et sa date d'adoption", () => {
    render(CodeDeConduite());
    expect(
      screen.getByText(new RegExp(`version\\s+${VERSION_CODE_DE_CONDUITE.numero} du ${VERSION_CODE_DE_CONDUITE.date}`)),
    ).toBeInTheDocument();
    expect(VERSION_CODE_DE_CONDUITE).toEqual({ numero: "1.0", date: "29 septembre 2026" });
  });

  it("rend chaque section du texte adopté, titre et contenu", () => {
    render(CodeDeConduite());
    for (const section of codeDeConduite) {
      const region = screen.getByRole("region", { name: section.titre });
      // textContent plutôt que getByText : le normaliseur de Testing Library
      // écrase les insécables, que le texte adopté porte.
      for (const texte of [...section.paragraphes, ...(section.liste ?? []), ...(section.apresListe ?? [])]) {
        expect(region.textContent).toContain(texte);
      }
    }
  });

  it("l'adresse de signalement est un lien mailto", () => {
    render(CodeDeConduite());
    const region = screen.getByRole("region", { name: /Un problème/ });
    expect(region.querySelector(`a[href="mailto:${CONTACT_EMAIL}"]`)).not.toBeNull();
  });

  it("garde les sept comportements non tolérés et les numéros d'urgence", () => {
    const regles = codeDeConduite.find((s) => s.id === "regles");
    expect(regles?.liste).toHaveLength(7);
    const probleme = codeDeConduite.find((s) => s.id === "probleme");
    const texte = probleme?.apresListe?.join(" ") ?? "";
    for (const numero of ["17", "112", "114", "3919"]) {
      expect(texte).toContain(numero);
    }
  });
});

describe("page Adhérer", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("@/constants/site");
  });

  async function chargerPage(url: string) {
    vi.resetModules();
    vi.doMock("@/constants/site", async (orig) => ({
      ...(await orig<typeof import("@/constants/site")>()),
      HELLOASSO_ADHESION_URL: url,
    }));
    return import("@/app/adherer/page");
  }

  it("masque le bouton et reste hors index tant que l'URL est vide", async () => {
    const { default: Adherer, metadata } = await chargerPage("");
    render(await Adherer());
    expect(screen.queryByRole("link", { name: /Adhérer sur HelloAsso/ })).toBeNull();
    expect(metadata.robots).toMatchObject({ index: false });
  });

  // Re-jugé le 2026-10-15 : la page devient une landing, l'action se répète
  // (règle « un CTA » = une seule ACTION, la même à chaque bouton).
  it("chaque bouton mène à la même campagne HelloAsso quand l'URL est renseignée", async () => {
    const url = "https://www.helloasso.com/associations/tech-speak-her/adhesions/adhesion";
    const { default: Adherer, metadata } = await chargerPage(url);
    render(await Adherer());
    const liens = screen.getAllByRole("link", { name: /Adhérer sur HelloAsso/ });
    expect(liens.length).toBeGreaterThanOrEqual(1);
    for (const l of liens) expect(l).toHaveAttribute("href", url);
    expect(metadata.robots ?? null).toBeNull();
  });

  it("mène les membres bienfaitrices au formulaire de soutien, sans second bouton", async () => {
    const { default: Adherer } = await chargerPage("");
    render(await Adherer());
    const lien = screen.getByRole("link", { name: /formulaire séparé/ });
    expect(lien.getAttribute("href")).toMatch(/soutien-membres-bienfaitrices/);
    expect(lien.getAttribute("href")).not.toMatch(/\/beta\//);
  });

  it("dit que l'adhésion n'ouvre pas le droit de vote et ne donne pas de reçu fiscal", async () => {
    const { default: Adherer } = await chargerPage("");
    render(await Adherer());
    expect(screen.getByText(/n.ouvre pas le droit de vote/)).toBeInTheDocument();
    expect(screen.getByText(/pas droit à un reçu fiscal/)).toBeInTheDocument();
    expect(document.body.textContent).toContain("10\u00A0€ par an");
  });
});
