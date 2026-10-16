import type { AdhesionCompte, AdhesionOrga } from "@/lib/adhesions";
import { statusLabel } from "@/lib/profile-status";
import { DELAI_ADHESION, etatAdhesion, type EtatAdhesion } from "@/lib/adhesion";
import { dateHeureParis, dateLongueParis, formatDateFr, nb } from "@/lib/format";
import type { BilanAdhesions, OrigineSynchro } from "@/lib/bilan-adhesions";

/**
 * Le sous-titre de la rangée « Mon adhésion » (Mon profil). Pur, pour tester
 * chaque état sans rendre la page. Court : un sous-titre DÉCRIT, il tient en
 * deux lignes sur un téléphone ; le détail vit sur la page « Mon adhésion »
 * (docs/principes-conception-ui.md). Forme positive partout.
 */
export function sousTitreAdhesion(
  adhesion: Pick<AdhesionCompte, "expiresAt" | "status"> | null,
  ficheEnPause: boolean,
  maintenant: Date = new Date(),
): string {
  if (ficheEnPause) return "Fiche hors annuaire, en attente de ton adhésion";
  if (!adhesion) return `Aucune adhésion reliée · visible ${DELAI_ADHESION}`;
  const date = dateLongueParis(adhesion.expiresAt);
  const etat = etatAdhesion(adhesion, maintenant);
  if (etat === "close") return "Adhésion arrêtée avant l'échéance · à renouveler sur HelloAsso";
  if (etat === "echue") return `Échue le ${date} · à renouveler sur HelloAsso`;
  return etat === "a_renouveler" ? `À renouveler avant le ${date}` : `Active jusqu'au ${date}`;
}

export interface LigneAdhesionOrga {
  userId: number;
  nom: string;
  detail: string;
}

/** Le groupe de la vue orga, par état : une seule lecture de l'état. */
const GROUPE: Record<EtatAdhesion, "bientot" | "aJour" | "echues"> = {
  active: "aJour",
  a_renouveler: "bientot",
  echue: "echues",
  close: "echues",
};

/**
 * La vue orga, rangée en trois groupes : à renouveler dans les 30 jours, à
 * jour, échues (arrêtées comprises). L'état vient de `etatAdhesion`, la même
 * lecture que la page « Mon adhésion ».
 */
export function groupesAdhesionsOrga(
  adhesions: AdhesionOrga[],
  maintenant: Date = new Date(),
): { bientot: LigneAdhesionOrga[]; aJour: LigneAdhesionOrga[]; echues: LigneAdhesionOrga[] } {
  const groupes = {
    bientot: [] as LigneAdhesionOrga[],
    aJour: [] as LigneAdhesionOrga[],
    echues: [] as LigneAdhesionOrga[],
  };
  for (const a of adhesions) {
    const etat = etatAdhesion(a, maintenant);
    // La date de sortie ne se dit qu'au futur, donc pour une fiche encore en
    // ligne : une fiche en pause garde la date passée de son préavis.
    const fiche = a.ficheStatus
      ? `fiche ${statusLabel(a.ficheStatus).toLowerCase()}${
          a.retraitLe && a.ficheStatus === "publie"
            ? `, sort de l'annuaire le ${dateLongueParis(a.retraitLe)}`
            : ""
        }`
      : "sans fiche";
    const echeance =
      etat === "close"
        ? a.source === "helloasso"
          ? "Arrêtée sur HelloAsso"
          : "Arrêtée avant l'échéance"
        : `${etat === "echue" ? "Échue le" : "Échéance le"} ${dateLongueParis(a.expiresAt)}`;
    const detail = [echeance, fiche, a.source === "manuel" ? "saisie à la main" : null]
      .filter(Boolean)
      .join(" · ");
    groupes[GROUPE[etat]].push({ userId: a.userId, nom: a.name?.trim() || a.email, detail });
  }
  return groupes;
}

/** Qui a lancé la relecture, dit comme une orga le dirait. */
const ORIGINE: Record<OrigineSynchro, string> = {
  cron: "par le passage du soir",
  notification: "à l'arrivée d'une adhésion",
  invitation: "avant l'invitation à adhérer",
  manuelle: "à la demande d'une organisatrice",
};

/**
 * Le bilan de la dernière relecture de HelloAsso, pour la page orga
 * « Adhésions ». Des compteurs d'ARTICLES seulement (reliés + sans compte =
 * lus) ; « sans compte » s'explique, parce que c'est le cas qui peut demander
 * un geste (2026-10-15 : la première adhésion portait une autre adresse que
 * le compte). Un échec dit d'abord quoi faire, puis le détail technique.
 */
export function texteBilanAdhesions(b: BilanAdhesions | null): {
  quand: string;
  lignes: string[];
  alerte: boolean;
} {
  if (!b) return { quand: "Aucune relecture enregistrée pour l'instant.", lignes: [], alerte: false };
  const quand = `Le ${dateHeureParis(b.le)}, ${ORIGINE[b.origine]}.`;
  const r = b.resultat;
  if (r === "non_configuree")
    return {
      quand,
      lignes: ["Les identifiants HelloAsso manquaient\u00a0: aucune adhésion lue à ce passage."],
      alerte: true,
    };
  if ("erreur" in r)
    return {
      quand,
      lignes: [
        "La relecture a échoué. Relance-la avec le bouton ci-dessous dans quelques minutes\u00a0; si l'échec revient, préviens l'équipe technique.",
        `Détail pour l'équipe technique\u00a0: ${r.erreur}`,
      ],
      alerte: true,
    };
  const lignes = [
    `${nb(r.articles, "adhésion")} ${r.articles > 1 ? "lues" : "lue"}\u00a0: ${r.articlesRelies} ${
      r.articlesRelies > 1 ? "reliées" : "reliée"
    } à un compte, ${r.sansCompte} sans compte.`,
  ];
  if (r.sansCompte > 0)
    lignes.push(
      "«\u00a0Sans compte\u00a0»\u00a0: l'adresse donnée à HelloAsso est absente des comptes de la plateforme, ce qui est normal pour une adhérente sans compte. Si elle en a un sous une autre adresse, elle peut y relier son compte Google ou LinkedIn à l'adresse donnée à HelloAsso, ou tu peux corriger l'adresse de l'adhésion dans HelloAsso.",
    );
  return { quand, lignes, alerte: false };
}
