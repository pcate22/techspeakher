"use server";

import { invaliderAnnuaire } from "@/lib/annuaire-cache";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { upsertCoachProfile, setCoachProfilePublic } from "@/lib/coach-profiles";
import { isSafeHttpUrl } from "@/components/ExternalLink";
import { audienceParCle } from "@/lib/atelier-audience";
import { requireOrgaId } from "@/lib/auth-guards";
import {
  getEditionById,
  createEdition,
  updateEdition,
  setEditionStatut,
  deleteEdition,
  getEditionDeletionCounts,
  aujourdhuiParis,
} from "@/lib/tremplin-editions";
import { isEditionStatut } from "@/lib/tremplin-statut";
import { isUniqueViolation } from "@/lib/pg-errors";
import { duplicateEdition } from "@/lib/tremplin-duplicate";
import {
  attachUserToRegistration,
  setRegistrationVisibility,
  isConsentBase,
  type ConsentBase,
  updateRegistrationDetails,
  registerUserToEdition,
  setRegistrationFinale,
  setRegistrationPhase,
  isPhaseEntree,
  deleteRegistration,
  getRegistrationById,
  registrationLabel,
  setRegistrationTalk,
} from "@/lib/tremplin-registrations";
import { parseTalkIdentityForm } from "@/lib/talk-form";
import { addTalk, updateTalk, getTalkById } from "@/lib/talks";
import { ensureProfileId } from "@/lib/profiles";
import {
  setRegistrationPhaseMembership,
  setRegistrationPhasePublic,
  getPhaseMembersByEdition,
  cohortePhaseAAjouter,
  isMembershipPhase,
} from "@/lib/tremplin-registration-phases";
import { isValidEmail, optionalUrl } from "@/lib/profile-form";
import {
  setAtelierVisio,
  updateAtelierInfos,
  createAtelierWithMembers,
  setAtelierMembers,
  setAtelierMembre,
  setAtelierAudience,
  setAtelierProgrammePublic,
  echangerOrdreAteliers,
  getAteliersByEdition,
  voisinDansLaPhase,
  estSensDeplacement,
  setAtelierPresences,
  setAtelierPresence,
  getAtelierMembers,
  getAtelierPresences,
  getCohorteAtelier,
  isPresence,
  getAtelierById,
  setAtelierPhase,
  isPhaseAtelier,
  phaseDateCoherente,
  setAtelierNature,
  isNatureAtelier,
  deleteAtelier,
  createSousGroupe,
  updateSousGroupe,
  setCoachDansSousGroupe,
  deleteSousGroupe,
  assignMembreSousGroupe,
  type Presence,
} from "@/lib/tremplin-ateliers";
import { addDocument, deleteDocument } from "@/lib/tremplin-documents";
import { confirmationValide, exigeReecriture, plierConfirmation } from "@/lib/confirmation";
import {
  addPhotoWithPersons,
  deletePhoto,
  addPhotoTag,
  removePhotoTag,
  setPhotoTagConsent,
  updatePhoto,
} from "@/lib/tremplin-photos";
import { getOrCreateUserByEmail, getUserById, setUserNameIfEmpty } from "@/lib/users";
import {
  addCoachToAtelier,
  removeCoachFromAtelier,
  addCoachToRegistration,
  removeCoachFromRegistration,
  estCoachRattache,
  setUserGenre,
  setUserGenreIfUnset,
  markUserAsCoach,
  isGenre,
} from "@/lib/tremplin-coachs";
import {
  addRecompense,
  updateRecompense,
  deleteRecompense,
  setRecompenseBeneficiaire,
  setRecompenseSuivi,
  isRecompenseStatut,
  isRecompenseTransfertRaison,
  type RecompenseInput,
} from "@/lib/tremplin-recompenses";
import { addJury, deleteJury, type JuryInput } from "@/lib/tremplin-jury";
import {
  parseDocumentForm,
  parseAttachForm,
  parseRegistrationDetailsForm,
  parsePhotoForm,
  parseAtelierForm,
  parseAtelierInfosForm,
  parseEditionForm,
  parseEditionUpdateForm,
} from "@/lib/tremplin-form";
import { sendEditionInviteEmail } from "@/lib/tremplin-email";
import { formValues, type ActionState } from "@/lib/action-state";

/**
 * Message de doublon (conf, année) — partagé par la création ET la duplication
 * (même contrainte UNIQUE `idx_editions_conf_annee`), pour qu'une retouche du
 * texte ne laisse pas les deux copies diverger (non couvert par la CI).
 */
const editionConflitMessage = (confSlug: string | null, annee: number) =>
  `Une édition existe déjà pour cette conférence et cette année (${confSlug}, ${annee}).`;

/** Base d'URL admin d'une édition à partir du formulaire, ou null si l'id est invalide. */
function editionBase(formData: FormData): string | null {
  const id = Number(formData.get("editionId"));
  return Number.isInteger(id) && id > 0 ? `/admin/tremplins/${id}` : null;
}

/**
 * Route ISR des pages publiques d'édition. Les actions de visibilité / détails
 * modifient ce qui y est affiché : on la revalide pour que le retrait d'une
 * personne (RGPD) ou une correction soit visible tout de suite, sans attendre
 * les 5 min d'ISR.
 *
 * `"layout"` et non `"page"` : une édition se raconte désormais sur DEUX pages
 * — celle-ci et son enfant `montee-sur-scene`. Avec `"page"`, publier une séance
 * de la phase 3 ou retirer une accompagnée rafraîchissait le chapitre 1 sur-le-
 * champ pendant que le chapitre 2 gardait l'ancien contenu cinq minutes, retrait
 * RGPD compris. `"layout"` couvre la route ET ses enfants.
 */
const PUBLIC_EDITION_ROUTE = "/tremplin/[conf]/[annee]";

/**
 * L'AUTRE page publique que le Tremplin nourrit : `/partenaires` cite les
 * ACCOMPAGNANTES (« Elles donnent de leur temps »), toutes éditions confondues
 * (`listAccompagnantesPubliques`). Elle est STATIQUE avec `revalidate = 300`.
 *
 * Elle se revalide donc partout où change l'une des trois conditions de cette
 * requête : l'ACCORD de la personne (`coach_profiles.public`), son
 * RATTACHEMENT à un atelier, la présence de cet atelier AU PROGRAMME PUBLIC, ou
 * la PUBLICATION de l'édition. Sans quoi elle garde jusqu'à cinq minutes un nom
 * que l'orga vient de retirer — un retrait de consentement (RGPD art. 7-3) qui
 * attend le prochain passage du cache.
 *
 * Trouvé en jouant le parcours de bout en bout (e2e/parcours-tremplin-orga) :
 * la page d'édition se rafraîchissait sur-le-champ, celle-ci non — le geste
 * n'était branché que sur la surface qu'on a sous les yeux en le faisant.
 */
const PUBLIC_PARTENAIRES_ROUTE = "/partenaires";

/** État de `createEditionAction` : le succès REDIRIGE (jamais d'état success). */
export type CreateEditionState = ActionState<object>;

/**
 * Crée une édition du Tremplin — vierge, ou EN DUPLIQUANT une édition modèle
 * (`sourceId` optionnel : créer, c'est souvent repartir de l'édition
 * précédente). Une seule action pour les deux modales (« Créer » avec son
 * sélecteur « À partir de », « Dupliquer » depuis le hub d'une édition).
 *
 * Avec `sourceId`, seul le SQUELETTE des ateliers est recopié — aucune donnée
 * personnelle, description et dates vidées (cf.
 * `docs/tremplin-duplication-edition.md`). Réservé orga. Statut initial
 * `preparation` : invisible du public tant que non ouverte. Doublon
 * (conf, année) → message clair, saisie conservée. Succès → redirection vers
 * la page admin de la nouvelle édition.
 */
export async function createEditionAction(
  _prev: CreateEditionState,
  formData: FormData,
): Promise<CreateEditionState> {
  await requireOrgaId();
  const err = (error: string): CreateEditionState => ({
    status: "error",
    error,
    values: formValues(formData),
  });

  // « À partir de » : champ absent ou vide = édition vierge.
  const sourceBrut = (formData.get("sourceId") ?? "").toString().trim();
  let sourceId: number | null = null;
  if (sourceBrut !== "") {
    sourceId = Number(sourceBrut);
    if (!Number.isInteger(sourceId) || sourceId <= 0) return err("Édition modèle invalide.");
  }

  const parsed = parseEditionForm(formData);
  if (!parsed.ok) return err(parsed.error);
  const { confSlug, annee, nom, confNom, confLieu, confLien } = parsed.data;
  // parseEditionForm garantit un slug non nul (déduit du nom au besoin) ; ce
  // garde narrowe le type `string | null` d'EditionInput pour DuplicateTarget.
  if (!confSlug) return err("Conférence invalide.");

  let editionId: number;
  try {
    if (sourceId !== null) {
      const newId = await duplicateEdition(sourceId, {
        confSlug,
        annee,
        nom,
        confNom,
        confLieu: confLieu ?? null,
        confLien,
      });
      if (newId === null) return err("Édition modèle introuvable (supprimée ?).");
      editionId = newId;
    } else {
      editionId = await createEdition(parsed.data);
    }
  } catch (e) {
    if (isUniqueViolation(e)) {
      return err(editionConflitMessage(confSlug, annee));
    }
    // Libellé par branche : l'orga qui DUPLIQUE ne doit pas lire « création »
    // (et le log oriente le diagnostic).
    const geste = sourceId !== null ? "Duplication" : "Création";
    console.error(`${geste} d'édition échouée`, e);
    return err(`${geste} impossible : réessaie ; si ça persiste, préviens l'équipe technique.`);
  }

  revalidatePath("/admin/tremplins");
  // La redirection (throw NEXT_REDIRECT) doit rester HORS du try/catch.
  redirect(`/admin/tremplins/${editionId}`);
}

/** État des actions d'édition (sous-pages Informations et Statut). */
export type UpdateEditionState = ActionState<object>;

/** Revalide tout ce qui reflète une édition : son sous-arbre admin (layout),
 * les listes admin, le tableau de bord, et les pages publiques (page
 * d'édition, hub conf, page DevFest, et `/partenaires` — dont la liste des
 * accompagnantes ne cite que les éditions PUBLIÉES) — un changement d'édition
 * peut modifier ce que chacune liste. */
function revaliderEditionPartout(editionId: number): void {
  revalidatePath(`/admin/tremplins/${editionId}`, "layout");
  revalidatePath("/admin/tremplins");
  revalidatePath("/admin");
  revalidatePath(PUBLIC_EDITION_ROUTE, "layout");
  revalidatePath("/tremplin/[conf]", "page");
  revalidatePath("/devfest-toulouse");
  revalidatePath(PUBLIC_PARTENAIRES_ROUTE);
}

/**
 * Modifie les champs éditoriaux d'une édition (sous-page « Informations » ;
 * le statut a sa propre action). Réservé orga. **Renvoie un résultat** (pas
 * de redirect) : en cas d'erreur la saisie est conservée et le champ fautif
 * nommé, au lieu de recharger le formulaire depuis la base. Revalide la page
 * publique de l'édition ET les hubs (page conf dédiée, hub générique).
 */
export async function updateEditionAction(
  _prev: UpdateEditionState,
  formData: FormData,
): Promise<UpdateEditionState> {
  await requireOrgaId();
  const err = (error: string): UpdateEditionState => ({
    status: "error",
    error,
    values: formValues(formData),
  });

  const parsed = parseEditionUpdateForm(formData);
  if (!parsed.ok) return err(parsed.error);
  const { editionId, update } = parsed.data;

  const ok = await updateEdition(editionId, update);
  if (!ok) return err("Édition introuvable (supprimée ?).");

  revaliderEditionPartout(editionId);
  return { status: "success" };
}

/**
 * Change le statut d'une édition (sous-page « Statut » — c'est ICI qu'on
 * l'ouvre au public, la clôt ou l'archive). Réservé orga. Le statut change
 * ce que les pages publiques listent → revalidation complète.
 */
export async function setEditionStatutAction(
  _prev: UpdateEditionState,
  formData: FormData,
): Promise<UpdateEditionState> {
  await requireOrgaId();
  const err = (error: string): UpdateEditionState => ({
    status: "error",
    error,
    values: formValues(formData),
  });

  const editionId = Number(formData.get("editionId"));
  if (!Number.isInteger(editionId) || editionId <= 0) return err("Édition invalide.");
  const statut = (formData.get("statut") ?? "").toString();
  if (!isEditionStatut(statut)) return err("Statut inconnu.");

  const ok = await setEditionStatut(editionId, statut);
  if (!ok) return err("Édition introuvable (supprimée ?).");

  revaliderEditionPartout(editionId);
  return { status: "success" };
}

/**
 * Supprime une édition. Réservé orga. Palier 3 QUEL QUE SOIT LE STATUT (§10) :
 * le nom saisi est revérifié ici, avec le même repli qu'au client
 * (`plierConfirmation` — casse, accents, ponctuation, blancs), sinon une saisie
 * acceptée à l'écran serait refusée ici. Une édition en préparation part en
 * hard delete cascadant (elle efface donc PLUS qu'une publiée, qui garde un
 * tombstone) : le statut ne dégrade pas le palier.
 */
export async function deleteEditionAction(formData: FormData): Promise<void> {
  await requireOrgaId();

  const base = editionBase(formData);
  if (!base) redirect("/admin/tremplins");
  const editionId = Number(formData.get("editionId")); // sûr : base valide

  const edition = await getEditionById(editionId);
  if (!edition) redirect("/admin/tremplins"); // inexistante ou déjà supprimée

  // Palier 3, quel que soit le statut (cf. principes-conception-ui.md §10) : le
  // nom saisi doit correspondre, revérifié ICI et pas seulement au navigateur.
  // Une édition « en préparation » n'est pas publique, mais son DELETE est un
  // HARD delete qui cascade sur participantes, ateliers, photos, jury et
  // documents — il efface PLUS que le soft-delete d'une édition publiée. Le
  // statut ne dégrade donc pas le palier.
  // Repli identique au client (`plierConfirmation`), sinon une saisie acceptée
  // à l'écran serait refusée ici.
  // …sauf si l'édition est VIDE : le palier se lit sur l'effet, et supprimer un
  // brouillon qui ne porte rien n'emporte rien. C'est le cas fréquent (édition
  // créée par erreur) ; lui imposer une saisie serait du rite, pas un filet.
  const { total } = await getEditionDeletionCounts(editionId);
  if (exigeReecriture(total)) {
    const saisie = (formData.get("confirmation") ?? "").toString();
    if (!confirmationValide(edition.nom, saisie)) redirect(`${base}/retrait?err=edition_nom`);
  }

  const outcome = await deleteEdition(editionId);
  if (outcome === "introuvable") redirect("/admin/tremplins");

  revaliderEditionPartout(editionId);
  redirect("/admin/tremplins");
}

/**
 * Rattache une inscription (saisie orga) à un compte, par e-mail. Réservé orga.
 * Pas besoin d'un compte préexistant : si l'e-mail est inconnu, on pré-crée le
 * compte (ligne `users` sans profil) et on invite la personne à se connecter ;
 * à sa 1ʳᵉ connexion avec ce même e-mail elle récupère son espace.
 */
export async function attachRegistrationAction(
  _prev: AttachState,
  formData: FormData,
): Promise<AttachState> {
  await requireOrgaId();
  const err = (error: string): AttachState => ({
    status: "error",
    error,
    values: formValues(formData),
  });

  const parsed = parseAttachForm(formData);
  if (!parsed.ok) return err(parsed.error);
  const { editionId, registrationId, compteId, email, nom } = parsed.data;

  // Compte inconnu → pré-création (la personne sera invitée à se connecter).
  // Le nom saisi complète un compte SANS nom (jamais n'écrase un nom existant,
  // cf. getOrCreateUserByEmail) : on évite les comptes anonymes.
  // Deux chemins : un COMPTE existant choisi dans la recherche (rattachement
  // direct, personne déjà joignable) ou une INVITATION par e-mail.
  let user: { id: number; name: string | null; email: string | null };
  let created = false;
  const parCompte = compteId !== null;
  // NB : on re-teste `compteId !== null` (et non `parCompte`) pour que
  // TypeScript restreigne le type à `number` dans la branche.
  if (compteId !== null) {
    const existant = await getUserById(compteId);
    if (!existant) return err("Ce compte n'existe pas (ou plus).");
    user = existant;
    if (nom) await setUserNameIfEmpty(compteId, nom);
  } else {
    const r = await getOrCreateUserByEmail(email!, nom ?? undefined);
    user = r.user;
    created = r.created;
  }

  // La lib possède le résultat complet (y compris le conflit UNIQUE), l'action
  // ne lit aucun code d'erreur du driver et n'annonce un succès que si rattaché.
  const outcome = await attachUserToRegistration(registrationId, user.id, editionId);
  if (outcome === "deja_rattache") {
    return err("Ce compte est déjà rattaché à une autre inscription de cette édition.");
  }
  if (outcome === "occupee") {
    return err("Cette inscription est déjà rattachée à un compte, ou n'appartient pas à cette édition.");
  }

  // E-mail « ton espace est prêt » (best-effort : un échec ne bloque pas,
  // mais il est SIGNALÉ à l'orga via `invited`).
  const invited = parCompte ? false : await sendEditionInviteEmail(user, editionId);

  revalidatePath(`/admin/tremplins/${editionId}`, "layout");
  return {
    status: "success",
    email: user.email ?? user.name ?? `compte n° ${user.id}`,
    invited,
    created,
    parCompte,
  };
}

/**
 * États des actions « à résultat » (via `useActionState`) : pas de redirect,
 * la modale reste ouverte pour enchaîner les saisies. Sur erreur, `values`
 * restaure la saisie (React 19 vide le formulaire à chaque soumission).
 */
export type CreateDocumentState = ActionState<{ titre: string }>;
/** État des actions simples de fiche (bascules, suppressions ciblées). */
export type FicheActionState = ActionState<object>;
export type AttachState = ActionState<{
  email: string;
  invited: boolean;
  created: boolean;
  /** Rattaché à un compte existant choisi (pas d'invitation e-mail attendue). */
  parCompte: boolean;
}>;
export type AddPhotoState = ActionState<object>;
export type AddParticipanteState = ActionState<{ resume: string }>;
export type CreateAtelierState = ActionState<{ titre: string }>;

/**
 * Ajoute un document à une édition et **renvoie un résultat** (pas de redirect).
 * Réservé orga. Portée : atelier (partagé), inscription (individuel privé) ou
 * général — pré-remplie par la section appelante. Support requis (lien http(s)
 * **ou** contenu). L'auteur est l'orga connectée.
 */
export async function createDocumentAction(
  _prev: CreateDocumentState,
  formData: FormData,
): Promise<CreateDocumentState> {
  const orgaId = await requireOrgaId();
  const err = (error: string): CreateDocumentState => ({
    status: "error",
    error,
    values: formValues(formData),
  });

  const editionId = Number(formData.get("editionId"));
  if (!Number.isInteger(editionId) || editionId <= 0) return err("Édition invalide.");

  const parsed = parseDocumentForm(formData, orgaId);
  if (!parsed.ok) return err(parsed.error);

  try {
    // addDocument vérifie que l'atelier / l'inscription appartient à l'édition.
    await addDocument(editionId, parsed.data);
  } catch (e) {
    console.error("Ajout document échoué", e);
    return err("Ajout impossible : cible hors de cette édition ?");
  }
  // "layout" : la ressource apparaît sur la route enfant /ressources (pas
  // seulement sur le hub) — le scope page seul ne la rafraîchirait pas.
  revalidatePath(`/admin/tremplins/${editionId}`, "layout");
  return { status: "success", titre: parsed.data.titre };
}

/**
 * Inscrit une ou PLUSIEURS participantes d'un coup : des COMPTES choisis dans
 * la liste des speakeuses (`compteId`, répété) et/ou UN e-mail (compte
 * retrouvé ou pré-créé ; elle complètera son profil à sa connexion) — les
 * deux se cumulent (retour preview : choisir une connue PUIS inviter une
 * inconnue ne doit pas perdre la première). On ne demande PAS le statut
 * finaliste ici (inconnu à l'inscription — il se pose ensuite via la bascule).
 * Réservé orga. Tout est validé (édition, comptes) AVANT la première
 * écriture : pas de ligne `users` orpheline ni d'inscription partielle sur
 * une saisie invalide. Une « déjà inscrite » ne bloque pas les autres : elle
 * est nommée dans le résumé.
 */
export async function addParticipanteAction(
  _prev: AddParticipanteState,
  formData: FormData,
): Promise<AddParticipanteState> {
  await requireOrgaId();
  const err = (error: string): AddParticipanteState => ({
    status: "error",
    error,
    values: formValues(formData),
  });

  const editionId = Number(formData.get("editionId"));
  if (!Number.isInteger(editionId) || editionId <= 0) return err("Édition invalide.");

  const compteIds = formData
    .getAll("compteId")
    .map((v) => v.toString().trim())
    .filter((v) => v !== "")
    .map(Number);
  if (compteIds.some((id) => !Number.isInteger(id) || id <= 0)) {
    return err("Compte invalide.");
  }
  const email = (formData.get("email") ?? "").toString().trim().toLowerCase();
  if (compteIds.length === 0 && email === "") {
    return err("Choisis une speakeuse dans la liste, ou saisis son e-mail.");
  }
  if (email !== "" && !isValidEmail(email)) return err("E-mail invalide.");

  try {
    const edition = await getEditionById(editionId);
    if (!edition) return err("Édition introuvable (supprimée ?).");

    // Comptes résolus AVANT toute écriture : un id périmé annule tout.
    const users = await Promise.all(compteIds.map((id) => getUserById(id)));
    if (users.some((u) => !u)) return err("Compte introuvable (supprimé ?).");
    const comptes = users.filter((u) => u !== null);

    // Phase d'entrée pré-remplie : après la finale, un ajout rejoint la
    // phase 3 (accompagnement montée sur scène) ; modifiable sur sa fiche.
    const phase =
      edition.finaleDate && edition.finaleDate < aujourdhuiParis()
        ? "montee_sur_scene"
        : "cfp_et_pitch";

    const libelle = (u: (typeof comptes)[number]) =>
      u.email ?? u.name ?? `compte n° ${u.id}`;
    const inscrites: typeof comptes = [];
    const dejaInscrites: string[] = [];
    // Dédoublonné par compte : la même personne choisie dans la liste ET
    // saisie par son e-mail ne doit ni s'inscrire deux fois ni sortir dans le
    // résumé comme « déjà inscrite » alors qu'elle vient de l'être.
    const vus = new Set<number>();
    const inscrire = async (user: (typeof comptes)[number]) => {
      if (vus.has(user.id)) return;
      vus.add(user.id);
      const outcome = await registerUserToEdition(editionId, user.id, phase);
      if (outcome === "deja_inscrite") dejaInscrites.push(libelle(user));
      else inscrites.push(user);
    };
    for (const user of comptes) await inscrire(user);
    // Le compte de l'e-mail n'est (pré-)créé qu'APRÈS les inscriptions des
    // comptes choisis, et inscrit dans la foulée : pas de ligne `users`
    // orpheline si une inscription précédente échoue.
    if (email !== "") await inscrire((await getOrCreateUserByEmail(email)).user);
    if (inscrites.length === 0) {
      return err(
        dejaInscrites.length > 1
          ? "Elles sont toutes déjà inscrites sur cette édition."
          : "Elle est déjà inscrite sur cette édition.",
      );
    }

    // Invitations best-effort : un échec n'annule pas les inscriptions.
    const envois = await Promise.all(
      inscrites.map((u) => sendEditionInviteEmail(u, editionId)),
    );
    const toutesInvitees = envois.every(Boolean);

    const resume = [
      inscrites.length === 1
        ? toutesInvitees
          ? `${libelle(inscrites[0])} inscrite et invitée.`
          : `${libelle(inscrites[0])} inscrite, mais l'e-mail d'invitation n'est pas parti : préviens-la directement.`
        : toutesInvitees
          ? `${inscrites.length} speakeuses inscrites et invitées.`
          : `${inscrites.length} speakeuses inscrites, mais des e-mails d'invitation ne sont pas partis : préviens-les directement.`,
      dejaInscrites.length > 0 &&
        `Déjà inscrite${dejaInscrites.length > 1 ? "s" : ""} : ${dejaInscrites.join(", ")}.`,
    ]
      .filter(Boolean)
      .join(" ");

    // "layout" : l'inscrite apparaît sur la route enfant /participantes (pas
    // seulement sur le hub) — le scope page seul ne la rafraîchirait pas.
    revalidatePath(`/admin/tremplins/${editionId}`, "layout");
    return { status: "success", resume };
  } catch (e) {
    console.error("Ajout participante échoué", e);
    return err("Inscription impossible : réessaie ; si ça persiste, préviens l'équipe technique.");
  }
}

/**
 * Retire une participante d'une édition (e-mail erroné, désinscription).
 * Réservé orga, scopé à l'édition. Palier 3 : le nom est retapé ET revérifié
 * ici, parce que la cascade emporte les données d'une AUTRE personne
 * (documents, tags photo, appartenances d'atelier, journal de consentement).
 */
export async function deleteRegistrationAction(formData: FormData): Promise<void> {
  await requireOrgaId();

  const base = editionBase(formData);
  if (!base) redirect("/admin/tremplins");
  const editionId = Number(formData.get("editionId")); // sûr : base valide
  const registrationId = Number(formData.get("registrationId"));
  if (!Number.isInteger(registrationId) || registrationId <= 0) {
    redirect(`${base}?err=retrait`);
  }

  // Palier 3 (§10) : le retrait efface les données d'une AUTRE personne
  // (documents, tags photo, ateliers, journal de consentement). On retape son
  // nom, et on le revérifie ici — `registrationLabel` est le libellé exact
  // affiché par la page, pour que les deux côtés attendent la même chose.
  const inscription = await getRegistrationById(registrationId, editionId);
  if (!inscription) redirect(`${base}?err=retrait`);
  // NB : palier 3 inconditionnel ici (le retrait emporte toujours les données
  // d'une autre personne), et le garde `length > 0` évite d'enfermer une
  // inscription dont le libellé serait vide — d'où le fait que ce site n'utilise
  // pas `confirmationValide`, qui échoue fermé. Divergence assumée, pas un oubli.
  const attenduNom = plierConfirmation(registrationLabel(inscription));
  const saisieNom = plierConfirmation((formData.get("confirmation") ?? "").toString());
  if (attenduNom.length > 0 && saisieNom !== attenduNom) {
    redirect(`${base}/participantes/${registrationId}/retrait?err=participante_nom`);
  }

  const ok = await deleteRegistration(registrationId, editionId);
  if (!ok) redirect(`${base}?err=retrait`);

  revalidatePath(base);
  revalidatePath(PUBLIC_EDITION_ROUTE, "layout");
  redirect(`${base}?ok=participante_retiree`);
}

/**
 * Marque (ou retire) le statut « finaliste / présente à la soirée » d'une
 * inscription. Réservé orga, scopé à l'édition. Rafraîchit aussi la page
 * publique (les compteurs et la galerie en dépendent).
 */
export async function setRegistrationFinaleAction(
  _prev: FicheActionState,
  formData: FormData,
): Promise<FicheActionState> {
  await requireOrgaId();
  const err = (error: string): FicheActionState => ({
    status: "error",
    error,
    values: formValues(formData),
  });

  const editionId = Number(formData.get("editionId"));
  const registrationId = Number(formData.get("registrationId"));
  if (!Number.isInteger(editionId) || editionId <= 0) return err("Édition invalide.");
  if (!Number.isInteger(registrationId) || registrationId <= 0) {
    return err("Inscription invalide.");
  }

  const present = (formData.get("present") ?? "").toString() === "true";
  // Invariant phase 2 ⊂ phase 1 : marquer finaliste GARANTIT l'appartenance à la
  // phase 1 (peu importe le chemin : fiche, POST rejoué…). On la sème AVANT de
  // poser la finale — si la pose échoue, on reste cohérent (phase 1 sans finale).
  if (present) {
    const ok = await setRegistrationPhaseMembership(
      registrationId,
      editionId,
      "cfp_et_pitch",
      true,
    );
    if (!ok) return err("Inscription introuvable pour cette édition.");
  }
  const ok = await setRegistrationFinale(registrationId, editionId, present);
  if (!ok) return err("Inscription introuvable pour cette édition.");

  revalidatePath(`/admin/tremplins/${editionId}`, "layout");
  revalidatePath(PUBLIC_EDITION_ROUTE, "layout");
  return { status: "success" };
}

/**
 * Active ou retire le consentement « visible publiquement » d'une inscription
 * (nom + talk dans la galerie et le palmarès). Réservé orga, scopé à l'édition.
 * La valeur cible vient du bouton du formulaire (publier / masquer).
 */
export async function setRegistrationVisibilityAction(
  _prev: FicheActionState,
  formData: FormData,
): Promise<FicheActionState> {
  await requireOrgaId();
  const err = (error: string): FicheActionState => ({
    status: "error",
    error,
    values: formValues(formData),
  });

  const editionId = Number(formData.get("editionId"));
  const registrationId = Number(formData.get("registrationId"));
  if (!Number.isInteger(editionId) || editionId <= 0) return err("Édition invalide.");
  if (!Number.isInteger(registrationId) || registrationId <= 0) {
    return err("Inscription invalide.");
  }

  const isPublic = (formData.get("public") ?? "").toString() === "true";

  // À l'OCTROI seulement, l'orga qualifie la base du consentement (recueil
  // externe) et peut joindre un lien de preuve. Un retrait n'a pas de base :
  // les champs sont ignorés (cf. setRegistrationVisibility).
  let base: ConsentBase = "self";
  let preuveLien: string | null = null;
  if (isPublic) {
    const brut = (formData.get("base") ?? "").toString();
    // L'orga atteste un recueil EXTERNE : 'self' (la personne elle-même) passe
    // par son espace, pas par ici — on le refuse pour ne pas maquiller l'origine.
    if (!isConsentBase(brut) || brut === "self") {
      return err("Précise d'où vient l'autorisation de diffusion.");
    }
    base = brut;
    const preuve = optionalUrl.safeParse(formData.get("preuveLien") ?? "");
    if (!preuve.success) return err("Lien de preuve invalide (ex. exemple.com).");
    preuveLien = preuve.data;
  }

  const ok = await setRegistrationVisibility(
    registrationId,
    editionId,
    isPublic,
    base,
    preuveLien,
  );
  if (!ok) return err("Inscription introuvable pour cette édition.");

  revalidatePath(`/admin/tremplins/${editionId}`, "layout");
  revalidatePath(PUBLIC_EDITION_ROUTE, "layout");
  return { status: "success" };
}

/**
 * Met à jour le classement de podium d'une inscription (mérite d'édition).
 * Réservé orga, scopé à l'édition. La bio / le site / la photo ne sont plus
 * édités ici : données personnelles, gérées par la speakeuse sur sa fiche.
 */
export async function updateRegistrationDetailsAction(
  _prev: FicheActionState,
  formData: FormData,
): Promise<FicheActionState> {
  await requireOrgaId();
  const err = (error: string): FicheActionState => ({
    status: "error",
    error,
    values: formValues(formData),
  });

  const parsed = parseRegistrationDetailsForm(formData);
  if (!parsed.ok) return err(parsed.error);
  const { editionId, registrationId, classement } = parsed.data;

  let ok: boolean;
  try {
    ok = await updateRegistrationDetails(registrationId, editionId, { classement });
  } catch (e) {
    // Rang de podium déjà pris (index unique edition_id, classement) : message
    // clair plutôt qu'un « oups », la saisie est conservée.
    if (isUniqueViolation(e)) {
      return err(`Ce classement (${classement}) est déjà attribué à une autre participante de l'édition.`);
    }
    console.error("Mise à jour des détails échouée", e);
    return err("Enregistrement impossible : réessaie ; si ça persiste, préviens l'équipe technique.");
  }
  if (!ok) return err("Inscription introuvable pour cette édition.");

  revalidatePath(`/admin/tremplins/${editionId}`, "layout");
  revalidatePath(PUBLIC_EDITION_ROUTE, "layout");
  return { status: "success" };
}

/**
 * Ajoute une photo (par URL) à une édition et tague les personnes présentes,
 * en une seule transaction. Réservé orga, scopé à l'édition. URL http(s)
 * obligatoire. La photo et son inventaire (droit à l'image) sont créés
 * atomiquement : jamais de photo publiée sans ses tags.
 */
export async function addPhotoAction(
  _prev: AddPhotoState,
  formData: FormData,
): Promise<AddPhotoState> {
  await requireOrgaId();
  const err = (error: string): AddPhotoState => ({
    status: "error",
    error,
    values: formValues(formData),
  });

  const parsed = parsePhotoForm(formData);
  if (!parsed.ok) return err(parsed.error);
  const { editionId, url, legende, kind, registrationIds } = parsed.data;

  try {
    await addPhotoWithPersons(editionId, { url, legende, kind }, registrationIds);
  } catch (e) {
    console.error("Ajout photo échoué", e);
    return err("Ajout impossible : vérifie l'adresse de la photo et réessaie.");
  }

  revalidatePath(`/admin/tremplins/${editionId}`, "layout");
  revalidatePath(PUBLIC_EDITION_ROUTE, "layout");
  return { status: "success" };
}

/**
 * Met à jour les informations de fond d'un atelier (titre, date, horaires,
 * description) depuis SA FICHE — l'atelier s'édite désormais au même endroit
 * qu'il se consulte, plus dans une modale séparée. Réservé orga, scopé à
 * l'édition. Validation partagée avec la création (`parseAtelierInfosForm` :
 * titre requis + bornes, date calendaire, horaires HH:MM) : un champ invalide
 * remonte une erreur claire au lieu d'un 500 sur la contrainte Postgres.
 */
export async function updateAtelierInfosAction(
  _prev: FicheActionState,
  formData: FormData,
): Promise<FicheActionState> {
  await requireOrgaId();
  const err = (error: string): FicheActionState => ({
    status: "error",
    error,
    values: formValues(formData),
  });

  const editionId = Number(formData.get("editionId"));
  const atelierId = Number(formData.get("atelierId"));
  if (!Number.isInteger(editionId) || editionId <= 0) return err("Édition invalide.");
  if (!Number.isInteger(atelierId) || atelierId <= 0) return err("Atelier invalide.");

  const parsed = parseAtelierInfosForm(formData);
  if (!parsed.ok) return err(parsed.error);

  // La phase (avant / après la soirée) est éditée dans CE même formulaire : elle
  // dépend de la date, on les valide ensemble plutôt que sur deux pages.
  const phase = (formData.get("phase") ?? "").toString();
  if (!isPhaseAtelier(phase)) return err("Phase inconnue.");

  // La nature (collectif / sous-groupes) est aussi éditée ici (un seul
  // formulaire « informations »). Autorité serveur : valeur inconnue rejetée.
  const nature = (formData.get("nature") ?? "").toString();
  if (!isNatureAtelier(nature)) return err("Nature inconnue.");

  // Cohérence date ↔ phase : une date « avant la soirée » ne peut pas tomber
  // après la finale (et inversement). On vérifie la phase ET la date SOUMISES
  // (les deux peuvent changer d'un coup) contre la date de finale de l'édition.
  const [atelier, edition] = await Promise.all([
    getAtelierById(atelierId, editionId),
    getEditionById(editionId),
  ]);
  if (!atelier) return err("Atelier introuvable pour cette édition.");
  if (!phaseDateCoherente(phase, parsed.data.date, edition?.finaleDate ?? null)) {
    return err(
      phase === "cfp_et_pitch"
        ? "Un atelier « avant la soirée » ne peut pas être daté après la finale. Change la date ou la phase."
        : "Un atelier « après la soirée » ne peut pas être daté avant la finale. Change la date ou la phase.",
    );
  }

  const ok = await updateAtelierInfos(atelierId, editionId, parsed.data);
  if (!ok) return err("Atelier introuvable pour cette édition.");
  // Phase + nature dans la foulée (l'atelier existe : le premier UPDATE a
  // réussi). Après la validation, ces UPDATE ne peuvent plus échouer.
  await setAtelierPhase(atelierId, editionId, phase);
  await setAtelierNature(atelierId, editionId, nature);

  revalidatePath(`/admin/tremplins/${editionId}`, "layout");
  revalidatePath(PUBLIC_EDITION_ROUTE, "layout");
  return { status: "success" };
}

/**
 * Monte ou descend une séance d'un rang DANS SA PHASE — le geste par lequel
 * l'orga conçoit la cadence, avant même d'avoir les dates.
 *
 * Le voisin est calculé CÔTÉ SERVEUR (`voisinDansLaPhase`) à partir du
 * programme réel : le client n'envoie qu'un sens, jamais l'id de la séance avec
 * laquelle échanger. Sinon on pourrait faire échanger deux séances
 * quelconques — y compris à travers les phases, ce que le geste n'autorise pas.
 *
 * En bout de phase, il n'y a rien à faire : on répond succès sans écrire (le
 * bouton est déjà désactivé, ce n'est qu'un garde-fou serveur). Réservé orga,
 * scopé à l'édition.
 */
export async function deplacerAtelierAction(
  _prev: FicheActionState,
  formData: FormData,
): Promise<FicheActionState> {
  await requireOrgaId();
  const err = (error: string): FicheActionState => ({
    status: "error",
    error,
    values: formValues(formData),
  });

  const editionId = Number(formData.get("editionId"));
  const atelierId = Number(formData.get("atelierId"));
  if (!Number.isInteger(editionId) || editionId <= 0) return err("Édition invalide.");
  if (!Number.isInteger(atelierId) || atelierId <= 0) return err("Atelier invalide.");
  const sens = formData.get("sens");
  if (!estSensDeplacement(sens)) return err("Sens de déplacement inconnu.");

  try {
    const programme = await getAteliersByEdition(editionId);
    if (!programme.some((a) => a.id === atelierId)) {
      return err("Atelier introuvable pour cette édition.");
    }
    const voisin = voisinDansLaPhase(programme, atelierId, sens);
    // Déjà en bout de phase : rien à échanger, et rien d'anormal.
    if (voisin) {
      const ok = await echangerOrdreAteliers(editionId, atelierId, voisin.id);
      if (!ok) return err("Atelier introuvable pour cette édition.");
    }
  } catch (e) {
    console.error("Déplacement d'atelier échoué", e);
    return err("Enregistrement impossible : réessaie ; si ça persiste, préviens l'équipe technique.");
  }

  revalidatePath(`/admin/tremplins/${editionId}`, "layout");
  // Le programme public numérote les étapes avec `ordre` : il change aussi.
  revalidatePath(PUBLIC_EDITION_ROUTE, "layout");
  return { status: "success" };
}

/**
 * Crée un atelier et pose ses membres, en une transaction (atomique). Réservé
 * orga. Les membres posés à la création sont l'inventaire nominatif
 * (présences) ; « ouvert à toutes » est une propriété à part, désactivée par
 * défaut (l'atelier neuf n'est visible que de l'orga). Renvoie un résultat.
 */
export async function createAtelierAction(
  _prev: CreateAtelierState,
  formData: FormData,
): Promise<CreateAtelierState> {
  await requireOrgaId();
  const err = (error: string): CreateAtelierState => ({
    status: "error",
    error,
    values: formValues(formData),
  });

  const parsed = parseAtelierForm(formData);
  if (!parsed.ok) return err(parsed.error);
  const { editionId, atelier, registrationIds } = parsed.data;

  try {
    await createAtelierWithMembers(editionId, atelier, registrationIds);
  } catch (e) {
    console.error("Création atelier échouée", e);
    return err("Création de l'atelier impossible.");
  }
  // "layout" : l'atelier apparaît sur la route enfant /ateliers (pas seulement
  // sur le hub) — le scope page seul ne la rafraîchirait pas.
  revalidatePath(`/admin/tremplins/${editionId}`, "layout");
  revalidatePath(PUBLIC_EDITION_ROUTE, "layout");
  return { status: "success", titre: atelier.titre };
}

/**
 * Supprime un atelier (séance annulée, doublon créé par erreur). Réservé orga,
 * scopé à l'édition. La cascade du schéma emporte avec lui ses participantes et
 * leurs présences, ses sous-groupes, ses coachs reliés et ses supports — les
 * inscriptions, elles, restent : on retire une séance du parcours, pas des
 * personnes de l'édition.
 *
 * PALIER (principes-conception-ui.md §10, décision du 01/08) : un atelier n'est
 * PAS assez critique pour le type-to-confirm, et le geste doit tenir en DEUX
 * actions — ouvrir sa page de retrait depuis la fiche, puis appuyer. La page
 * arme (elle ne fait que ça, et elle chiffre ce qui va partir), le bouton
 * confirme. Rien à retaper donc, même quand l'atelier porte des présences : une
 * séance se repointe, là où une ÉDITION supprimée (palier 3, plus haut) emporte
 * le travail de toute une promotion.
 */
export async function deleteAtelierAction(formData: FormData): Promise<void> {
  await requireOrgaId();

  const base = editionBase(formData);
  if (!base) redirect("/admin/tremplins");
  const editionId = Number(formData.get("editionId")); // sûr : base valide
  const atelierId = Number(formData.get("atelierId"));
  if (!Number.isInteger(atelierId) || atelierId <= 0) redirect(`${base}/ateliers?err=atelier`);

  const atelier = await getAtelierById(atelierId, editionId);
  if (!atelier) redirect(`${base}/ateliers?err=atelier`);

  const ok = await deleteAtelier(atelierId, editionId);
  if (!ok) redirect(`${base}/ateliers?err=atelier`);

  revalidatePath(`/admin/tremplins/${editionId}`, "layout");
  revalidatePath(PUBLIC_EDITION_ROUTE, "layout");
  // L'atelier emporte ses coachs reliés, donc le crédit public qu'il portait.
  revalidatePath(PUBLIC_PARTENAIRES_ROUTE);
  // La fiche de l'atelier n'existe plus : on revient à la liste, qui l'annonce.
  redirect(`${base}/ateliers?ok=atelier_supprime`);
}

/**
 * Supprime un atelier DEPUIS LA LISTE, au bout du glissement de sa rangée
 * (`RangeeGlissante`). Même geste que `deleteAtelierAction`, deux différences
 * qui comptent :
 *
 * 1. Pattern RÉSULTAT et non redirection (principes §4) : une micro-action dans
 *    une liste ne doit pas remettre la page en haut ni replier « ateliers
 *    passés ». La rangée annonce elle-même le résultat, sur place.
 * 2. Le filet n'est pas une modale mais les DEUX TEMPS du geste : la poubelle
 *    reste hors d'atteinte tant qu'on n'a pas glissé la rangée exprès, et la
 *    rangée dit déjà ce que l'atelier porte. La confirmation, elle, redit ce qui
 *    est parti (`confirmationRetraitAtelier`). Aucun titre à retaper : un
 *    atelier n'est pas assez critique pour ça (§10, décision du 01/08).
 */
export async function retirerAtelierAction(
  _prev: FicheActionState,
  formData: FormData,
): Promise<FicheActionState> {
  await requireOrgaId();
  const err = (error: string): FicheActionState => ({
    status: "error",
    error,
    values: formValues(formData),
  });

  const editionId = Number(formData.get("editionId"));
  const atelierId = Number(formData.get("atelierId"));
  if (!Number.isInteger(editionId) || editionId <= 0) return err("Édition invalide.");
  if (!Number.isInteger(atelierId) || atelierId <= 0) return err("Atelier invalide.");

  const atelier = await getAtelierById(atelierId, editionId);
  if (!atelier) return err("Atelier introuvable pour cette édition.");

  const ok = await deleteAtelier(atelierId, editionId);
  if (!ok) return err("Atelier introuvable pour cette édition.");

  // AUCUNE revalidation ici, et c'est délibéré — mesuré, pas supposé.
  //
  // Une `revalidatePath`, sur N'IMPORTE quel chemin, vide le cache de routeur et
  // fait re-rendre la route COURANTE dans la réponse même de l'action : React
  // applique ce nouvel arbre en même temps que l'état retourné, et la rangée est
  // démontée avant d'avoir pu rendre sa confirmation. Constaté au navigateur :
  // avec revalidation, réponse de 32 ko, aucune région vive ne bouge, le focus
  // reste sur un bouton fantôme ; sans elle, réponse de 89 octets, la
  // confirmation s'affiche, est annoncée et prend le focus. C'est LA raison pour
  // laquelle le compte rendu prévu par le §10 n'existait pas à l'écran.
  //
  // Conséquences assumées :
  // - la liste ADMIN se remet à jour côté client (`RangeeGlissante` déclenche
  //   `router.refresh()` après la confirmation) ; la page est `force-dynamic`,
  //   donc elle dit la vérité au rafraîchissement comme au retour ;
  // - la vitrine PUBLIQUE (ISR 300 s) peut afficher la séance supprimée pendant
  //   cinq minutes au plus. C'est une page de récit, pas un système de
  //   réservation : ce délai coûte moins qu'un geste destructif sans compte rendu.
  return { status: "success" };
}

/**
 * Remplace la liste des participantes d'un atelier EN LOT. La fiche gère
 * désormais l'appartenance inscrite par inscrite (interrupteurs,
 * `setAtelierMembreAction`) ; cette action en lot est conservée pour la future
 * commande « Toutes » (cocher tout le monde d'un coup, cf. roadmap). Réservé
 * orga, scopé à l'édition (« ouvert à toutes » est une propriété à part).
 */
export async function setAtelierMembresAction(
  _prev: FicheActionState,
  formData: FormData,
): Promise<FicheActionState> {
  await requireOrgaId();
  const err = (error: string): FicheActionState => ({
    status: "error",
    error,
    values: formValues(formData),
  });

  const editionId = Number(formData.get("editionId"));
  const atelierId = Number(formData.get("atelierId"));
  if (!Number.isInteger(editionId) || editionId <= 0) return err("Édition invalide.");
  if (!Number.isInteger(atelierId) || atelierId <= 0) return err("Atelier invalide.");

  const registrationIds = formData
    .getAll("membres")
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n > 0);

  const ok = await setAtelierMembers(atelierId, editionId, registrationIds);
  if (!ok) return err("Atelier introuvable pour cette édition.");

  revalidatePath(`/admin/tremplins/${editionId}`, "layout");
  revalidatePath(PUBLIC_EDITION_ROUTE, "layout");
  return { status: "success" };
}

/**
 * Supprime un document (faute de frappe, retour collé chez la mauvaise
 * personne, doublon). Réservé orga, scopé à l'édition, confirmation côté UI.
 */
export async function deleteDocumentAction(
  _prev: FicheActionState,
  formData: FormData,
): Promise<FicheActionState> {
  await requireOrgaId();
  const err = (error: string): FicheActionState => ({
    status: "error",
    error,
    values: formValues(formData),
  });

  const editionId = Number(formData.get("editionId"));
  const documentId = Number(formData.get("documentId"));
  if (!Number.isInteger(editionId) || editionId <= 0) return err("Édition invalide.");
  if (!Number.isInteger(documentId) || documentId <= 0) return err("Document invalide.");

  const ok = await deleteDocument(documentId, editionId);
  if (!ok) return err("Document introuvable pour cette édition.");

  revalidatePath(`/admin/tremplins/${editionId}`, "layout");
  return { status: "success" };
}

/**
 * Renseigne (ou efface) le lien de connexion (visio) d'un atelier. Réservé orga.
 * Le lien est normalisé/validé (http/https) ; vide → on efface.
 */
export async function setAtelierVisioAction(
  _prev: FicheActionState,
  formData: FormData,
): Promise<FicheActionState> {
  await requireOrgaId();
  const err = (error: string): FicheActionState => ({
    status: "error",
    error,
    values: formValues(formData),
  });

  const editionId = Number(formData.get("editionId"));
  const atelierId = Number(formData.get("atelierId"));
  if (!Number.isInteger(editionId) || editionId <= 0) return err("Édition invalide.");
  if (!Number.isInteger(atelierId) || atelierId <= 0) return err("Atelier invalide.");

  const parsedLien = optionalUrl.safeParse((formData.get("lienVisio") ?? "").toString());
  if (!parsedLien.success) {
    return err("Lien de connexion invalide : utilise une adresse en http(s).");
  }
  await setAtelierVisio(atelierId, editionId, parsedLien.data);
  revalidatePath(`/admin/tremplins/${editionId}`, "layout");
  return { status: "success" };
}

export type AddCoachState = ActionState<{ email: string; created: boolean }>;

/**
 * Relie un coach par e-mail — à un ATELIER (`atelierId`) ou en COACHING
 * INDIVIDUEL d'une participante (`registrationId`). Compte existant retrouvé,
 * sinon pré-créé (relié à sa première connexion). Le genre est OBLIGATOIRE
 * (statistiques de mixité, jamais affiché) et le compte reçoit le profil
 * « animateur / coach » (cumulable). Réservé orga, scopé à l'édition.
 */
export async function addCoachAction(
  _prev: AddCoachState,
  formData: FormData,
): Promise<AddCoachState> {
  await requireOrgaId();
  const err = (error: string): AddCoachState => ({
    status: "error",
    error,
    values: formValues(formData),
  });

  const editionId = Number(formData.get("editionId"));
  const atelierId = Number(formData.get("atelierId"));
  const registrationId = Number(formData.get("registrationId"));
  const cibleAtelier = Number.isInteger(atelierId) && atelierId > 0;
  const cibleParticipante = Number.isInteger(registrationId) && registrationId > 0;
  if (!Number.isInteger(editionId) || editionId <= 0) return err("Édition invalide.");
  if (!cibleAtelier && !cibleParticipante) return err("Cible invalide (atelier ou participante).");
  const compteBrut = (formData.get("compteId") ?? "").toString().trim();
  const email = (formData.get("email") ?? "").toString().trim().toLowerCase();
  if (compteBrut !== "" && email !== "") {
    return err("Choisis un compte de la liste OU saisis un e-mail, pas les deux.");
  }
  if (compteBrut === "" && email === "") {
    return err("Choisis un compte de la liste, ou saisis son e-mail.");
  }
  let compteId: number | null = null;
  if (compteBrut !== "") {
    compteId = Number(compteBrut);
    if (!Number.isInteger(compteId) || compteId <= 0) return err("Compte invalide.");
  } else if (!isValidEmail(email)) {
    return err("Adresse e-mail invalide.");
  }
  const nom = (formData.get("nom") ?? "").toString().trim();
  const genreRaw = (formData.get("genre") ?? "").toString();
  // Le genre est OBLIGATOIRE pour un nouveau compte invité par e-mail
  // (statistiques de mixité, jamais affiché). Pour un compte choisi dans la
  // liste il est facultatif : fourni, il COMPLÈTE un genre manquant sans
  // jamais écraser un genre déjà déclaré.
  if (compteId === null && !isGenre(genreRaw)) {
    return err("Indique son genre (il ne sera jamais affiché publiquement).");
  }
  if (compteId !== null && genreRaw !== "" && !isGenre(genreRaw)) {
    return err("Genre inconnu.");
  }

  try {
    let user: { id: number; email: string | null; name: string | null };
    let created = false;
    if (compteId !== null) {
      const trouve = await getUserById(compteId);
      if (!trouve) return err("Compte introuvable (supprimé ?).");
      user = trouve;
      if (isGenre(genreRaw)) await setUserGenreIfUnset(user.id, genreRaw);
      // Le nom saisi complète un compte SANS nom (jamais d'écrasement) — même
      // service que la branche e-mail, pour le compte choisi dans la liste.
      if (nom) await setUserNameIfEmpty(user.id, nom);
    } else {
      ({ user, created } = await getOrCreateUserByEmail(email, nom || undefined));
      await setUserGenre(user.id, genreRaw as Parameters<typeof setUserGenre>[1]);
    }
    const ok = cibleAtelier
      ? await addCoachToAtelier(atelierId, editionId, user.id)
      : await addCoachToRegistration(registrationId, editionId, user.id);
    if (!ok) {
      return err(
        cibleAtelier
          ? "Atelier introuvable pour cette édition."
          : "Inscription introuvable pour cette édition.",
      );
    }
    // Le marqueur APRÈS le lien : posé avant, un atelier hors édition laissait
    // un compte marqué coach sans rien accompagner.
    await markUserAsCoach(user.id); // profil « animateur / coach », cumulable
    revalidatePath(`/admin/tremplins/${editionId}`, "layout");
    // Les DEUX pages publiques listent les accompagnantes depuis ce même
    // rattachement (cf. PUBLIC_PARTENAIRES_ROUTE).
    revalidatePath(PUBLIC_EDITION_ROUTE, "layout");
    revalidatePath(PUBLIC_PARTENAIRES_ROUTE);
    return {
      status: "success",
      email: user.email ?? user.name ?? `compte n° ${user.id}`,
      created,
    };
  } catch (e) {
    console.error("Ajout de coach échoué", e);
    return err("Ajout impossible : réessaie ; si ça persiste, préviens l'équipe technique.");
  }
}

/** Retire un coach (d'un atelier ou d'un coaching individuel). Réservé orga, scopé. */
export async function removeCoachAction(
  _prev: FicheActionState,
  formData: FormData,
): Promise<FicheActionState> {
  await requireOrgaId();
  const err = (error: string): FicheActionState => ({
    status: "error",
    error,
    values: formValues(formData),
  });

  const editionId = Number(formData.get("editionId"));
  const atelierId = Number(formData.get("atelierId"));
  const registrationId = Number(formData.get("registrationId"));
  const userId = Number(formData.get("userId"));
  const cibleAtelier = Number.isInteger(atelierId) && atelierId > 0;
  const cibleParticipante = Number.isInteger(registrationId) && registrationId > 0;
  if (!Number.isInteger(editionId) || editionId <= 0) return err("Édition invalide.");
  if (!cibleAtelier && !cibleParticipante) return err("Cible invalide (atelier ou participante).");
  if (!Number.isInteger(userId) || userId <= 0) return err("Compte invalide.");

  const ok = cibleAtelier
    ? await removeCoachFromAtelier(atelierId, editionId, userId)
    : await removeCoachFromRegistration(registrationId, editionId, userId);
  if (!ok) return err("Ce compte n'est pas coach de cette cible.");

  revalidatePath(`/admin/tremplins/${editionId}`, "layout");
  // Retirer une coach de l'atelier la retire des DEUX listes publiques
  // d'accompagnantes : c'est souvent le geste qui suit une demande de retrait,
  // et les deux pages sont en ISR. On les rafraîchit tout de suite.
  revalidatePath(PUBLIC_EDITION_ROUTE, "layout");
  revalidatePath(PUBLIC_PARTENAIRES_ROUTE);
  return { status: "success" };
}

/** État de la création d'une récompense (modale, saisie à la chaîne). */
export type CreateRecompenseState = ActionState<{ intitule: string }>;

/**
 * Vraie date du calendrier (AAAA-MM-JJ). La forme seule ne suffit pas :
 * « 2026-02-31 » roulerait en mars côté JS et crasherait côté Postgres.
 */
function estDateCalendaire(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [annee, mois, jour] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(annee, mois - 1, jour));
  return (
    d.getUTCFullYear() === annee && d.getUTCMonth() === mois - 1 && d.getUTCDate() === jour
  );
}

/** Champs communs intitulé / détail / rang, validés une seule fois. */
function parseRecompenseChamps(
  formData: FormData,
): { ok: true; data: RecompenseInput } | { ok: false; error: string } {
  const intitule = (formData.get("intitule") ?? "").toString().trim();
  if (!intitule) return { ok: false, error: "L'intitulé est obligatoire." };
  const detail = (formData.get("detail") ?? "").toString().trim() || null;
  const rangBrut = (formData.get("rang") ?? "").toString().trim();
  let rang: number | null = null;
  if (rangBrut !== "") {
    rang = Number(rangBrut);
    if (!Number.isInteger(rang) || rang <= 0) {
      return { ok: false, error: "Le rang doit être un entier positif (1, 2, 3…), ou vide." };
    }
  }
  return { ok: true, data: { intitule, detail, rang } };
}

/**
 * Crée une récompense de l'édition (l'attribution à une bénéficiaire est un
 * geste séparé, sur sa fiche). Réservé orga.
 */
export async function addRecompenseAction(
  _prev: CreateRecompenseState,
  formData: FormData,
): Promise<CreateRecompenseState> {
  await requireOrgaId();
  const err = (error: string): CreateRecompenseState => ({
    status: "error",
    error,
    values: formValues(formData),
  });

  const editionId = Number(formData.get("editionId"));
  if (!Number.isInteger(editionId) || editionId <= 0) return err("Édition invalide.");
  const champs = parseRecompenseChamps(formData);
  if (!champs.ok) return err(champs.error);

  try {
    await addRecompense(editionId, champs.data);
  } catch (e) {
    console.error("Création de récompense échouée", e);
    return err("Création impossible : réessaie ; si ça persiste, préviens l'équipe technique.");
  }
  revalidatePath(`/admin/tremplins/${editionId}`, "layout");
  revalidatePath(PUBLIC_EDITION_ROUTE, "layout"); // les récompenses s'affichent au public
  return { status: "success", intitule: champs.data.intitule };
}

/** Met à jour intitulé / détail / rang d'une récompense. Réservé orga, scopé. */
export async function updateRecompenseAction(
  _prev: FicheActionState,
  formData: FormData,
): Promise<FicheActionState> {
  await requireOrgaId();
  const err = (error: string): FicheActionState => ({
    status: "error",
    error,
    values: formValues(formData),
  });

  const editionId = Number(formData.get("editionId"));
  const recompenseId = Number(formData.get("recompenseId"));
  if (!Number.isInteger(editionId) || editionId <= 0) return err("Édition invalide.");
  if (!Number.isInteger(recompenseId) || recompenseId <= 0) return err("Récompense invalide.");
  const champs = parseRecompenseChamps(formData);
  if (!champs.ok) return err(champs.error);

  try {
    const ok = await updateRecompense(recompenseId, editionId, champs.data);
    if (!ok) return err("Récompense introuvable pour cette édition.");
  } catch (e) {
    console.error("Mise à jour de récompense échouée", e);
    return err("Enregistrement impossible : réessaie ; si ça persiste, préviens l'équipe technique.");
  }

  revalidatePath(`/admin/tremplins/${editionId}`, "layout");
  revalidatePath(PUBLIC_EDITION_ROUTE, "layout"); // les récompenses s'affichent au public
  return { status: "success" };
}

/**
 * Attribue la récompense à une participante de l'édition (attribution LIBRE :
 * pas forcément le rang du podium — le motif trace pourquoi), ou la retire
 * (`registrationId` vide). Réservé orga, scopé côté SQL.
 */
export async function setRecompenseBeneficiaireAction(
  _prev: FicheActionState,
  formData: FormData,
): Promise<FicheActionState> {
  await requireOrgaId();
  const err = (error: string): FicheActionState => ({
    status: "error",
    error,
    values: formValues(formData),
  });

  const editionId = Number(formData.get("editionId"));
  const recompenseId = Number(formData.get("recompenseId"));
  if (!Number.isInteger(editionId) || editionId <= 0) return err("Édition invalide.");
  if (!Number.isInteger(recompenseId) || recompenseId <= 0) return err("Récompense invalide.");

  const brut = (formData.get("registrationId") ?? "").toString().trim();
  let registrationId: number | null = null;
  if (brut !== "") {
    registrationId = Number(brut);
    if (!Number.isInteger(registrationId) || registrationId <= 0) {
      return err("Participante invalide.");
    }
  }
  const motif =
    registrationId === null ? null : (formData.get("motif") ?? "").toString().trim() || null;
  // Raison PUBLIQUE de transfert (énumérée, sans nom) : facultative, seulement
  // si on attribue. Valeur inconnue ou vide → null (pas de transfert affiché).
  const raisonBrute = (formData.get("transfertRaison") ?? "").toString();
  const transfertRaison =
    registrationId !== null && isRecompenseTransfertRaison(raisonBrute) ? raisonBrute : null;

  try {
    const ok = await setRecompenseBeneficiaire(
      recompenseId,
      editionId,
      registrationId,
      motif,
      transfertRaison,
    );
    if (!ok) {
      return err(
        "Attribution impossible : la participante ou la récompense n'appartient pas à cette édition.",
      );
    }
  } catch (e) {
    console.error("Attribution de récompense échouée", e);
    return err("Enregistrement impossible : réessaie ; si ça persiste, préviens l'équipe technique.");
  }

  revalidatePath(`/admin/tremplins/${editionId}`, "layout");
  revalidatePath(PUBLIC_EDITION_ROUTE, "layout"); // les récompenses s'affichent au public
  return { status: "success" };
}

/** Suivi de l'événement découlant de la récompense (statut + date). Réservé orga. */
export async function setRecompenseSuiviAction(
  _prev: FicheActionState,
  formData: FormData,
): Promise<FicheActionState> {
  await requireOrgaId();
  const err = (error: string): FicheActionState => ({
    status: "error",
    error,
    values: formValues(formData),
  });

  const editionId = Number(formData.get("editionId"));
  const recompenseId = Number(formData.get("recompenseId"));
  if (!Number.isInteger(editionId) || editionId <= 0) return err("Édition invalide.");
  if (!Number.isInteger(recompenseId) || recompenseId <= 0) return err("Récompense invalide.");

  const statut = (formData.get("statut") ?? "").toString();
  if (!isRecompenseStatut(statut)) return err("Statut inconnu.");
  const dateBrute = (formData.get("evenementLe") ?? "").toString().trim();
  if (dateBrute !== "" && !estDateCalendaire(dateBrute)) {
    return err("Date invalide (format AAAA-MM-JJ).");
  }

  try {
    const ok = await setRecompenseSuivi(recompenseId, editionId, statut, dateBrute || null);
    if (!ok) return err("Récompense introuvable pour cette édition.");
  } catch (e) {
    console.error("Suivi de récompense échoué", e);
    return err("Enregistrement impossible : réessaie ; si ça persiste, préviens l'équipe technique.");
  }

  revalidatePath(`/admin/tremplins/${editionId}`, "layout");
  revalidatePath(PUBLIC_EDITION_ROUTE, "layout"); // les récompenses s'affichent au public
  return { status: "success" };
}

/**
 * Supprime une récompense (erreur de saisie). Destructif → PRG : la fiche
 * n'existe plus, on redirige vers le tableau de bord. Réservé orga, scopé.
 */
export async function deleteRecompenseAction(formData: FormData): Promise<void> {
  await requireOrgaId();

  const base = editionBase(formData);
  if (!base) redirect("/admin/tremplins");
  const editionId = Number(formData.get("editionId")); // sûr : base valide
  const recompenseId = Number(formData.get("recompenseId"));
  if (!Number.isInteger(recompenseId) || recompenseId <= 0) {
    redirect(`${base}?err=recompense`);
  }

  const ok = await deleteRecompense(recompenseId, editionId);
  if (!ok) redirect(`${base}?err=recompense`);

  revalidatePath(base, "layout");
  revalidatePath(PUBLIC_EDITION_ROUTE, "layout");
  redirect(`${base}?ok=recompense_supprimee`);
}

/** État de la création d'un juré (modale, saisie à la chaîne). */
export type CreateJuryState = ActionState<{ label: string }>;

/** Valide les champs d'un juré : nom obligatoire, e-mail bien formé s'il est
 * fourni (interne, mais autant le saisir juste). Le reste est optionnel. */
function parseJuryChamps(
  formData: FormData,
): { ok: true; data: JuryInput; label: string } | { ok: false; error: string } {
  const nom = (formData.get("nom") ?? "").toString().trim();
  if (!nom) return { ok: false, error: "Le nom est obligatoire." };
  const prenom = (formData.get("prenom") ?? "").toString().trim() || null;
  const fonction = (formData.get("fonction") ?? "").toString().trim() || null;
  const entreprise = (formData.get("entreprise") ?? "").toString().trim() || null;
  const email = (formData.get("email") ?? "").toString().trim() || null;
  if (email && !isValidEmail(email)) {
    return { ok: false, error: "L'e-mail n'est pas valide (ou laisse-le vide)." };
  }
  return {
    ok: true,
    data: { nom, prenom, fonction, entreprise, email },
    label: [prenom, nom].filter(Boolean).join(" "),
  };
}

/**
 * Ajoute un juré à l'édition (personne sans compte requise). Réservé orga. Le
 * jury s'affiche publiquement (accord recueilli) → on revalide la page publique.
 */
export async function addJuryAction(
  _prev: CreateJuryState,
  formData: FormData,
): Promise<CreateJuryState> {
  await requireOrgaId();
  const err = (error: string): CreateJuryState => ({
    status: "error",
    error,
    values: formValues(formData),
  });

  const editionId = Number(formData.get("editionId"));
  if (!Number.isInteger(editionId) || editionId <= 0) return err("Édition invalide.");
  const champs = parseJuryChamps(formData);
  if (!champs.ok) return err(champs.error);

  try {
    await addJury(editionId, champs.data);
  } catch (e) {
    console.error("Ajout d'un juré échoué", e);
    return err("Ajout impossible : réessaie ; si ça persiste, préviens l'équipe technique.");
  }
  revalidatePath(`/admin/tremplins/${editionId}`, "layout");
  revalidatePath(PUBLIC_EDITION_ROUTE, "layout");
  return { status: "success", label: champs.label };
}

/** Retire un juré de l'édition. Réservé orga, scopé à l'édition. */
export async function deleteJuryAction(
  _prev: FicheActionState,
  formData: FormData,
): Promise<FicheActionState> {
  await requireOrgaId();
  const err = (error: string): FicheActionState => ({
    status: "error",
    error,
    values: formValues(formData),
  });

  const editionId = Number(formData.get("editionId"));
  const juryId = Number(formData.get("juryId"));
  if (!Number.isInteger(editionId) || editionId <= 0) return err("Édition invalide.");
  if (!Number.isInteger(juryId) || juryId <= 0) return err("Juré invalide.");

  try {
    const ok = await deleteJury(juryId, editionId);
    if (!ok) return err("Juré introuvable pour cette édition.");
  } catch (e) {
    console.error("Retrait d'un juré échoué", e);
    return err("Retrait impossible : réessaie ; si ça persiste, préviens l'équipe technique.");
  }
  revalidatePath(`/admin/tremplins/${editionId}`, "layout");
  revalidatePath(PUBLIC_EDITION_ROUTE, "layout");
  return { status: "success" };
}

/** Change la phase d'entrée dans le parcours. Réservé orga, scopé à l'édition. */
export async function setRegistrationPhaseAction(
  _prev: FicheActionState,
  formData: FormData,
): Promise<FicheActionState> {
  await requireOrgaId();
  const err = (error: string): FicheActionState => ({
    status: "error",
    error,
    values: formValues(formData),
  });

  const editionId = Number(formData.get("editionId"));
  const registrationId = Number(formData.get("registrationId"));
  if (!Number.isInteger(editionId) || editionId <= 0) return err("Édition invalide.");
  if (!Number.isInteger(registrationId) || registrationId <= 0) return err("Inscription invalide.");
  const phase = (formData.get("phase") ?? "").toString();
  if (!isPhaseEntree(phase)) return err("Phase inconnue.");

  try {
    const ok = await setRegistrationPhase(registrationId, editionId, phase);
    if (!ok) return err("Inscription introuvable pour cette édition.");
  } catch (e) {
    console.error("Changement de phase échoué", e);
    return err("Enregistrement impossible : réessaie ; si ça persiste, préviens l'équipe technique.");
  }

  revalidatePath(`/admin/tremplins/${editionId}`, "layout");
  return { status: "success" };
}

/**
 * Ajoute ou retire l'appartenance d'une inscription à une phase (1 ou 3). La
 * phase 2 (finale) reste pilotée par `setRegistrationFinaleAction`. Réservé
 * orga, scopé à l'édition.
 *
 * INVARIANT phase 2 ⊂ phase 1 : retirer la phase 1 retire aussi le statut
 * finaliste (on ne peut pas être finaliste sans avoir participé à la phase 1).
 * Sur la fiche, la case « Finaliste » disparaît alors immédiatement (retour
 * visible du retrait en cascade).
 */
export async function setRegistrationPhaseMembershipAction(
  _prev: FicheActionState,
  formData: FormData,
): Promise<FicheActionState> {
  await requireOrgaId();
  const err = (error: string): FicheActionState => ({
    status: "error",
    error,
    values: formValues(formData),
  });

  const editionId = Number(formData.get("editionId"));
  const registrationId = Number(formData.get("registrationId"));
  if (!Number.isInteger(editionId) || editionId <= 0) return err("Édition invalide.");
  if (!Number.isInteger(registrationId) || registrationId <= 0) {
    return err("Inscription invalide.");
  }
  const phase = (formData.get("phase") ?? "").toString();
  if (!isMembershipPhase(phase)) return err("Phase inconnue.");
  const present = (formData.get("present") ?? "").toString() === "true";

  try {
    // Invariant phase 2 ⊂ phase 1 : retirer la phase 1 retire aussi le statut
    // finaliste. On l'efface AVANT de retirer l'appartenance — si le retrait
    // échoue ensuite, on reste cohérent (encore phase 1, mais plus finaliste).
    if (phase === "cfp_et_pitch" && !present) {
      const scoped = await setRegistrationFinale(registrationId, editionId, false);
      if (!scoped) return err("Inscription introuvable pour cette édition.");
    }
    const ok = await setRegistrationPhaseMembership(registrationId, editionId, phase, present);
    if (!ok) return err("Inscription introuvable pour cette édition.");
  } catch (e) {
    console.error("Changement d'appartenance de phase échoué", e);
    return err("Enregistrement impossible : réessaie ; si ça persiste, préviens l'équipe technique.");
  }

  revalidatePath(`/admin/tremplins/${editionId}`, "layout");
  revalidatePath(PUBLIC_EDITION_ROUTE, "layout"); // la finale (retirée) est publique
  return { status: "success" };
}

/**
 * Pointe les présences des membres d'un atelier (champs `presence_<idInscription>`,
 * tri-état). Réservé orga, scopé à l'édition côté SQL.
 */
export async function setAtelierPresencesAction(
  _prev: FicheActionState,
  formData: FormData,
): Promise<FicheActionState> {
  await requireOrgaId();
  const err = (error: string): FicheActionState => ({
    status: "error",
    error,
    values: formValues(formData),
  });

  const editionId = Number(formData.get("editionId"));
  const atelierId = Number(formData.get("atelierId"));
  if (!Number.isInteger(editionId) || editionId <= 0) return err("Édition invalide.");
  if (!Number.isInteger(atelierId) || atelierId <= 0) return err("Atelier invalide.");

  const entrees: { registrationId: number; presence: Presence }[] = [];
  for (const [cle, valeur] of formData.entries()) {
    if (!cle.startsWith("presence_")) continue;
    const registrationId = Number(cle.slice("presence_".length));
    if (!Number.isInteger(registrationId) || registrationId <= 0) {
      return err("Inscription invalide.");
    }
    if (!isPresence(valeur)) return err("Valeur de présence inconnue.");
    entrees.push({ registrationId, presence: valeur });
  }

  try {
    const ok = await setAtelierPresences(atelierId, editionId, entrees);
    if (!ok) return err("Atelier introuvable pour cette édition.");
  } catch (e) {
    console.error("Pointage des présences échoué", e);
    return err("Enregistrement impossible : réessaie ; si ça persiste, préviens l'équipe technique.");
  }

  revalidatePath(`/admin/tremplins/${editionId}`, "layout");
  return { status: "success" };
}

/**
 * Choisit QUI voit l'atelier (cf. `src/lib/atelier-audience.ts`) : une sélection
 * nommée, les participantes de sa phase, ou toutes les inscrites. Un choix
 * EXCLUSIF, à la place des deux interrupteurs qui se contredisaient.
 *
 * Réservé orga, scopé à l'édition. La valeur reçue est validée par
 * `audienceParCle` : une clé inventée est refusée, jamais repliée en silence
 * sur une audience arbitraire — ce serait replier vers la plus ouverte. On
 * revalide aussi la page publique, dont le programme dépend de l'audience.
 */
export async function setAtelierAudienceAction(
  _prev: FicheActionState,
  formData: FormData,
): Promise<FicheActionState> {
  await requireOrgaId();
  const err = (error: string): FicheActionState => ({
    status: "error",
    error,
    values: formValues(formData),
  });

  const editionId = Number(formData.get("editionId"));
  const atelierId = Number(formData.get("atelierId"));
  if (!Number.isInteger(editionId) || editionId <= 0) return err("Édition invalide.");
  if (!Number.isInteger(atelierId) || atelierId <= 0) return err("Atelier invalide.");
  const audience = audienceParCle(formData.get("audience"));
  if (!audience) return err("Audience invalide.");

  try {
    const ok = await setAtelierAudience(atelierId, editionId, audience);
    if (!ok) return err("Atelier introuvable pour cette édition.");
  } catch (e) {
    console.error("Changement d'ouverture d'atelier échoué", e);
    return err("Enregistrement impossible : réessaie ; si ça persiste, préviens l'équipe technique.");
  }

  revalidatePath(`/admin/tremplins/${editionId}`, "layout");
  revalidatePath(PUBLIC_EDITION_ROUTE, "layout");
  return { status: "success" };
}

/**
 * Montrer une séance sur le site public, ou la réserver à l'espace des
 * inscrites — un geste À PART de l'audience (migration 056).
 *
 * Les deux réglages ont vécu fusionnés parce qu'ils l'avaient été pour de
 * mauvaises raisons : la publication se DÉDUISAIT du pointage des présences.
 * Ici elle se coche, se lit en toutes lettres sur la liste comme sur la fiche,
 * et changer l'audience ne la touche plus.
 */
/**
 * L'accord d'une participante à être NOMMÉE sur la page publique d'une phase.
 *
 * Distinct de `setRegistrationVisibilityAction`, qui porte l'accord pour la
 * galerie des finalistes : deux finalités, deux interrupteurs, deux retraits.
 * Rejouer l'un pour l'autre serait un changement de finalité — une finaliste qui
 * a accepté d'apparaître en juin n'a pas accepté de figurer en novembre dans une
 * liste d'accompagnées, et une participante retenue au CFP sans passer par la
 * finale n'a jamais eu l'occasion de consentir à quoi que ce soit.
 */
export async function setRegistrationPhasePublicAction(
  _prev: FicheActionState,
  formData: FormData,
): Promise<FicheActionState> {
  await requireOrgaId();
  const err = (error: string): FicheActionState => ({
    status: "error",
    error,
    values: formValues(formData),
  });

  const editionId = Number(formData.get("editionId"));
  const registrationId = Number(formData.get("registrationId"));
  if (!Number.isInteger(editionId) || editionId <= 0) return err("Édition invalide.");
  if (!Number.isInteger(registrationId) || registrationId <= 0)
    return err("Inscription invalide.");
  const phase = formData.get("phase");
  if (!isMembershipPhase(phase)) return err("Phase invalide.");
  const consent = (formData.get("present") ?? "").toString() === "true";

  try {
    const ok = await setRegistrationPhasePublic(registrationId, editionId, phase, consent);
    // 0 ligne : soit l'inscription est hors édition, soit elle n'est PAS
    // rattachée à cette phase. On ne crée pas le rattachement en douce — on le
    // dit, et l'orga rattache d'abord.
    if (!ok) return err("Rattache d'abord la participante à cette phase.");
  } catch (e) {
    console.error("Consentement de phase échoué", e);
    return err("Enregistrement impossible : réessaie ; si ça persiste, préviens l'équipe technique.");
  }

  revalidatePath(`/admin/tremplins/${editionId}`, "layout");
  revalidatePath(PUBLIC_EDITION_ROUTE, "layout");
  return { status: "success" };
}

/**
 * Un identifiant de compte reçu du client. Borné à l'`INTEGER` de Postgres :
 * au-delà, la requête lèverait un 22003 qu'on rapporterait comme une panne de
 * base, alors que c'est une saisie invalide.
 */
function idCompteValide(id: number): boolean {
  return Number.isInteger(id) && id > 0 && id <= 2_147_483_647;
}

/**
 * LE COMPTE VISÉ PAR UNE FICHE COACH, vérifié côté serveur — la précondition et
 * ses raisons sont documentées sur `estCoachRattache` (src/lib/tremplin-coachs.ts).
 *
 * Rend un message d'erreur, ou `null` si le compte convient. Une base
 * indisponible refuse : une vérification impossible ferme, elle n'ouvre pas.
 */
async function refusFicheCoach(userId: number): Promise<string | null> {
  if (!idCompteValide(userId)) return "Compte invalide.";
  try {
    if (await estCoachRattache(userId)) return null;
  } catch (e) {
    console.error("Vérification du rattachement d'une coach échouée", e);
    return "Enregistrement impossible : réessaie ; si ça persiste, préviens l'équipe technique.";
  }
  // Nommer le geste qui débloque, comme les autres préconditions de ce fichier.
  return "Rattache d'abord ce compte aux coachs d'un atelier ou d'une participante.";
}

/** Rôle et lien affichés d'une accompagnante. Décrire n'est pas publier : le
 * consentement a son propre geste (`setCoachProfilePublicAction`). */
export async function setCoachProfileAction(
  _prev: FicheActionState,
  formData: FormData,
): Promise<FicheActionState> {
  await requireOrgaId();
  const err = (error: string): FicheActionState => ({
    status: "error",
    error,
    values: formValues(formData),
  });

  const userId = Number(formData.get("userId"));
  const lien = (formData.get("lien") ?? "").toString().trim();
  // Un lien affiché sur une page publique : http(s) uniquement, refusé à
  // l'écriture ET dégradé au rendu (`ExternalLink`). Deux gardes, parce qu'une
  // seule finit toujours par sauter.
  if (lien !== "" && !isSafeHttpUrl(lien)) return err("Le lien doit commencer par http:// ou https://.");
  // Les refus gratuits d'abord : le rattachement coûte une requête.
  const refus = await refusFicheCoach(userId);
  if (refus) return err(refus);

  try {
    await upsertCoachProfile(userId, {
      role: (formData.get("role") ?? "").toString(),
      lien,
    });
  } catch (e) {
    console.error("Enregistrement de la fiche coach échoué", e);
    return err("Enregistrement impossible : réessaie ; si ça persiste, préviens l'équipe technique.");
  }

  revalidatePath("/admin/tremplins", "layout");
  // Le rôle et le lien s'affichent sur les DEUX pages qui la citent.
  revalidatePath(PUBLIC_EDITION_ROUTE, "layout");
  revalidatePath(PUBLIC_PARTENAIRES_ROUTE);
  return { status: "success" };
}

/**
 * L'accord d'une accompagnante à être citée publiquement. Au niveau du COMPTE :
 * une seule révocation vaut pour toutes les éditions qu'elle a accompagnées.
 */
export async function setCoachProfilePublicAction(
  _prev: FicheActionState,
  formData: FormData,
): Promise<FicheActionState> {
  await requireOrgaId();
  const err = (error: string): FicheActionState => ({
    status: "error",
    error,
    values: formValues(formData),
  });

  const userId = Number(formData.get("userId"));
  const consent = (formData.get("present") ?? "").toString() === "true";

  if (!idCompteValide(userId)) return err("Compte invalide.");
  // RETIRER un accord reste possible en toutes circonstances (RGPD art. 7-3 :
  // aussi simple à retirer qu'à donner) : la précondition garde ce qu'on pose,
  // pas ce qu'on efface. Sinon, une coach retirée de son dernier atelier
  // garderait un `public = true` indélébile, republié le jour où elle
  // accompagne à nouveau, sur la foi d'un accord donné pour une autre édition.
  // Le retrait ne crée rien de son côté (cf. `setCoachProfilePublic`).
  if (consent) {
    const refus = await refusFicheCoach(userId);
    if (refus) return err(refus);
  }

  try {
    await setCoachProfilePublic(userId, consent);
  } catch (e) {
    console.error("Consentement de coach échoué", e);
    return err("Enregistrement impossible : réessaie ; si ça persiste, préviens l'équipe technique.");
  }

  revalidatePath("/admin/tremplins", "layout");
  // L'accord vaut pour TOUTES les éditions qu'elle a animées, et son retrait
  // aussi : les deux surfaces qui la citent se rafraîchissent maintenant, pas
  // dans cinq minutes (RGPD art. 7-3, cf. PUBLIC_PARTENAIRES_ROUTE).
  revalidatePath(PUBLIC_EDITION_ROUTE, "layout");
  revalidatePath(PUBLIC_PARTENAIRES_ROUTE);
  return { status: "success" };
}

export async function setAtelierProgrammePublicAction(
  _prev: FicheActionState,
  formData: FormData,
): Promise<FicheActionState> {
  await requireOrgaId();
  const err = (error: string): FicheActionState => ({
    status: "error",
    error,
    values: formValues(formData),
  });

  const editionId = Number(formData.get("editionId"));
  const atelierId = Number(formData.get("atelierId"));
  if (!Number.isInteger(editionId) || editionId <= 0) return err("Édition invalide.");
  if (!Number.isInteger(atelierId) || atelierId <= 0) return err("Atelier invalide.");
  // `SettingToggle` poste la valeur CIBLE dans « present » (même contrat que
  // les autres interrupteurs de cet écran) : on la lit comme eux.
  const visible = (formData.get("present") ?? "").toString() === "true";

  try {
    const ok = await setAtelierProgrammePublic(atelierId, editionId, visible);
    if (!ok) return err("Atelier introuvable pour cette édition.");
  } catch (e) {
    console.error("Changement de visibilité publique d'atelier échoué", e);
    return err("Enregistrement impossible : réessaie ; si ça persiste, préviens l'équipe technique.");
  }

  revalidatePath(`/admin/tremplins/${editionId}`, "layout");
  // Une séance qu'on n'annonce plus n'expose plus son encadrement : les
  // accompagnantes qu'elle créditait quittent les deux pages publiques.
  revalidatePath(PUBLIC_EDITION_ROUTE, "layout");
  revalidatePath(PUBLIC_PARTENAIRES_ROUTE);
  return { status: "success" };
}

/**
 * Ajoute ou retire UNE participante d'un atelier (interrupteur par inscrite,
 * gestion en ligne). Réservé orga, scopé à l'édition.
 */
export async function setAtelierMembreAction(
  _prev: FicheActionState,
  formData: FormData,
): Promise<FicheActionState> {
  await requireOrgaId();
  const err = (error: string): FicheActionState => ({
    status: "error",
    error,
    values: formValues(formData),
  });

  const editionId = Number(formData.get("editionId"));
  const atelierId = Number(formData.get("atelierId"));
  const registrationId = Number(formData.get("registrationId"));
  if (!Number.isInteger(editionId) || editionId <= 0) return err("Édition invalide.");
  if (!Number.isInteger(atelierId) || atelierId <= 0) return err("Atelier invalide.");
  if (!Number.isInteger(registrationId) || registrationId <= 0) return err("Inscription invalide.");
  const present = (formData.get("present") ?? "").toString() === "true";

  try {
    const ok = await setAtelierMembre(atelierId, editionId, registrationId, present);
    if (!ok) return err("Atelier introuvable pour cette édition.");
  } catch (e) {
    console.error("Changement de participante d'atelier échoué", e);
    return err("Enregistrement impossible : réessaie ; si ça persiste, préviens l'équipe technique.");
  }

  revalidatePath(`/admin/tremplins/${editionId}`, "layout");
  revalidatePath(PUBLIC_EDITION_ROUTE, "layout");
  return { status: "success" };
}

/**
 * Pointe la présence d'UNE participante (case « Présente », dépendante de son
 * appartenance à l'atelier) : cochée = présente, décochée = absente. Réservé
 * orga, scopé à l'édition.
 */
export async function setAtelierPresenceAction(
  _prev: FicheActionState,
  formData: FormData,
): Promise<FicheActionState> {
  await requireOrgaId();
  const err = (error: string): FicheActionState => ({
    status: "error",
    error,
    values: formValues(formData),
  });

  const editionId = Number(formData.get("editionId"));
  const atelierId = Number(formData.get("atelierId"));
  const registrationId = Number(formData.get("registrationId"));
  if (!Number.isInteger(editionId) || editionId <= 0) return err("Édition invalide.");
  if (!Number.isInteger(atelierId) || atelierId <= 0) return err("Atelier invalide.");
  if (!Number.isInteger(registrationId) || registrationId <= 0) return err("Inscription invalide.");
  const presente = (formData.get("present") ?? "").toString() === "true";

  try {
    const ok = await setAtelierPresence(
      atelierId,
      editionId,
      registrationId,
      presente ? "presente" : "absente",
    );
    if (!ok) return err("Atelier introuvable pour cette édition.");
  } catch (e) {
    console.error("Pointage de présence échoué", e);
    return err("Enregistrement impossible : réessaie ; si ça persiste, préviens l'équipe technique.");
  }

  revalidatePath(`/admin/tremplins/${editionId}`, "layout");
  return { status: "success" };
}

/* ─────────────────────── Sous-groupes (orga) ───────────────────────
   Atelier « en sous-groupes » (revue croisée, points individuels). Toutes ces
   actions sont réservées orga (`requireOrgaId`) et scopées à l'édition côté
   lib : identité et autorisation viennent de la session, jamais du client. */

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Édition + sous-groupe (entiers positifs), ou `null` si l'un manque. */
function idsSousGroupe(formData: FormData): { editionId: number; sousGroupeId: number } | null {
  const editionId = Number(formData.get("editionId"));
  const sousGroupeId = Number(formData.get("sousGroupeId"));
  if (!Number.isInteger(editionId) || editionId <= 0) return null;
  if (!Number.isInteger(sousGroupeId) || sousGroupeId <= 0) return null;
  return { editionId, sousGroupeId };
}

/**
 * Crée un sous-groupe dans un atelier. Réservé orga, scopé à l'édition.
 *
 * Plus de NOM à donner (migration 052) : un sous-groupe se désigne par qui est
 * dedans. On en crée un vide, puis on le compose sur sa page — c'est là que
 * vivent les participantes et les coachs, et un champ « Binôme 1 » à remplir
 * avant de pouvoir composer ne servait personne.
 */
export async function createSousGroupeAction(
  _prev: FicheActionState,
  formData: FormData,
): Promise<FicheActionState> {
  await requireOrgaId();
  const err = (error: string): FicheActionState => ({ status: "error", error, values: formValues(formData) });
  const editionId = Number(formData.get("editionId"));
  const atelierId = Number(formData.get("atelierId"));
  if (!Number.isInteger(editionId) || editionId <= 0) return err("Édition invalide.");
  if (!Number.isInteger(atelierId) || atelierId <= 0) return err("Atelier invalide.");
  let id: number | null = null;
  try {
    id = await createSousGroupe(atelierId, editionId);
    if (id === null) return err("Atelier introuvable pour cette édition.");
  } catch (e) {
    console.error("Création de sous-groupe échouée", e);
    return err("Enregistrement impossible : réessaie ; si ça persiste, préviens l'équipe technique.");
  }
  revalidatePath(`/admin/tremplins/${editionId}`, "layout");
  // On OUVRE le sous-groupe créé : créer, c'est commencer à le composer. Sans
  // cette redirection, l'orga restait sur la liste, avec une ligne vide apparue
  // en bas — parfois hors écran — et un bouton qui affichait « Enregistré ✓ » là
  // où elle en attendait un deuxième. C'est aussi ce que l'écran annonce.
  redirect(`/admin/tremplins/${editionId}/ateliers/${atelierId}/sous-groupes/${id}`);
}

/** Met à jour un sous-groupe : le lien « comment se retrouver » (http(s)) et la
 * réalisation (date ou vide). Réservé orga, scopé à l'édition.
 *
 * Les COACHS ne passent PAS par ici : elles se basculent une par une
 * (`setCoachDansSousGroupeAction`). Les mêler à ce formulaire posait un piège —
 * un ensemble de cases vide et un champ non rendu arrivent tous deux « vide »
 * côté serveur, donc enregistrer le lien effaçait les coachs en place. */
export async function updateSousGroupeAction(
  _prev: FicheActionState,
  formData: FormData,
): Promise<FicheActionState> {
  await requireOrgaId();
  const err = (error: string): FicheActionState => ({ status: "error", error, values: formValues(formData) });
  const ids = idsSousGroupe(formData);
  if (!ids) return err("Sous-groupe ou édition invalide.");

  const parsedLien = optionalUrl.safeParse((formData.get("lienVisio") ?? "").toString());
  if (!parsedLien.success) return err("Lien invalide : utilise une adresse en http(s).");

  const brutFait = (formData.get("faitLe") ?? "").toString().trim();
  if (brutFait !== "" && !ISO_DATE_RE.test(brutFait)) return err("Date invalide (AAAA-MM-JJ).");

  try {
    const ok = await updateSousGroupe(ids.sousGroupeId, ids.editionId, {
      lienVisio: parsedLien.data,
      faitLe: brutFait === "" ? null : brutFait,
    });
    if (!ok) return err("Sous-groupe introuvable pour cette édition.");
  } catch (e) {
    console.error("Mise à jour de sous-groupe échouée", e);
    return err("Enregistrement impossible : réessaie ; si ça persiste, préviens l'équipe technique.");
  }
  revalidatePath(`/admin/tremplins/${ids.editionId}`, "layout");
  return { status: "success" };
}

/**
 * Confie (ou retire) UNE coach à un sous-groupe — un interrupteur par coach,
 * enregistré à la bascule, comme le rangement d'une participante juste en
 * dessous sur le même écran.
 *
 * L'identité vient de la session (orga), la coach visée du formulaire : son
 * appartenance aux coachs de l'ATELIER est revérifiée côté base (FK composite,
 * migration 052), donc un id forgé n'entre pas. Réservé orga, scopé à l'édition.
 */
export async function setCoachDansSousGroupeAction(
  _prev: FicheActionState,
  formData: FormData,
): Promise<FicheActionState> {
  await requireOrgaId();
  const err = (error: string): FicheActionState => ({ status: "error", error, values: formValues(formData) });
  const ids = idsSousGroupe(formData);
  if (!ids) return err("Sous-groupe ou édition invalide.");
  const userId = Number(formData.get("userId"));
  if (!Number.isInteger(userId) || userId <= 0) return err("Coach invalide.");
  const present = (formData.get("present") ?? "").toString() === "true";
  try {
    const ok = await setCoachDansSousGroupe(ids.sousGroupeId, ids.editionId, userId, present);
    if (!ok) return err("Cette coach ne figure pas sur l'atelier de ce sous-groupe.");
  } catch (e) {
    console.error("Coach de sous-groupe échouée", e);
    return err("Enregistrement impossible : réessaie ; si ça persiste, préviens l'équipe technique.");
  }
  revalidatePath(`/admin/tremplins/${ids.editionId}`, "layout");
  return { status: "success" };
}

/** Supprime un sous-groupe (ses membres restent inscrits à l'atelier). Orga.
 * Depuis la page dédiée du sous-groupe : au succès on REVIENT à la répartition
 * (la page de l'item disparaît), via `atelierId` (redirection). */
export async function deleteSousGroupeAction(
  _prev: FicheActionState,
  formData: FormData,
): Promise<FicheActionState> {
  await requireOrgaId();
  const err = (error: string): FicheActionState => ({ status: "error", error, values: formValues(formData) });
  const ids = idsSousGroupe(formData);
  if (!ids) return err("Sous-groupe ou édition invalide.");
  const atelierId = Number(formData.get("atelierId"));
  const ok = await deleteSousGroupe(ids.sousGroupeId, ids.editionId);
  if (!ok) return err("Sous-groupe introuvable pour cette édition.");
  revalidatePath(`/admin/tremplins/${ids.editionId}`, "layout");
  // Retour à la répartition (la page de l'item n'existe plus) : c'est là qu'on
  // voit tout de suite qui vient d'être délié, et reste donc à ranger.
  if (Number.isInteger(atelierId) && atelierId > 0) {
    redirect(`/admin/tremplins/${ids.editionId}/ateliers/${atelierId}/sous-groupes`);
  }
  return { status: "success" };
}

/** Range (ou sort) une participante d'un sous-groupe. « aucun »/vide → aucun
 * sous-groupe. Réservé orga, scopé à l'édition. */
export async function setMembreDansSousGroupeAction(
  _prev: FicheActionState,
  formData: FormData,
): Promise<FicheActionState> {
  await requireOrgaId();
  const err = (error: string): FicheActionState => ({ status: "error", error, values: formValues(formData) });
  const editionId = Number(formData.get("editionId"));
  const atelierId = Number(formData.get("atelierId"));
  const registrationId = Number(formData.get("registrationId"));
  const sousGroupeId = Number(formData.get("sousGroupeId"));
  if (!Number.isInteger(editionId) || editionId <= 0) return err("Édition invalide.");
  if (!Number.isInteger(atelierId) || atelierId <= 0) return err("Atelier invalide.");
  if (!Number.isInteger(registrationId) || registrationId <= 0) return err("Inscription invalide.");
  if (!Number.isInteger(sousGroupeId) || sousGroupeId <= 0) return err("Sous-groupe invalide.");
  // Interrupteur par participante SUR la page du sous-groupe : cochée → dans CE
  // sous-groupe (la retire de tout autre, un membre = un seul sous-groupe) ;
  // décochée → rangée nulle part (elle reste inscrite à l'atelier).
  const present = (formData.get("present") ?? "").toString() === "true";
  try {
    const ok = await assignMembreSousGroupe(
      atelierId,
      editionId,
      registrationId,
      present ? sousGroupeId : null,
    );
    if (!ok) return err("Atelier ou sous-groupe introuvable pour cette édition.");
  } catch (e) {
    console.error("Rangement dans le sous-groupe échoué", e);
    return err("Enregistrement impossible : réessaie ; si ça persiste, préviens l'équipe technique.");
  }
  revalidatePath(`/admin/tremplins/${editionId}`, "layout");
  return { status: "success" };
}

/**
 * « Activer toutes les participantes de la phase » (#29). ADDITIVE : pose
 * comme membres l'UNION des membres actuels et de la cohorte de sa phase
 * (jamais de retrait silencieux, et sans toucher « ouvert à toutes »). La cohorte est dérivée CÔTÉ SERVEUR (`atelier.phase` +
 * appartenances) — l'invariant « seule la cohorte de la phase » ne dépend pas du
 * client. Réservé orga, scopé à l'édition. Ajouter préserve les présences déjà
 * pointées (`setAtelierMembers` DIFFE).
 */
export async function activerCohortePhaseAtelierAction(
  _prev: FicheActionState,
  formData: FormData,
): Promise<FicheActionState> {
  await requireOrgaId();
  const err = (error: string): FicheActionState => ({
    status: "error",
    error,
    values: formValues(formData),
  });

  const editionId = Number(formData.get("editionId"));
  const atelierId = Number(formData.get("atelierId"));
  if (!Number.isInteger(editionId) || editionId <= 0) return err("Édition invalide.");
  if (!Number.isInteger(atelierId) || atelierId <= 0) return err("Atelier invalide.");

  try {
    const atelier = await getAtelierById(atelierId, editionId);
    if (!atelier) return err("Atelier introuvable pour cette édition.");
    const [phaseMembers, membresActuels] = await Promise.all([
      getPhaseMembersByEdition(editionId),
      getAtelierMembers(atelierId),
    ]);
    // Union additive : jamais de retrait (donc jamais vider l'atelier). La
    // cohorte à ajouter exclut déjà les membres actuels → concat sans doublon.
    const cible = [
      ...membresActuels,
      ...cohortePhaseAAjouter(phaseMembers, atelier.phase, membresActuels),
    ];
    const ok = await setAtelierMembers(atelierId, editionId, cible);
    if (!ok) return err("Atelier introuvable pour cette édition.");
  } catch (e) {
    console.error("Activation de la cohorte de phase échouée", e);
    return err("Enregistrement impossible : réessaie ; si ça persiste, préviens l'équipe technique.");
  }

  revalidatePath(`/admin/tremplins/${editionId}`, "layout");
  revalidatePath(PUBLIC_EDITION_ROUTE, "layout"); // membres d'un atelier ouvert à toutes → page publique
  return { status: "success" };
}

/**
 * « Marquer toutes présentes » (#29) : passe `presente` les membres actuels dont
 * la présence est encore « non renseignée » — sans écraser un `absente` déjà
 * pointé. Réservé orga, scopé à l'édition.
 */
export async function marquerToutesPresentesAction(
  _prev: FicheActionState,
  formData: FormData,
): Promise<FicheActionState> {
  await requireOrgaId();
  const err = (error: string): FicheActionState => ({
    status: "error",
    error,
    values: formValues(formData),
  });

  const editionId = Number(formData.get("editionId"));
  const atelierId = Number(formData.get("atelierId"));
  if (!Number.isInteger(editionId) || editionId <= 0) return err("Édition invalide.");
  if (!Number.isInteger(atelierId) || atelierId <= 0) return err("Atelier invalide.");

  try {
    const atelier = await getAtelierById(atelierId, editionId);
    if (!atelier) return err("Atelier introuvable pour cette édition.");
    // La cible vient de l'AUDIENCE (dérivée côté serveur), pas des lignes de
    // présence déjà créées : sur un atelier de phase jamais pointé, il n'y en a
    // aucune. On marque celles qui restent « non renseignée » — une absente
    // déjà pointée n'est jamais requalifiée en présente au passage.
    const [cohorte, presences] = await Promise.all([
      getCohorteAtelier(atelierId, editionId),
      getAtelierPresences(atelierId),
    ]);
    const deja = new Map(presences.map((p) => [p.registrationId, p.presence]));
    const entrees = cohorte
      .filter((id) => (deja.get(id) ?? "non_renseignee") === "non_renseignee")
      .map((registrationId) => ({ registrationId, presence: "presente" as const }));
    if (entrees.length > 0) {
      const ok = await setAtelierPresences(atelierId, editionId, entrees);
      if (!ok) return err("Atelier introuvable pour cette édition.");
    }
  } catch (e) {
    console.error("Marquage collectif des présences échoué", e);
    return err("Enregistrement impossible : réessaie ; si ça persiste, préviens l'équipe technique.");
  }

  // Pas de revalidation ici : elle ramènerait l'arbre RSC dans la réponse même
  // de l'action, et le geste en lot se supprime lui-même (« Marquer présentes
  // les N » disparaît quand N tombe à zéro). Son compte rendu était donc démonté
  // avant d'exister — succès parfaitement silencieux, comme pour la suppression
  // d'un atelier. Le rafraîchissement appartient au client (`InlineActionForm`),
  // après l'annonce ; la page est `force-dynamic`.
  return { status: "success" };
}

/* ─────────────────────────── Photos (fiche photo) ───────────────────────────
   Le consentement d'une INSCRIPTION reste self-service (registration.public) ;
   pour un compte ou un nom libre, l'orga atteste l'avoir recueilli, tag par
   tag. Tout est scopé à l'édition côté SQL. */

/**
 * Tague une personne sur une photo : participante de l'édition (registrationId),
 * compte de la plateforme (compteId) OU nom libre (nomLibre). Réservé orga.
 */
export async function addPhotoTagAction(
  _prev: FicheActionState,
  formData: FormData,
): Promise<FicheActionState> {
  await requireOrgaId();
  const err = (error: string): FicheActionState => ({
    status: "error",
    error,
    values: formValues(formData),
  });

  const editionId = Number(formData.get("editionId"));
  const photoId = Number(formData.get("photoId"));
  if (!Number.isInteger(editionId) || editionId <= 0) return err("Édition invalide.");
  if (!Number.isInteger(photoId) || photoId <= 0) return err("Photo invalide.");

  const regBrut = (formData.get("registrationId") ?? "").toString().trim();
  const compteBrut = (formData.get("compteId") ?? "").toString().trim();
  const nomLibre = (formData.get("nomLibre") ?? "").toString().trim();
  const remplis = [regBrut, compteBrut, nomLibre].filter((v) => v !== "").length;
  if (remplis === 0) {
    return err("Choisis une participante, un compte, ou saisis un nom.");
  }
  if (remplis > 1) {
    return err("Une seule identité par personne : participante, compte OU nom libre.");
  }

  let tag: Parameters<typeof addPhotoTag>[2];
  if (regBrut !== "") {
    const registrationId = Number(regBrut);
    if (!Number.isInteger(registrationId) || registrationId <= 0) return err("Participante invalide.");
    // Une inscription porte son consentement dans son profil (registration.public).
    tag = { registrationId, consentement: true };
  } else if (compteBrut !== "") {
    const userId = Number(compteBrut);
    if (!Number.isInteger(userId) || userId <= 0) return err("Compte invalide.");
    tag = { userId, consentement: formData.get("consentement") != null };
  } else {
    tag = { nomLibre, consentement: formData.get("consentement") != null };
  }

  try {
    const ok = await addPhotoTag(photoId, editionId, tag);
    if (!ok) return err("Personne non ajoutée : photo, participante ou compte hors de cette édition ?");
  } catch (e) {
    console.error("Tag photo échoué", e);
    return err("Ajout impossible : réessaie ; si ça persiste, préviens l'équipe technique.");
  }
  revalidatePath(`/admin/tremplins/${editionId}`, "layout");
  revalidatePath(PUBLIC_EDITION_ROUTE, "layout");
  return { status: "success" };
}

/** Retire un tag d'une photo. Réservé orga, scopé à l'édition. */
export async function removePhotoTagAction(
  _prev: FicheActionState,
  formData: FormData,
): Promise<FicheActionState> {
  await requireOrgaId();
  const err = (error: string): FicheActionState => ({
    status: "error",
    error,
    values: formValues(formData),
  });

  const editionId = Number(formData.get("editionId"));
  const tagId = Number(formData.get("tagId"));
  if (!Number.isInteger(editionId) || editionId <= 0) return err("Édition invalide.");
  if (!Number.isInteger(tagId) || tagId <= 0) return err("Personne invalide.");

  const ok = await removePhotoTag(tagId, editionId);
  if (!ok) return err("Personne introuvable pour cette édition.");
  revalidatePath(`/admin/tremplins/${editionId}`, "layout");
  revalidatePath(PUBLIC_EDITION_ROUTE, "layout");
  return { status: "success" };
}

/**
 * Pose « consentement recueilli » sur un tag hors inscription (à la volée).
 * Réservé orga, scopé. Le consentement d'une inscription se gère chez elle.
 */
export async function setPhotoTagConsentAction(
  _prev: FicheActionState,
  formData: FormData,
): Promise<FicheActionState> {
  await requireOrgaId();
  const err = (error: string): FicheActionState => ({
    status: "error",
    error,
    values: formValues(formData),
  });

  const editionId = Number(formData.get("editionId"));
  const tagId = Number(formData.get("tagId"));
  if (!Number.isInteger(editionId) || editionId <= 0) return err("Édition invalide.");
  if (!Number.isInteger(tagId) || tagId <= 0) return err("Personne invalide.");
  const consentement = formData.get("consentement") != null;

  const ok = await setPhotoTagConsent(tagId, editionId, consentement);
  if (!ok) return err("Consentement non enregistré : cette personne est-elle une inscrite (accord géré dans son espace) ?");
  revalidatePath(`/admin/tremplins/${editionId}`, "layout");
  revalidatePath(PUBLIC_EDITION_ROUTE, "layout");
  return { status: "success" };
}

/** Modifie légende et moment d'une photo. Réservé orga, scopé à l'édition. */
export async function updatePhotoAction(
  _prev: FicheActionState,
  formData: FormData,
): Promise<FicheActionState> {
  await requireOrgaId();
  const err = (error: string): FicheActionState => ({
    status: "error",
    error,
    values: formValues(formData),
  });

  const editionId = Number(formData.get("editionId"));
  const photoId = Number(formData.get("photoId"));
  if (!Number.isInteger(editionId) || editionId <= 0) return err("Édition invalide.");
  if (!Number.isInteger(photoId) || photoId <= 0) return err("Photo invalide.");
  const legende = (formData.get("legende") ?? "").toString().trim() || null;
  const kind = (formData.get("kind") ?? "").toString();
  if (kind !== "podium" && kind !== "soiree" && kind !== "autre") return err("Moment inconnu.");

  const ok = await updatePhoto(photoId, editionId, { legende, kind });
  if (!ok) return err("Photo introuvable pour cette édition.");
  revalidatePath(`/admin/tremplins/${editionId}`, "layout");
  revalidatePath(PUBLIC_EDITION_ROUTE, "layout");
  return { status: "success" };
}

/**
 * Supprime une photo depuis sa fiche (destructif → PRG : la fiche n'existe
 * plus, on redirige vers le tableau de bord). Réservé orga, scopé.
 */
export async function deletePhotoFromFicheAction(formData: FormData): Promise<void> {
  await requireOrgaId();

  const base = editionBase(formData);
  if (!base) redirect("/admin/tremplins");
  const editionId = Number(formData.get("editionId")); // sûr : base valide
  const photoId = Number(formData.get("photoId"));
  if (!Number.isInteger(photoId) || photoId <= 0) redirect(`${base}?err=photo`);

  const ok = await deletePhoto(photoId, editionId);
  if (!ok) redirect(`${base}?err=photo`);

  revalidatePath(base, "layout");
  revalidatePath(PUBLIC_EDITION_ROUTE, "layout");
  redirect(`${base}?ok=photo_supprimee`);
}

/**
 * État de retour du formulaire de talk orga, compatible avec `TalkForm`
 * (mêmes clés d'erreurs que le formulaire speakeuse).
 */
export type TalkSaveState = { ok?: boolean; errors?: Record<string, string> };

/**
 * Rattache un talk à une participante DEPUIS la fiche orga (la « proposition de
 * talk » mise en avant à la finale). Réutilise la machinerie de l'annuaire : le
 * talk vit sur le profil speakeuse de la personne (et le préremplit). Il faut
 * donc un compte relié — l'orga le rattache d'abord via « Son compte » (ce qui
 * pré-crée le compte par e-mail si besoin). Réservé orga, scopé à l'édition.
 */
export async function addRegistrationTalkAction(
  _prev: TalkSaveState,
  formData: FormData,
): Promise<TalkSaveState> {
  await requireOrgaId();
  const editionId = Number(formData.get("ctxEditionId"));
  const registrationId = Number(formData.get("registrationId"));
  if (!Number.isInteger(editionId) || editionId <= 0)
    return { ok: false, errors: { titre: "Édition invalide." } };
  if (!Number.isInteger(registrationId) || registrationId <= 0)
    return { ok: false, errors: { titre: "Inscription invalide." } };

  const reg = await getRegistrationById(registrationId, editionId);
  if (!reg) return { ok: false, errors: { titre: "Inscription introuvable." } };
  if (reg.userId == null)
    return {
      ok: false,
      errors: {
        titre:
          "Rattache d'abord un compte à cette participante (« Son compte ») : le talk vit sur son profil et le préremplit.",
      },
    };

  const result = parseTalkIdentityForm(formData);
  if (!result.ok) return { ok: false, errors: result.errors };

  const profileId = await ensureProfileId(reg.userId);
  const talkId = await addTalk(profileId, result.data);
  // Créer un talk ici, c'est le désigner comme talk pitché au Tremplin.
  await setRegistrationTalk(registrationId, editionId, talkId);
  // Une participante peut être une speakeuse PUBLIÉE : le talk s'affiche
  // alors sur sa carte d'annuaire (source NULL, pas 'tremplin').
  invaliderAnnuaire();

  revalidatePath(`/admin/tremplins/${editionId}`, "layout");
  revalidatePath(PUBLIC_EDITION_ROUTE, "layout");
  redirect(`/admin/tremplins/${editionId}/participantes/${registrationId}/talk`);
}

/**
 * Met à jour le talk mis en avant d'une participante (ownership vérifié via le
 * profil dérivé du compte relié). Réservé orga, scopé à l'édition.
 */
export async function updateRegistrationTalkAction(
  _prev: TalkSaveState,
  formData: FormData,
): Promise<TalkSaveState> {
  await requireOrgaId();
  const editionId = Number(formData.get("ctxEditionId"));
  const registrationId = Number(formData.get("registrationId"));
  const talkId = Number(formData.get("talkId"));
  if (!Number.isInteger(editionId) || editionId <= 0)
    return { ok: false, errors: { titre: "Édition invalide." } };
  if (!Number.isInteger(registrationId) || registrationId <= 0)
    return { ok: false, errors: { titre: "Inscription invalide." } };
  if (!Number.isInteger(talkId) || talkId <= 0)
    return { ok: false, errors: { titre: "Talk introuvable." } };

  const reg = await getRegistrationById(registrationId, editionId);
  if (!reg || reg.userId == null)
    return { ok: false, errors: { titre: "Inscription ou compte introuvable." } };

  const result = parseTalkIdentityForm(formData);
  if (!result.ok) return { ok: false, errors: result.errors };

  const profileId = await ensureProfileId(reg.userId);
  // Ownership : le talk doit appartenir au profil de cette participante.
  const existant = await getTalkById(talkId, profileId);
  if (!existant) return { ok: false, errors: { titre: "Talk introuvable pour ce profil." } };
  // Édition du CONTENU seulement : on ne change pas quel talk est pitché ici
  // (c'est le rôle de setRegistrationPitchedTalkAction).
  await updateTalk(talkId, profileId, result.data);
  // Même raison qu'à la création : le titre édité peut être sur une carte.
  invaliderAnnuaire();

  revalidatePath(`/admin/tremplins/${editionId}`, "layout");
  revalidatePath(PUBLIC_EDITION_ROUTE, "layout");
  redirect(`/admin/tremplins/${editionId}/participantes/${registrationId}/talk`);
}

/**
 * Désigne (ou retire, talkId vide) le talk pitché au Tremplin par une
 * participante, parmi ses talks existants. Micro-action à résultat (pas de
 * redirection) : l'appelant rafraîchit. Ownership vérifié via le profil du
 * compte relié. Réservé orga, scopé à l'édition.
 */
export async function setRegistrationPitchedTalkAction(
  _prev: FicheActionState,
  formData: FormData,
): Promise<FicheActionState> {
  await requireOrgaId();
  const err = (error: string): FicheActionState => ({
    status: "error",
    error,
    values: formValues(formData),
  });
  const editionId = Number(formData.get("editionId"));
  const registrationId = Number(formData.get("registrationId"));
  if (!Number.isInteger(editionId) || editionId <= 0) return err("Édition invalide.");
  if (!Number.isInteger(registrationId) || registrationId <= 0) return err("Inscription invalide.");

  const raw = (formData.get("talkId") ?? "").toString().trim();
  const talkId = raw === "" ? null : Number(raw);
  if (talkId !== null && (!Number.isInteger(talkId) || talkId <= 0)) return err("Talk invalide.");

  const reg = await getRegistrationById(registrationId, editionId);
  if (!reg || reg.userId == null) return err("Inscription ou compte introuvable.");

  // Rattacher : le talk doit appartenir au profil de CETTE participante.
  if (talkId !== null) {
    const profileId = await ensureProfileId(reg.userId);
    const existant = await getTalkById(talkId, profileId);
    if (!existant) return err("Ce talk appartient à une autre participante.");
  }

  const ok = await setRegistrationTalk(registrationId, editionId, talkId);
  if (!ok) return err("Inscription introuvable pour cette édition.");

  revalidatePath(`/admin/tremplins/${editionId}`, "layout");
  revalidatePath(PUBLIC_EDITION_ROUTE, "layout");
  return { status: "success" };
}
