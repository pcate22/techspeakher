"use client";

import { useActionState, useState } from "react";
import { addTalkAction, updateTalkAction, type SaveState } from "./actions";
import type { Talk } from "@/lib/talks";
import { TALK_TYPES, TALK_PROPOSAL } from "@/data/domaines";
import { TITRE_MAX, DESCRIPTION_MAX } from "@/lib/talk-limits";
import Button from "@/components/Button";
import ChampTexte, {
  inputClass,
  labelClass,
  errorClass,
} from "@/components/ChampTexte";

/** Libellés lisibles pour le résumé d'erreurs (clé serveur → intitulé). */
const FIELD_LABELS: Record<string, string> = {
  titre: "Titre",
  type: "Type",
  description: "Description",
};

type SaveAction = (state: SaveState, formData: FormData) => Promise<SaveState>;

/**
 * Formulaire d'IDENTITÉ d'un talk (titre, type, résumé). Les conférences où il a
 * été donné (occurrences) se gèrent sur la page du talk, une fois créé — cf.
 * docs/conception-talk-multi-conferences.md. On crée minimal, on complète après.
 */
export default function TalkForm({
  initial,
  addAction = addTalkAction,
  updateAction = updateTalkAction,
  hidden,
}: {
  initial?: Talk;
  /** Action d'ajout (défaut : la speakeuse sur son espace). L'orga passe la
   * sienne pour rattacher le talk depuis la fiche participante. */
  addAction?: SaveAction;
  /** Action de mise à jour (défaut : la speakeuse). */
  updateAction?: SaveAction;
  /** Champs cachés de contexte à joindre (ex. inscription côté orga). */
  hidden?: Record<string, string | number>;
}) {
  const editing = Boolean(initial);
  const [state, action, pending] = useActionState<SaveState, FormData>(
    editing ? updateAction : addAction,
    {},
  );
  const [type, setType] = useState(initial?.type ?? "Conférence");
  // Description contrôlée : le compteur doit suivre la frappe, et la saisie
  // survit ainsi à un aller-retour d'erreur serveur (§6).
  const [description, setDescription] = useState(initial?.description ?? "");
  const isProposal = type === TALK_PROPOSAL;
  const errorEntries = Object.entries(state.errors ?? {});

  return (
    <form action={action} className="flex flex-col gap-4">
      {hidden &&
        Object.entries(hidden).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
      {editing && <input type="hidden" name="talkId" value={initial!.id} />}

      {/* Résumé d'erreurs : filet de sécurité pour qu'AUCUNE soumission ne
          puisse échouer en silence. Même une erreur sans message dédié est
          visible ici. */}
      {errorEntries.length > 0 && (
        <div
          role="alert"
          className="text-sm text-orange bg-orange/10 border border-orange/30 rounded-lg px-4 py-3"
        >
          {/* Forme positive (§5) : on dit ce qu'il reste à faire, pas ce qui a
              échoué. */}
          <p className="font-medium">
            Corrige ce qui suit pour enregistrer ton talk&nbsp;:
          </p>
          <ul className="list-disc pl-5 mt-1">
            {errorEntries.map(([champ, message]) => (
              <li key={champ}>
                {FIELD_LABELS[champ] ? `${FIELD_LABELS[champ]} : ${message}` : message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Champ dimensionné sur son contenu (`multiligne`) : un titre de talk
          dépasse largement la largeur d'un champ sur téléphone, et il se lisait
          par bouts en défilant. Même geste que la bio de la fiche speakeuse.
          La valeur reste une ligne (« Entrée » soumet, le serveur aplatit un
          collage multi-lignes). */}
      <ChampTexte
        id="titre"
        name="titre"
        label="Titre du talk"
        required
        multiligne
        maxLength={TITRE_MAX}
        defaultValue={initial?.titre}
        error={state.errors?.titre}
      />

      <div>
        <label htmlFor="talk-type" className={labelClass}>
          Type
        </label>
        <select
          id="talk-type"
          name="type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          className={inputClass}
        >
          {TALK_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        {isProposal && (
          <p className="text-xs text-cyan mt-1.5">
            Un sujet que tu aimerais présenter, encore à donner. Décris-le
            ci-dessous, la communauté pourra t&apos;aider à te lancer&nbsp;!
          </p>
        )}
      </div>

      <div>
        <label htmlFor="talk-description" className={labelClass}>
          Description
        </label>
        <textarea
          id="talk-description"
          name="description"
          rows={6}
          maxLength={DESCRIPTION_MAX}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          aria-invalid={state.errors?.description ? true : undefined}
          aria-describedby={
            state.errors?.description ? "err-description" : "hint-description"
          }
          className={`${inputClass} leading-relaxed`}
        />
        {/* Compteur vivant plutôt qu'une limite figée : `maxLength` tronque la
            frappe en silence, on montre donc où on en est. Pas de région live
            (ce serait bavard à chaque touche) : l'indice reste lu à la prise de
            focus via aria-describedby. */}
        <p id="hint-description" className="text-xs text-gray-light mt-1">
          {description.length} / {DESCRIPTION_MAX} caractères
        </p>
        {state.errors?.description && (
          <p id="err-description" role="alert" className={errorClass}>
            {state.errors.description}
          </p>
        )}
      </div>

      {/* CTA principal de la page : taille `md` (py-3 → 48 px, au-dessus des
          44 px COGA ; `sm` plafonnait à 36 px) et seul aplat magenta de
          l'écran — les autres actions sont secondaires. */}
      <Button type="submit" disabled={pending} className="self-start">
        {pending
          ? "Enregistrement…"
          : editing
            ? "Enregistrer les modifications"
            : "Créer le talk"}
      </Button>
    </form>
  );
}
