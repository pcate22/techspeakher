import { describe, it, expect } from "vitest";
import type { Tache } from "@/lib/taches";
import { buildMagicLinkEmail } from "@/lib/magic-link";
import { buildModerationEmail } from "@/lib/moderation-email";
import { buildOrgaDigestEmail, buildSpeakeuseDigestEmail } from "@/lib/digest-email";
import { buildInvitationEmail } from "@/lib/invitation-email";
import { buildRelanceEmail } from "@/lib/relance-email";
import { buildTremplinReadyEmail } from "@/lib/tremplin-email";
import { buildRappelFicheEmail } from "@/lib/rappel-fiche-email";
import { buildSuppressionEmail } from "@/lib/conservation-comptes";
import { buildSuggestionsEmail } from "@/lib/cfp-sync";
import { buildNouveautesEmail } from "@/lib/nouveautes-email";
import {
  buildInvitationAdhesionEmail,
  buildPreavisAnnuaireEmail,
  buildRelanceAdhesionEmail,
} from "@/lib/adhesion-email";

/**
 * LES RÈGLES DE RÉDACTION, tenues sur TOUS les e-mails que la plateforme
 * envoie (inventaire : page Notion « TSH — les e-mails envoyés par la
 * plateforme », 2026-10-15). Un e-mail est du contenu affiché : les règles du
 * dépôt (CLAUDE.md § Langue et ton) s'y appliquent comme à l'écran.
 *
 * - une seule salutation, « Salut », tutoiement de la communauté ;
 * - aucun cadratin ;
 * - la forme positive (« ne … pas », « ne … plus » écartés) ;
 * - une insécable avant « : ! ? ; », jamais une espace simple.
 *
 * Ajouter un e-mail = l'ajouter à cette liste. C'est elle qui l'empêche de
 * repartir avec les fautes que la relecture du 2026-10-15 a corrigées.
 *
 * Hors liste, et c'est voulu : l'e-mail du formulaire de contact
 * (`src/app/api/contact/route.ts`), une fiche technique « Nom : … Sujet : … »
 * que reçoit l'équipe, pas une membre.
 */

const tache = (over: Partial<Tache>): Tache =>
  ({
    libelle: "x",
    href: "/x",
    famille: "association",
    regle: "valider-fiche",
    ...over,
  }) as Tache;

const EMAILS: [string, { subject: string; htmlContent?: string; textContent?: string }][] = [
  ["connexion", buildMagicLinkEmail("https://techspeakher.fr/api/auth/callback/email?token=x")],
  ["fiche publiée", buildModerationEmail({ decision: "publie", name: "Ada Lovelace", profileId: 1 })],
  [
    "fiche refusée",
    buildModerationEmail({ decision: "refuse", name: "Ada Lovelace", profileId: 1, motif: "Ajoute une bio." }),
  ],
  [
    "message transmis",
    buildSpeakeuseDigestEmail({ name: "Ada Lovelace", messages: [{ motif: "conference", body: "Merci pour ton talk, on aimerait t'inviter." }] }),
  ],
  ["digest orga", buildOrgaDigestEmail([tache({}), tache({ regle: "moderer-messages" })])!],
  ["invitation", buildInvitationEmail({ name: "Ada Lovelace", email: "ada@x.fr", isOrga: false })],
  ["invitation orga", buildInvitationEmail({ name: "Ada Lovelace", email: "ada@x.fr", isOrga: true })],
  ["relance (étapes)", buildRelanceEmail({ name: "Ada Lovelace", chantiers: ["Bio", "Talks"] })],
  ["relance (complète)", buildRelanceEmail({ name: "Ada Lovelace", chantiers: [] })],
  ["Tremplin", buildTremplinReadyEmail({ name: "Ada Lovelace", editionNom: "Tremplin DevFest 2026", editionId: 3 })],
  ["rappel de fiche", buildRappelFicheEmail()],
  ["suppression", buildSuppressionEmail({ name: "Ada Lovelace", dateSuppression: "14 novembre 2026" })],
  ["moissonneur (1)", buildSuggestionsEmail("Ada Lovelace", 1)],
  ["moissonneur (n)", buildSuggestionsEmail("Ada Lovelace", 3)],
  [
    "préavis sans adhésion",
    buildPreavisAnnuaireEmail({ name: "Ada Lovelace", dateRetrait: "2026-11-14T12:00:00Z", echeance: null }),
  ],
  [
    "préavis échéance",
    buildPreavisAnnuaireEmail({
      name: "Ada Lovelace",
      dateRetrait: "2026-11-14T12:00:00Z",
      echeance: "2026-11-10T12:00:00Z",
    }),
  ],
  ["relance d'adhésion", buildRelanceAdhesionEmail({ name: "Ada Lovelace", echeance: "2026-11-10T12:00:00Z" })],
  ["invitation à adhérer", buildInvitationAdhesionEmail({ name: "Ada Lovelace" })],
  ["lettre d'information", buildNouveautesEmail({ name: "Ada Lovelace", version: "avec-fiche" })],
  ["lettre d'information (sans fiche)", buildNouveautesEmail({ name: "Ada Lovelace", version: "sans-fiche" })],
];

/** Le texte tel qu'il se LIT : balises retirées, entités décodées. */
function lu(mail: { subject: string; htmlContent?: string; textContent?: string }): string[] {
  const decode = (s: string) =>
    s
      .replace(/<[^>]+>/g, " ")
      .replaceAll("&nbsp;", " ")
      .replaceAll("&apos;", "'")
      .replaceAll("&#39;", "'")
      .replaceAll("&mdash;", "—")
      .replaceAll("&#8212;", "—")
      .replaceAll("&amp;", "&");
  return [mail.subject, mail.htmlContent, mail.textContent]
    .filter((s): s is string => typeof s === "string")
    .map(decode);
}

describe.each(EMAILS)("e-mail « %s »", (_nom, mail) => {
  it("salue par « Salut » (et seulement le corps qui salue)", () => {
    for (const corps of lu(mail).slice(1)) {
      expect(corps.trim()).toMatch(/^Salut\b/);
      expect(corps).not.toMatch(/\bBonjour\b/);
    }
  });

  it("aucun cadratin", () => {
    for (const t of lu(mail)) expect(t).not.toContain("—");
  });

  it("forme positive : ni « ne … pas », « ne … plus » ni « ne … jamais »", () => {
    // L'apostrophe typographique (’) compte autant que la droite : « n’est
    // pas » passait la première version de cette règle (revue du 2026-10-15).
    for (const t of lu(mail))
      expect(t).not.toMatch(/\b(ne\s|n['’])[^.!?\n]{0,40}?\b(pas|plus|jamais)\b/i);
  });

  it("une insécable avant « : ! ? ; », jamais une espace simple", () => {
    for (const t of lu(mail)) expect(t).not.toMatch(/ [:!?;]/);
  });
});
