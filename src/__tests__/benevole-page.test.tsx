import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";

import Benevole from "@/app/benevole/page";
import { missionsBenevoles } from "@/data/benevole";

/**
 * /BENEVOLE : une page, un rôle (proposer son temps), une action (nous
 * écrire). Le coaching et le jury disent leurs conditions sur leur carte ; la
 * section « Vous vous reconnaissez ? » oriente celles qui ont moins de 10 talks
 * vers ce qui leur est ouvert.
 */

afterEach(cleanup);

/** La carte d'une mission, retrouvée par son titre. */
function carteMission(titre: string): HTMLElement {
  const missions = screen.getByRole("region", { name: /Ce que vous pouvez faire/ });
  const carte = within(missions).getByRole("heading", { name: titre }).closest("li");
  if (!carte) throw new Error(`Carte introuvable : ${titre}`);
  return carte;
}

describe("/benevole", () => {
  it("le titre principal dit à qui la page parle", () => {
    render(<Benevole />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/bénévole/i);
  });

  it("chaque mission a son titre", () => {
    render(<Benevole />);
    const missions = screen.getByRole("region", { name: /Ce que vous pouvez faire/ });
    for (const m of missionsBenevoles) {
      expect(within(missions).getByRole("heading", { name: m.titre })).toBeInTheDocument();
    }
  });

  it("la carte du coaching dit ses conditions : l'expérience de la scène et le feedback", () => {
    render(<Benevole />);
    const coach = carteMission("Coacher une speakeuse");
    expect(coach).toHaveTextContent(/au moins 10\stalks/);
    expect(coach).toHaveTextContent(/meetups et conférences/);
    expect(coach).toHaveTextContent(/l'international est un plus/);
    expect(coach).toHaveTextContent(/feedback constructif/);
    expect(coach).toHaveTextContent(/franchise bienveillante/);
  });

  it("la carte du jury dit l'expérience qu'il demande", () => {
    render(<Benevole />);
    const jury = carteMission("Faire partie du jury du Tremplin");
    expect(jury).toHaveTextContent(/Pour le jury, il faut une solide expérience de la scène/);
  });

  it("la question du coaching reprend le seuil de sa carte", () => {
    render(<Benevole />);
    const reconnaissez = screen.getByRole("region", { name: /Vous vous reconnaissez/ });
    expect(reconnaissez).toHaveTextContent(
      /au moins 10\stalks et vous savez faire un feedback franc et constructif/,
    );
  });

  it("oriente celles qui ont moins de 10 talks vers l'organisation, la communication et la scène des meetups", () => {
    render(<Benevole />);
    const reconnaissez = screen.getByRole("region", { name: /Vous vous reconnaissez/ });
    expect(reconnaissez).toHaveTextContent(/moins de 10\stalks/);
    expect(reconnaissez).toHaveTextContent(/organisation ou la communication/);
    expect(reconnaissez).toHaveTextContent(/proposez un talk à nos meetups/);
    // Le jury et le coaching demandent de l'expérience, et le Tremplin vise
    // les primo-speakeuses avec des conditions propres à chaque édition :
    // aucun n'est une porte de repli. « jur » attrape aussi juré et jurée.
    expect(reconnaissez).not.toHaveTextContent(/jur(y|é)/i);
    expect(reconnaissez).not.toHaveTextContent(/coach/i);
    expect(reconnaissez).not.toHaveTextContent(/Tremplin/i);
  });

  it("l'appel demande, pour le coaching, quelques talks déjà donnés", () => {
    render(<Benevole />);
    const appel = screen.getByRole("region", { name: /Proposer votre aide/ });
    expect(appel).toHaveTextContent(/Pour le coaching, citez quelques talks/);
  });

  it("une seule action, répétée : nous écrire", () => {
    render(<Benevole />);
    const ctas = screen.getAllByRole("link", { name: /Proposer mon aide/ });
    expect(ctas.length).toBeGreaterThanOrEqual(2);
    for (const l of ctas) expect(l).toHaveAttribute("href", "/contact");
  });

  it("dit que l'adhésion est gratuite pour les bénévoles d'un programme", () => {
    render(<Benevole />);
    expect(document.body.textContent).toMatch(/adhésion est gratuite/i);
  });
});
