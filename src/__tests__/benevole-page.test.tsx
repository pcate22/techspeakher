import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";

import Benevole from "@/app/benevole/page";
import { missionsBenevoles } from "@/data/benevole";

/**
 * /BENEVOLE : le site cherchait des coachs et un jury sans page pour les
 * accueillir. Une page, un rôle (proposer son temps), une action : nous
 * écrire. Le coaching seul a des conditions, dites sur sa carte : une coach
 * trop peu expérimentée ne peut pas accompagner une speakeuse jusqu'à la scène.
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
    expect(coach).toHaveTextContent(/feedback constructif/);
    expect(coach).toHaveTextContent(/franchise bienveillante/);
  });

  it("la carte du jury dit l'expérience qu'il demande", () => {
    render(<Benevole />);
    const jury = carteMission("Faire partie du jury du Tremplin");
    expect(jury).toHaveTextContent(/Pour le jury, il faut une solide expérience de la scène/);
  });

  it("oriente celles qui ont moins de 10 talks vers l'organisation, la communication et la scène des meetups", () => {
    render(<Benevole />);
    const reconnaissez = screen.getByRole("region", { name: /Vous vous reconnaissez/ });
    expect(reconnaissez).toHaveTextContent(/moins de 10\stalks/);
    expect(reconnaissez).toHaveTextContent(/organisation ou la communication/);
    expect(reconnaissez).toHaveTextContent(/proposez un talk à nos meetups/);
    // Le jury demande de l'expérience, et le Tremplin vise les primo-speakeuses
    // avec des conditions propres à chaque édition : aucun des deux n'est une
    // porte de repli pour une candidate coach.
    expect(reconnaissez).not.toHaveTextContent(/jury/i);
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
