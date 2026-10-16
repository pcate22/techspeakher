"use client";

import { useState } from "react";
import type { ConferenceRef, Edition } from "@/lib/tremplin-editions";
import { nomEditionPropose } from "@/lib/tremplin-nom";
import { createEditionAction } from "../actions";
import ConferenceFields, { NOUVELLE_CONF } from "../ConferenceFields";
import ConfLienField from "../ConfLienField";
import DuplicationRecap from "../DuplicationRecap";
import NomEditionField from "../NomEditionField";
import AdminDialog, { inputCls } from "./AdminDialog";

/**
 * Modale « Dupliquer cette édition » : le raccourci pré-rempli de la création
 * « À partir de » (même action `createEditionAction`, `sourceId` caché = cette
 * édition). Conf par défaut = celle de la source → l'orga ne change que l'année
 * (« même conf, nouvelle année ») ; ou elle choisit une autre conf.
 *
 * On NE recopie que le squelette des ateliers : ni participantes, ni photos, ni
 * documents, ni récompenses, ni jury, ni dates, ni coachs (cf.
 * `docs/tremplin-duplication-edition.md`) — le récapitulatif l'annonce en clair
 * pour qu'aucune orga ne croie « repartir avec les inscrites ». La copie naît
 * « en préparation ». Succès → page admin de la copie.
 */
export default function DuplicateEditionDialog({
  edition,
  conferences,
}: {
  edition: Edition;
  conferences: ConferenceRef[];
}) {
  // Année cible par défaut : l'année suivante (cas courant « la conf revient »).
  // Garder même conf + même année déclencherait le conflit d'unicité.
  // CONTRÔLÉE (pas defaultValue) : le nom proposé se recalcule en tapant.
  const [annee, setAnnee] = useState<string>(String(edition.annee + 1));
  const [confChoisie, setConfChoisie] = useState<string>(edition.confSlug ?? NOUVELLE_CONF);
  // Nom : null tant que l'orga n'a pas édité → le champ suit la proposition.
  const [nomPerso, setNomPerso] = useState<string | null>(null);
  const existante = conferences.find((c) => c.confSlug === confChoisie);

  // Nom proposé « Tremplin {conf} {année} ». Le nom de conf vient de la conf
  // choisie, avec repli sur la source (cas legacy : slug absent de la liste).
  // Année invalide en cours de saisie → pas d'année.
  const confNomCible =
    existante?.confNom ??
    (confChoisie === edition.confSlug ? edition.confNom : null);
  const nomPropose = nomEditionPropose(
    confNomCible,
    /^\d{4}$/.test(annee) ? Number(annee) : null,
  );

  return (
    <AdminDialog
      triggerLabel="Dupliquer cette édition"
      triggerPrefix={null}
      title="Dupliquer cette édition"
      action={createEditionAction}
      submitLabel="Dupliquer l'édition"
      pendingLabel="Duplication…"
    >
      {(state) => (
        <>
          <input type="hidden" name="sourceId" value={edition.id} />

          <ConferenceFields
            conferences={conferences}
            state={state}
            value={confChoisie}
            onChange={setConfChoisie}
          />

          <label className="text-sm flex flex-col gap-1">
            Année
            <input
              type="number"
              name="annee"
              required
              min={2000}
              max={2100}
              value={annee}
              onChange={(e) => setAnnee(e.target.value)}
              className={inputCls}
            />
          </label>

          <NomEditionField nomPropose={nomPropose} value={nomPerso} onChange={setNomPerso} />

          <ConfLienField
            state={state}
            defaultLien={existante?.confLien ?? null}
            remountKey={confChoisie}
          />

          <DuplicationRecap />
        </>
      )}
    </AdminDialog>
  );
}
