"use client";

import { useState } from "react";
import type { ConferenceRef } from "@/lib/tremplin-editions";
import { nomEditionPropose } from "@/lib/tremplin-nom";
import { createEditionAction } from "./actions";
import AdminDialog, { inputCls } from "./[edition]/AdminDialog";
import ConferenceFields, { NOUVELLE_CONF } from "./ConferenceFields";
import ConfLienField from "./ConfLienField";
import DuplicationRecap from "./DuplicationRecap";
import EditionChampsCommuns from "./EditionChampsCommuns";
import NomEditionField from "./NomEditionField";

/** Édition proposable comme modèle — rien de nominatif (id + nom + identité
 * publique de conf, pour pré-remplir la cible comme le fait « Dupliquer »). */
export interface EditionModele {
  id: number;
  nom: string;
  annee: number;
  confSlug: string | null;
  confNom: string | null;
}

/**
 * Modale « + Créer une édition ». Créer, c'est souvent repartir de l'édition
 * précédente : le sélecteur « À partir de » (optionnel, EN PREMIER — on choisit
 * son point de départ) duplique le SQUELETTE des ateliers d'une édition modèle
 * — jamais ses personnes ni ses dates (cf. `docs/tremplin-duplication-edition.md`).
 *
 * En mode modèle, la modale s'aligne sur « Dupliquer cette édition » : conf et
 * année pré-remplies depuis le modèle (année + 1), nom proposé suiveur, et
 * SEULS les champs que la duplication conserve (conf, année, nom, site) — pas
 * de dates ni de description qui seraient jetées en silence. Vide (« Édition
 * vierge »), le formulaire complet de création s'affiche.
 *
 * La conférence définit l'identité d'URL (non modifiable ensuite) : pas de
 * choix par défaut en création vierge — on ne crée pas une édition sous la
 * mauvaise conf par inattention. Statut initial « en préparation » : invisible
 * du public tant que non ouverte. Succès → page admin de la nouvelle édition.
 */
export default function AddEditionDialog({
  conferences,
  editions,
  editionOptions = [],
}: {
  conferences: ConferenceRef[];
  /** Éditions proposables comme modèle (la plus récente d'abord). */
  editions: EditionModele[];
  /** Événements de la référence des conférences (lien facultatif). */
  editionOptions?: { id: number; libelle: string }[];
}) {
  // Pas de pré-sélection silencieuse ; sans conf connue, directement la saisie libre.
  const [confChoisie, setConfChoisie] = useState<string>(
    conferences.length === 0 ? NOUVELLE_CONF : "",
  );
  // « À partir de » : "" = édition vierge (défaut).
  const [sourceId, setSourceId] = useState<string>("");
  // Année CONTRÔLÉE : pré-remplie au choix d'un modèle, et le nom proposé se
  // recalcule en tapant (mode modèle).
  const [annee, setAnnee] = useState<string>("");
  // Nom : null tant que l'orga n'a pas édité → le champ suit la proposition.
  const [nomPerso, setNomPerso] = useState<string | null>(null);

  const existante = conferences.find((c) => c.confSlug === confChoisie);
  const modele = editions.find((e) => String(e.id) === sourceId);

  /** Choisir un modèle pré-remplit la cible (conf du modèle, année + 1) —
   * même geste que « Dupliquer cette édition » depuis le hub. */
  const choisirModele = (valeur: string) => {
    setSourceId(valeur);
    const m = editions.find((e) => String(e.id) === valeur);
    if (m) {
      setConfChoisie(m.confSlug ?? NOUVELLE_CONF);
      setAnnee(String(m.annee + 1));
    }
  };

  // Nom proposé (mode modèle) : conf choisie, repli sur celle du modèle
  // (cas legacy : slug absent de la liste des confs connues).
  const confNomCible =
    existante?.confNom ??
    (modele && confChoisie === modele.confSlug ? modele.confNom : null);
  const nomPropose = nomEditionPropose(
    confNomCible,
    /^\d{4}$/.test(annee) ? Number(annee) : null,
  );

  return (
    <AdminDialog
      triggerLabel="Créer une édition"
      title="Créer une édition"
      action={createEditionAction}
      submitLabel="Créer l'édition"
      pendingLabel="Création…"
      wrapperClassName="mb-2"
    >
      {(state) => (
        <>
          {editions.length > 0 && (
            <label className="text-sm flex flex-col gap-1">
              À partir de (optionnel)
              <select
                name="sourceId"
                value={sourceId}
                onChange={(e) => choisirModele(e.target.value)}
                className={inputCls}
              >
                <option value="">Édition vierge</option>
                {editions.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nom}
                  </option>
                ))}
              </select>
            </label>
          )}
          {modele && <DuplicationRecap />}

          <ConferenceFields
            conferences={conferences}
            state={state}
            value={confChoisie}
            onChange={setConfChoisie}
          />

          <label className="text-sm flex flex-col gap-1">
            <span>
              Année <span aria-hidden="true">*</span>
              <span className="sr-only"> (obligatoire)</span>
            </span>
            <input
              type="number"
              name="annee"
              required
              min={2000}
              max={2100}
              value={annee}
              onChange={(e) => setAnnee(e.target.value)}
              placeholder="2027"
              className={inputCls}
            />
          </label>

          {modele ? (
            // Mode modèle : seulement ce que la duplication CONSERVE (nom
            // proposé suiveur + site de la conf) — les dates et la description
            // seraient jetées, on ne les propose pas à la saisie.
            <>
              <NomEditionField nomPropose={nomPropose} value={nomPerso} onChange={setNomPerso} />
              <ConfLienField
                state={state}
                defaultLien={existante?.confLien ?? null}
                remountKey={confChoisie}
              />
            </>
          ) : (
            <EditionChampsCommuns
              editionOptions={editionOptions}
              state={state}
              defaults={{ confLien: existante?.confLien ?? null }}
              confLienKey={confChoisie}
            />
          )}

          <p className="text-xs text-gray-light">
            L&apos;édition est créée <strong>en préparation</strong>&nbsp;: invisible du
            public jusqu&apos;à ce que tu l&apos;ouvres. Tout se complète plus tard.
          </p>
        </>
      )}
    </AdminDialog>
  );
}
