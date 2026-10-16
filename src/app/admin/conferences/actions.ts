"use server";

import { revalidatePath } from "next/cache";
import { invaliderAnnuaire } from "@/lib/annuaire-cache";
import { redirect } from "next/navigation";
import { requireOrgaId } from "@/lib/auth-guards";
import {
  parseConferenceForm,
  parseEditionForm,
  parsePropositionOrgaForm,
  parseNomConference,
  ENDPOINT_REGEX,
} from "@/lib/conference-form";
import { detecterEndpointSessionize } from "@/lib/detecteur-sessionize";
import {
  createConference,
  updateConference,
  deleteConference,
  saveEdition,
  updateEdition,
  deleteEdition,
  setEditionActive,
  testSessionizeEndpoint,
  slugifyConference,
} from "@/lib/conferences";
import {
  validateConferenceProposition,
  refuseConferenceProposition,
  updatePropositionParOrga,
  getPropositionEnAttente,
} from "@/lib/conference-propositions";
import { seedConferences } from "@/lib/conference-seed";
import { formValues, type ActionState } from "@/lib/action-state";
import { idDepuis } from "@/lib/id-url";

/** Premier message d'erreur de validation (InlineActionForm affiche UNE alerte). */
function premiereErreur(errors: Record<string, string>): string {
  return Object.values(errors)[0] ?? "Formulaire invalide.";
}

function erreur(formData: FormData, message: string): ActionState {
  return { status: "error", error: message, values: formValues(formData) };
}

const revalider = () => revalidatePath("/admin/conferences", "layout");

/** LA destination après un arbitrage : la file, jamais le catalogue. Une
 * proposition arbitrée quitte la file — on revient là où il en reste. */
const FILE = "/admin/conferences/propositions";

/**
 * Le nom de la conférence arbitrée, pour que la confirmation le DISE (principes
 * UI §5 : un message de confirmation nomme la chose concernée). Le retour se
 * fait en haut d'une file de rangées qui se ressemblent — « Conférence
 * validée » sans nom laissait chercher laquelle.
 *
 * Il vient du champ caché de l'écran, donc du client : borné à la longueur que
 * le schéma autorise, encodé pour l'URL, et rendu par React (donc échappé) à
 * l'arrivée. Absent ou trop long, la phrase reste juste, simplement moins
 * précise — jamais d'erreur pour un paramètre décoratif.
 */
function nomArbitre(formData: FormData): string {
  const nom = (formData.get("nom") ?? "").toString().trim();
  return nom === "" || nom.length > 160 ? "" : `&nom=${encodeURIComponent(nom)}`;
}

/** Slug interne sûr pour une redirection (jamais un chemin arbitraire). */
function slugSafe(formData: FormData): string | null {
  const slug = (formData.get("slug") ?? "").toString();
  return /^[a-z0-9-]+$/.test(slug) ? slug : null;
}

// ─────────────────────────── Conférences ───────────────────────────

/** Création d'une conférence (page /nouvelle) → PRG vers sa page. INSERT-only. */
export async function createConferenceAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireOrgaId();
  const result = parseConferenceForm(formData);
  if (!result.ok) return erreur(formData, premiereErreur(result.errors));
  const created = await createConference(result.data);
  if (!created.ok) {
    return erreur(
      formData,
      "Une conférence porte déjà ce nom. Ouvre-la depuis la liste pour la corriger.",
    );
  }
  revalider();
  redirect(`/admin/conferences/${created.slug}?cree=1`);
}

/**
 * Correction des infos d'une conférence (page /[slug]/modifier). Reste EN PLACE
 * (InlineActionForm) ; ne redirige QUE si le slug change (renommage) — sinon
 * l'ancienne URL [slug] tomberait en 404.
 */
export async function updateConferenceAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireOrgaId();
  const id = Number(formData.get("conferenceId"));
  if (!Number.isInteger(id) || id <= 0) return erreur(formData, "Conférence introuvable.");
  const result = parseConferenceForm(formData);
  if (!result.ok) return erreur(formData, premiereErreur(result.errors));
  const saved = await updateConference(id, result.data);
  if (!saved.ok) {
    return erreur(formData, "Une autre conférence porte déjà ce nom.");
  }
  revalider();
  const ancienSlug = slugSafe(formData);
  const nouveauSlug = slugifyConference(result.data.nom);
  // Renommage → l'URL doit changer : on redirige vers la page à jour. Sinon on
  // reste en place, InlineActionForm affiche la confirmation focalisée.
  if (nouveauSlug !== ancienSlug) {
    redirect(`/admin/conferences/${nouveauSlug}/modifier`);
  }
  return { status: "success" };
}

/** Suppression d'une conférence (page /[slug]/supprimer + ConfirmSubmitButton). */
export async function deleteConferenceAction(formData: FormData): Promise<void> {
  await requireOrgaId();
  const id = Number(formData.get("conferenceId"));
  const slug = slugSafe(formData);
  const retour = slug ? `/admin/conferences/${slug}` : "/admin/conferences";
  if (!Number.isInteger(id) || id <= 0) redirect(retour);
  const result = await deleteConference(id);
  revalider();
  if (!result.ok) redirect(`${retour}?suppr=refus`);
  redirect(`/admin/conferences?supprimee=${encodeURIComponent(result.nom)}`);
}

// ─────────────────────────── Éditions ───────────────────────────

/**
 * L'orga colle l'id, OU l'adresse https de la page programme : l'adresse passe
 * par le détecteur (`detecteur-sessionize.ts`, garde SSRF) et devient l'id —
 * la suite du chemin (re-test Sessionize, écriture) reste inchangée et ne voit
 * jamais qu'un id au format fermé.
 */
async function resoudreEndpointSaisi(
  saisie: string | null,
): Promise<{ ok: true; endpoint: string | null } | { ok: false; erreur: string }> {
  if (saisie === null || ENDPOINT_REGEX.test(saisie)) return { ok: true, endpoint: saisie };
  return detecterEndpointSessionize(saisie);
}

/**
 * Re-teste l'endpoint (si fourni) juste avant d'écrire — même garantie qu'avant.
 *
 * `perdu` nomme ce que le refus a JETÉ : le message disait « l'édition n'a pas
 * été enregistrée » sur l'écran de correction d'une proposition, où aucune
 * édition n'existe encore et où c'est la correction ENTIÈRE (nom, année, ville,
 * lien) qui repart — une orga n'avait aucune raison de deviner que son nom
 * corrigé était parti avec (relevé par la passe justesse).
 */
async function verifieEndpoint(
  endpoint: string | null,
  perdu = "l'édition n'a pas été enregistrée",
): Promise<string | null> {
  if (endpoint == null) return null;
  const test = await testSessionizeEndpoint(endpoint);
  return test.ok
    ? null
    : `Cet id ne répond pas chez Sessionize\u00a0: ${perdu}. Vérifie l'id, ou l'adresse de la page programme.`;
}

/** Création d'une édition (page /[slug]/editions/nouvelle) → PRG vers l'édition. */
export async function createEditionAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireOrgaId();
  const result = parseEditionForm(formData);
  if (!result.ok) return erreur(formData, premiereErreur(result.errors));
  const resolu = await resoudreEndpointSaisi(result.data.endpoint);
  if (!resolu.ok) return erreur(formData, resolu.erreur);
  const pb = await verifieEndpoint(resolu.endpoint);
  if (pb) return erreur(formData, pb);
  // INSERT-only : une même (conférence, année) déjà là = à corriger sur sa page.
  const saved = await saveEdition({
    ...result.data,
    endpoint: resolu.endpoint,
    actif: resolu.endpoint != null,
    mode: "insert",
  });
  if (!saved.ok) {
    return erreur(
      formData,
      "Une édition de cette année existe déjà. Ouvre-la pour la corriger.",
    );
  }
  revalider();
  const slug = slugSafe(formData);
  redirect(
    slug
      ? `/admin/conferences/${slug}/editions/${saved.id}?cree=1`
      : "/admin/conferences",
  );
}

/** Correction d'une édition (page /[slug]/editions/[id]) — reste EN PLACE. */
export async function updateEditionAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireOrgaId();
  const editionId = Number(formData.get("editionId"));
  if (!Number.isInteger(editionId) || editionId <= 0) {
    return erreur(formData, "Édition introuvable.");
  }
  const result = parseEditionForm(formData);
  if (!result.ok) return erreur(formData, premiereErreur(result.errors));
  const resolu = await resoudreEndpointSaisi(result.data.endpoint);
  if (!resolu.ok) return erreur(formData, resolu.erreur);
  const pb = await verifieEndpoint(resolu.endpoint);
  if (pb) return erreur(formData, pb);
  // `actif` n'est pas passé : corriger une édition ne touche pas la moisson
  // (c'est le rôle de l'interrupteur). Retirer l'endpoint la coupe côté lib.
  const saved = await updateEdition(editionId, {
    annee: result.data.annee,
    dateDebut: result.data.dateDebut,
    dateFin: result.data.dateFin,
    ville: result.data.ville,
    lieu: result.data.lieu,
    url: result.data.url,
    endpoint: resolu.endpoint,
  });
  if (!saved.ok) {
    return erreur(formData, "Une autre édition de cette année (ou cet endpoint) existe déjà.");
  }
  revalider();
  return { status: "success" };
}

/** Suppression d'une édition (page /[slug]/editions/[id] + ConfirmSubmitButton). */
export async function deleteEditionAction(formData: FormData): Promise<void> {
  await requireOrgaId();
  const editionId = Number(formData.get("editionId"));
  const slug = slugSafe(formData);
  const retour = slug ? `/admin/conferences/${slug}` : "/admin/conferences";
  if (Number.isInteger(editionId) && editionId > 0) {
    await deleteEdition(editionId);
    revalider();
  }
  redirect(`${retour}?edition-suppr=1`);
}

export type ToggleState = { message?: string };

/** Interrupteur de moisson d'une édition (orga), confirmation nominative. */
export async function toggleMoissonAction(
  _prev: ToggleState,
  formData: FormData,
): Promise<ToggleState> {
  await requireOrgaId();
  const id = Number(formData.get("editionId"));
  const actif = formData.get("actif") === "true";
  if (!Number.isInteger(id) || id <= 0) return {};
  const ok = await setEditionActive(id, actif);
  revalider();
  if (!ok) return { message: "Impossible (pas d'endpoint sur cette édition)." };
  return { message: actif ? "Moisson activée." : "Moisson désactivée." };
}

// ──────────────────── Propositions de conférences (modération) ────────────────────

/**
 * Valide une proposition membre : promotion vers le répertoire (conf + édition)
 * ET mise en ligne des saisies restées derrière (migration 068). Le nombre de
 * talks publiés part dans l'URL : l'orga voit l'effet réel de son clic.
 *
 * Les fiches publiques concernées sont revalidées ici, pas seulement l'admin —
 * sans ça les talks tout juste publiés resserviraient en cache.
 */
export async function validateConferencePropositionAction(formData: FormData): Promise<void> {
  await requireOrgaId();
  const id = idDepuis(formData.get("propositionId"));
  if (id === null) redirect(FILE);
  const r = await validateConferenceProposition(id);
  revalider();
  if (!r.ok) redirect(`${FILE}?prop=${r.raison}${nomArbitre(formData)}`);
  invaliderAnnuaire();
  revalidatePath("/speakeuses");
  revalidatePath("/speakeuses/[id]", "page");
  revalidatePath("/agenda");
  redirect(`${FILE}?prop=validee${nomArbitre(formData)}&talks=${r.occurrences}`);
}

/**
 * Écarte une proposition membre (la ligne reste : des saisies la référencent).
 *
 * Le booléen de la lib va jusqu'à l'écran : une proposition déjà arbitrée dans
 * un autre onglet donne « déjà traitée », plus un succès qui n'a rien écrit
 * (dette soldée le 2026-08-21, avec la garde d'état côté SQL).
 */
export async function refuseConferencePropositionAction(formData: FormData): Promise<void> {
  await requireOrgaId();
  const id = idDepuis(formData.get("propositionId"));
  if (id === null) redirect(FILE);
  const ecartee = await refuseConferenceProposition(id);
  revalider();
  redirect(
    `${FILE}?prop=${ecartee ? "refusee" : "introuvable"}${nomArbitre(formData)}`,
  );
}

/**
 * Corrige une proposition AVANT validation (sous-page « Corriger »). La porte
 * qui manquait : le message de conflit d'endpoint disait déjà « corrige-le »
 * sans qu'aucun écran ne le permette.
 *
 * Reste EN PLACE (`InlineActionForm`) : l'id est la clé de l'URL, donc corriger
 * le nom ne déplace rien — à l'inverse d'une conférence du répertoire, dont le
 * slug EST l'adresse.
 *
 * L'endpoint accepte l'adresse de la page programme, comme les autres écrans
 * orga : le détecteur (garde SSRF) la ramène à un id, et l'écriture ne voit
 * jamais qu'un id au format fermé.
 */
export async function updatePropositionAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireOrgaId();
  const id = idDepuis(formData.get("propositionId"));
  if (id === null) return erreur(formData, "Proposition introuvable.");
  const result = parsePropositionOrgaForm(formData);
  if (!result.ok) return erreur(formData, premiereErreur(result.errors));
  const endpoint = await resoudreEndpointSaisi(result.data.endpoint);
  if (!endpoint.ok) return erreur(formData, endpoint.erreur);
  // Re-testé avant d'écrire, comme sur les éditions : à la validation, un
  // endpoint présent ACTIVE la moisson (`actif: p.endpoint != null`) — un id
  // mort y installerait un repérage qui ne rapporte jamais rien.
  const pb = await verifieEndpoint(endpoint.endpoint, "la correction n'a pas été enregistrée");
  if (pb) return erreur(formData, pb);
  const corrigee = await updatePropositionParOrga(id, {
    ...result.data,
    endpoint: endpoint.endpoint,
  });
  if (!corrigee) {
    return erreur(
      formData,
      "Cette proposition a déjà été traitée : il n'y a plus rien à corriger.",
    );
  }
  revalider();
  return { status: "success" };
}

/**
 * REPRENDRE LE NOM d'une conférence du répertoire, en un geste — la correction
 * qui compte, celle dont dépend le rattachement.
 *
 * Pourquoi une action et pas un lien qui pré-remplit le champ : la version
 * « lien + `defaultValue` » a été écrite, puis MESURÉE. Le serveur envoyait bien
 * `value="Devoxx France"` et la valeur VIVE du champ restait « DevoxxFR » — un
 * champ non contrôlé ne suit pas un `defaultValue` qui change sans remontage, et
 * l'état client reprend la main après hydratation. La parade n'est pas un
 * contournement de plus : c'est de ne rien demander au client. Un clic, une
 * écriture, un aller-retour.
 *
 * RIEN N'EST LU DU CLIENT à part l'id et le nom : l'année, la ville, le lien et
 * l'endpoint sont relus EN BASE. Des champs cachés auraient offert quatre
 * valeurs de plus à falsifier pour un geste qui n'en change qu'une.
 */
export async function reprendreNomAction(formData: FormData): Promise<void> {
  await requireOrgaId();
  const id = idDepuis(formData.get("propositionId"));
  if (id === null) redirect(FILE);
  const proposition = await getPropositionEnAttente(id);
  // Arbitrée entre-temps : la page de l'item le dit, avec le chemin qui reste.
  if (!proposition) redirect(`${FILE}/${id}`);
  // Le nom passe par le MÊME validateur que le formulaire complet.
  const nom = parseNomConference(formData.get("nom"));
  if (nom === null) redirect(`${FILE}/${id}`);
  await updatePropositionParOrga(id, {
    nomConference: nom,
    annee: proposition.annee,
    ville: proposition.ville,
    url: proposition.url,
    endpoint: proposition.endpoint,
  });
  revalider();
  redirect(`${FILE}/${id}?corrige=${encodeURIComponent(nom)}`);
}

/** Amorce le catalogue France (idempotent) → PRG avec feedback. */
export async function seedCatalogueAction(): Promise<void> {
  await requireOrgaId();
  const n = await seedConferences();
  revalider();
  redirect(`/admin/conferences?seed=${n}`);
}
