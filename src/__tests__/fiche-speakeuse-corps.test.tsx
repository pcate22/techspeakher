import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";

expect.extend(toHaveNoViolations);

import FicheSpeakeuseCorps from "@/components/FicheSpeakeuseCorps";
import type { SpeakerProfile } from "@/lib/profiles";
import { makeFiche } from "./test-helpers";

/**
 * LE CONTRAT DE LA VUE PUBLIQUE du corps de fiche partagé.
 *
 * Ce fichier existe parce que son absence a coûté cher : le corps de la fiche a
 * été extrait de la page publique vers un composant partagé avec « Ma fiche »,
 * et rien ne rendait la vue publique. Trois défauts sont passés — la section
 * contact a perdu son `aria-labelledby`, une marge est apparue, et un bouton
 * « Envoyer un message » s'est retrouvé côté propriétaire. La CI était verte.
 *
 * Ce que ce fichier verrouille, et que personne d'autre ne vérifie : ce qui ne
 * doit JAMAIS sortir vers l'annuaire indexé, et ce qui doit y rester.
 */

afterEach(cleanup);

const fiche = makeFiche;

const publique = (o: Partial<SpeakerProfile> = {}) =>
  render(<FicheSpeakeuseCorps vue="publique" profile={fiche(o)} talks={[]} />);

describe("Corps de fiche — vue PUBLIQUE", () => {
  it("le nom est le titre de la page, et les groupes de chips sont étiquetés", async () => {
    publique();
    expect(screen.getByRole("heading", { level: 1, name: /léa dubois/i })).toBeInTheDocument();
    // Sans étiquette, ce sont des pastilles colorées anonymes.
    expect(screen.getByText("Secteurs")).toBeInTheDocument();
    expect(screen.getByText("Sujets")).toBeInTheDocument();
    expect(screen.getByText("Intervient")).toBeInTheDocument();
    expect(screen.getByText("Langues")).toBeInTheDocument();
  });

  it("une fiche au nom blanc titre sur le repli calculé au bord, jamais sur du vide", () => {
    // `name ?? …` laissait passer "   " : le <h1> de la fiche publique était
    // blanc pour la cohorte migrée sans nom (dette P1).
    publique({ name: "   " });
    expect(
      screen.getByRole("heading", { level: 1, name: "Développeuse plateforme" }),
    ).toBeInTheDocument();
    // Le repli EST le titre du profil : la ligne titre sous le h1 le
    // répéterait mot pour mot (4e passe du 2026-08-22) — une seule occurrence.
    expect(screen.getAllByText("Développeuse plateforme")).toHaveLength(1);
    // Et « Contacter {prenom} » ne découpe pas un titre en faux prénom
    // (« Contacter Développeuse ») : même repli que la page de contact.
    expect(
      screen.getByRole("heading", { name: "Contacter cette speakeuse" }),
    ).toBeInTheDocument();
  });

  it("avec un vrai nom, le titre du profil reste en sous-ligne et le prénom porte le contact", () => {
    publique();
    expect(screen.getByText("Développeuse plateforme")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Contacter Léa" })).toBeInTheDocument();
  });

  /** Le cœur du contrat : aucune affordance ni donnée d'édition ne franchit la
   * frontière. Une visiteuse anonyme lit cette page. */
  it("aucun lien d'édition, aucune trace de l'espace personnel", () => {
    const { container } = publique();
    expect(screen.queryByText(/modifier/i)).toBeNull();
    expect(screen.queryByText(/^ajouter$/i)).toBeNull();
    expect(container.querySelector('a[href^="/mon-espace"]')).toBeNull();
  });

  /** L'attestation d'appartenance à la communauté est une donnée personnelle
   * sensible : elle ne sort jamais, même en creux. */
  it("aucune mention de l'attestation, signée ou pas", () => {
    for (const isWoman of [true, false]) {
      publique({ isWoman });
      expect(screen.queryByText(/attestation/i), `isWoman=${isWoman}`).toBeNull();
      expect(screen.queryByText(/visible par toi seule/i)).toBeNull();
      cleanup();
    }
  });

  /** Une partie vide ne rend RIEN : l'annuaire ne montre pas des trous, et les
   * phrases « Aucun … choisi » sont écrites pour elle, pas pour le public. */
  it("une partie vide est absente, sans phrase de repli", () => {
    publique({ secteurs: [], sujets: [], regions: [], langues: [], linkedin: null });
    expect(screen.queryByText(/aucun secteur choisi/i)).toBeNull();
    expect(screen.queryByText(/aucune zone ni langue/i)).toBeNull();
    expect(screen.queryByText("Secteurs")).toBeNull();
  });

  it("la section contact garde son nom accessible (convention du projet)", () => {
    const { container } = publique();
    const section = container.querySelector('section[aria-labelledby="fiche-contact"]');
    expect(section).not.toBeNull();
    expect(container.querySelector("#fiche-contact")).toHaveTextContent(/contacter léa/i);
  });

  /** Le relais e-mail est le seul moyen d'écrire, et seulement sur une fiche
   * PUBLIÉE dont la speakeuse a ouvert le canal. */
  it("le relais e-mail suit le statut ET le consentement", () => {
    publique();
    expect(screen.getByRole("link", { name: /envoyer un message/i })).toHaveAttribute(
      "href",
      "/speakeuses/lea-dubois/contact",
    );
    cleanup();

    for (const o of [{ status: "en_attente" as const }, { contactEmailOk: false }]) {
      publique(o);
      expect(screen.queryByRole("link", { name: /envoyer un message/i }), JSON.stringify(o)).toBeNull();
      cleanup();
    }
  });

  /**
   * Une fiche NON publiée dont la speakeuse a ouvert le relais, et sans aucun
   * lien : il n'y a rien à montrer. Le prédicat du registre ne regarde que le
   * consentement, pas le statut — sans ce garde, on rendait un cadre bordé, titré
   * « Contacter Léa », et parfaitement vide.
   */
  it("aucun cadre de contact creux sur une fiche non publiée", () => {
    for (const status of ["en_attente", "brouillon", "refuse", "masque"] as const) {
      const { container } = publique({ status, linkedin: null, website: null, instagram: null });
      expect(screen.queryByText(/contacter léa/i), status).toBeNull();
      expect(container.querySelector('section[aria-labelledby="fiche-contact"]'), status).toBeNull();
      cleanup();
    }
  });

  /** L'ordre de lecture d'une page indexée : l'identité, puis la bio, puis
   * l'expertise. Il a changé avec l'extraction (la bio est remontée sous le
   * portrait, avec la ville) — c'est assumé, donc c'est verrouillé. */
  it("l'ordre de lecture : identité, ville, bio, puis expertise", () => {
    const { container } = publique();
    const texte = container.textContent ?? "";
    const rang = (s: string) => texte.indexOf(s);
    expect(rang("Léa Dubois")).toBeLessThan(rang("Basée à Toulouse"));
    expect(rang("Basée à Toulouse")).toBeLessThan(rang("Dix ans de systèmes"));
    expect(rang("Dix ans de systèmes")).toBeLessThan(rang("Secteurs"));
    expect(rang("Secteurs")).toBeLessThan(rang("Talks"));
    expect(rang("Talks")).toBeLessThan(rang("Contacter"));
  });

  it("aucune donnée interne dans le rendu", () => {
    const { container } = publique();
    const html = container.innerHTML;
    for (const interne of ["31000", "31555", "suggestions"]) {
      expect(html, interne).not.toContain(interne);
    }
  });

  it("aucune violation a11y (axe)", async () => {
    const { container } = publique();
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Corps de fiche — vue PROPRIÉTAIRE, ce que la vue publique n'a pas", () => {
  const proprietaire = (o: Partial<SpeakerProfile> = {}) =>
    render(
      <FicheSpeakeuseCorps
        vue="proprietaire"
        profile={fiche(o)}
        talks={[]}
        editBase="/mon-espace/fiche"
        talksBase="/mon-espace/talks"
      />,
    );

  it("le nom n'est PAS un h1 (la page hôte en a déjà un)", () => {
    proprietaire();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    // …mais il reste dans le plan du document : un texte de la taille d'un titre
    // hors hiérarchie se perd au lecteur d'écran.
    expect(screen.getByRole("heading", { level: 3, name: /léa dubois/i })).toBeInTheDocument();
  });

  it("chaque partie mène à sa page, et l'attestation est marquée privée", () => {
    proprietaire();
    expect(screen.getByRole("link", { name: /tes secteurs/i })).toHaveAttribute(
      "href",
      "/mon-espace/fiche/secteurs",
    );
    expect(screen.getByText(/visible par toi seule/i)).toBeInTheDocument();
  });

  it("aucun bouton pour s'écrire à soi-même", () => {
    proprietaire();
    expect(screen.queryByRole("link", { name: /envoyer un message/i })).toBeNull();
    expect(screen.getByText(/messages par e-mail/i)).toBeInTheDocument();
  });

  it("aucune violation a11y (axe)", async () => {
    const { container } = proprietaire();
    expect(await axe(container)).toHaveNoViolations();
  });
});
