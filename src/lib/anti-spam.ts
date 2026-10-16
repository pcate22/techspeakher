/**
 * Filtre anti-démarchage du formulaire public de contact.
 *
 * `/contact` est l'écriture anonyme qui part DIRECTEMENT dans la boîte de
 * l'association — l'autre, le message à une speakeuse
 * (`speakeuses/[id]/contact/actions.ts`), passe d'abord par la modération d'une
 * orga. Les agences de prospection se servent du formulaire public comme d'un
 * canal de démarchage : plafonner le DÉBIT (`rate-limit.ts`) ne suffit pas, un
 * seul message par jour passe sous tous les plafonds.
 *
 * Le filtre note le CONTENU sur des marqueurs de démarchage : chaque signal
 * pèse 1 ou 2, et un message atteignant `SEUIL_SPAM` (4) est écarté. Il faut
 * donc DEUX signaux forts, ou un fort et deux faibles : un « nos services » ou
 * un « sans engagement » isolé laisse passer le message, parce qu'un faux
 * positif coûte un contact perdu (sponsor, organisateur d'événement, candidate
 * au Tremplin) sans que personne le sache.
 *
 * Le filtre est volontairement lisible et sans dépendance : c'est une liste
 * qu'une orga peut relire et compléter à la vue d'un nouveau spam.
 */

/** Un message qui atteint ce score est écarté (deux signaux forts). */
export const SEUIL_SPAM = 4;

/**
 * Délai minimal entre l'ouverture du formulaire et l'envoi. Un humain met des
 * dizaines de secondes à écrire ; un automate qui remplit et poste dans la
 * foulée passe en dessous.
 */
export const DELAI_SAISIE_MIN_MS = 2_000;

interface Signal {
  regex: RegExp;
  motif: string;
  poids: number;
}

/** Marqueurs forts : le vocabulaire propre au démarchage commercial. */
const SIGNAUX_MESSAGE: Signal[] = [
  { regex: /prospection|prospecter|d[ée]marchage/i, motif: "prospection commerciale", poids: 2 },
  { regex: /externalis[ée]/i, motif: "prestation externalisée", poids: 2 },
  { regex: /rendez-?vous qualifi/i, motif: "rendez-vous qualifiés", poids: 2 },
  {
    regex: /g[ée]n[ée]ration de (leads|prospects)|acquisition de (clients|leads|prospects)/i,
    motif: "génération de prospects",
    poids: 2,
  },
  {
    regex: /netlinking|backlinks?|r[ée]f[ée]rencement (naturel|google)/i,
    motif: "référencement / netlinking",
    poids: 2,
  },
  { regex: /satisfait ou (rembours|remplac)/i, motif: "garantie commerciale", poids: 2 },
  { regex: /sans engagement/i, motif: "offre sans engagement", poids: 2 },
  {
    regex: /audit (commercial|seo|marketing|de communication)|audit[^.!?]{0,40}gratuit/i,
    motif: "audit commercial offert",
    poids: 2,
  },
  {
    regex: /\d+\s?(€|euros?)\s?(\/|par )\s?mois|[àa] partir de\s+\d+\s?(€|euros?)/i,
    motif: "tarif mensuel",
    poids: 2,
  },
  {
    regex: /boostez|augmenter (votre|vos) (chiffre|ventes|CA\b|visibilit)|d[ée]collez vos ventes/i,
    motif: "promesse de croissance",
    poids: 2,
  },
  {
    regex: /t[ée]l[ée]prospection|cold ?(call|e-?mail)|emailing/i,
    motif: "démarchage de masse",
    poids: 2,
  },
  { regex: /d[ée]veloppement commercial/i, motif: "développement commercial", poids: 2 },
  {
    regex: /\bbitcoin\b|\bcasino\b|\bviagra\b|crypto-?monnaie/i,
    motif: "spam classique",
    poids: 2,
  },
  {
    regex: /nous (aimerions|souhaitons|voulons|serions ravis de) vous proposer/i,
    motif: "offre de services",
    poids: 2,
  },
  // Marqueurs faibles : courants aussi chez des correspondants légitimes.
  { regex: /nos (services|prestations|offres|tarifs)/i, motif: "catalogue de services", poids: 1 },
  { regex: /\bseo\b/i, motif: "vocabulaire SEO", poids: 1 },
  { regex: /\[url=|\[\/url\]|<a\s|<\/a>|<script/i, motif: "balisage collé", poids: 1 },
];

/** Compte les liens (http(s) ou www.) présents dans le message. */
function compterLiens(message: string): number {
  return (message.match(/https?:\/\/|www\./gi) ?? []).length;
}

/**
 * Nom formé du même mot répété deux fois, sans séparateur
 * (« SellExpertSellExpert ») : signature d'un champ rempli par un automate.
 */
function nomRepete(nom: string): boolean {
  const compact = nom.replace(/\s+/g, "");
  return /^(.{4,})\1$/i.test(compact);
}

export interface AnalyseSpam {
  /** Somme des poids des signaux repérés. */
  score: number;
  /** Signaux repérés, en clair : sert au journal côté serveur. */
  motifs: string[];
  /** Vrai si le message atteint `SEUIL_SPAM`. */
  suspect: boolean;
}

/**
 * Analyse un message de contact (entrée non fiable) et dit s'il ressemble à du
 * démarchage. Aucun effet de bord : la décision appartient à l'appelant.
 */
export function analyserMessageContact(entree: {
  nom: string;
  email: string;
  message: string;
}): AnalyseSpam {
  const texte = `${entree.nom}\n${entree.message}`;
  const motifs: string[] = [];
  let score = 0;

  for (const signal of SIGNAUX_MESSAGE) {
    if (signal.regex.test(texte) && !motifs.includes(signal.motif)) {
      motifs.push(signal.motif);
      score += signal.poids;
    }
  }

  if (compterLiens(entree.message) >= 3) {
    motifs.push("liens multiples");
    score += 1;
  }

  if (nomRepete(entree.nom)) {
    motifs.push("nom répété");
    score += 1;
  }

  return { score, motifs, suspect: score >= SEUIL_SPAM };
}
