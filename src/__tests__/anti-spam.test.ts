import { describe, it, expect } from "vitest";
import { analyserMessageContact, SEUIL_SPAM } from "@/lib/anti-spam";

/**
 * Le filtre garde la boîte de l'association pour les vrais messages. Deux
 * exigences opposées, testées ici ensemble :
 *  - il écarte le démarchage (le cas réel reçu en août 2026 sert de témoin) ;
 *  - il laisse passer les messages légitimes, y compris ceux qui parlent
 *    d'argent, de sponsoring ou de SEO — un faux positif coûte un contact perdu.
 */

const MESSAGE_REEL_PROSPECTION = `Bonjour,

En notre qualité d'agence de prospection externalisée spécialisée dans
l'acquisition de clients, nous aimerions vous proposer nos services pour vous
accompagner dans la recherche de nouveaux clients pour votre activité. Nous
travaillons avec tout type de structure, allant de la TPE notament dans votre
secteur d'activité, jusqu'à des ETI, avec des tarifs commençant à partir de
990 €/mois, sans engagement, comprenant un audit commercial complet gratuit,
ainsi que la fourniture de nombreux rendez-vous qualifiés par semaine, garantis
contractuellement selon le principe « satisfait ou remplacé ».`;

function analyser(message: string, nom = "Camille Roux") {
  return analyserMessageContact({ nom, email: "camille@example.org", message });
}

describe("analyserMessageContact", () => {
  describe("écarte le démarchage", () => {
    it("écarte le message d'agence de prospection reçu en vrai", () => {
      const verdict = analyserMessageContact({
        nom: "SellExpertSellExpert",
        email: "contact@sellexpert.io",
        message: MESSAGE_REEL_PROSPECTION,
      });
      expect(verdict.suspect).toBe(true);
      expect(verdict.score).toBeGreaterThanOrEqual(SEUIL_SPAM);
      expect(verdict.motifs).toContain("prospection commerciale");
    });

    it.each([
      ["prospection commerciale", "Nous faisons de la prospection pour nos clients."],
      ["prestation externalisée", "Notre équipe externalisée prend le relais."],
      ["rendez-vous qualifiés", "Nous fournissons des rendez-vous qualifiés."],
      ["génération de prospects", "Notre génération de leads est garantie."],
      ["référencement / netlinking", "Une campagne de netlinking pour votre site."],
      ["garantie commerciale", "Nos offres sont satisfait ou remboursé."],
      ["offre sans engagement", "C'est un abonnement sans engagement."],
      ["audit commercial offert", "Nous offrons un audit commercial gratuit."],
      ["tarif mensuel", "Nos prix démarrent à 990 €/mois."],
      ["promesse de croissance", "Boostez votre chiffre d'affaires dès ce mois-ci."],
      ["démarchage de masse", "Nous gérons votre téléprospection."],
      ["développement commercial", "Nous pilotons votre développement commercial."],
      ["spam classique", "Achetez du bitcoin sur notre casino en ligne."],
    ])("repère le signal « %s »", (motif, message) => {
      expect(analyser(message).motifs).toContain(motif);
    });

    it("écarte un message qui cumule deux signaux de démarchage", () => {
      const verdict = analyser(
        "Bonjour, notre agence propose un audit commercial gratuit et des rendez-vous qualifiés chaque semaine.",
      );
      expect(verdict.suspect).toBe(true);
    });

    it("repère un nom formé du même mot répété (SellExpertSellExpert)", () => {
      expect(analyser("Bonjour", "SellExpertSellExpert").motifs).toContain(
        "nom répété",
      );
      expect(analyser("Bonjour", "sellexpertSELLEXPERT").motifs).toContain(
        "nom répété",
      );
    });

    it("repère un message truffé de liens", () => {
      const verdict = analyser(
        "Voir https://a.example, https://b.example et https://c.example",
      );
      expect(verdict.motifs).toContain("liens multiples");
    });

    it("repère les balises HTML ou BBCode collées dans le message", () => {
      expect(analyser("Cliquez [url=https://spam.example]ici[/url]").motifs).toContain(
        "balisage collé",
      );
      expect(analyser('Cliquez <a href="https://spam.example">ici</a>').motifs).toContain(
        "balisage collé",
      );
    });
  });

  describe("laisse passer les vrais messages", () => {
    it.each([
      [
        "une demande de speakeuse",
        "Bonjour, nous organisons un meetup en octobre à Toulouse et cherchons une intervenante sur le sujet de l'accessibilité. Est-ce que vous pouvez nous mettre en relation ?",
      ],
      [
        "une proposition de sponsoring",
        "Bonjour, notre entreprise souhaite sponsoriser votre prochaine soirée Tremplin. Nous pouvons prêter une salle pour 80 personnes et prendre en charge le buffet.",
      ],
      [
        "une candidature au Tremplin",
        "Bonjour, je voudrais participer au Tremplin. J'ai un talk sur le SEO technique et le référencement des applications React, est-ce que le sujet rentre dans le cadre ?",
      ],
      [
        "une question sur la cotisation",
        "Bonjour, quel est le montant de l'adhésion à l'association ? J'ai vu 20 € quelque part, est-ce toujours d'actualité ?",
      ],
      [
        "un message court",
        "Bonjour, comment est-ce que je rejoins la communauté ?",
      ],
      [
        "une prise de contact d'entreprise",
        "Bonjour, je suis responsable technique chez Acme et je cherche des speakeuses pour notre conférence interne. Nos équipes seraient ravies de vous accueillir.",
      ],
      // Les trois cas suivants cumulent un signal fort et un faible : ils
      // tombaient au seuil de 3, ce qui coûtait un vrai contact à chaque fois.
      [
        "un traiteur qui répond à un besoin",
        "Bonjour, nous pouvons assurer le buffet de vos soirées. Nos services sont facturés à la personne, sans engagement de votre côté.",
      ],
      [
        "un sponsor qui parle de visibilité",
        "Bonjour, sponsoriser votre Tremplin nous permettrait d'augmenter notre visibilité auprès des développeuses. Nos offres de mécénat sont ouvertes jusqu'en octobre.",
      ],
      [
        "une candidate qui parle de SEO",
        "Bonjour, je suis développeuse SEO et je propose un talk sur l'audit d'accessibilité gratuit des sites publics.",
      ],
    ])("laisse passer %s", (_cas, message) => {
      const verdict = analyser(message);
      expect(
        verdict.suspect,
        `motifs : ${verdict.motifs.join(", ")}`,
      ).toBe(false);
    });

    it("laisse passer un message qui contient un seul lien", () => {
      expect(analyser("Voici notre site : https://exemple.org").suspect).toBe(false);
    });

    it("laisse passer un nom composé de deux mots différents", () => {
      expect(analyser("Bonjour", "Marie Dupont").motifs).toHaveLength(0);
    });

    it("laisse passer un signal fort isolé", () => {
      const verdict = analyser("Notre offre est sans engagement.");
      expect(verdict.score).toBeLessThan(SEUIL_SPAM);
      expect(verdict.suspect).toBe(false);
    });

    it("laisse passer un signal fort accompagné d'un seul signal faible", () => {
      const verdict = analyser("Nos services sont disponibles sans engagement.");
      expect(verdict.motifs).toHaveLength(2);
      expect(verdict.suspect).toBe(false);
    });
  });

  it("compte un même signal une seule fois", () => {
    const verdict = analyser(
      "prospection prospection prospection prospection prospection",
    );
    expect(verdict.motifs.filter((m) => m === "prospection commerciale")).toHaveLength(1);
    expect(verdict.suspect).toBe(false);
  });

  it("reste insensible aux accents manquants", () => {
    expect(analyser("Notre generation de leads est garantie.").motifs).toContain(
      "génération de prospects",
    );
  });
});
