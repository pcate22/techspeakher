"use server";

import { revalidatePath } from "next/cache";
import { invaliderAnnuaire } from "@/lib/annuaire-cache";
import { requireUserId } from "@/lib/auth-guards";
import { isRateLimited } from "@/lib/rate-limit";
import { ensureProfileId } from "@/lib/profiles";
import {
  addTalk,
  addOccurrence,
  getTalksByProfileId,
  getRegistreIndex,
} from "@/lib/talks";
import { soumettreProposition } from "@/lib/conference-propositions";
import { resoudreEvenementsNotist } from "@/lib/notist-evenements";
import { dateLegueeParEdition } from "@/lib/talk-date";
import {
  parseImport,
  construirePlan,
  IMPORT_MAX_TAILLE,
  IMPORT_MAX_PROPOSITIONS,
  type PlanTalk,
} from "@/lib/import-talks";

/**
 * Import de talks (JSON / CSV) en deux temps sur UN écran : prévisualiser,
 * puis confirmer une sélection. Les deux actions repartent du MÊME texte et du
 * MÊME `construirePlan` : ce que la prévisualisation montre est exactement ce
 * que la confirmation écrit — pas de plan sérialisé côté client à croire sur
 * parole.
 *
 * L'écriture réutilise les briques du site telles quelles : `addTalk` /
 * `addOccurrence` (ownership dans le SQL), et `soumettreProposition` pour une
 * conférence hors répertoire — l'occurrence attend l'arbitrage orga (068),
 * exactement comme une saisie manuelle. Importer n'ouvre aucun chemin de
 * publication que le formulaire n'a pas.
 */

export type PreviewState =
  | { ok?: undefined }
  | { ok: true; texte: string; plan: PlanTalk[]; ignorees: number }
  | { ok: false; erreur: string };

export type ImportResultat = {
  talksCrees: number;
  talksCompletes: number;
  occurrencesPubliees: number;
  occurrencesEnAttente: number;
  occurrencesEcartees: number;
  /** Scènes dont la conférence n'a pas pu être NOMMÉE (absente du fichier et
   *  fiche d'événement Notist muette) : le site en exige une, elles passent. */
  scenesSansConference: number;
  doublons: number;
};

export type ConfirmState =
  | { ok?: undefined }
  | { ok: true; resultat: ImportResultat }
  | { ok: false; erreur: string };

/** Le texte soumis : le fichier téléversé s'il y en a un, sinon la zone collée. */
async function lireTexte(formData: FormData): Promise<string | { erreur: string }> {
  const fichier = formData.get("fichier");
  if (fichier instanceof File && fichier.size > 0) {
    if (fichier.size > IMPORT_MAX_TAILLE) {
      return { erreur: "Ce fichier est trop grand : découpe-le et importe en plusieurs fois." };
    }
    return await fichier.text();
  }
  const texte = (formData.get("texte") ?? "").toString();
  if (texte.length > IMPORT_MAX_TAILLE) {
    return { erreur: "Ce texte est trop grand : découpe-le et importe en plusieurs fois." };
  }
  return texte;
}

/** Parse + plan, partagés par les deux actions (une seule vérité). */
async function planDepuisTexte(
  texte: string,
  profileId: number,
): Promise<{ plan: PlanTalk[]; ignorees: number } | { erreur: string }> {
  const parse = parseImport(texte);
  if (!parse.ok) return { erreur: parse.erreur };
  // Les lectures DB partent TOUT DE SUITE : elles se cachent sous la vague
  // HTTP Notist (jusqu'à 30 s) au lieu de s'y additionner.
  const donnees = Promise.all([getRegistreIndex(), getTalksByProfileId(profileId)]);
  // Un rejet DB pendant la vague Notist (30 s) serait orphelin — donc fatal au
  // process au lieu d'une erreur propre. Marqué géré ; l'await plus bas rejette
  // toujours, sur le chemin d'erreur normal de l'action.
  donnees.catch(() => {});
  // Un export Notist tait les noms de conférences : ils vivent dans les fiches
  // d'événements (links.event). On les résout ICI, dans les DEUX actions — le
  // plan affiché et le plan écrit restent une seule vérité. Fiche absente ou
  // en échec : la scène reste « date seule », comme avant le chantier. Le nom
  // obtenu suit le circuit ordinaire (année extraite en ÉDITION, annuaire ou
  // proposition) : l'annuaire reste la mémoire, rien n'est stocké d'autre.
  const idsEvenements = parse.talks.flatMap((t) =>
    t.occurrences
      .filter((o) => o.conference == null && o.evenementNotist != null)
      .map((o) => o.evenementNotist!),
  );
  // Garde-fou d'appels SORTANTS (CLAUDE.md, anti-abus), consommé AU BESOIN
  // RÉEL : une confirmation entièrement servie par la mémoire courte (le cas
  // nominal, juste après la prévisualisation) ne dépense aucun jeton et ne
  // peut pas diverger du plan montré. Quota atteint ET réseau nécessaire :
  // les scènes concernées suivent la voie « date seule », comptées au
  // récapitulatif — l'enrichissement est optionnel, jamais bloquant.
  if (idsEvenements.length > 0) {
    const evenements = await resoudreEvenementsNotist(
      idsEvenements,
      undefined,
      () => !isRateLimited(`notist:${profileId}`, 10, 3_600_000),
    );
    for (const t of parse.talks) {
      for (const o of t.occurrences) {
        if (o.conference != null || o.evenementNotist == null) continue;
        const ev = evenements.get(o.evenementNotist);
        if (!ev) continue;
        o.conference = ev.titre;
        o.ville = o.ville ?? ev.ville;
        o.pays = o.pays ?? ev.pays;
        // Présentation sans date : la fenêtre de l'événement lègue ce qu'elle
        // SAIT — la règle commune du site (un seul jour → le jour, plusieurs
        // jours → le mois), jamais un faux jour de début.
        o.date = dateLegueeParEdition(ev.dateDebut, ev.dateFin, o.date);
      }
    }
  }
  const [registre, existants] = await donnees;
  const plan = construirePlan(
    parse.talks,
    registre,
    existants.map((t) => ({
      id: t.id,
      titre: t.titre,
      occurrences: t.occurrences.map((o) => ({ conference: o.conference, date: o.date })),
    })),
  );
  return { plan, ignorees: parse.ignorees };
}

/** Analyse le fichier et renvoie le plan à l'écran. AUCUNE écriture. */
export async function previewImportAction(
  _prev: PreviewState,
  formData: FormData,
): Promise<PreviewState> {
  const userId = await requireUserId();
  const texte = await lireTexte(formData);
  if (typeof texte !== "string") return { ok: false, erreur: texte.erreur };

  const profileId = await ensureProfileId(userId);
  const r = await planDepuisTexte(texte, profileId);
  if ("erreur" in r) return { ok: false, erreur: r.erreur };
  return { ok: true, texte, plan: r.plan, ignorees: r.ignorees };
}

/** Écrit les talks COCHÉS du plan, recalculé côté serveur depuis le texte. */
export async function confirmImportAction(
  _prev: ConfirmState,
  formData: FormData,
): Promise<ConfirmState> {
  const userId = await requireUserId();

  const texte = await lireTexte(formData);
  if (typeof texte !== "string") return { ok: false, erreur: texte.erreur };

  // Refus à BON MARCHÉ d'abord : aucune case cochée se voit sans recalculer le
  // plan — sinon l'oubli d'une case coûtait jusqu'à 30 s de résolution Notist
  // (et un jeton de quota sortant) pour s'entendre dire de cocher.
  const aucuneCoche = ![...formData.keys()].some((k) => /^talk-\d+$/.test(k));
  if (aucuneCoche) {
    return { ok: false, erreur: "Coche au moins un talk à importer." };
  }

  const profileId = await ensureProfileId(userId);
  const r = await planDepuisTexte(texte, profileId);
  if ("erreur" in r) return { ok: false, erreur: r.erreur };

  const coches = r.plan.filter((_, i) => formData.get(`talk-${i}`) != null);
  if (coches.length === 0) {
    return { ok: false, erreur: "Coche au moins un talk à importer." };
  }

  // Plafond de PROPOSITIONS par lot : l'import déverse dans la file de
  // modération orga, et sans borne un seul fichier pouvait y déposer 300
  // lignes — le formulaire unitaire est, lui, tenu à 5/h. La borne laisse
  // passer un portfolio entier (mesuré à 154 conférences distinctes sur le
  // fichier réel de dix ans) ; au-delà, le fichier se découpe.
  const propositionsDuLot = new Set(
    coches.flatMap((t) =>
      t.occurrences
        .filter((o) => o.action === "proposition")
        .map((o) => `${o.nomPropose}|${o.annee ?? ""}`),
    ),
  );
  if (propositionsDuLot.size > IMPORT_MAX_PROPOSITIONS) {
    return {
      ok: false,
      erreur: `Ce lot propose ${propositionsDuLot.size} conférences hors répertoire (plafond : ${IMPORT_MAX_PROPOSITIONS}). Découpe le fichier, ou décoche des talks.`,
    };
  }

  // Le quota se consomme ICI, tous les contrôles passés : trois soumissions
  // ratées (case décochée, fichier bancal) laissaient sinon la personne
  // bloquée une heure alors que rien n'avait été écrit.
  if (isRateLimited(`import-talks:${userId}`, 3, 3_600_000)) {
    return { ok: false, erreur: "Doucement ! Réessaie dans une heure." };
  }

  const resultat: ImportResultat = {
    talksCrees: 0,
    talksCompletes: 0,
    occurrencesPubliees: 0,
    occurrencesEnAttente: 0,
    occurrencesEcartees: 0,
    scenesSansConference: 0,
    doublons: 0,
  };
  // Une proposition par (conférence, année) au sein du lot : la porte partagée
  // déduplique en base, ce cache évite juste de la re-consulter à chaque talk.
  const propositions = new Map<string, number | "ecartee">();

  for (const talk of coches) {
    resultat.doublons += talk.occurrences.filter((o) => o.action === "doublon").length;
    resultat.scenesSansConference += talk.occurrences.filter(
      (o) => o.action === "ignoree",
    ).length;
    const aEcrire = talk.occurrences.filter(
      (o) => o.action === "registre" || o.action === "proposition",
    );
    // Tout est déjà sur la fiche : rien à écrire, les doublons sont comptés.
    if (talk.statut === "inchange") continue;

    let talkId = talk.talkIdExistant;
    if (talkId == null) {
      talkId = await addTalk(profileId, {
        titre: talk.titre,
        type: "Conférence",
        description: talk.description,
      });
      resultat.talksCrees++;
    }
    const publieesAvant = resultat.occurrencesPubliees + resultat.occurrencesEnAttente;

    for (const o of aEcrire) {
      let propositionId: number | null = null;
      let libelle = o.libelle;

      if (o.action === "proposition") {
        const cle = `${o.nomPropose}|${o.annee ?? ""}`;
        let connue = propositions.get(cle);
        if (connue == null) {
          const soumise = await soumettreProposition({
            userId,
            nomConference: o.nomPropose!,
            annee: o.annee,
            ville: o.ville,
            url: o.lien,
            endpoint: null,
          });
          connue = soumise.ok ? soumise.propositionId : "ecartee";
          propositions.set(cle, connue);
        }
        // Nom déjà écarté par l'équipe : la scène est passée, le talk reste.
        if (connue === "ecartee") {
          resultat.occurrencesEcartees++;
          continue;
        }
        propositionId = connue;
        libelle = o.nomPropose;
      }

      await addOccurrence(talkId, profileId, {
        conferenceId: propositionId == null ? o.conferenceId : null,
        editionId: propositionId == null ? o.editionId : null,
        propositionId,
        conference: libelle,
        ville: o.ville,
        // Un import (Notist, Sessionize) rend une ville en TEXTE : aucun code
        // INSEE, donc aucune région. Le rattrapage géographique les remplira,
        // avec les mêmes règles que la saisie manuelle — inventer une région
        // ici serait deviner.
        codeInsee: null,
        region: null,
        pays: o.pays,
        date: o.date,
        lienConf: o.lien,
        lienSlides: null,
        lienVideo: null,
        lienFeedback: null,
      });
      if (propositionId == null) resultat.occurrencesPubliees++;
      else resultat.occurrencesEnAttente++;
    }
    // « Complété » = au moins une écriture RÉELLE sur un talk existant. Compté
    // avant la boucle, un talk dont toutes les scènes finissaient écartées
    // était annoncé complété alors que rien n'avait été écrit.
    if (
      talk.talkIdExistant != null &&
      resultat.occurrencesPubliees + resultat.occurrencesEnAttente > publieesAvant
    ) {
      resultat.talksCompletes++;
    }
  }

  revalidatePath("/mon-espace/talks");
  revalidatePath("/mon-espace/fiche");
  invaliderAnnuaire();
  revalidatePath("/speakeuses");
  revalidatePath("/speakeuses/[id]", "page");
  return { ok: true, resultat };
}
