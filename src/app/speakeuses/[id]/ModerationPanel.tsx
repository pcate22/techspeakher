"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Button from "@/components/Button";
import type { ProfileStatus } from "@/lib/profiles";
import { formatDateFr } from "@/lib/format";
import { moderateProfileAction } from "@/app/admin/actions";
import {
  relancerFicheAction,
  type EtatRelance,
} from "@/app/admin/speakeuses/relances/actions";
import { IDLE } from "@/lib/action-state";

const STATUS_LABEL: Record<ProfileStatus, string> = {
  brouillon: "Brouillon (pas encore soumis)",
  en_attente: "En attente de validation",
  publie: "Publiée dans l'annuaire",
  refuse: "Refusée",
  masque: "Masquée",
  en_pause: "En pause, en attente d'adhésion",
};

/**
 * Panneau de modération affiché sur la fiche en vue orga (pas la propriétaire).
 * Publier en un clic ; refuser ouvre une zone de motif (expliqué à la
 * speakeuse, envoyé par e-mail). La décision est rejouée côté serveur.
 */
export default function ModerationPanel({
  profileId,
  status,
  submittedAt,
  refusMotif,
  relancable,
  rappelRefuse,
}: {
  profileId: number;
  status: ProfileStatus;
  submittedAt: string | null;
  refusMotif: string | null;
  /** La base accepte une relance pour cette fiche MAINTENANT (cf.
   *  `getFicheARelancer`). Simple indice d'affichage : c'est l'action serveur
   *  qui tranche à l'envoi, un onglet resté ouvert pouvant être en retard. */
  relancable: boolean;
  /** La speakeuse a demandé à recevoir AUCUN rappel sur sa fiche. C'est un
   *  fait à dire, pas une règle à redériver : sans lui, l'écran servirait
   *  « la relance rouvrira plus tard » pour un choix qui, lui, ne rouvrira
   *  jamais. Le refus est de toute façon tenu par le SQL. */
  rappelRefuse: boolean;
}) {
  const [refusing, setRefusing] = useState(false);
  const motifRef = useRef<HTMLTextAreaElement>(null);
  const [relance, relancer, relanceEnCours] = useActionState<EtatRelance, FormData>(
    relancerFicheAction,
    IDLE,
  );

  // Quand on ouvre le motif de refus, on y amène le focus (clavier / lecteur).
  useEffect(() => {
    if (refusing) motifRef.current?.focus();
  }, [refusing]);

  return (
    <section
      aria-label="Modération"
      className="mb-8 rounded-xl border border-magenta/40 bg-navy-light/60 p-5"
    >
      <p className="text-xs font-bold uppercase tracking-wider text-magenta">
        Modération
      </p>
      <p className="text-sm text-white mt-1">
        Statut&nbsp;: <strong>{STATUS_LABEL[status]}</strong>
      </p>
      {submittedAt && (
        <p className="text-xs text-gray-light mt-0.5">
          Soumise le {formatDateFr(submittedAt)}
        </p>
      )}
      {status === "en_pause" && (
        <p className="text-xs text-gray-light mt-2">
          Republier la remet en ligne trente jours, le temps d&apos;un nouveau préavis
          d&apos;adhésion.
        </p>
      )}
      {status === "refuse" && refusMotif && (
        <p className="text-xs text-orange mt-2">
          Motif du refus communiqué&nbsp;: {refusMotif}
        </p>
      )}

      <div className="flex flex-wrap gap-3 mt-4">
        {/* Publier / Republier : visible sauf si déjà publiée. */}
        {status !== "publie" && (
          <form action={moderateProfileAction}>
            <input type="hidden" name="profileId" value={profileId} />
            <input type="hidden" name="decision" value="publie" />
            <Button type="submit" size="sm">
              {status === "masque" || status === "en_pause" ? "Republier" : "Publier"}
            </Button>
          </form>
        )}
        {/* Mettre en retrait : retire une fiche publiée de l'annuaire. */}
        {status === "publie" && (
          <form action={moderateProfileAction}>
            <input type="hidden" name="profileId" value={profileId} />
            <input type="hidden" name="decision" value="masque" />
            <Button type="submit" variant="secondary" size="sm">
              Mettre en retrait
            </Button>
          </form>
        )}
        {/* Refuser (avec motif) : pertinent pour une fiche soumise. */}
        {status === "en_attente" && (
          <Button
            type="button"
            variant="danger"
            size="sm"
            aria-expanded={refusing}
            aria-controls="refus-form"
            onClick={() => setRefusing((v) => !v)}
          >
            Refuser…
          </Button>
        )}
      </div>

      {refusing && (
        <form
          id="refus-form"
          action={moderateProfileAction}
          className="mt-4 flex flex-col gap-2"
        >
          <input type="hidden" name="profileId" value={profileId} />
          <input type="hidden" name="decision" value="refuse" />
          <label htmlFor="motif" className="text-sm text-gray-light">
            Motif du refus{" "}
            <span className="text-gray-light">
              (envoyé à la speakeuse pour qu&apos;elle puisse ajuster)
            </span>
          </label>
          <textarea
            ref={motifRef}
            id="motif"
            name="motif"
            rows={3}
            required
            className="w-full bg-navy border border-navy-lighter rounded-lg px-3 py-2 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
            placeholder="Ex. La bio est vide, ou aucun talk / sujet n'est renseigné."
          />
          <div className="flex gap-3">
            <Button type="submit" variant="danger" size="sm">
              Confirmer le refus
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setRefusing(false)}
            >
              Annuler
            </Button>
          </div>
        </form>
      )}

      {/* RELANCE — seulement sur un brouillon : c'est la seule situation où
          « il te reste ceci à faire » dit vrai. Une fiche soumise attend une
          orga, une fiche publiée reçoit déjà le rappel semestriel.
          Pattern résultat (`useActionState`) plutôt que redirection : le retour
          s'affiche À CÔTÉ du bouton, sans renvoyer l'orga en haut de la fiche
          (principes UI § 4). */}
      {status === "brouillon" && (
        <div className="mt-4 border-t border-navy-lighter pt-4">
          <p className="text-sm text-gray-light">
            Cette fiche vit en brouillon. Une relance lui envoie la liste de ce
            qu&apos;il lui reste à faire pour rejoindre l&apos;annuaire.
          </p>
          {/* Région vivante rendue en permanence : créée seulement à l'arrivée
              du message, elle resterait muette pour un lecteur d'écran. */}
          <p role="status" className="text-sm text-cyan mt-2">
            {relance.status === "success" ? relance.message : ""}
          </p>
          {relance.status === "error" && (
            <p role="alert" className="text-sm text-orange mt-2">
              {relance.error}
            </p>
          )}
          {relancable && relance.status !== "success" && (
            <form action={relancer} className="mt-3">
              <input type="hidden" name="profileId" value={profileId} />
              <Button
                type="submit"
                variant="secondary"
                size="sm"
                disabled={relanceEnCours}
              >
                {relanceEnCours ? "Envoi en cours…" : "Relancer par e-mail"}
              </Button>
            </form>
          )}
          {!relancable &&
            (rappelRefuse ? (
              // Le seul cas définitif, et le seul qui mérite d'être nommé : un
              // choix de la personne. Le dire évite qu'on cherche pourquoi le
              // bouton manque, et qu'on la relance par un autre chemin.
              <p className="text-sm text-gray-light mt-2">
                Elle a demandé à recevoir aucun rappel sur sa fiche. On respecte
                ce choix&nbsp;: pour la joindre, passe par un autre canal.
              </p>
            ) : (
              // Une seule phrase pour toutes les autres raisons de fermeture
              // (message récent, cadence en cours, adresse à confirmer,
              // invitation de migration encore à envoyer) : réénumérer ici les
              // conditions du SQL les ferait diverger au premier changement.
              <p className="text-sm text-gray-light mt-2">
                La relance rouvrira plus tard&nbsp;: un message est parti
                récemment, ou le compte reste à joindre.
              </p>
            ))}
        </div>
      )}
    </section>
  );
}
