"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import {
  addOccurrenceAction,
  updateOccurrenceAction,
  type SaisieOccurrenceState,
} from "./actions";
import type { TalkOccurrence, OccurrenceSuggestions } from "@/lib/talks";
import { dateLegueeParEdition, parseTalkDateParts } from "@/lib/talk-date";
import Button from "@/components/Button";
import TalkDateFields from "@/components/TalkDateFields";
// Classes partagées : le contour `field-border` (>= 3:1) y est tenu en un seul
// endroit — `border-navy-lighter` sur `bg-navy` plafonnait à 1,26:1 (§9).
import ChampTexte, { inputClass, labelClass } from "@/components/ChampTexte";
import ConferenceCombobox, { HORS_REGISTRE } from "@/components/ConferenceCombobox";
import VilleField from "./VilleField";

const FIELD_LABELS: Record<string, string> = {
  conference: "Conférence",
  conferenceProposee: "Nom de la conférence",
  ville: "Ville",
  pays: "Pays",
  date: "Date",
  lienConf: "Lien page de la conf",
  lienSlides: "Lien slides",
  lienVideo: "Lien vidéo",
  lienFeedback: "Lien feedback",
};

type SaveAction = (state: SaisieOccurrenceState, formData: FormData) => Promise<SaisieOccurrenceState>;

/**
 * Rattache (ou modifie) une conférence à un talk. La conférence est CHOISIE dans
 * le registre (`conferences` → `conference_editions`) quand elle y figure.
 * Cf. docs/conception-talk-multi-conferences.md § 2.1 bis.
 *
 * Une conférence ABSENTE du registre n'arrête plus la saisie (migration 068) :
 * la dernière option du sélecteur ouvre un champ « nom de la conférence », et
 * l'enregistrement part en proposition aux orga AVEC la saisie (date, lieu,
 * liens). La saisie attend l'arbitrage au lieu d'être perdue, et passe en ligne
 * telle quelle à la validation. Avant, le renvoi vers un autre écran obligeait à
 * tout retaper — et ne menait même pas au bon endroit.
 *
 * Variante `rapide` (fenêtre « Une date » de la fiche, 2026-10-15) : le même
 * formulaire réduit à conférence, édition, ville et date — le pays et le lien
 * pré-remplis par la conférence partent quand même, en champs cachés ; slides,
 * vidéo et feedback se complètent après, sur la page du talk. L'action passée
 * par la fenêtre répond au lieu de rediriger, et `onEnregistre` reçoit la
 * réponse APRÈS la transition (dans un effet, patron d'`InlineActionForm`).
 */
export default function OccurrenceForm({
  talkId,
  initial,
  suggestions,
  aideSlidesHref,
  addAction = addOccurrenceAction,
  updateAction = updateOccurrenceAction,
  rapide = false,
  onEnregistre,
}: {
  talkId: number;
  initial?: TalkOccurrence;
  suggestions: OccurrenceSuggestions;
  /** Lien vers l'article « où héberger tes slides » (présent seulement s'il est
   *  publié). Rend un renvoi discret sous le champ « Lien slides ». */
  aideSlidesHref?: string | null;
  addAction?: SaveAction;
  updateAction?: SaveAction;
  /** Variante réduite de la fenêtre « Une date » (ajout seulement). */
  rapide?: boolean;
  /** Appelé quand l'action RÉPOND un succès (variante rapide : pas de
   * redirection, c'est l'appelante qui ferme, confirme et rafraîchit). */
  onEnregistre?: (etat: SaisieOccurrenceState) => void;
}) {
  const editing = Boolean(initial);
  const [state, action, pending] = useActionState<SaisieOccurrenceState, FormData>(
    editing ? updateAction : addAction,
    {},
  );
  // Après la transition, pas pendant (patron d'`InlineActionForm`) : la
  // fenêtre « Une date » ferme et confirme ici. Fermée pendant l'action, elle
  // démontait le formulaire en vol et la liste revalidée se perdait.
  useEffect(() => {
    if (state.ok) onEnregistre?.(state);
    // `state` change d'identité à chaque réponse : une réponse, un appel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const dateParts = parseTalkDateParts(initial?.date ?? null);
  const currentYear = new Date().getFullYear();

  /**
   * UN état pour UN choix : la valeur brute du combobox. `conferenceId` et
   * « hors registre » en sont dérivés. Trois états tenus à la main (le choix,
   * l'id, le drapeau) se désynchronisaient au premier endroit qui oublierait
   * d'en poser un — et il y avait déjà deux façons de les initialiser.
   *
   * Une saisie déjà en attente (ou écartée) rouvre sur SON nom : sinon l'écran
   * repartirait de « choisis une conférence » et perdrait ce qu'elle a proposé.
   */
  const enProposition = initial != null && initial.etat !== "publiee";
  const [choixConf, setChoixConf] = useState(
    enProposition ? HORS_REGISTRE : String(initial?.conferenceId ?? ""),
  );
  const horsRegistre = choixConf === HORS_REGISTRE;
  const conferenceId =
    horsRegistre || choixConf === "" ? null : Number(choixConf);

  const [editionId, setEditionId] = useState<number | null>(initial?.editionId ?? null);
  const [conferenceProposee, setConferenceProposee] = useState(
    enProposition ? (initial?.conference ?? "") : "",
  );
  const [ville, setVille] = useState(initial?.ville ?? "");
  const [pays, setPays] = useState(initial?.pays ?? "France");
  const [lienConf, setLienConf] = useState(initial?.lienConf ?? "");

  const confChoisie = suggestions.registre.find((c) => c.id === conferenceId) ?? null;
  const editions = confChoisie?.editions ?? [];
  // Libellé figé soumis (SNAPSHOT) : l'édition prime, sinon le nom de la conf ;
  // hors registre, le nom saisi (le serveur le revalide et le réécrit).
  const libelle = horsRegistre
    ? conferenceProposee
    : (editions.find((e) => e.editionId === editionId)?.libelle ??
      confChoisie?.nom ??
      "");
  const errorEntries = Object.entries(state.errors ?? {});
  // Mention texte HISTORIQUE (avant le registre) : ni conférence choisie, ni
  // proposition en cours. `etat` porte déjà la seconde moitié de la question.
  const legacyLibre = Boolean(
    initial?.conference && initial.conferenceId == null && initial.etat === "publiee",
  );

  // L'édition choisie LÈGUE-t-elle une date ? Même règle que le serveur
  // (`dateLegueeParEdition`) : une édition sans date de début, ou à cheval sur
  // deux ans, ne lègue rien — l'année reste alors exigée, et le texte d'aide
  // ne promet rien (revue justesse rejouée du 2026-10-15).
  const editionChoisie = editions.find((e) => e.editionId === editionId) ?? null;
  const dateLeguee =
    editionChoisie != null &&
    dateLegueeParEdition(editionChoisie.dateDebut, editionChoisie.dateFin, null) != null;

  function onConferenceChange(value: string, saisie: string) {
    setChoixConf(value);
    setEditionId(null);
    // « Ma conférence manque » : le texte déjà tapé dans la recherche devient
    // le nom proposé (sans écraser un nom déjà saisi) — zéro re-frappe.
    if (value === HORS_REGISTRE && conferenceProposee === "" && saisie.trim()) {
      setConferenceProposee(saisie.trim());
    }
    const id = value === "" || value === HORS_REGISTRE ? null : Number(value);
    const conf = suggestions.registre.find((c) => c.id === id);
    if (conf) {
      if (ville === "" && conf.ville) setVille(conf.ville);
      // Le pays n'est REMPLACÉ que s'il est resté au défaut : ce qu'elle a tapé
      // gagne toujours. Une conférence itinérante (KubeCon, sans pays au
      // répertoire) VIDE le champ au lieu de laisser « France » — c'est
      // précisément le pays faux que le `pays: null` du catalogue veut éviter.
      if (pays === "" || pays === "France") setPays(conf.pays ?? "");
    }
  }

  function onEditionChange(value: string) {
    const id = value === "" ? null : Number(value);
    setEditionId(id);
    const ed = editions.find((e) => e.editionId === id);
    if (ed) {
      if (ville === "" && ed.ville) setVille(ed.ville);
      if ((pays === "" || pays === "France") && ed.pays) setPays(ed.pays);
      if (lienConf === "" && ed.url) setLienConf(ed.url);
    }
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="talkId" value={talkId} />
      {editing && <input type="hidden" name="occurrenceId" value={initial!.id} />}
      {/* Liens au registre : revalidés côté serveur (l'édition déduit sa conf). */}
      <input type="hidden" name="conferenceId" value={conferenceId ?? ""} />
      <input type="hidden" name="editionId" value={editionId ?? ""} />
      <input type="hidden" name="conference" value={libelle} />

      {errorEntries.length > 0 && (
        <div
          role="alert"
          className="text-sm text-orange bg-orange/10 border border-orange/30 rounded-lg px-4 py-3"
        >
          <p className="font-medium">Corrige ce qui suit&nbsp;:</p>
          <ul className="list-disc pl-5 mt-1">
            {errorEntries.map(([champ, message]) => (
              <li key={champ}>
                {FIELD_LABELS[champ] ? `${FIELD_LABELS[champ]} : ${message}` : message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {legacyLibre && (
        <p className="text-xs text-cyan">
          Conférence actuelle&nbsp;: «&nbsp;{initial!.conference}&nbsp;». Choisis-la
          dans la liste pour la rattacher au registre.
        </p>
      )}

      {initial?.etat === "ecartee" && (
        <p role="status" className="text-xs text-orange">
          L&apos;équipe a écarté cette conférence du répertoire. Choisis-en une
          dans la liste, ou renomme la tienne et renvoie-la.
        </p>
      )}

      {/* On TAPE (nom, ville ou pays) au lieu de dérouler 126 options. La
          dernière option — « ma conférence manque » — reste une option SUR
          PLACE, jamais un renvoi vers un autre écran : la saisie en cours
          reste à l'écran et part avec la proposition. */}
      <ConferenceCombobox
        id="conf-select"
        label="Conférence"
        required
        registre={suggestions.registre}
        valeur={choixConf}
        onChange={onConferenceChange}
        error={state.errors?.conference}
      />

      {horsRegistre && (
        <div className="rounded-xl border border-field-border bg-navy/40 p-4 flex flex-col gap-3">
          <ChampTexte
            id="conferenceProposee"
            name="conferenceProposee"
            label="Nom de la conférence"
            required
            value={conferenceProposee}
            onChange={setConferenceProposee}
            error={state.errors?.conferenceProposee}
          />
          <p className="text-xs text-gray-light">
            L&apos;équipe Tech Speak&apos;Her valide les conférences avant qu&apos;elles
            rejoignent le répertoire. Enregistre quand même&nbsp;: ta saisie est
            gardée telle quelle et rejoint ta fiche publique dès la validation.
          </p>
        </div>
      )}

      {confChoisie && editions.length > 0 && (
        <div>
          <label htmlFor="edition-select" className={labelClass}>
            Édition
          </label>
          <select
            id="edition-select"
            value={editionId ?? ""}
            onChange={(e) => onEditionChange(e.target.value)}
            className={inputClass}
          >
            <option value="">Année non listée</option>
            {editions.map((e) => (
              <option key={e.editionId} value={e.editionId}>
                {e.libelle}
              </option>
            ))}
          </select>
          {/* Ce que l'écran fait VRAIMENT : la ville et le lien se remplissent
              à l'écran, la date est reprise par le serveur si elle reste vide
              (les listes de date ne bougent pas). */}
          <p className="text-xs text-cyan mt-1">
            {rapide ? "Choisir une édition remplit la ville" : "Choisir une édition remplit le lieu et le lien"}
            {dateLeguee ? ", et sa date est reprise si tu laisses la date vide." : "."}
          </p>
        </div>
      )}

      {/* Lieu : contrôlé (le choix d'une conf / édition le pré-remplit s'il est
          vide) et branché sur la Base Adresse Nationale, comme la commune d'une
          fiche. C'est la saisie qui capture le code INSEE et la région — sans
          quoi la géographie n'existerait que sur le passé rattrapé, et les
          facettes de l'agenda vieilliraient à l'envers. */}
      <VilleField
        champs={{ ville: "ville", codeInsee: "codeInsee", region: "region" }}
        label="Ville"
        value={ville}
        onChange={setVille}
        defaultVille={initial?.ville}
        defaultCodeInsee={initial?.codeInsee}
        defaultRegion={initial?.region}
        villesConnues={suggestions.villes}
        error={state.errors?.ville}
      />

      {/* Variante rapide : le pays vient de la conférence choisie. Hors
          registre, aucune conférence ne le fournit — le champ s'affiche, sinon
          « France » partirait en silence (revue justesse du 2026-10-15). */}
      {rapide && !horsRegistre ? (
        <input type="hidden" name="pays" value={pays} />
      ) : (
        <ChampTexte
          id="pays"
          name="pays"
          label="Pays"
          value={pays}
          onChange={setPays}
          suggestions={suggestions.pays}
          error={state.errors?.pays}
        />
      )}

      <TalkDateFields
        initial={dateParts}
        error={state.errors?.date}
        currentYear={currentYear}
        repriseDeLEdition={dateLeguee}
      />

      {rapide ? (
        <>
          <input type="hidden" name="lienConf" value={lienConf} />
          <p className="text-xs text-gray-light">
            Slides, vidéo et feedback&nbsp;: tu les ajoutes ensuite depuis la page du talk.
          </p>
        </>
      ) : (
        <>
          {/* Le lien de la conf est CONTRÔLÉ : choisir une édition le pré-remplit
              s'il est vide. Les trois autres sont libres. */}
          <ChampLien
            id="lienConf"
            label="Lien page de la conf"
            value={lienConf}
            onChange={setLienConf}
            error={state.errors?.lienConf}
          />
          <div>
            <ChampLien
              id="lienSlides"
              label="Lien slides"
              defaultValue={initial?.lienSlides}
              error={state.errors?.lienSlides}
            />
            {aideSlidesHref && (
              <p className="text-xs text-gray-light mt-1">
                Où héberger tes slides&nbsp;?{" "}
                <Link href={aideSlidesHref} className="text-cyan underline">
                  Notre guide
                </Link>
                .
              </p>
            )}
          </div>
          <ChampLien
            id="lienVideo"
            label="Lien vidéo"
            defaultValue={initial?.lienVideo}
            error={state.errors?.lienVideo}
          />
          <ChampLien
            id="lienFeedback"
            label="Lien feedback"
            defaultValue={initial?.lienFeedback}
            error={state.errors?.lienFeedback}
          />
        </>
      )}

      {/* Taille `md` : 48 px de haut, au-dessus des 44 px COGA. */}
      <Button type="submit" disabled={pending} className="self-start">
        {pending
          ? "Enregistrement…"
          : editing
            ? "Enregistrer les modifications"
            : rapide
              ? "Ajouter la date"
              : "Ajouter la conférence"}
      </Button>
    </form>
  );
}

/**
 * Champ d'URL : `ChampTexte` avec le clavier et le gabarit d'une adresse, et le
 * nom soumis aligné sur l'id. Aucune logique propre — le câblage
 * label / aria / erreur reste dans la primitive, pas recopié ici.
 */
function ChampLien({
  id,
  label,
  defaultValue,
  error,
  value,
  onChange,
}: {
  id: string;
  label: string;
  defaultValue?: string | null;
  error?: string;
  value?: string;
  onChange?: (v: string) => void;
}) {
  return (
    <ChampTexte
      id={id}
      name={id}
      label={label}
      inputMode="url"
      placeholder="https://…"
      defaultValue={defaultValue}
      value={value}
      onChange={onChange}
      error={error}
    />
  );
}
