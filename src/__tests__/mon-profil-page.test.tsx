import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";

expect.extend(toHaveNoViolations);

/**
 * « Mon profil » (conception N1 §2.5, écran A — validée le 2026-08-07) : la
 * page PRIVÉE de l'onglet-photo. Une marche dérivée des données, la porte
 * « Ma fiche publique », et le travail de rôle en rangées — exactement ce que
 * la barre canonique et le tiroir ont perdu. Fiche publique et compte ne se
 * mélangent JAMAIS : aucune section de la fiche ne s'affiche ici.
 */

vi.mock("next/navigation", () => ({
  redirect: vi.fn((p: string) => {
    throw new Error(`REDIRECT:${p}`);
  }),
}));
vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/profiles", () => ({ getProfileByUserId: vi.fn() }));
vi.mock("@/lib/talks", () => ({ getTalksCountByProfileId: vi.fn(async () => 0) }));
vi.mock("@/lib/tremplin-registrations", () => ({ getEditionsForUser: vi.fn(async () => []) }));
vi.mock("@/lib/tremplin-editions", () => ({ getEditionEnCours: vi.fn(async () => null) }));
vi.mock("@/lib/mon-agenda", () => ({ getMesProchainsTalks: vi.fn(async () => []) }));
vi.mock("@/lib/cfp-suggestions", () => ({ getPendingSuggestionsCount: vi.fn(async () => 0) }));
vi.mock("@/lib/articles-membres", () => ({ countMesArticles: vi.fn(async () => 0) }));
vi.mock("@/lib/contact-message", () => ({
  countTransmittedMessagesForProfile: vi.fn(async () => 0),
}));
vi.mock("@/lib/accounts", () => ({
  getLinkedProviders: vi.fn(async () => ["google", "linkedin"]),
  // impl réelle (fonction pure) recopiée : couverte par accounts.test.ts.
  hasUnlinkedOAuth: (linked: string[], enabled: string[]) =>
    enabled.some((p) => !linked.includes(p)),
}));
vi.mock("@/lib/helloasso", () => ({ helloassoConfig: vi.fn(() => null) }));
vi.mock("@/lib/adhesions", () => ({ adhesionDuCompte: vi.fn(async () => null) }));
vi.mock("@/auth.config", () => ({ enabledOAuthProviders: () => ["google", "linkedin"] }));
vi.mock("@/lib/users", () => ({
  getCompte: vi.fn(async () => ({ name: "Marie Curie", genre: null })),
  // impl réelle (fonction pure) recopiée : la règle est couverte par ses
  // propres tests, le mock du module ne doit pas la faire disparaître.
  peutCreerFiche: (genre: string | null | undefined) => genre !== "homme",
}));

import { auth } from "@/auth";
import { getProfileByUserId } from "@/lib/profiles";
import { getTalksCountByProfileId } from "@/lib/talks";
import { getEditionsForUser } from "@/lib/tremplin-registrations";
import { getEditionEnCours } from "@/lib/tremplin-editions";
import { getMesProchainsTalks } from "@/lib/mon-agenda";
import { getLinkedProviders } from "@/lib/accounts";
import { countMesArticles } from "@/lib/articles-membres";
import { countTransmittedMessagesForProfile } from "@/lib/contact-message";
import { getCompte } from "@/lib/users";
import { helloassoConfig } from "@/lib/helloasso";
import { adhesionDuCompte } from "@/lib/adhesions";
import { makeProfile } from "./test-helpers";
import MonProfil from "@/app/mon-espace/profil/page";

afterEach(cleanup);

const rendu = async () => render(await MonProfil());

/** Le décor le plus fréquent du fichier : une fiche publiée. */
const avecFiche = () =>
  vi.mocked(getProfileByUserId).mockResolvedValue(makeProfile({ id: 5, status: "publie" }));

const sessionDe = (extra: object = {}) =>
  ({ user: { id: "1", name: "Ada Lovelace", isOrga: false, isCoach: false, ...extra } }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue(sessionDe());
  vi.mocked(getProfileByUserId).mockResolvedValue(null);
  vi.mocked(getMesProchainsTalks).mockResolvedValue([]);
  vi.mocked(getEditionsForUser).mockResolvedValue([]);
  vi.mocked(getEditionEnCours).mockResolvedValue(null);
  vi.mocked(getCompte).mockResolvedValue({ name: "Marie Curie", genre: null } as never);
  vi.mocked(getLinkedProviders).mockResolvedValue(["google", "linkedin"]);
  vi.mocked(countMesArticles).mockResolvedValue(0);
  vi.mocked(countTransmittedMessagesForProfile).mockResolvedValue(0);
  vi.mocked(helloassoConfig).mockReturnValue(null);
  vi.mocked(adhesionDuCompte).mockResolvedValue(null);
});

describe("Mon profil — l'écran privé", () => {
  it("le titre de la page est « Mon profil », et rien d'autre", async () => {
    // La pastille vivait DANS le `h1` : le nom accessible du titre devenait
    // « Mon profil Privé », et le repère de page annonçait une étiquette
    // d'état (relecture RGAA du 2026-08-16, F4). Un titre nomme l'endroit ;
    // la visibilité est une information à côté.
    await rendu();
    expect(
      screen.getByRole("heading", { level: 1 }).textContent?.trim(),
    ).toBe("Mon profil");
  });

  it("la visibilité se dit quand même, en toutes lettres et à taille lisible", async () => {
    await rendu();
    const pastille = screen.getByText("Privé");
    expect(pastille).toBeInTheDocument();
    // Plancher de lecture : jamais de taille arbitraire sous `text-xs`, et
    // pas d'interlettrage qui abîme la silhouette du mot.
    expect(pastille.className).not.toMatch(/text-\[[\d.]+px\]/);
    expect(pastille.className).not.toMatch(/tracking-/);
  });

  it("hors session → /connexion", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    await expect(rendu()).rejects.toThrow("REDIRECT:/connexion");
  });

  it("avec fiche : la porte « Ma fiche publique », JAMAIS la fiche elle-même", async () => {
    vi.mocked(getProfileByUserId).mockResolvedValue(
      makeProfile({ id: 5, status: "publie", name: "Ada Lovelace" }),
    );
    await rendu();
    expect(
      screen.getByRole("link", { name: /ma fiche publique/i }),
    ).toHaveAttribute("href", "/mon-espace/fiche");
    // Aucune section de fiche ne s'affiche ici (bio, sujets, crayons…).
    expect(screen.queryByText(/qui tu es/i)).toBeNull();
  });

  it("sans fiche : la porte s'efface, l'étape propose la création", async () => {
    await rendu();
    expect(screen.queryByRole("link", { name: /ma fiche publique/i })).toBeNull();
    expect(screen.getByText(/ta prochaine étape/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /créer ma fiche/i })).toHaveAttribute(
      "href",
      "/mon-espace/fiche",
    );
  });

  it("sans fiche + genre « homme » : aucune étape de création (jamais de CTA impossible)", async () => {
    vi.mocked(getCompte).mockResolvedValue({ name: "Marc", genre: "homme" } as never);
    await rendu();
    expect(screen.queryByText(/ta prochaine étape/i)).toBeNull();
  });

  it("fiche + talk daté à venir : l'étape devient « préparer sa scène »", async () => {
    avecFiche();
    vi.mocked(getTalksCountByProfileId).mockResolvedValue(2);
    vi.mocked(getMesProchainsTalks).mockResolvedValue([
      {
        occurrenceId: 9,
        talkId: 3,
        titre: "Debugger sans pleurer",
        date: "2026-09-12",
        conference: "DevFest",
        ville: "Toulouse",
      } as never,
    ]);
    await rendu();
    expect(screen.getByText(/12 septembre 2026/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /voir mon agenda/i })).toHaveAttribute(
      "href",
      "/mon-espace/agenda",
    );
  });
});

describe("Mon profil — les rangées, groupées par monde", () => {
  /** Toutes les destinations de la page, dans l'ordre de lecture — les
   * segments sont plusieurs listes, plus une seule. */
  const rangées = () =>
    screen
      .getAllByRole("list")
      .flatMap((l) => within(l).getAllByRole("link"))
      .map((l) => l.getAttribute("href"));

  /**
   * Les étiquettes de groupe RÉELLEMENT VISIBLES.
   *
   * Le filtre `sr-only` n'est pas un détail : sans lui, poser `visible: false`
   * sur les trois segments — donc supprimer le regroupement visible, qui est
   * le sujet même de ce lot — laissait la suite entièrement verte. `sr-only`
   * ne retire rien de l'arbre d'accessibilité, un helper qui lit `textContent`
   * ne distingue donc pas une étiquette d'une étiquette masquée (relecture du
   * 2026-08-16, mutation jouée).
   */
  const segments = () =>
    screen
      .getAllByRole("heading", { level: 2 })
      .filter((h) => !h.className.includes("sr-only"))
      .map((h) => h.textContent)
      .filter((t): t is string => t !== null);

  it("speakeuse « simple » : un seul groupe étiqueté, « Mon compte »", async () => {
    await rendu();
    // Sans fiche, « Ma photo » est la seule porte vers la photo (rangée
    // arrivée de `main` pendant ce lot) : elle vit dans le groupe de tête.
    expect(rangées()).toEqual(["/mon-espace/photo", "/mon-espace/reglages"]);
    expect(screen.getByRole("button", { name: /se déconnecter/i })).toBeInTheDocument();
    // Le coût du regroupement pour le CAS MAJORITAIRE : UNE étiquette de
    // groupe, autant qu'avec « Mes accès » (conception §4.1). Et on nomme
    // laquelle : c'est la seule que voit une speakeuse simple, donc le libellé
    // le plus exposé de la page — l'asserter par la négative laissait passer
    // n'importe quel autre mot (relecture du 2026-08-16).
    expect(segments()).toContain("Mon compte");
    expect(segments().filter((t) => /bénévolat|participation/i.test(t))).toEqual([]);
  });

  it("orga : ses rangées vivent sous « Mon bénévolat »", async () => {
    vi.mocked(auth).mockResolvedValue(sessionDe({ isOrga: true }));
    vi.mocked(getEditionEnCours).mockResolvedValue({ id: 5, nom: "Tremplin DevFest 2026" });
    await rendu();
    expect(rangées()).toEqual([
      "/mon-espace/photo",
      // La rangée « À faire » pointe la NOUVELLE adresse (étape B, lot 5) : le
      // 308 de /admin/taches est pour les vieux liens des e-mails, pas pour
      // rebondir à chaque tap. La vue « Pour l'association » : c'est ce que
      // cette rangée d'orga a toujours montré.
      "/mon-espace/a-faire?vue=association",
      "/admin",
      "/admin/tremplins/5/ateliers",
      "/mon-espace/reglages",
    ]);
    expect(segments()).toContain("Mon bénévolat");
  });

  it("l'espace orga se nomme « Espace organisatrices » — jamais un mot tronqué", async () => {
    vi.mocked(auth).mockResolvedValue(sessionDe({ isOrga: true }));
    await rendu();
    expect(screen.getByRole("link", { name: /espace organisatrices/i })).toHaveAttribute(
      "href",
      "/admin",
    );
    expect(screen.queryByText(/tableau de bord/i)).toBeNull();
  });

  it("l'accès direct aux ateliers dit « tremplin », le mot de l'orga (pas « édition », celui du schéma)", async () => {
    vi.mocked(auth).mockResolvedValue(sessionDe({ isOrga: true }));
    vi.mocked(getEditionEnCours).mockResolvedValue({ id: 5, nom: "Tremplin DevFest 2026" });
    await rendu();
    const lien = screen.getByRole("link", { name: /ateliers du tremplin en cours/i });
    expect(lien).toHaveAttribute("href", "/admin/tremplins/5/ateliers");
    expect(lien.textContent).toContain("Tremplin DevFest 2026");
  });

  it("participante : ses rangées vivent sous « Ma participation »", async () => {
    vi.mocked(getEditionsForUser).mockResolvedValue([
      { editionId: 3, nom: "Tremplin DevFest 2026" },
    ] as never);
    await rendu();
    expect(segments()).toContain("Ma participation");
  });

  it("un segment sans rangée ne s'affiche pas (pas d'étiquette vide)", async () => {
    await rendu();
    expect(segments()).not.toContain("Mon bénévolat");
    expect(segments()).not.toContain("Ma participation");
  });

  it("le groupe de tête n'a PAS d'étiquette : on ne fabrique pas un mot pour en avoir une", async () => {
    // Le commentaire du code énonçait la règle (« le groupe n'a pas de nom
    // simple, et on ne fabrique pas un mot pour avoir une étiquette ») puis
    // fabriquait « Mes pages » et le servait en `sr-only` — un mot que
    // personne n'emploie, lu à voix haute aux seules personnes qui ne peuvent
    // pas le recouper avec l'écran (relecture du 2026-08-16, F2). « Mon
    // profil », le `h1`, couvre déjà ce groupe.
    avecFiche();
    vi.mocked(countMesArticles).mockResolvedValue(2);
    await rendu();
    expect(screen.queryByText(/mes pages/i)).toBeNull();
    // Et aucune étiquette masquée n'a repris sa place sous un autre mot : les
    // seuls `h2` de la page sont ceux qu'on voit.
    const masques = screen
      .getAllByRole("heading", { level: 2 })
      .filter((h) => h.className.includes("sr-only"));
    expect(masques.map((h) => h.textContent)).toEqual([]);
  });

  it("les groupes de rangées ne sont pas des RÉGIONS : une page, un plan, pas six repères", async () => {
    // Six `<section aria-labelledby>` sur un écran de téléphone donnent six
    // repères au lecteur d'écran là où la page en a un seul (relecture du
    // 2026-08-16, F1). Le plan se lit par les TITRES ; les listes portent leur
    // nom par `aria-labelledby`, ce qui ne crée pas de repère de navigation.
    vi.mocked(auth).mockResolvedValue(sessionDe({ isOrga: true, isCoach: true }));
    vi.mocked(getEditionsForUser).mockResolvedValue([
      { editionId: 3, nom: "Tremplin DevFest 2026" },
    ] as never);
    // Le cas VRAIMENT maximal : les quatre groupes, la carte d'étape ET la
    // carte d'incitation au regroupement. Sans cette dernière, l'assertion
    // passait sur une page qui compte pourtant une région de plus.
    vi.mocked(getLinkedProviders).mockResolvedValue(["google"]);
    await rendu();
    expect(screen.getByText(/retrouve ta fiche à coup sûr/i)).toBeInTheDocument();
    const regions = screen.queryAllByRole("region").map((r) => r.textContent);
    expect(regions.length, `Régions : ${regions.join(" | ")}`).toBeLessThanOrEqual(1);
  });

  it("chaque groupe de rangées porte quand même son nom, par sa liste", async () => {
    vi.mocked(auth).mockResolvedValue(sessionDe({ isOrga: true }));
    await rendu();
    expect(
      screen.getByRole("list", { name: "Mon bénévolat" }),
    ).toBeInTheDocument();
  });

  it("coach : « Mes coachées » (la direction dans le mot), sous « Mon bénévolat »", async () => {
    vi.mocked(auth).mockResolvedValue(sessionDe({ isCoach: true }));
    await rendu();
    expect(screen.getByRole("link", { name: /mes coachées/i })).toHaveAttribute(
      "href",
      "/mon-espace/coaching",
    );
    expect(segments()).toContain("Mon bénévolat");
  });

  it("le sous-titre d'une rangée DÉCRIT sa destination, il n'ordonne pas", async () => {
    // « Envoie un fichier, ou reprends celle de ton profil LinkedIn » : deux
    // impératifs dans un sommaire, avant même d'avoir ouvert la page. Une
    // rangée de navigation dit ce qu'on trouve derrière ; les consignes
    // vivent sur l'écran qui les demande (relecture du 2026-08-16, F9).
    await rendu();
    const rangee = screen.getByRole("link", { name: /ma photo/i });
    expect(rangee.textContent).not.toMatch(/\b(envoie|reprends|ajoute|choisis)\b/i);
    expect(rangee.textContent).toMatch(/linkedin/i);
  });

  /**
   * La SEULE porte du produit vers `/mon-espace/messages` est l'onglet de la
   * barre : une seule occurrence dans tout `src/`, vérifiée. L'étape B
   * remplace cet onglet par « À faire », où un message n'est une ligne que
   * tant qu'il attend une réponse — et il n'existe aucun état « lu » (répondre
   * est un `mailto:` qui quitte le produit). Sans cette rangée, les messages
   * LUS deviennent inatteignables : une fonctionnalité qui disparaît sans que
   * rien ne dise où elle est partie, ce que la checklist COGA range au pire
   * (revue de conception du 2026-08-16, C2).
   *
   * Elle part donc AVANT le changement d'onglet, pas après.
   */
  it("des messages reçus : la rangée « Mes messages » existe, en permanence", async () => {
    avecFiche();
    vi.mocked(countTransmittedMessagesForProfile).mockResolvedValue(3);
    await rendu();
    expect(screen.getByRole("link", { name: /mes messages/i })).toHaveAttribute(
      "href",
      "/mon-espace/messages",
    );
  });

  it("la rangée reste là même quand plus rien n'attend de réponse", async () => {
    // C'est tout l'intérêt : elle ne dépend PAS d'un compteur de non-lus.
    // La casser, c'est la faire dépendre de « ce qui attend une action » —
    // et on retombe sur l'archive inatteignable.
    avecFiche();
    vi.mocked(countTransmittedMessagesForProfile).mockResolvedValue(1);
    await rendu();
    const rangee = screen.getByRole("link", { name: /mes messages/i });
    // Aucun nombre : la rangée est une PORTE, pas une notification.
    expect(rangee.textContent).not.toMatch(/\d/);
  });

  it("aucun message jamais reçu : aucune rangée vide", async () => {
    avecFiche();
    await rendu();
    expect(screen.queryByRole("link", { name: /mes messages/i })).toBeNull();
  });

  it("un article écrit : la rangée « Mes articles » apparaît (lot N3)", async () => {
    vi.mocked(countMesArticles).mockResolvedValue(2);
    await rendu();
    expect(screen.getByRole("link", { name: /mes articles/i })).toHaveAttribute(
      "href",
      "/mon-espace/articles",
    );
  });

  it("aucun article : aucune rangée vide — le geste d'écrire vit dans la feuille ➕", async () => {
    await rendu();
    expect(screen.queryByRole("link", { name: /mes articles/i })).toBeNull();
  });

  it("participante : SA rangée d'édition mène à son espace tremplin (lot N2 §4)", async () => {
    vi.mocked(getEditionsForUser).mockResolvedValue([
      { editionId: 3, nom: "Tremplin DevFest 2026" },
    ] as never);
    await rendu();
    expect(
      screen.getByRole("link", { name: /tremplin devfest 2026/i }),
    ).toHaveAttribute("href", "/mon-espace/tremplin/3");
  });

  it("une méthode de connexion reste à relier : l'incitation vit ici (lot N2 §4)", async () => {
    vi.mocked(getLinkedProviders).mockResolvedValue(["google"]);
    await rendu();
    expect(
      screen.getByRole("link", { name: /ajouter une méthode de connexion/i }),
    ).toHaveAttribute("href", "/mon-espace/connexions");
  });

  it("tout est relié : aucune incitation au regroupement", async () => {
    await rendu();
    expect(screen.queryByText(/retrouve ta fiche à coup sûr/i)).toBeNull();
  });

  it("participante d'un tremplin : la rangée Documents (Q4, tranchée)", async () => {
    vi.mocked(getEditionsForUser).mockResolvedValue([{ editionId: 1, nom: "TSH 2026" }] as never);
    await rendu();
    expect(screen.getByRole("link", { name: /documents/i })).toHaveAttribute(
      "href",
      "/mon-espace/documents",
    );
  });

  it("non-orga : aucune porte vers l'espace orga", async () => {
    await rendu();
    expect(rangées().every((h) => h && !h.startsWith("/admin"))).toBe(true);
  });
});

describe("Mon profil — accessibilité", () => {
  it("axe : aucune violation (vue orga-coach, cas maximal)", async () => {
    vi.mocked(auth).mockResolvedValue(sessionDe({ isOrga: true, isCoach: true }));
    avecFiche();
    vi.mocked(getEditionEnCours).mockResolvedValue({ id: 5, nom: "TSH 2026" });
    const { container } = await rendu();
    expect(await axe(container)).toHaveNoViolations();
  });

  describe("rangée « Mon adhésion »", () => {
    it("absente tant que la synchro HelloAsso n'est pas configurée (elle dirait « aucune » à toutes)", async () => {
      await rendu();
      expect(screen.queryByText("Mon adhésion")).toBeNull();
      expect(adhesionDuCompte).not.toHaveBeenCalled();
    });

    it("adhésion reliée : dit l'échéance, et mène à la page « Mon adhésion »", async () => {
      vi.mocked(helloassoConfig).mockReturnValue({} as never);
      vi.mocked(adhesionDuCompte).mockResolvedValue({
        startedAt: "2026-10-15T08:00:00.000Z",
        expiresAt: "2099-10-15T08:00:00.000Z",
        status: "active",
        source: "helloasso",
      });
      await rendu();
      const lien = screen.getByText("Mon adhésion").closest("a")!;
      expect(lien.getAttribute("href")).toBe("/mon-espace/adhesion");
      expect(lien.textContent).toContain("Active jusqu'au 15 octobre 2099");
    });

    it("aucune adhésion reliée : mène à /adherer, et dit le délai", async () => {
      vi.mocked(helloassoConfig).mockReturnValue({} as never);
      await rendu();
      const lien = screen.getByText("Mon adhésion").closest("a")!;
      expect(lien.getAttribute("href")).toBe("/adherer");
      expect(lien.textContent).toContain("dans quelques minutes, et au plus tard le lendemain");
    });

    it("fiche en pause : la prochaine étape (LE CTA de la page) devient « Adhérer »", async () => {
      vi.mocked(getProfileByUserId).mockResolvedValue(makeProfile({ id: 5, status: "en_pause" }));
      await rendu();
      const cta = screen.getByRole("link", { name: "Adhérer" });
      expect(cta.getAttribute("href")).toBe("/adherer");
    });

    it("fiche en pause : dit qu'elle revient à l'adhésion", async () => {
      vi.mocked(helloassoConfig).mockReturnValue({} as never);
      vi.mocked(getProfileByUserId).mockResolvedValue(makeProfile({ id: 5, status: "en_pause" }));
      await rendu();
      expect(screen.getByText("Mon adhésion").closest("a")!.textContent).toContain(
        "Fiche hors annuaire, en attente de ton adhésion",
      );
    });
  });
});
