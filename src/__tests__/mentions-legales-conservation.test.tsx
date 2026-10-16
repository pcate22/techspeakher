import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import MentionsLegales from "@/app/mentions-legales/page";
import {
  DUREE_INACTIVITE_JOURS,
  PREAVIS_SUPPRESSION_JOURS,
  dureeEnAns,
} from "@/lib/conservation-comptes";

/**
 * LA DURÉE PUBLIÉE EST CELLE DU CODE.
 *
 * L'art. 13-2-a impose d'annoncer la durée de conservation ; l'art. 5-2, de
 * pouvoir démontrer qu'on applique ce qu'on annonce. Deux textes — la notice
 * d'un côté, les constantes du cron de l'autre — auraient dérivé au premier
 * changement, et c'est la notice publiée qui serait devenue fausse.
 *
 * Ce test lit les MÊMES constantes que la page : il ne vérifie pas un texte
 * figé, il vérifie que le texte suit le code.
 */

afterEach(cleanup);

describe("mentions légales — conservation des comptes", () => {
  it("annonce la durée d'inactivité, en années", async () => {
    render(await MentionsLegales());
    expect(
      screen.getByText(dureeEnAns(DUREE_INACTIVITE_JOURS), { exact: false }),
    ).toBeInTheDocument();
  });

  it("annonce le préavis et le moyen de l'annuler", async () => {
    render(await MentionsLegales());
    const section = screen.getByText(/annonce la suppression/i);
    expect(section).toHaveTextContent(`${PREAVIS_SUPPRESSION_JOURS} jours`);
    // Sans cette phrase, la notice décrirait un couperet sans la porte de
    // sortie que le produit offre pourtant.
    expect(section).toHaveTextContent(/une simple\s+connexion pendant ce préavis annule tout/i);
  });

  it("annonce la conservation MAXIMALE, préavis compris", async () => {
    // « au plus 2 ans » puis « effacé 30 jours plus tard » se contredisaient :
    // le maximum réel est la somme. Dériver le texte des constantes ne sert à
    // rien si le texte se contredit lui-même (mesuré en revue).
    render(await MentionsLegales());
    const total = DUREE_INACTIVITE_JOURS + PREAVIS_SUPPRESSION_JOURS;
    expect(
      screen.getByText(new RegExp(`conservation maximale[^]{0,40}${total} jours`, "i")),
    ).toBeInTheDocument();
  });

  it("dit que la suppression automatique efface autant qu'une suppression demandée", async () => {
    render(await MentionsLegales());
    expect(
      screen.getByText(/qu'elle soit demandée ou qu'elle vienne de\s+ce délai/i),
    ).toBeInTheDocument();
  });

  it("ANNONCE la donnée qui rend la règle applicable", async () => {
    // L'art. 13-1-c impose de dire ce qu'on collecte et pourquoi. Mesurer
    // l'inactivité a demandé une donnée NOUVELLE (`users.last_seen_at`, la date
    // du dernier passage) : publier la durée sans annoncer la mesure qui la
    // déclenche, c'est appliquer une règle sur une donnée tue.
    render(await MentionsLegales());
    const phrase = screen.getByText(/dernier passage/i).closest("p");
    expect(phrase).toHaveTextContent(/à la semaine près/i);
    expect(phrase).toHaveTextContent(/conservation/i);
  });

  it("dit que l'annonce de suppression part, elle aussi, par e-mail", async () => {
    render(await MentionsLegales());
    expect(screen.getByText(/annonce de suppression/i)).toBeInTheDocument();
  });

  it("cesse de ranger le rappel de fiche parmi les e-mails qui ne se règlent pas", async () => {
    // La liste des e-mails « de service » (donc non réglables) énumérait le
    // rappel de mise à jour, qui se règle depuis la PR #316. Une notice qui
    // décrit un réglage comme inexistant vaut moins que pas de notice.
    render(await MentionsLegales());
    const lettre = screen.getByText(/Se désinscrire de la lettre/i);
    // L'énumération des e-mails de service s'arrête au message reçu…
    expect(lettre).toHaveTextContent(/message reçu\)/);
    // … et le réglage de fréquence est nommé juste à côté.
    expect(lettre).toHaveTextContent(/fréquence/i);
  });

  it("cesse de promettre une conservation « tant que la fiche est active »", async () => {
    // L'ancien texte était un critère, pas une durée — et il devient faux dès
    // qu'on supprime pour inactivité.
    render(await MentionsLegales());
    expect(screen.queryByText(/tant que la fiche est active/i)).toBeNull();
  });
});
