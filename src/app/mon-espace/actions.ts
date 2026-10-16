"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { invaliderAnnuaire } from "@/lib/annuaire-cache";
import { signOut } from "@/auth";
import { connexionOAuthSansDoublon } from "@/lib/connexion-oauth";
import { appliquerNouvelAvatar, CADENCE_AVATAR } from "@/lib/avatar-compte";
import { requireUserId } from "@/lib/auth-guards";
import {
  parseProfileForm,
  parseProfilChamps,
  normaliserProfil,
  formString,
} from "@/lib/profile-form";
import { sectionParCle } from "@/lib/profil-sections";
import { parseTalkIdentityForm, parseOccurrenceForm } from "@/lib/talk-form";
import {
  upsertProfile,
  ensureProfileId,
  submitForValidation,
  withdrawOwnProfile,
  getProfileByUserId,
  raisonBlocageAnnuaire,
  isSlugAvailable,
  deriveAvailableSlug,
  profilVersInput,
} from "@/lib/profiles";
import { supprimerCompte } from "@/lib/suppression-compte";
import { isUniqueViolation } from "@/lib/pg-errors";
import {
  addTalk,
  updateTalk,
  deleteTalk,
  addOccurrence,
  updateOccurrence,
  removeOccurrence,
  getOccurrenceById,
  talkAppartientAuProfil,
  getKnownEditionById,
  getRegistryConferenceById,
  type OccurrenceInput,
  type TalkOccurrence,
} from "@/lib/talks";
import { setUserName, getUserById } from "@/lib/users";
import { reprendrePhotoLinkedIn } from "@/lib/linkedin-photo";
import type { ActionState } from "@/lib/action-state";
// `estIdValide` vit dans `@/lib/id-url` depuis le 2026-08-21 : la copie locale
// s'arrêtait à `Number.isInteger`, que la notation exponentielle passe (`1e21`),
// et le paramètre partait alors tel quel dans un `integer` — la 500 que son
// propre commentaire annonçait pour les décimaux. Une seule épellation, deux
// bornes (relevé par la passe sécurité du lot d'arbitrage).
import { estIdValide } from "@/lib/id-url";
import { poserReaction, retirerReaction, estTypeCible } from "@/lib/reactions";
import { isRateLimited } from "@/lib/rate-limit";
import { normaliserNomCompte } from "@/lib/format";
import { plierConfirmation } from "@/lib/confirmation";
import { acceptSuggestion, refuseSuggestion } from "@/lib/cfp-suggestions";
import { parseMemberEditionForm } from "@/lib/conference-form";
import { testSessionizeEndpoint } from "@/lib/conferences";
import {
  soumettreProposition,
  updateConferenceProposition,
  findPropositionByNom,
} from "@/lib/conference-propositions";
import { runHarvestForProfile } from "@/lib/cfp-sync";
import { moissonnageConsenti } from "@/lib/cfp-consentement";
import { dateLegueeParEdition, parseTalkDateParts } from "@/lib/talk-date";
import { isLinkedInEnabled } from "@/auth.config";


/**
 * Revalide les écrans PERSO qui affichent la fiche, les talks et la marche
 * (lot N2 : « Ma fiche publique » porte complétude + soumission, « Mon
 * profil » porte la marche dérivée, /mon-espace/talks la liste et les
 * suggestions). Une écriture de fiche ou de talk les rafraîchit ENSEMBLE :
 * cibler un seul écran laissait les autres servir leur version en cache
 * (Router Cache) avec les anciennes infos.
 */
function revalidateEspacePerso(): void {
  revalidatePath("/mon-espace/fiche");
  revalidatePath("/mon-espace/profil");
  revalidatePath("/mon-espace/talks");
}

export type SaveState = {
  ok?: boolean;
  errors?: Record<string, string>;
  /**
   * La saisie REFUSÉE, renvoyée telle quelle pour que le formulaire la
   * réaffiche. Sans elle, le champ reprenait sa valeur en base : on lisait
   * « cette adresse est déjà prise, essaies-en une autre » à côté d'un champ
   * qui ne contenait plus ce qu'on avait tapé (WCAG 3.3.1 / 3.3.3, et le §6 du
   * guide — « une erreur de validation CONSERVE la saisie »).
   *
   * `string[]` parce qu'un champ peut être multiple (les cases d'une section) ;
   * l'appelant lit la première valeur pour un champ simple.
   */
  valeurs?: Record<string, string[]>;
};

/** Message unique quand l'adresse choisie est déjà portée par une autre fiche. */
const SLUG_PRIS = "Cette adresse est déjà prise, essaies-en une autre.";

/**
 * Rafraîchit la fiche publique + l'annuaire après une modif qui s'y reflète
 * (talks, suggestion confirmée). Sans ça, le Router Cache ressert l'ancienne
 * version : c'est le bug classique « ma modif n'apparaît pas sur ma fiche ».
 * L'annuaire est inclus car sa recherche indexe le contenu des talks.
 *
 * La fiche est une route DYNAMIQUE joignable par id OU par slug : on revalide le
 * MOTIF `/speakeuses/[id]` (type `page`) plutôt qu'un chemin littéral, pour
 * couvrir les deux formes d'URL sans dépendre de la valeur du slug.
 */
function revalidatePublicProfile(): void {
  invaliderAnnuaire();
  revalidatePath("/speakeuses");
  revalidatePath("/speakeuses/[id]", "page");
}

/**
 * Enregistre le profil de la membre connectée.
 * Sécurité : l'id vient de la SESSION (jamais d'un champ client). Entrées
 * validées par parseProfileForm avant écriture en base.
 */
export async function saveProfile(
  _prev: SaveState,
  formData: FormData,
): Promise<SaveState> {
  const id = await requireUserId();

  const result = parseProfileForm(formData);
  if (!result.ok) return { ok: false, errors: result.errors };

  // Le nom vit sur le COMPTE (users.name) : affiché sur la fiche et dans
  // l'annuaire. Saisi ici pour la cohorte lien-magique (aucun nom OAuth) ;
  // vide = inchangé (on n'efface jamais un nom).
  // Le nom vit sur le COMPTE, pas sur la fiche : normalisation et borne sont
  // tenues par `users.ts` (bord de la colonne), et un nom vide n'écrase jamais
  // celui qui existe. On le normalise ici seulement pour dériver l'adresse.
  const nomComplet = normaliserNomCompte(formString(formData, "nomComplet"));

  // Profil existant (nom + slug actuels) lu AVANT l'écriture : le nom sert de
  // repli pour dériver l'adresse, et un slug existant est préservé si le champ
  // reste vide (on ne casse jamais une URL déjà partagée en silence).
  const existant = await getProfileByUserId(id);
  if (nomComplet) await setUserName(id, nomComplet);
  const nomEffectif = nomComplet || existant?.name || "";

  // Adresse (slug) définitive : saisie explicite → contrôle d'unicité (message
  // clair si déjà prise) ; champ vide → slug existant conservé, sinon dérivé du nom.
  let slug: string | null;
  if (result.data.slug) {
    if (!(await isSlugAvailable(result.data.slug, id))) {
      return { ok: false, errors: { slug: SLUG_PRIS } };
    }
    slug = result.data.slug;
  } else {
    slug = existant?.slug ?? (await deriveAvailableSlug(nomEffectif, id));
  }

  try {
    await upsertProfile(id, { ...result.data, slug });
  } catch (err) {
    // Course entre le contrôle d'unicité et l'écriture (deux enregistrements
    // simultanés) : l'index UNIQUE tranche, on retraduit en message clair.
    if (isUniqueViolation(err)) {
      return { ok: false, errors: { slug: SLUG_PRIS } };
    }
    throw err;
  }
  revalidateEspacePerso();
  // Revalider aussi la fiche + l'annuaire : sans ça, « Prévisualiser ma fiche »
  // (navigation client) ressert la version en cache (Router Cache) avec les
  // anciennes infos, et une fiche publiée n'y refléterait pas les modifs.
  revalidatePublicProfile();
  // La fiche créée s'affiche là où elle vit (lot N2 §4) : sur son écran.
  redirect("/mon-espace/fiche");
}

/**
 * Enregistre UNE SECTION de la fiche (lot I : « façon LinkedIn », un crayon par
 * section plutôt qu'un assistant de six étapes à re-parcourir pour un mot).
 *
 * Sécurité : l'identité vient de la SESSION, et le PÉRIMÈTRE vient de la page
 * (`cle`, liée côté serveur), jamais du formulaire. Un champ glissé dans le POST
 * d'une autre section n'est donc pas lu — sans quoi l'enregistrement partiel
 * offrirait un chemin pour écrire n'importe quelle colonne depuis n'importe quel
 * écran. Ce qui n'est pas dans la section n'est pas relu non plus : une valeur
 * déjà en base qui ne passerait plus la validation ne bloque pas l'édition
 * d'ailleurs.
 */
export async function saveProfileSection(
  cle: string,
  _prev: SaveState,
  formData: FormData,
): Promise<SaveState> {
  const id = await requireUserId();
  const section = sectionParCle(cle);
  if (!section) return { ok: false, errors: { slug: "Section inconnue." } };

  // Éditer une section suppose une fiche à éditer : sans fiche, c'est le
  // parcours de création qui a le bon rôle (et lui seul recueille l'attestation).
  const existant = await getProfileByUserId(id);
  if (!existant) redirect("/mon-espace/fiche");

  // La saisie telle qu'elle arrive, pour la RENDRE en cas de refus. Bornée aux
  // champs de la SECTION, comme l'écriture : ce qui n'a pas le droit d'être
  // enregistré depuis cet écran n'a pas le droit d'y revenir non plus.
  const refuser = (errors: Record<string, string>): SaveState => ({
    ok: false,
    errors,
    valeurs: Object.fromEntries(
      section.champs
        .map((c) => [c, formData.getAll(c).filter((v): v is string => typeof v === "string")])
        .filter(([, v]) => (v as string[]).length > 0),
    ),
  });

  const result = parseProfilChamps(formData, section.champs);
  if (!result.ok) return refuser(result.errors);

  // Adresse (slug) : contrôle d'unicité comme le parcours complet, et seulement
  // si la section la porte. Champ vide → l'adresse existante est conservée (on
  // ne casse jamais une URL déjà partagée), ou dérivée du nom s'il n'y en a pas.
  let slug = existant.slug;
  if (section.champs.includes("slug")) {
    const voulu = result.data.slug ?? null;
    if (voulu && voulu !== existant.slug) {
      if (!(await isSlugAvailable(voulu, id))) return refuser({ slug: SLUG_PRIS });
      slug = voulu;
    } else if (!voulu) {
      slug = existant.slug ?? (await deriveAvailableSlug(existant.name ?? "", id));
    }
  }

  // Le nom vit sur le COMPTE (users.name), pas sur la fiche : seule la section
  // qui l'affiche a le droit de l'écrire, et un nom vide n'écrase jamais celui
  // qui existe.
  if (section.champs.includes("nomComplet")) {
    const nomComplet = normaliserNomCompte(formString(formData, "nomComplet"));
    if (nomComplet) await setUserName(id, nomComplet);
  }

  // La section repose SES colonnes sur celles déjà en base, puis les règles de
  // cohérence du profil entier s'appliquent (elles traversent les sections).
  const fusion = normaliserProfil({
    ...profilVersInput(existant),
    ...result.data,
    slug,
  });

  try {
    await upsertProfile(id, fusion);
  } catch (err) {
    if (isUniqueViolation(err)) return refuser({ slug: SLUG_PRIS });
    throw err;
  }
  revalidateEspacePerso();
  revalidatePublicProfile();
  // La section est NOMMÉE dans l'adresse de retour : la fiche peut alors dire
  // laquelle vient d'être enregistrée, dans une région vive et avec le focus
  // (`ConfirmationBanner`). Sans ce paramètre, l'enregistrement était
  // parfaitement muet — focus retombé sur `body`, régions vives vides — alors
  // que le même geste, côté talks, annonçait déjà correctement.
  redirect(`/mon-espace/fiche?ok=${section.cle}`);
}

/**
 * La membre soumet son profil (infos + talks) pour apparaître dans l'annuaire.
 * Pré-requis : un lien LinkedIn (seul canal de contact public). Le contrôle est
 * aussi fait côté UI ; ici c'est la sécurité côté serveur.
 */
export async function submitProfileAction(): Promise<void> {
  const id = await requireUserId();

  const profile = await getProfileByUserId(id);
  // Le MOTIF porte la règle (src/lib/profiles.ts) : l'action ne fait que le
  // traduire en message. Avant, chaque condition était re-testée ici, et celle
  // du nom l'était deux fois à trois lignes d'écart.
  const blocage = raisonBlocageAnnuaire(profile);
  // La soumission vit sur « Ma fiche publique » (lot N2 §4) : erreurs et
  // résultat atterrissent là où le geste est parti.
  if (blocage) redirect(`/mon-espace/fiche?error=${blocage}`);

  await submitForValidation(id);
  // Une fiche PUBLIÉE re-soumise QUITTE l'annuaire (la 3e sortie de
  // « publié », cf. submitForValidation) : mêmes revalidations que les deux
  // autres sorties (modération, retrait).
  revalidatePublicProfile();
  revalidateEspacePerso();
  redirect("/mon-espace/fiche");
}

/**
 * Le retour d'un refus de suppression, HORODATÉ.
 *
 * Le motif seul ne suffit pas : deux refus d'affilée (une faute de frappe
 * répétée, une panne qui dure) rendaient exactement la même URL. La page ne
 * changeait alors nulle part — React réconciliait les mêmes nœuds, donc aucune
 * annonce au lecteur d'écran, et la fenêtre de confirmation restait ouverte
 * PAR-DESSUS le message (Radix masque ses frères en `aria-hidden`). On ne
 * pouvait pas savoir si la seconde tentative avait eu lieu. L'horodatage donne
 * une URL neuve à chaque refus : la page remonte ce qu'il faut, le message
 * s'annonce, la fenêtre se referme. `ConfirmationBanner` retire les deux
 * paramètres ensuite, pour qu'un rechargement ne rejoue pas un refus périmé.
 */
function refusSuppression(motif: "confirmation" | "echec"): string {
  return `/mon-espace/supprimer?err=${motif}&n=${Date.now()}`;
}

/**
 * Suppression RGPD du profil + compte de la membre connectée, puis déconnexion.
 * Irréversible : efface fiche, talks et compte (cascade).
 */
export async function deleteProfileAction(formData: FormData): Promise<void> {
  const id = await requireUserId();

  // Palier 3 (cf. principes-conception-ui.md §10) : le type-to-confirm est
  // REVÉRIFIÉ ici. Celui du navigateur se contourne en deux clics de DevTools ;
  // pour un effacement RGPD irréversible, on ne s'en contente pas. Le repli est
  // le même qu'au client (`plierConfirmation`), sinon une saisie acceptée à
  // l'écran serait refusée par le serveur.
  const compte = await getUserById(id);
  const attendus = [compte?.name, compte?.email]
    .map((v) => plierConfirmation(v ?? ""))
    .filter((v) => v.length > 0);
  const saisie = plierConfirmation((formData.get("confirmation") ?? "").toString());
  if (attendus.length > 0 && !attendus.includes(saisie)) {
    redirect(refusSuppression("confirmation"));
  }

  // La suppression va jusqu'à Brevo (le contact de la lettre d'information) et
  // renonce si le sous-traitant est en panne, plutôt que d'effacer l'adresse et
  // de perdre le moyen d'aller chercher le contact. Le geste échoue donc
  // parfois : le dire ici, sinon la page d'erreur générique laisserait croire à
  // une suppression faite (ou à un bouton cassé).
  //
  // Un seul motif pour les deux causes (le sous-traitant AVANT, la base APRÈS) :
  // nommer Brevo dirait faux le jour où c'est Postgres qui a lâché, et ce qui
  // compte pour la personne est le même dans les deux cas — son compte est
  // toujours là, le geste se retente.
  try {
    await supprimerCompte(id);
  } catch (err) {
    console.error("Suppression de compte échouée", id, err);
    redirect(refusSuppression("echec"));
  }
  // La page de l'annuaire est dynamique mais sa DONNÉE est en cache : sans
  // expiration immédiate (invaliderAnnuaire), une fiche resterait visible
  // 5 min et un service périmé après une suppression RGPD. La fiche `/speakeuses/[id]`
  // reste dynamique (elle renvoie notFound aussitôt).
  invaliderAnnuaire();
  revalidatePath("/speakeuses");
  // Déconnexion + atterrissage sur /connexion avec confirmation (la membre est
  // désormais déconnectée ; son compte et ses données sont effacés).
  await signOut({ redirectTo: "/connexion?compte=supprime" });
}

/**
 * La membre retire sa fiche de l'annuaire / annule sa soumission : retour en
 * brouillon (modifiable, à re-soumettre). Depuis publie / en_attente / masque.
 */
export async function withdrawProfileAction(): Promise<void> {
  const id = await requireUserId();
  await withdrawOwnProfile(id);
  revalidateEspacePerso();
  // La fiche disparait de l'annuaire public : on rafraichit la liste et la
  // fiche (symetrique du retrait orga) pour que le retrait soit immediat.
  revalidatePublicProfile();
  redirect("/mon-espace/fiche");
}

/**
 * Résout le LIEN d'une occurrence au registre (conf + édition). Les champs
 * cachés `conferenceId`/`editionId` sont falsifiables : la vérité vient d'ici.
 *  1. `editionId` fourni : vérifier qu'elle existe, en déduire la conférence
 *     réelle (FORCE `conferenceId`) et figer le libellé (SNAPSHOT) ;
 *  2. sinon `conferenceId` fourni : vérifier qu'il existe, figer le libellé ;
 *  3. aucune conf valide : lien nul (l'action rejette — pas de saisie libre).
 * Aucune erreur de FK possible : un id invalide retombe à NULL, l'action décide.
 */
async function resolveOccurrenceLink(data: OccurrenceInput): Promise<OccurrenceInput> {
  if (data.editionId != null) {
    const edition = await getKnownEditionById(data.editionId);
    if (edition) {
      // Une date encore imprécise hérite de ce que l'édition SAIT : le jour
      // exact si elle tient sur un jour, le mois si elle en couvre plusieurs
      // (le talk tombe l'un des jours, personne ne sait lequel). Une date déjà
      // exacte reste intacte. Règle partagée avec l'import.
      const date = dateLegueeParEdition(edition.dateDebut, edition.dateFin, data.date);
      return {
        ...data,
        editionId: edition.editionId,
        conferenceId: edition.conferenceId,
        conference: edition.libelle,
        date,
      };
    }
    data = { ...data, editionId: null };
  }
  if (data.conferenceId != null) {
    const conf = await getRegistryConferenceById(data.conferenceId);
    if (conf) {
      return { ...data, editionId: null, conferenceId: conf.id, conference: conf.nom };
    }
    data = { ...data, conferenceId: null };
  }
  return { ...data, conferenceId: null, editionId: null, conference: null };
}

/** Ajoute un talk (identité seule) au profil, puis ouvre sa page pour y
 * rattacher des conférences. Un talk fraîchement créé est un sujet proposé. */
export async function addTalkAction(
  _prev: SaveState,
  formData: FormData,
): Promise<SaveState> {
  const id = await requireUserId();

  const result = parseTalkIdentityForm(formData);
  if (!result.ok) return { ok: false, errors: result.errors };

  const profileId = await ensureProfileId(id);
  const talkId = await addTalk(profileId, result.data);
  revalidateEspacePerso();
  revalidatePublicProfile();
  redirect(`/mon-espace/talks/${talkId}?ok=talk_ajoute`);
}

/**
 * Met à jour l'identité d'un talk (ownership vérifié) et RESTE sur sa page.
 * Éjecter vers la liste était une redirection surprise : on perdait la page
 * qu'on éditait alors que tous les autres gestes de cet écran (création,
 * ajout / modification / retrait d'une conférence) y reviennent (COGA §9).
 */
export async function updateTalkAction(
  _prev: SaveState,
  formData: FormData,
): Promise<SaveState> {
  const id = await requireUserId();

  const talkId = Number(formData.get("talkId"));
  if (!estIdValide(talkId)) return { ok: false, errors: { titre: "Talk introuvable." } };

  const result = parseTalkIdentityForm(formData);
  if (!result.ok) return { ok: false, errors: result.errors };

  const profileId = await ensureProfileId(id);
  await updateTalk(talkId, profileId, result.data);
  revalidateEspacePerso();
  revalidatePublicProfile();
  redirect(`/mon-espace/talks/${talkId}?ok=talk_modifie`);
}

/** Message d'erreur commun : une occurrence doit désigner une conférence. */
const OCCURRENCE_CONF_REQUISE =
  "Choisis une conférence dans la liste, ou donne le nom de la tienne.";

/**
 * Résultat de la résolution d'une conférence hors registre. Union DISCRIMINÉE
 * sur `ok` : `SaveState.ok` étant optionnel, l'échec ne s'y distinguait pas du
 * succès et il fallait renifler la forme (`"link" in x`) — un contrôle qui
 * casse en silence dès que l'un des deux membres gagne un champ.
 */
type PropositionResolue =
  | { ok: true; link: OccurrenceInput }
  | { ok: false; errors: Record<string, string> };

/**
 * Clé du seau anti-abus des propositions — PARTAGÉE par les deux écrans qui en
 * déposent (formulaire d'occurrence, et « Propose-la » du repérage). Écrite ici
 * une fois : deux littéraux qui divergeraient donneraient deux quotas séparés,
 * donc le double d'envois.
 */
const CLE_QUOTA_PROPOSITION = (userId: number) => `propose-conference:${userId}`;

/** Une conférence déjà écartée par l'équipe ne retourne pas dans la file. */
function messageEcartee(nom: string): string {
  return `L'équipe a écarté « ${nom} ». Choisis une conférence dans la liste, ou donne un autre nom.`;
}

/** Trop de propositions d'affilée : même plafond aux deux portes. */
const TROP_TOT = "Doucement ! Réessaie dans une heure.";

/** Trop de propositions d'affilée, côté formulaire d'occurrence. */
const TROP_DE_PROPOSITIONS: PropositionResolue = {
  ok: false,
  errors: { conferenceProposee: TROP_TOT },
};

/**
 * Message de confirmation : une saisie encore rattachée à une proposition dit
 * qu'elle attend, les autres disent qu'elles sont enregistrées. DÉRIVÉ du lien
 * lui-même — un drapeau tenu à part à côté finit par mentir.
 */
function okSaisie<T extends string>(link: OccurrenceInput, siPubliee: T): T | "conf_proposee" {
  return link.propositionId != null ? "conf_proposee" : siPubliee;
}

/**
 * La conférence saisie est hors registre : on la propose aux orga ET on garde
 * la saisie. L'occurrence est enregistrée tout de suite, rattachée à la
 * proposition (`propositionId`) au lieu du répertoire — elle reste hors des
 * affichages publics jusqu'à l'arbitrage, puis y entre telle quelle.
 *
 * UNE proposition par (conférence, ANNÉE) et par personne, pas une par talk :
 * la même édition sert souvent plusieurs talks, et sans ce regroupement l'orga
 * arbitrerait la même ligne N fois. L'année fait partie de la clé parce qu'une
 * proposition promeut UNE édition datée : regrouper 2023 et 2024 publierait les
 * deux talks sur la même édition. Un nom DÉJÀ ÉCARTÉ (toutes années) n'est pas
 * remis en file — on le dit, plutôt que de faire semblant d'envoyer.
 *
 * `saisieEditee` : la proposition que cette saisie portait déjà est corrigée sur
 * place tant qu'elle attend ET que cette saisie est SEULE à la tenir ; sinon on
 * repart sur le cas général, qui rejoint la proposition de la nouvelle
 * (conférence, année) ou en ouvre une — la saisie se DÉTACHE au lieu de
 * réécrire l'édition sous les autres talks derrière la même ligne. L'année et
 * le lieu viennent de la saisie : l'orga arbitre avec le contexte sous les yeux.
 */
async function proposerConference(
  userId: number,
  nom: string,
  data: OccurrenceInput,
  saisieEditee: Pick<TalkOccurrence, "id" | "propositionId"> | null,
): Promise<PropositionResolue> {
  const champs = {
    nomConference: nom,
    annee: Number(parseTalkDateParts(data.date).annee) || null,
    ville: data.ville,
    url: data.lienConf,
  };
  const rattachee = (propositionId: number): PropositionResolue => ({
    ok: true,
    link: { ...data, conferenceId: null, editionId: null, conference: nom, propositionId },
  });

  // L'état de la file se lit AVANT toute écriture, parce que corriger sa
  // proposition en place est une porte d'écriture au même titre que d'en
  // déposer une — et les arbitrages de l'orga valent aux deux. Sondée après,
  // la correction en place remettait en file un nom que l'équipe avait écarté :
  // le contournement déjà fermé sur l'écran « Propose-la », resté ouvert ici.
  const deja = await findPropositionByNom(userId, nom, champs.annee);
  // Un nom écarté ne RENTRE plus en file — mais `dejaEcartee` porte sur le nom
  // toutes années, alors qu'une proposition est datée. Refuser sur le nom seul
  // verrouillerait une saisie légitime : « Foo Conf 2023 » écartée empêcherait
  // de toucher à « Foo Conf 2025 » encore en attente, jusqu'au lien de slides.
  // Ce qui compte est donc : la correction change-t-elle le couple (nom, année)
  // que l'orga voit ? Si la ligne visée est celle qu'on édite déjà, rien de
  // neuf n'entre, et l'arbitrage reste entier.
  const editeSaPropreLigne =
    saisieEditee?.propositionId != null && deja.aReutiliser === saisieEditee.propositionId;
  if (deja.dejaEcartee && !editeSaPropreLigne) {
    return { ok: false, errors: { conferenceProposee: messageEcartee(nom) } };
  }

  // Corriger en place ne vaut que si le (nom, année) visé n'est porté par
  // AUCUNE autre de ses propositions : sinon on la rejoint, plutôt que d'en
  // fabriquer un doublon dans la file. Sa propre proposition ne compte pas
  // comme un doublon — c'est justement le cas « je corrige ma ville ».
  if (
    saisieEditee?.propositionId != null &&
    (deja.aReutiliser == null || deja.aReutiliser === saisieEditee.propositionId)
  ) {
    const { id: occurrenceId, propositionId } = saisieEditee;
    const corrigee = await updateConferenceProposition(
      { propositionId, userId, occurrenceId },
      champs,
    );
    if (corrigee) return rattachee(propositionId);
    // Déjà arbitrée, plus la sienne, ou TENUE PAR D'AUTRES SAISIES : on retombe
    // sur le cas général, qui détache cette saisie sur sa propre proposition.
  }

  // Le rate-limit ne se paie que pour une proposition NEUVE : rejoindre une
  // ligne déjà en file ne coûte rien à l'orga.
  if (deja.aReutiliser == null) {
    if (isRateLimited(CLE_QUOTA_PROPOSITION(userId), 5, 3_600_000)) {
      return TROP_DE_PROPOSITIONS;
    }
  }

  const soumise = await soumettreProposition({ userId, ...champs, endpoint: null });
  if (!soumise.ok) {
    return {
      ok: false,
      errors: { conferenceProposee: messageEcartee(nom) },
    };
  }
  return rattachee(soumise.propositionId);
}

/** Rattache une conférence (occurrence) à un talk de la membre connectée. */
export async function addOccurrenceAction(
  _prev: SaveState,
  formData: FormData,
): Promise<SaveState> {
  const res = await ajouterOccurrence(formData);
  if (!res.ok) return res;
  redirect(`/mon-espace/talks/${res.talkId}?ok=${res.issue}`);
}

/** Ce que répond une saisie d'occurrence. `issue` (ajout rapide) dit si la date
 * est en ligne ou si elle attend la validation de la conférence. */
export type SaisieOccurrenceState = SaveState & { issue?: "conf_ajoutee" | "conf_proposee" };

/**
 * Ajout RAPIDE d'une date, depuis la fenêtre ouverte sur un talk de la fiche
 * (refonte de la navigation connectée, 2026-10-15). Même noyau, donc mêmes
 * garde-fous qu'`addOccurrenceAction` ; une micro-action dans une liste ne
 * redirige pas (principes UI §4) : elle RÉPOND, et la fenêtre confirme à côté
 * du talk.
 */
export async function addOccurrenceRapideAction(
  _prev: SaisieOccurrenceState,
  formData: FormData,
): Promise<SaisieOccurrenceState> {
  const res = await ajouterOccurrence(formData);
  if (!res.ok) return res;
  return { ok: true, issue: res.issue };
}

/**
 * Le noyau des deux ajouts : identité par la SESSION, saisie validée,
 * conférence résolue contre le registre (ou proposée), ownership du talk dans
 * le WHERE de l'écriture. Ne redirige pas : chaque appelant répond à sa façon.
 */
async function ajouterOccurrence(
  formData: FormData,
): Promise<
  | { ok: false; errors: Record<string, string> }
  | { ok: true; talkId: number; issue: "conf_ajoutee" | "conf_proposee" }
> {
  const id = await requireUserId();

  const talkId = Number(formData.get("talkId"));
  if (!estIdValide(talkId))
    return { ok: false, errors: { conference: "Talk introuvable." } };

  const result = parseOccurrenceForm(formData);
  if (!result.ok) return { ok: false, errors: result.errors };

  const profileId = await ensureProfileId(id);
  let link = await resolveOccurrenceLink(result.data);
  if (link.conferenceId == null) {
    if (result.conferenceProposee == null)
      return { ok: false, errors: { conference: OCCURRENCE_CONF_REQUISE } };
    // Le talk est vérifié AVANT d'ouvrir une proposition : un talkId qui n'est
    // pas à elle laissait sinon une ligne orpheline dans la file de l'orga (et
    // consommait son quota) pour un enregistrement qui n'a jamais eu lieu. La
    // sonde reste dans CETTE branche : sur le chemin courant (conférence du
    // registre), `addOccurrence` porte déjà l'ownership dans son WHERE.
    if (!(await talkAppartientAuProfil(talkId, profileId)))
      return { ok: false, errors: { conference: "Ce talk est introuvable." } };
    const propose = await proposerConference(id, result.conferenceProposee, link, null);
    if (!propose.ok) return propose;
    link = propose.link;
  }

  const occId = await addOccurrence(talkId, profileId, link);
  if (occId == null) return { ok: false, errors: { conference: "Ce talk est introuvable." } };

  revalidateEspacePerso();
  revalidatePublicProfile();
  return { ok: true, talkId, issue: okSaisie(link, "conf_ajoutee") };
}

/** Met à jour une occurrence (ownership vérifié via le profil). */
export async function updateOccurrenceAction(
  _prev: SaveState,
  formData: FormData,
): Promise<SaveState> {
  const id = await requireUserId();

  const talkId = Number(formData.get("talkId"));
  const occurrenceId = Number(formData.get("occurrenceId"));
  if (!estIdValide(talkId) || !estIdValide(occurrenceId))
    return { ok: false, errors: { conference: "Conférence introuvable." } };

  const result = parseOccurrenceForm(formData);
  if (!result.ok) return { ok: false, errors: result.errors };

  const profileId = await ensureProfileId(id);
  // L'occurrence est relue AVANT d'écrire quoi que ce soit : elle porte
  // l'ownership (une occurrence qui n'est pas à ce profil est introuvable) et
  // l'état réel côté serveur, qui a pu bouger pendant que le formulaire était
  // ouvert. Sans elle, un id étranger ouvrait quand même une proposition et
  // repartait sur « Saisie enregistrée ✓ » sans avoir rien écrit.
  const actuelle = await getOccurrenceById(occurrenceId, profileId);
  if (!actuelle) return { ok: false, errors: { conference: "Conférence introuvable." } };

  let link = await resolveOccurrenceLink(result.data);
  if (link.conferenceId == null) {
    if (result.conferenceProposee == null)
      return { ok: false, errors: { conference: OCCURRENCE_CONF_REQUISE } };
    // Validée pendant que le formulaire était ouvert : renvoyer le nom saisi
    // DÉPUBLIERAIT une conférence déjà en ligne (conference_id effacé, nouvelle
    // proposition ouverte). On refuse, et on dit pourquoi.
    if (actuelle.etat === "publiee" && actuelle.conferenceId != null) {
      return {
        ok: false,
        errors: {
          conference:
            "Bonne nouvelle : l'équipe a validé cette conférence entre-temps. Recharge la page pour la choisir dans la liste.",
        },
      };
    }
    // La proposition à corriger vient de la BASE (ownership vérifié), jamais du
    // formulaire : un id soumis désignerait la proposition de quelqu'un d'autre.
    // L'id de la saisie va avec : il dit laquelle des occurrences derrière la
    // proposition est en train de la corriger, donc si elle est seule à la tenir.
    const propose = await proposerConference(id, result.conferenceProposee, link, actuelle);
    if (!propose.ok) return propose;
    link = propose.link;
  }

  await updateOccurrence(occurrenceId, profileId, link);

  revalidateEspacePerso();
  revalidatePublicProfile();
  redirect(`/mon-espace/talks/${talkId}?ok=${okSaisie(link, "conf_modifiee")}`);
}

/** Retire une conférence d'un talk (ownership vérifié), puis revient au talk. */
export async function removeOccurrenceAction(formData: FormData): Promise<void> {
  const id = await requireUserId();

  const talkId = Number(formData.get("talkId"));
  const occurrenceId = Number(formData.get("occurrenceId"));
  if (!estIdValide(talkId) || !estIdValide(occurrenceId)) return;

  const profileId = await ensureProfileId(id);
  await removeOccurrence(occurrenceId, profileId);
  revalidateEspacePerso();
  revalidatePublicProfile();
  redirect(`/mon-espace/talks/${talkId}?ok=conf_retiree`);
}

/** Supprime un talk (ownership vérifié), puis revient à la liste. */
export async function deleteTalkAction(formData: FormData): Promise<void> {
  const id = await requireUserId();

  const talkId = Number(formData.get("talkId"));
  if (!estIdValide(talkId)) return;

  const profileId = await ensureProfileId(id);
  await deleteTalk(talkId, profileId);
  revalidateEspacePerso();
  revalidatePublicProfile();
  redirect("/mon-espace/talks?ok=talk_supprime");
}

/**
 * Applique une décision (confirmer / écarter) sur une suggestion du moissonneur.
 * Garde-fous partagés : identité par la SESSION (jamais du client), id entier
 * strict, suggestion vérifiée en SQL via le profil (ownership). Sans profil,
 * aucune suggestion ne peut exister → no-op.
 */
async function decideSuggestion(
  formData: FormData,
  decide: (suggestionId: number, profileId: number) => Promise<unknown>,
  touchesFiche: boolean,
): Promise<void> {
  const id = await requireUserId();

  const suggestionId = Number(formData.get("suggestionId"));
  if (!Number.isInteger(suggestionId) || suggestionId <= 0) return;

  const profile = await getProfileByUserId(id);
  if (!profile) return;

  await decide(suggestionId, profile.id);
  revalidateEspacePerso();
  // Confirmer crée un talk sur la fiche publique → rafraîchir. Écarter ne
  // change rien de public (la suggestion est juste masquée).
  if (touchesFiche) revalidatePublicProfile();
}

/** La speakeuse confirme un talk repéré par le moissonneur : créé sur sa fiche. */
export async function acceptSuggestionAction(formData: FormData): Promise<void> {
  await decideSuggestion(formData, acceptSuggestion, true);
}

/** « Écarter » : la suggestion est mémorisée refusée, jamais re-proposée. */
export async function refuseSuggestionAction(formData: FormData): Promise<void> {
  await decideSuggestion(formData, refuseSuggestion, false);
}

/**
 * « Ta conf n'y est pas ? Propose-la » : la membre SIGNALE une conférence
 * manquante. Ça n'entre PAS dans le répertoire — ça part en file de validation
 * orga (`conference_propositions`), promue ou refusée depuis /admin/conferences.
 * Ainsi une saisie erronée (ex. un titre de talk pris pour un nom de conf) ne
 * peut jamais polluer les sélecteurs ni le moissonneur. Garde-fous : Zod,
 * rate-limit, et endpoint TESTÉ à la soumission (id cassé → erreur claire, rien
 * enregistré).
 */
export async function proposeConferenceAction(
  _prev: SaveState,
  formData: FormData,
): Promise<SaveState> {
  const id = await requireUserId();

  const result = parseMemberEditionForm(formData);
  if (!result.ok) return { ok: false, errors: result.errors };

  if (isRateLimited(CLE_QUOTA_PROPOSITION(id), 5, 3_600_000)) {
    return {
      ok: false,
      errors: { nomConference: TROP_TOT },
    };
  }

  if (result.data.endpoint != null) {
    const test = await testSessionizeEndpoint(result.data.endpoint);
    if (!test.ok) {
      return {
        ok: false,
        errors: {
          endpoint:
            "Cet id ne répond pas chez Sessionize. Vérifie l'id d'endpoint (pas l'URL complète).",
        },
      };
    }
  }

  // MÊME porte que la saisie d'un talk : le regroupement par (conférence,
  // année) et le refus d'un nom déjà écarté valent quel que soit l'écran. Sans
  // ça, cet écran-ci restait un contournement de l'arbitrage.
  const soumise = await soumettreProposition({ userId: id, ...result.data });
  if (!soumise.ok) {
    return {
      ok: false,
      errors: { nomConference: messageEcartee(result.data.nomConference) },
    };
  }
  return { ok: true };
}

export type HarvestState = {
  ok?: boolean;
  message?: string;
  /** Compteurs du run, pour l'affichage immédiat. */
  suggestions?: number;
  majs?: number;
};

/**
 * « Lancer le repérage » : moisson à la demande, scopée au profil de la
 * session. Rate-limitée ; les suggestions apparaissent immédiatement dans
 * « Talks repérés pour toi » (pas d'e-mail : elle est devant son écran).
 */
export async function runHarvestAction(
  _prev: HarvestState,
  _formData: FormData,
): Promise<HarvestState> {
  const id = await requireUserId();
  const profile = await getProfileByUserId(id);
  if (!profile) {
    return { ok: false, message: "Enregistre d'abord ton profil." };
  }
  // La MÊME source que les requêtes du moissonneur : un mode ajouté demain
  // n'ouvre pas cette garde tout seul (cf. cfp-consentement.ts).
  if (!moissonnageConsenti(profile.cfpSyncMode)) {
    return {
      ok: false,
      message:
        "Le repérage est désactivé dans ton profil (« Propose-moi les talks trouvés à mon nom »).",
    };
  }
  if (isRateLimited(`harvest:${profile.id}`, 2, 600_000)) {
    return {
      ok: false,
      message: "Un repérage vient d'être lancé. Réessaie dans quelques minutes.",
    };
  }

  const result = await runHarvestForProfile(profile.id);
  // Le run peut réécrire des titres de talks AFFICHÉS sur les cartes et la
  // fiche (refreshImportedTalk) : l'annuaire expire aussi.
  revalidatePublicProfile();
  revalidateEspacePerso();
  const total = result.suggestions;
  let message: string;
  if (total === 1) {
    message = "1 talk repéré ! Confirme-le ci-dessus.";
  } else if (total > 1) {
    message = `${total} talks repérés ! Confirme-les ci-dessus.`;
  } else if (result.majs > 0) {
    // Le run a travaillé : dire « rien trouvé » serait alarmant et faux.
    message = `Aucun nouveau talk, mais ${result.majs} de tes talks confirmés ${result.majs > 1 ? "ont été rafraîchis" : "a été rafraîchi"} (date, lieu).`;
  } else {
    message =
      "Aucun nouveau talk repéré pour l'instant. Vérifie ton lien Sessionize ou LinkedIn dans ton profil, et que tes conférences sont bien référencées.";
  }
  return { ok: true, suggestions: result.suggestions, majs: result.majs, message };
}

/**
 * LE geste Bravo (lot N4) — pattern résultat (`useActionState`), jamais de
 * PRG sur une micro-action de liste (principes §4). Sécurité : identité de
 * session, entrées bornées par la garde de type PARTAGÉE (`estTypeCible` —
 * la liste fermée vit dans la lib), et la borne réelle (cible visible,
 * jamais la sienne) vit en SQL dans `poserReaction`. La réponse d'un refus est
 * UNIFORME (cible invisible, inexistante ou sienne : même message) — zéro
 * oracle. Et l'action ne LAISSE JAMAIS remonter une erreur base : un échec
 * (table absente en preview, connexion) devient l'état d'erreur — le bouton
 * revient en arrière et l'alerte le dit, jamais une page remplacée.
 */

/** Un refus, quel qu'il soit, se dit d'une seule voix (zéro oracle). */
const REACTION_REFUS =
  "Ce bravo a été refusé\u00a0: le fil a bougé. Recharge la page pour le voir à jour.";

export async function reactionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const uid = await requireUserId();

  const type = String(formData.get("type") ?? "");
  const id = Number(formData.get("id"));
  const intention = String(formData.get("intention") ?? "");
  if (
    !estTypeCible(type) ||
    !Number.isInteger(id) ||
    id <= 0 ||
    (intention !== "applaudir" && intention !== "retirer")
  ) {
    return { status: "error", error: REACTION_REFUS, values: {} };
  }
  const cible = { type, id };

  try {
    if (intention === "applaudir") {
      if (isRateLimited(`bravo:${uid}`, 30, 60_000)) {
        return {
          status: "error",
          error: "Beaucoup d'enthousiasme d'un coup 👏\u00a0: réessaie dans une minute.",
          values: {},
        };
      }
      const atteint = await poserReaction(uid, cible);
      if (!atteint) return { status: "error", error: REACTION_REFUS, values: {} };
      return { status: "success" };
    }

    // Le RETRAIT reste toujours possible pour une humaine (RGPD) : la borne
    // est LARGE (60/min) — elle arrête un script, jamais une main.
    if (isRateLimited(`bravo-retrait:${uid}`, 60, 60_000)) {
      return {
        status: "error",
        error: "Une minute de pause, puis ton retrait passera.",
        values: {},
      };
    }
    await retirerReaction(uid, cible);
    return { status: "success" };
  } catch (e) {
    // Base indisponible ou table encore absente (preview sans la migration
    // 063) : l'échec SE DIT — le composant revient en arrière avec l'alerte,
    // la page reste le fil du lot N2. Message PROPRE à la panne : la réponse
    // uniforme ne vaut que pour les refus de cible (l'oracle), et « le fil a
    // bougé » serait un faux diagnostic ici.
    console.error("Bravo indisponible", e);
    return {
      status: "error",
      error: "Ton bravo attendra un instant\u00a0: réessaie dans une minute.",
      values: {},
    };
  }
}

/**
 * Résultat de la reprise de photo LinkedIn, tel que l'écran le consomme.
 * `reconnexion` est un cas À PART, et pas un message d'erreur de plus : c'est
 * le seul où l'on doit renvoyer la personne chez LinkedIn, ce qui la fait
 * quitter la page — l'écran l'annonce avant, jamais après.
 */
export type ResultatPhoto =
  | { statut: "ok"; url: string }
  | { statut: "reconnexion" }
  | { statut: "erreur"; message: string };

/**
 * Reprendre sa photo LinkedIn comme photo de profil, SANS quitter le site : on
 * redemande le profil à LinkedIn avec le jeton déjà conservé au rattachement,
 * et on copie la photo chez nous (`src/lib/linkedin-photo.ts`).
 *
 * Server Action appelée à la main depuis le champ Photo (jamais en `action=` :
 * ce champ vit DANS le formulaire de la section, et un formulaire imbriqué est
 * interdit en HTML). L'identité vient de la session, comme partout.
 */
export async function reprendrePhotoLinkedInAction(): Promise<ResultatPhoto> {
  const uid = await requireUserId();

  // Même garde que la liaison depuis « Mes connexions » : on ne s'adresse
  // qu'à un provider réellement configuré côté serveur. `linkedinLie` vient
  // des lignes `accounts` — elles survivent au retrait des identifiants en
  // env, le bouton s'afficherait donc pour un provider hors service.
  if (!isLinkedInEnabled()) {
    return {
      statut: "erreur",
      message: "La reprise depuis LinkedIn est indisponible pour le moment.",
    };
  }

  // Même borne que l'envoi de fichier (`/api/mon-espace/avatar`) : chaque
  // reprise appelle LinkedIn ET dépose un blob, les deux coûtent.
  if (isRateLimited(`avatar-linkedin:${uid}`, CADENCE_AVATAR.envois, CADENCE_AVATAR.fenetreMs)) {
    return {
      statut: "erreur",
      message: "Trop de photos reprises récemment. Réessaie dans quelques minutes.",
    };
  }

  const photo = await reprendrePhotoLinkedIn(uid);
  if (!photo.ok) {
    return photo.raison === "reconnexion"
      ? { statut: "reconnexion" }
      : { statut: "erreur", message: photo.message };
  }

  await appliquerNouvelAvatar(uid, photo.url);
  // La photo s'affiche sur la carte de l'annuaire et la fiche publique.
  revalidatePublicProfile();
  revalidateEspacePerso();
  return { statut: "ok", url: photo.url };
}

/**
 * Rendez-vous chez LinkedIn pour REDONNER un jeton d'accès, quand celui qu'on
 * garde a expiré ou été révoqué (~60 jours sans connexion LinkedIn, et
 * l'application n'a pas de jeton de rafraîchissement). C'est le seul chemin de
 * la photo qui fait quitter le site : il se déclenche donc à la main, après
 * l'avoir annoncé à l'écran.
 *
 * `retour` vient du navigateur : il est BORNÉ à l'espace perso, sinon la
 * redirection de fin de connexion enverrait où l'on veut (redirection ouverte).
 */
export async function reconnecterLinkedInAction(retour: string): Promise<void> {
  await requireUserId();
  const destination = retour.startsWith("/mon-espace/") ? retour : "/mon-espace/profil";
  // Un provider absent de la configuration mènerait à l'écran « Configuration »
  // d'Auth.js : on ramène plutôt là d'où l'on vient.
  if (!isLinkedInEnabled()) redirect(destination);
  // On se reconnecte à un provider DÉJÀ rattaché : la détection de doublon
  // n'aurait que ce compte-ci à trouver.
  await connexionOAuthSansDoublon("linkedin", destination);
}
