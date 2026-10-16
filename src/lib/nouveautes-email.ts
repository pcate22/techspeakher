import { BASE_URL } from "@/constants/site";
import { escapeHtml, nb, salutation } from "@/lib/format";
import {
  A_VENIR,
  BLOCS_NOUVEAUTES,
  ET_AUSSI,
  NOUVEAUTES_PLATEFORME,
  type BlocNouveautes,
  type NouveautePlateforme,
} from "@/data/nouveautes-plateforme";

/**
 * E-mail d'annonce des nouveautés, en DEUX versions selon l'état de la fiche :
 *
 * - `sans-fiche` : la personne a un compte, et sa fiche reste à publier. L'e-mail
 *   s'ouvre sur l'invitation à l'ouvrir (le geste attendu), puis annonce les
 *   nouveautés. « Ouvrir ma fiche » plutôt que « Créer ma fiche » : le même
 *   e-mail part à celles qui ont un brouillon commencé, et un libellé qui
 *   promet une création leur ferait craindre de repartir de zéro.
 * - `avec-fiche` : sa fiche vit déjà (publiée, soumise ou en retrait). On
 *   annonce seulement les nouveautés, sans lui redemander un geste déjà fait.
 *
 * Fonction PURE (testable, aucun envoi) : le tri des destinataires vit dans
 * `src/lib/nouveautes-diffusion.ts`, l'envoi dans l'action orga.
 */
export const VERSIONS_NOUVEAUTES = ["sans-fiche", "avec-fiche"] as const;
export type VersionNouveautes = (typeof VERSIONS_NOUVEAUTES)[number];

/** Couleurs de marque, en dur : un e-mail ne charge ni CSS ni police externes. */
const MAGENTA = "#e6007e";
const GRIS = "#555";

/**
 * URL absolue d'un lien du contenu. Un lien EXTERNE (la chaîne YouTube) se
 * déclare en absolu et passe tel quel : le préfixer donnerait un lien mort.
 */
const url = (lien: string): string =>
  lien.startsWith("http") ? lien : `${BASE_URL}${lien}`;

/**
 * Échappe une valeur destinée à un ATTRIBUT HTML. Les alternatives textuelles
 * sont de la copie libre : une citation entre guillemets droits y casserait
 * l'attribut, donc le balisage.
 */
const attr = (valeur: string): string =>
  valeur
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/**
 * En-tête d'une section de l'e-mail (blocs, « À venir », « Et aussi »).
 *
 * Il rendait 13 px EN CAPITALES avec 0,08 em d'interlettrage, en gris : la
 * forme condamnée par la checklist COGA, sur le titre qui structure la
 * lecture, dans un canal que personne ne relit après envoi. La hiérarchie
 * passe par la taille et la graisse (relecture du 2026-08-16).
 */
function titreSection(texte: string): string {
  return `<h2 style="font-size:15px;font-weight:700;color:${GRIS};margin:32px 0 12px;border-bottom:1px solid #ddd;padding-bottom:6px">${texte}</h2>`;
}

/** Bouton d'action : un lien épais, lisible partout (aucune table imbriquée). */
function bouton(href: string, label: string): string {
  return `<p style="margin:24px 0">
      <a href="${href}" style="background:${MAGENTA};color:#fff;text-decoration:none;border-radius:8px;padding:12px 20px;display:inline-block;font-weight:bold">${label}</a>
    </p>`;
}

/** Une nouveauté : son titre, sa phrase, sa capture d'écran et son lien. */
function blocNouveaute(n: NouveautePlateforme): string {
  const lien = url(n.lien);
  const capture = n.image
    ? `<p style="margin:12px 0">
         <a href="${lien}"><img src="${url(n.image)}" alt="${attr(n.alt)}" width="560" style="width:100%;max-width:560px;height:auto;border:1px solid #ddd;border-radius:8px"></a>
       </p>`
    : "";
  return `<div style="margin:0 0 32px">
      <h3 style="font-size:17px;margin:0 0 6px">${n.titre}</h3>
      <p style="margin:0">${n.texte}</p>
      ${capture}
      <p style="margin:8px 0 0"><a href="${lien}" style="color:${MAGENTA}">${n.lienLabel}</a></p>
    </div>`;
}

/**
 * Un BLOC : son titre, à qui il s'adresse, puis ses nouveautés. Le titre porte
 * le tri à la place de la lectrice — « si tu prépares ta montée sur scène » se
 * saute d'un coup d'œil quand on n'est pas concernée.
 */
function blocSection(b: BlocNouveautes): string {
  const intro = b.intro
    ? `<p style="margin:0 0 20px;color:${GRIS}">${b.intro}</p>`
    : "";
  return `${titreSection(b.titre)}
    ${intro}
    ${b.nouveautes.map(blocNouveaute).join("\n")}`;
}

/** Version texte d'un bloc. */
function lignesBloc(b: BlocNouveautes): string {
  return [
    b.titre.toUpperCase(),
    ...(b.intro ? [b.intro] : []),
    "",
    ...b.nouveautes.map(ligneNouveaute),
  ].join("\n");
}

/** Version texte d'une nouveauté (clients qui affichent le texte brut). */
function ligneNouveaute(n: NouveautePlateforme): string {
  return [`${n.titre}`, n.texte, `${n.lienLabel} : ${url(n.lien)}`, ""].join("\n");
}

export function buildNouveautesEmail({
  name,
  version,
}: {
  name: string | null;
  version: VersionNouveautes;
}): { subject: string; htmlContent: string; textContent: string } {
  const salut = salutation(name);
  const bonjour = escapeHtml(salut);
  const sansFiche = version === "sans-fiche";

  // Le compte vient de la LISTE : un objet qui promet « 3 nouveautés » alors
  // qu'il en porte deux est le genre de détail qui se périme en silence.
  const compte = nb(NOUVEAUTES_PLATEFORME.length, "nouveauté");
  const subject = sansFiche
    ? `Ta fiche speakeuse t'attend, et ${compte}`
    : `${compte} sur la plateforme Tech Speak'Her`;

  const intro = sansFiche
    ? `<p>Tu as un compte sur la plateforme Tech Speak'Her, et ta fiche speakeuse reste à publier.
         C'est elle qui te rend visible auprès des organisatrices qui cherchent des intervenantes : ton nom,
         ta bio, tes sujets, un moyen de te joindre. Dix minutes suffisent, et tu la soumets
         quand tu la trouves prête.</p>
       ${bouton(url("/mon-espace/fiche"), "Ouvrir ma fiche")}
       <p>Pendant ce temps, la plateforme a bougé. Voici l'essentiel :</p>`
    : `<p>Voici en bref ce qui a changé sur la plateforme cet été.</p>`;

  // Une brève sans lien reste du texte : aucun clic promis vers une page qui
  // n'existe pas encore.
  const aVenir = A_VENIR.map(
    (a) =>
      `<li style="margin-bottom:6px">${
        a.lien
          ? `<a href="${url(a.lien)}" style="color:${MAGENTA}">${a.texte}</a>`
          : a.texte
      }</li>`,
  ).join("\n");

  const etAussi = ET_AUSSI.map(
    (a) => `<li style="margin-bottom:6px"><a href="${url(a.lien)}" style="color:${MAGENTA}">${a.texte}</a></li>`,
  ).join("\n");

  const sortie = sansFiche
    ? ""
    : bouton(url("/mon-espace"), "Ouvrir mon espace");

  const htmlContent = `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#222;max-width:600px">
      <p>${bonjour}</p>
      ${intro}
      ${BLOCS_NOUVEAUTES.map(blocSection).join("\n")}
      ${titreSection("À venir")}
      <ul style="margin:0 0 24px;padding-left:20px">
        ${aVenir}
      </ul>
      ${titreSection("Et aussi")}
      <ul style="margin:0 0 24px;padding-left:20px">
        ${etAussi}
      </ul>
      ${sortie}
      <p>Merci de faire vivre la communauté, et au plaisir de te voir sur scène !</p>
      <p>L'équipe Tech Speak'Her</p>
      <p style="color:${GRIS};font-size:13px;border-top:1px solid #ddd;padding-top:12px">
        Tu reçois cette lettre parce que tu as un compte sur techspeakher.fr. Le lien de
        désinscription en bas de cet e-mail l'arrête en un clic, et les e-mails liés à ton compte
        (lien de connexion, décision sur ta fiche, message reçu) continuent d'arriver. Ce choix se
        change aussi dans tes <a href="${url("/mon-espace/reglages")}" style="color:${GRIS}">Réglages</a>.
      </p>
    </div>
  `;

  const textContent = [
    salut,
    "",
    ...(sansFiche
      ? [
          "Tu as un compte sur la plateforme Tech Speak'Her, et ta fiche speakeuse reste à publier.",
          "C'est elle qui te rend visible auprès des organisatrices qui cherchent des intervenantes : ton",
          "nom, ta bio, tes sujets, un moyen de te joindre. Dix minutes suffisent, et tu la soumets",
          "quand tu la trouves prête.",
          "",
          `Ouvrir ma fiche : ${url("/mon-espace/fiche")}`,
          "",
          "Pendant ce temps, la plateforme a bougé. Voici l'essentiel :",
          "",
        ]
      : ["Voici en bref ce qui a changé sur la plateforme cet été.", ""]),
    ...BLOCS_NOUVEAUTES.map(lignesBloc),
    "À VENIR",
    ...A_VENIR.map((a) => `- ${a.texte}${a.lien ? ` ${url(a.lien)}` : ""}`),
    "",
    "ET AUSSI",
    ...ET_AUSSI.map((a) => `- ${a.texte} ${url(a.lien)}`),
    "",
    ...(sansFiche ? [] : [`Ouvrir mon espace\u00a0: ${url("/mon-espace")}`, ""]),
    "Merci de faire vivre la communauté, et au plaisir de te voir sur scène\u00a0!",
    "L'équipe Tech Speak'Her",
    "",
    "Tu reçois cette lettre parce que tu as un compte sur techspeakher.fr. Le lien de",
    "désinscription en bas de cet e-mail l'arrête en un clic ; les e-mails liés à ton compte",
    `continuent d'arriver. Ce choix se change aussi dans tes réglages : ${url("/mon-espace/reglages")}`,
  ].join("\n");

  return { subject, htmlContent, textContent };
}
