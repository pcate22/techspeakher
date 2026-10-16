import { BASE_URL } from "@/constants/site";
import { contactMotifLabel } from "@/data/contact-motifs";
import { nb, salutation, uneSeuleLigne } from "@/lib/format";
import { couperSurUnMot } from "@/lib/texte-markdown";
import { nbCibles, reclameUnGeste, type RegleTache, type Tache } from "@/lib/taches";

/** Longueur de l'extrait montré dans le digest (« que le début du message »). */
const EXCERPT_LEN = 140;

/** Début du message, sur une ligne, coupé SUR UN MOT — un `slice` brut
 * tranchait au milieu d'un mot (dette soldée au passage, lot 7). */
function excerpt(body: string): string {
  const oneLine = uneSeuleLigne(body);
  return oneLine.length > EXCERPT_LEN
    ? `${couperSurUnMot(oneLine, EXCERPT_LEN)}…`
    : oneLine;
}

/**
 * L'AGRÉGAT d'une règle du moteur, au singulier près. Un libellé PAR RÈGLE,
 * et la fermeture est le cliquet (précédent Brevo du registre) : une règle
 * ajoutée à `REGLES_TACHES` sans sa ligne ici est une erreur de COMPILATION —
 * pas un e-mail qui oublie en silence une partie du travail.
 *
 * `null` = la règle ne sort JAMAIS par e-mail. Les constats en sont : une
 * notification qui réclamerait un accord déjà refusé referait, dans la boîte
 * mail, le défaut corrigé à l'écran — le digest notifie ce qu'un geste
 * referme, comme le point de l'onglet.
 *
 * DOUBLE GARDE ASSUMÉE avec le filtre `reclameUnGeste` du corps : les deux
 * n'encodent pas la même chose (`constat` est PAR LIGNE — qui referme ;
 * `null` est PAR RÈGLE — ne sort jamais par e-mail, imposé par
 * l'exhaustivité du Record), et chacune échoue côté sûr si l'autre glisse.
 * Conséquence connue : aucune des deux ne se casse SEULE — c'est la paire
 * que le second temps des tests fait tomber (revue du 2026-08-18).
 */
const AGREGATS = {
  "valider-fiche": (n) => `${nb(n, "fiche")} à valider`,
  "valider-conference": (n) => `${nb(n, "conférence")} proposée${n > 1 ? "s" : ""} à valider`,
  // Constat : le nom est un geste de la SPEAKEUSE (self-service), l'e-mail
  // relancerait l'orga sur le travail d'une autre.
  "nommer-fiche": null,
  "relancer-sommeil": (n) => `${nb(n, "fiche")} en sommeil à relancer`,
  "relire-article": (n) => `${nb(n, "article")} à relire`,
  "ajouter-visio": (n) => `${nb(n, "lien")} visio à ajouter`,
  "trouver-coach": (n) => `${nb(n, "coach")} à trouver`,
  "pointer-presences": (n) => `présences à pointer pour ${nb(n, "atelier")}`,
  "dater-atelier": (n) => `${nb(n, "atelier")} à dater`,
  "attribuer-recompenses": (n) => `${nb(n, "récompense")} à attribuer`,
  "relier-compte": (n) => `${nb(n, "participante")} à relier à un compte`,
  "recueillir-accord-photo": (n) => `${nb(n, "accord")} photo à recueillir`,
  "photos-privees": null,
  "ouvrir-edition": (n) => `${nb(n, "édition")} du tremplin à ouvrir au public`,
  "moderer-messages": (n) => `${nb(n, "message")} à modérer`,
} satisfies Record<RegleTache, ((n: number) => string) | null>;

/**
 * Récap quotidien pour l'orga — UN CANAL DU MOTEUR (étape C) : il reçoit les
 * tâches dérivées, celles de l'écran, et n'en publie que l'AGRÉGAT. Un compte
 * par (règle, contexte), les lignes à zéro tues d'elles-mêmes (une règle sans
 * tâche n'a pas de ligne), un seul lien — la liste, en vue association.
 * Fonction pure ; l'envoi (vers CONTACT_EMAIL) est géré par le cron. « Rien
 * à envoyer » se dit par `null` : un contrat que le compilateur tient, pas
 * une convention de chaîne vide à connaître des deux côtés.
 *
 * AUCUN LIBELLÉ, AUCUN HREF DE TÂCHE NE SORT — et ce n'est pas un détail
 * d'écriture. `CONTACT_EMAIL` est l'adresse PUBLIQUE de l'association : une
 * boîte Gmail partagée, dont le périmètre de lecture n'est pas
 * `users.is_orga`, et qu'un e-mail une fois parti ne quitte plus.
 * L'effacement d'un compte va jusqu'à Brevo et `passeConservation` efface en
 * cascade — rien n'atteint une copie distribuée. Un nom ici créerait la
 * première durée de conservation que personne n'outille. La fonction ne
 * consomme donc que `regle`, `nb` et `contexte` (le nom d'une ÉDITION, pas
 * d'une personne) ; `libelle` et `href` restent derrière l'authentification.
 * Le banc `digest-email.test.ts` nourrit l'agrégat de tâches pleines de noms
 * et affirme que rien n'en ressort (test RGPD de §5, posé avant ce code).
 *
 * Si un jour du nominatif est voulu, ce sera un e-mail par orga vers son
 * adresse, destinataire identifié, avec les mentions légales amendées.
 */
export function buildOrgaDigestEmail(taches: Tache[]): {
  subject: string;
  textContent: string;
} | null {
  // Un agrégat par (règle, contexte), dans l'ordre du moteur (les datées
  // d'abord) : la première apparition fixe la place de la ligne.
  const comptes = new Map<
    string,
    { agregat: (n: number) => string; contexte?: string; total: number }
  >();
  for (const t of taches.filter(reclameUnGeste)) {
    // Le formateur se capture AU filtre : un seul lookup, aucune assertion
    // `!` qui encoderait une dépendance invisible entre deux passages.
    const agregat = AGREGATS[t.regle];
    if (agregat === null) continue;
    const cle = `${t.regle}|${t.contexte ?? ""}`;
    const entree = comptes.get(cle) ?? { agregat, contexte: t.contexte, total: 0 };
    entree.total += nbCibles(t);
    comptes.set(cle, entree);
  }

  const lignes = [...comptes.values()].map((c) => {
    const agregat = c.agregat(c.total);
    return c.contexte ? `- ${agregat} (${c.contexte})` : `- ${agregat}`;
  });

  if (lignes.length === 0) {
    return null;
  }

  return {
    subject: "Tech Speak'Her\u00a0: à faire pour l'association",
    textContent: [
      salutation(null),
      "",
      "Ce qui attend un geste de l'équipe\u00a0:",
      ...lignes,
      "",
      `Le détail est dans ton espace\u00a0: ${BASE_URL}/mon-espace/a-faire?vue=association`,
      "",
      "L'équipe Tech Speak'Her",
    ].join("\n"),
  };
}

/**
 * Digest quotidien pour une speakeuse : elle a de nouveaux messages transmis.
 * On ne montre QUE le début de chaque message (extrait) ; elle se connecte à
 * son espace pour lire le message complet et répondre. Fonction pure.
 */
export function buildSpeakeuseDigestEmail({
  name,
  messages,
}: {
  name: string | null;
  messages: { motif: string; body: string }[];
}): { subject: string; textContent: string } {
  const bonjour = salutation(name);
  const n = messages.length;
  const compte = `${n} nouveau${n > 1 ? "x" : ""} message${n > 1 ? "s" : ""}`;

  const liste = messages.map(
    (m) => `- ${contactMotifLabel(m.motif)}\u00a0: «\u00a0${excerpt(m.body)}\u00a0»`,
  );

  return {
    subject: `Tech Speak'Her\u00a0: tu as ${compte}`,
    textContent: [
      bonjour,
      "",
      `Tu as reçu ${compte} via ta fiche Tech Speak'Her (vérifié${
        n > 1 ? "s" : ""
      } par l'équipe)\u00a0:`,
      "",
      ...liste,
      "",
      `Connecte-toi pour lire et répondre\u00a0: ${BASE_URL}/mon-espace/messages`,
      "",
      "L'équipe Tech Speak'Her",
    ].join("\n"),
  };
}
