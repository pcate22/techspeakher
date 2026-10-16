import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/app/mon-espace/actions", () => ({
  addOccurrenceAction: vi.fn(),
  updateOccurrenceAction: vi.fn(),
}));

import OccurrenceForm from "@/app/mon-espace/OccurrenceForm";
import { makeOccurrence } from "./test-helpers";
import type { OccurrenceSuggestions } from "@/lib/talks";

/**
 * OÙ LA GÉOGRAPHIE D'UNE OCCURRENCE SE FABRIQUE — au moment de la saisie.
 *
 * Le socle est en base (migration 072) et un rattrapage a rempli l'existant,
 * mais tant que le formulaire poste une ville en TEXTE LIBRE, chaque nouvelle
 * date arrive sans code INSEE ni région : la facette « Occitanie » de l'agenda
 * (lot 1) vieillirait à l'envers, complète sur le passé et trouée sur ce qui
 * vient. Le champ passe donc sur la Base Adresse Nationale, comme la commune
 * d'une fiche.
 *
 * Trois faits à tenir, et le troisième est le moins évident :
 *   1. une commune reconnue REMPLIT le couple (code INSEE, région) ;
 *   2. une géographie déjà enregistrée est REPOSÉE telle quelle — le
 *      formulaire réécrit l'occurrence entière, donc ce qu'il ne repose pas,
 *      il l'efface ;
 *   3. changer la ville EMPORTE la géographie : garder l'ancienne rangerait
 *      Bruxelles en Occitanie, précisément le mensonge que le couple existe
 *      pour éviter.
 */

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const suggestions: OccurrenceSuggestions = {
  registre: [],
  villes: ["Bruxelles"],
  pays: ["France"],
};

const TOULOUSE = {
  nom: "Toulouse",
  codePostal: "31000",
  codeInsee: "31555",
  region: "Occitanie",
};

/** La BAN, jouée à l'identique du proxy `/api/communes` : muette hors France. */
function banRepond(communes: Record<string, (typeof TOULOUSE)[]>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const q = decodeURIComponent(new URL(url, "https://exemple.test").search)
        .replace("?q=", "")
        .trim();
      return {
        ok: true,
        json: async () => ({ communes: communes[q] ?? [] }),
      };
    }),
  );
}

const champCache = (name: string) =>
  document.querySelector<HTMLInputElement>(`input[name="${name}"]`);

describe("Ville d'une occurrence — la saisie capture la commune (BAN)", () => {
  it("une commune reconnue remplit le code INSEE et la région", async () => {
    banRepond({ Toulouse: [TOULOUSE] });
    const u = userEvent.setup();
    render(<OccurrenceForm talkId={5} suggestions={suggestions} />);

    await u.type(screen.getByLabelText("Ville"), "Toulouse");

    await waitFor(() => {
      expect(champCache("codeInsee")).toHaveValue("31555");
    });
    expect(champCache("region")).toHaveValue("Occitanie");
    // La région reconnue se dit à l'écran : sans retour, personne ne sait que
    // la saisie a été comprise.
    expect(screen.getByText("Région : Occitanie")).toBeInTheDocument();
  });

  it("la fiche parle « région de résidence », l'occurrence parle « région »", () => {
    banRepond({});
    render(<OccurrenceForm talkId={5} suggestions={suggestions} />);
    // Le champ que le serveur relit s'appelle `region` (cf. parseOccurrenceForm)
    // et il n'y a pas de code postal sur une occurrence : poster celui de la
    // fiche ferait une colonne fantôme.
    expect(champCache("region")).toBeTruthy();
    expect(champCache("regionResidence")).toBeNull();
    expect(champCache("codePostal")).toBeNull();
  });

  it("en modification, la géographie enregistrée est reposée telle quelle", () => {
    banRepond({});
    render(
      <OccurrenceForm
        talkId={5}
        suggestions={suggestions}
        initial={makeOccurrence({
          id: 9,
          ville: "Toulouse",
          codeInsee: "31555",
          region: "Occitanie",
        })}
      />,
    );
    // Sans réseau et sans une frappe : changer la date d'une intervention ne
    // doit pas effacer sa commune.
    expect(champCache("codeInsee")).toHaveValue("31555");
    expect(champCache("region")).toHaveValue("Occitanie");
  });

  it("changer pour une ville que la BAN ignore emporte la géographie", async () => {
    banRepond({ Toulouse: [TOULOUSE] });
    const u = userEvent.setup();
    render(
      <OccurrenceForm
        talkId={5}
        suggestions={suggestions}
        initial={makeOccurrence({
          id: 9,
          ville: "Toulouse",
          codeInsee: "31555",
          region: "Occitanie",
        })}
      />,
    );

    const ville = screen.getByLabelText("Ville");
    await u.clear(ville);
    await u.type(ville, "Bruxelles");

    await waitFor(() => {
      expect(champCache("codeInsee")).toHaveValue("");
    });
    expect(champCache("region")).toHaveValue("");
    // La saisie, elle, reste : hors de France on garde la ville en texte.
    expect(ville).toHaveValue("Bruxelles");
  });

  it("choisir une conférence du registre pré-remplit la ville ET sa géographie", async () => {
    banRepond({ Toulouse: [TOULOUSE] });
    const u = userEvent.setup();
    render(
      <OccurrenceForm
        talkId={5}
        suggestions={{
          ...suggestions,
          registre: [
            {
              id: 2,
              nom: "DevFest Toulouse",
              ville: "Toulouse",
              pays: "France",
              editions: [],
            },
          ],
        }}
      />,
    );

    await u.click(screen.getByRole("combobox", { name: /conférence/i }));
    await u.click(screen.getByRole("option", { name: /devfest toulouse/i }));

    expect(screen.getByLabelText("Ville")).toHaveValue("Toulouse");
    // Le pré-remplissage passe par le même chemin qu'une frappe : la ville
    // héritée du registre n'a pas à rester sans géographie.
    await waitFor(() => {
      expect(champCache("codeInsee")).toHaveValue("31555");
    });
  });
});
