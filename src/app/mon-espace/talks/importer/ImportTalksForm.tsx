"use client";

import { useActionState } from "react";
import {
  previewImportAction,
  confirmImportAction,
  type PreviewState,
  type ConfirmState,
} from "./actions";
import type { PlanTalk, PlanOccurrence } from "@/lib/import-talks";
import Button from "@/components/Button";
import { inputClass, labelClass } from "@/components/ChampTexte";

/**
 * L'écran d'import, en trois temps sur UNE page (un seul rôle : importer) :
 * coller / téléverser → vérifier la sélection → confirmer. La prévisualisation
 * vient du serveur (`previewImportAction`), la confirmation repart du même
 * texte : ce qui est affiché est exactement ce qui sera écrit.
 */

/** Ce que chaque décision du plan veut dire, dit à la lectrice. */
const BADGE_OCCURRENCE: Record<
  PlanOccurrence["action"],
  { classe: string; texte: string }
> = {
  registre: { classe: "bg-cyan/15 text-cyan", texte: "Conférence du répertoire" },
  proposition: {
    classe: "bg-gold/15 text-gold",
    texte: "Sera proposée à l'équipe",
  },
  doublon: { classe: "bg-navy-lighter text-gray-light", texte: "Déjà sur ta fiche" },
  ignoree: { classe: "bg-navy-lighter text-gray-light", texte: "Sans conférence" },
};

const BADGE_TALK: Record<PlanTalk["statut"], string | null> = {
  nouveau: null,
  complement: "Complète un talk existant",
  inchange: "Déjà sur ta fiche",
};

function OccurrenceLigne({ o }: { o: PlanOccurrence }) {
  const badge = BADGE_OCCURRENCE[o.action];
  const detail = [o.libelle ?? o.nomPropose ?? o.conference, o.date, o.ville]
    .filter(Boolean)
    .join(" · ");
  return (
    <li className="flex flex-wrap items-center gap-2 text-sm text-gray-light">
      <span>{detail || "Scène à compléter"}</span>
      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge.classe}`}>
        {badge.texte}
      </span>
    </li>
  );
}

export default function ImportTalksForm() {
  const [preview, previewAction, previewPending] = useActionState<PreviewState, FormData>(
    previewImportAction,
    {},
  );
  const [confirm, confirmAction, confirmPending] = useActionState<ConfirmState, FormData>(
    confirmImportAction,
    {},
  );

  // ── Temps 3 : le récapitulatif de ce qui a été écrit ──
  if (confirm.ok) {
    const r = confirm.resultat;
    const lignes = [
      r.talksCrees > 0 && `${r.talksCrees} talk${r.talksCrees > 1 ? "s" : ""} créé${r.talksCrees > 1 ? "s" : ""}`,
      r.talksCompletes > 0 && `${r.talksCompletes} talk${r.talksCompletes > 1 ? "s" : ""} complété${r.talksCompletes > 1 ? "s" : ""}`,
      r.occurrencesPubliees > 0 && `${r.occurrencesPubliees} conférence${r.occurrencesPubliees > 1 ? "s" : ""} rattachée${r.occurrencesPubliees > 1 ? "s" : ""} au répertoire`,
      r.occurrencesEnAttente > 0 && `${r.occurrencesEnAttente} conférence${r.occurrencesEnAttente > 1 ? "s" : ""} proposée${r.occurrencesEnAttente > 1 ? "s" : ""} à l'équipe (en ligne dès validation)`,
      r.doublons > 0 && `${r.doublons} scène${r.doublons > 1 ? "s" : ""} déjà sur ta fiche, laissée${r.doublons > 1 ? "s" : ""} telle${r.doublons > 1 ? "s" : ""} quelle${r.doublons > 1 ? "s" : ""}`,
      r.occurrencesEcartees > 0 && `${r.occurrencesEcartees} scène${r.occurrencesEcartees > 1 ? "s" : ""} passée${r.occurrencesEcartees > 1 ? "s" : ""} (conférence écartée par l'équipe)`,
      // Dire ce qui MANQUE au fichier : un export Notist de profil ne porte
      // que des titres et des dates. Sans cette ligne, « 73 talks créés »
      // laissait croire que les scènes avaient suivi.
      r.scenesSansConference > 0 &&
        `${r.scenesSansConference} date${r.scenesSansConference > 1 ? "s" : ""} sans nom de conférence dans le fichier : ouvre un talk pour ajouter où tu l'as donné`,
    ].filter(Boolean) as string[];
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="rounded-lg border border-cyan/30 bg-cyan/10 px-4 py-3 text-sm text-cyan">
          Import terminé ✓
        </p>
        <ul className="list-disc pl-5 text-sm text-gray-light">
          {lignes.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        <Button href="/mon-espace/talks" className="self-start">
          Voir mes talks
        </Button>
      </div>
    );
  }

  // ── Temps 2 : le plan, à cocher ──
  if (preview.ok) {
    return (
      <form action={confirmAction} className="flex flex-col gap-4">
        {/* Le texte repart avec la confirmation : le serveur recalcule le plan
            depuis LUI (jamais depuis un plan sérialisé, falsifiable). */}
        <input type="hidden" name="texte" value={preview.texte} />

        <p className="text-sm text-gray-light">
          {preview.plan.length} talk{preview.plan.length > 1 ? "s" : ""} lu
          {preview.plan.length > 1 ? "s" : ""} dans le fichier
          {preview.ignorees > 0 &&
            ` (${preview.ignorees} entrée${preview.ignorees > 1 ? "s" : ""} illisible${preview.ignorees > 1 ? "s" : ""}, sautée${preview.ignorees > 1 ? "s" : ""})`}
          . Décoche ce que tu veux laisser de côté, puis importe.
        </p>

        {confirm.ok === false && (
          <p role="alert" className="text-sm text-orange">
            {confirm.erreur}
          </p>
        )}

        <ul className="flex flex-col gap-3 list-none">
          {preview.plan.map((talk, i) => (
            <li
              key={`${talk.titre}-${i}`}
              className="rounded-xl border border-field-border bg-navy p-4"
            >
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  name={`talk-${i}`}
                  defaultChecked={talk.statut !== "inchange"}
                  className="mt-1 h-5 w-5 accent-magenta"
                />
                <span className="min-w-0">
                  <span className="font-semibold text-white">{talk.titre}</span>
                  {BADGE_TALK[talk.statut] && (
                    <span className="ml-2 rounded-full bg-navy-lighter px-2 py-0.5 text-xs font-semibold text-gray-light">
                      {BADGE_TALK[talk.statut]}
                    </span>
                  )}
                  {/* Un export sans aucune conférence (Notist, profil) donne
                      autant de lignes « Sans conférence » que de dates : 178
                      pour un gros portfolio. On les résume en UNE ligne. */}
                  {talk.occurrences.length > 0 &&
                    (talk.occurrences.every((o) => o.action === "ignoree") ? (
                      <p className="mt-2 text-sm text-gray-light">
                        {talk.occurrences.length} date
                        {talk.occurrences.length > 1 ? "s" : ""} sans nom de
                        conférence&nbsp;: le talk entre seul, à compléter ensuite.
                      </p>
                    ) : (
                      <ul className="mt-2 flex flex-col gap-1 list-none">
                        {talk.occurrences.map((o, j) => (
                          <OccurrenceLigne key={j} o={o} />
                        ))}
                      </ul>
                    ))}
                </span>
              </label>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" disabled={confirmPending}>
            {confirmPending ? "Import en cours…" : "Importer la sélection"}
          </Button>
          {/* <a> volontaire (pas Link) : la cible est la page COURANTE, et une
              navigation douce vers la même URL garde l'état React — le plan
              resterait affiché. Le rechargement complet remet le temps 1. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/mon-espace/talks/importer" className="text-sm text-cyan underline">
            Repartir d&apos;un autre fichier
          </a>
        </div>
      </form>
    );
  }

  // ── Temps 1 : coller ou téléverser ──
  return (
    <form action={previewAction} className="flex flex-col gap-4">
      <div>
        <label htmlFor="import-fichier" className={labelClass}>
          Fichier (JSON ou CSV)
        </label>
        <input
          id="import-fichier"
          name="fichier"
          type="file"
          accept=".json,.csv,.txt,application/json,text/csv"
          className="block w-full text-sm text-gray-light file:mr-3 file:rounded-lg file:border-0 file:bg-navy-lighter file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
        />
      </div>

      <div>
        <label htmlFor="import-texte" className={labelClass}>
          Ou colle son contenu ici
        </label>
        <textarea
          id="import-texte"
          name="texte"
          rows={8}
          placeholder='[{"title": "Mon talk", "event": "Cloud Nord", "date": "2025-10-03"}]'
          className={`${inputClass} font-mono text-xs`}
        />
      </div>

      {preview.ok === false && (
        <p role="alert" className="text-sm text-orange">
          {preview.erreur}
        </p>
      )}

      <Button type="submit" disabled={previewPending} className="self-start">
        {previewPending ? "Analyse…" : "Analyser le fichier"}
      </Button>
    </form>
  );
}
