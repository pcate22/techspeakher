"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { saveProfile, type SaveState } from "./actions";
import type { SpeakerProfile } from "@/lib/profiles";
import Button from "@/components/Button";
import { useGardeSortie, DialogueSortie } from "./GardeSortie";
import { useChampDegage, useBarreCollante } from "@/components/barre-action";
import StepIndicator from "@/components/StepIndicator";
import {
  ChampsIdentite,
  ChampsSecteurs,
  ChampsSujets,
  ChampsInterventions,
  ChampsContact,
  ChampsAttestation,
} from "./ChampsSection";
import { ETAPES } from "./profil-etapes";
import { CHAMPS_PROFIL, libelleChamp, messageRefus } from "./champs-profil";

const STEPS = [...ETAPES];

export default function ProfileForm({
  initial,
  nom = "",
  avatarCompte = null,
  linkedinLie = false,
  initialStep = 0,
}: {
  initial: SpeakerProfile | null;
  /** Nom du COMPTE (users.name) : éditable ici, indispensable à la cohorte
   * lien-magique qui n'en a pas. */
  nom?: string;
  /** Photo du COMPTE (`users.image`, ex. avatar OAuth) : seedée dans le champ
   * Photo à la CRÉATION, quand `initial` (donc `initial.image`) n'existe pas
   * encore. Sans fiche existante, avec fiche c'est `initial.image` qui fait foi. */
  avatarCompte?: string | null;
  /** LinkedIn rattaché au compte : ouvre la reprise de photo dès la création
   * (beaucoup arrivent justement par LinkedIn, avec une photo déjà à jour). */
  linkedinLie?: boolean;
  /** Étape d'ouverture (deep-link depuis l'espace, ex. directement Attestation). */
  initialStep?: number;
}) {
  const [state, action, pending] = useActionState<SaveState, FormData>(
    saveProfile,
    {},
  );
  const last = STEPS.length - 1;
  // Fiche déjà existante : on est en MODIFICATION. On propose alors
  // « Enregistrer » à chaque étape (modifier un seul champ ne doit pas obliger
  // à re-parcourir tout l'assistant). En création, on garde le parcours guidé
  // (enregistrement à la dernière étape seulement).
  const editMode = initial != null;
  // Borne l'étape initiale dans la plage valide.
  const [step, setStep] = useState(Math.min(Math.max(initialStep, 0), last));
  // Refus de saisie côté navigateur, rendu VISIBLE : un champ requis d'une étape
  // masquée bloquait la soumission sans message (le navigateur ne peut pas
  // donner le focus à un champ caché) — le bouton ne produisait rien du tout.
  // UN refus porte UN champ ; projeté dans la même forme que les erreurs serveur
  // (champ → message), le bandeau et chaque champ lisent un seul canal — donc un
  // message ne peut pas s'afficher sous un autre champ que le sien.
  const [refus, setRefus] = useState<{ champ: string; message: string } | null>(null);
  const erreurs = state.errors ?? (refus ? { [refus.champ]: refus.message } : undefined);

  // La soumission ne se fait qu'à la dernière étape : une erreur serveur sur
  // un champ des étapes précédentes serait invisible (panneau masqué). On
  // RAMÈNE à la première étape fautive — ajustement d'état PENDANT le rendu
  // (pattern React officiel), pas dans un effet (cascade de rendus).
  const [erreursVues, setErreursVues] = useState<typeof state.errors>(undefined);
  if (state.errors && erreursVues !== state.errors) {
    setErreursVues(state.errors);
    const etapes = Object.keys(state.errors).map((c) => CHAMPS_PROFIL[c]?.etape ?? last);
    const cible = Math.min(...etapes);
    if (cible !== step) setStep(cible);
  }

  // Chaque changement d'étape REMONTE en haut du formulaire : sinon on
  // atterrit au milieu de l'étape suivante (la précédente était plus longue).
  // `scroll-padding-top` global tient compte du header collant ; l'annonce
  // « Étape X sur Y » (role=status) couvre les lecteurs d'écran.
  const formRef = useRef<HTMLFormElement>(null);
  const stepAffiche = useRef(step);
  // Champ à mettre au point une fois son étape démasquée : une REF, pas un
  // état — un champ caché ne prend pas le focus, il faut donc attendre le
  // rendu de la nouvelle étape, et le faire dans l'effet qui la suit déjà.
  const champAFocaliser = useRef<string | null>(null);
  useEffect(() => {
    if (stepAffiche.current === step) return;
    stepAffiche.current = step;
    formRef.current?.scrollIntoView?.({ block: "start" });
    const attendu = champAFocaliser.current;
    champAFocaliser.current = null;
    if (!attendu) return;
    const champ = formRef.current?.elements.namedItem(attendu);
    if (champ instanceof HTMLElement) champ.focus();
  }, [step]);

  /**
   * Enregistrement explicite. On CHERCHE d'abord un champ refusé par le
   * navigateur : s'il vit dans une étape masquée, `requestSubmit` échouerait en
   * silence. On démasque son étape, on l'annonce, et on l'amène au focus.
   */
  function enregistrer() {
    const form = formRef.current;
    if (!form) return;
    // `:invalid` sur les CONTRÔLES : un `querySelector(":invalid")` nu matcherait
    // aussi les <fieldset> qui en contiennent un. Couvre <select> et cases à
    // cocher, qu'un filtre input/textarea laissait passer — ils rejoueraient
    // l'échec silencieux qu'on corrige ici.
    const invalide = form.querySelector<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >("input:invalid, textarea:invalid, select:invalid");
    if (!invalide) {
      setRefus(null);
      form.requestSubmit();
      return;
    }
    // Message MAISON plutôt que `validationMessage` : celui du navigateur est
    // localisé par lui, ne nomme pas le champ, et diffère d'un moteur à l'autre.
    // Ici on nomme le champ ET le motif réel (§5).
    setRefus({ champ: invalide.name, message: messageRefus(invalide) });
    // Étape du registre, comme le chemin serveur : deux mécanismes pour la même
    // question divergeaient. Repli sur l'étape courante — un champ inconnu du
    // registre ne doit pas téléporter ailleurs (un test l'interdit de toute façon).
    const etape = CHAMPS_PROFIL[invalide.name]?.etape ?? step;
    if (etape === step) {
      invalide.focus(); // déjà visible : rien à démasquer
    } else {
      champAFocaliser.current = invalide.name;
      setStep(etape);
    }
  }

  // Rien n'est enregistré avant le bouton final : protéger la fermeture et
  // le rechargement de l'onglet quand une saisie est en cours…
  const [modifie, setModifie] = useState(false);
  useEffect(() => {
    if (!modifie) return;
    const garde = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", garde);
    return () => window.removeEventListener("beforeunload", garde);
  }, [modifie]);

  // …ET la navigation INTERNE (fil d'Ariane, barre d'onglets, menu) : App
  // Router n'offre pas de blocage de route, la garde partagée intercepte donc
  // les clics de liens même-origine avant qu'ils n'emportent la saisie.
  const { sortieVoulue, setSortieVoulue, rendreLeFocus } = useGardeSortie(modifie);

  // La barre ne doit jamais masquer le champ qu'on vient d'atteindre, et elle ne
  // colle que si l'étape dépasse l'écran.
  useChampDegage(formRef);
  const collante = useBarreCollante(formRef);



  return (
    <form
      ref={formRef}
      action={action}
      // Garde-fou (création seulement) : on ne soumet qu'à la dernière étape —
      // évite qu'un Entrée/Go au clavier valide avant l'attestation. En
      // modification, l'enregistrement est permis depuis n'importe quelle étape.
      onSubmit={(e) => {
        if (!editMode && step !== last) e.preventDefault();
        else setModifie(false); // la soumission part : plus de garde
      }}
      onChange={(e) => {
        setModifie(true);
        // Seul le champ corrigé perd son message : cocher une case à une autre
        // étape effaçait le diagnostic alors que le blocage tenait toujours.
        const champ = e.target instanceof HTMLElement ? e.target.getAttribute("name") : null;
        setRefus((r) => (r && r.champ === champ ? null : r));
      }}
      className="flex flex-col gap-5"
    >
      <StepIndicator current={step} steps={STEPS} />
      {/* En MODIFICATION, aucun paragraphe méta : le bouton « Enregistrer » reste
          visible en permanence dans la barre d'actions et se suffit à lui-même.
          En CRÉATION, l'assistant guide jusqu'au bout : une phrase dit où se
          trouve l'enregistrement (forme positive, §5). */}
      {!editMode && (
        <p className="text-xs text-gray-light -mt-3">
          Tu enregistres tout d&apos;un coup à la dernière étape.
        </p>
      )}

      {erreurs && (
        <p
          role="alert"
          className="text-sm text-orange bg-orange/10 border border-orange/30 rounded-lg p-3"
        >
          Certains champs sont à corriger&nbsp;:{" "}
          {Object.keys(erreurs)
            .map((c) => libelleChamp(c))
            .join(", ")}
          . Te voilà sur la première étape concernée.
        </p>
      )}

      {/* Étape 1 — Profil. Les champs des autres étapes restent dans le DOM
      {/* Les CHAMPS de chaque section viennent de `ChampsSection` — même
          source que les pages « une section à la fois ». Les panneaux des
          autres étapes restent dans le DOM (masqués) pour être soumis en une
          fois. */}
      <div hidden={step !== 0} className="flex flex-col gap-4">
        <ChampsIdentite
          initial={initial}
          nom={nom}
          avatarCompte={avatarCompte}
          linkedinLie={linkedinLie}
          erreurs={erreurs}
        />
      </div>

      {/* Une liste par étape : empilées, les deux taxonomies (15 + 11 cases,
          une par ligne sur mobile) faisaient ~1400 px et la seconde légende
          tombait sous la flottaison. */}
      <div hidden={step !== 1} className="flex flex-col gap-4">
        <ChampsSecteurs initial={initial} />
      </div>

      <div hidden={step !== 2} className="flex flex-col gap-4">
        <ChampsSujets initial={initial} />
      </div>

      <div hidden={step !== 3} className="flex flex-col gap-4">
        <ChampsInterventions initial={initial} />
      </div>

      <div hidden={step !== 4} className="flex flex-col gap-4">
        <ChampsContact initial={initial} erreurs={erreurs} />
      </div>

      <div hidden={step !== 5} className="flex flex-col gap-4">
        <ChampsAttestation initial={initial} />
      </div>


      {/* Navigation de l'assistant, ANCRÉE en bas de l'écran quand l'étape
          dépasse l'écran : Précédent / Suivant restent alors visibles sans la
          dérouler jusqu'au bout ; sur une étape courte, la barre se pose en fin
          de formulaire (une barre qui flotte n'y rapproche rien).

          SANS contour, comme les pages de section : bordée, arrondie et ombrée,
          elle se lisait comme une carte de plus dans une page qui n'en porte
          pas. Le fond OPAQUE suffit à la séparer du formulaire qui défile
          derrière, et le `px-4` de la carte part avec elle — les boutons
          s'alignent sur les champs.
          Sur MOBILE : compteur d'étape en tête, « ← Précédent / Suivant » sur
          une même ligne (paire écartée), puis « Enregistrer » pleine largeur
          (CTA principal net). Dès `sm` tout revient sur une seule ligne,
          compteur poussé à droite. */}
      <div
        className={`${collante ? "barre-action-collante " : ""}flex flex-col gap-2 bg-navy py-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3`}
      >
        {/* AUCUN bouton type="submit" dans la barre : « Suivant » et
            « Enregistrer » sont des type="button". Sinon, en passant de l'un à
            l'autre (dernière étape), le clic de « Suivant » retombait sur le
            bouton submit fraîchement monté et enregistrait la fiche toute seule.
            L'enregistrement est déclenché explicitement (requestSubmit), ce qui
            neutralise aussi une soumission accidentelle à la touche Entrée. */}
        {/* Précédent / Suivant : une paire horizontale, écartés sur mobile
            (justify-between), regroupés à gauche dès sm. */}
        <div className="flex items-center justify-between gap-3 sm:justify-start">
          {step > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setStep((s) => s - 1)}>
              ← Précédent
            </Button>
          )}
          {step < last && (
            <Button
              type="button"
              size="sm"
              variant={editMode ? "secondary" : "primary"}
              onClick={() => setStep((s) => s + 1)}
            >
              Suivant
            </Button>
          )}
        </div>
        {/* Après un refus, le CTA RESTE affiché hors dernière étape : sinon
            l'action disparaissait à l'instant où le message s'affichait, et il
            fallait recliquer «\u00a0Suivant\u00a0» cinq fois pour la retrouver. */}
        {(editMode || step === last || erreurs) && (
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={enregistrer}
            className="w-full sm:w-auto"
          >
            {pending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        )}
        {/* Confirmation À CÔTÉ du CTA : affichée en haut du formulaire, elle
            tombait hors écran (on venait de cliquer dans la barre du bas —
            registre « CTA sous la flottaison + feedback sur place »). Statut en
            toutes lettres, sans ✓ maigre (invisible au soleil, §9). */}
        {state.ok && (
          <p role="status" className="text-sm font-semibold text-cyan">
            Profil enregistré
          </p>
        )}
        {/* `role="status"` : le changement d'étape échange un panneau entier sans
            déplacer le focus — sans région live, il est MUET (WCAG 4.1.3). */}
        <span
          role="status"
          className="order-first text-xs text-gray-light sm:order-none sm:ml-auto"
        >
          Étape {step + 1} sur {STEPS.length} : {STEPS[step]}
        </span>
      </div>
      <DialogueSortie
        rendreLeFocus={rendreLeFocus}
        sortieVoulue={sortieVoulue}
        setSortieVoulue={setSortieVoulue}
        onQuitter={() => setModifie(false)}
      />
    </form>
  );
}
