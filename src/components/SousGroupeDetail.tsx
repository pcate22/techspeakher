import ExternalLink from "@/components/ExternalLink";
import InlineActionForm from "@/components/InlineActionForm";
import type { ActionState } from "@/lib/action-state";
import type { MonSousGroupe } from "@/lib/tremplin-ateliers";
import { libelleCoachs } from "@/lib/sous-groupe-libelle";
import { enumererFr } from "@/lib/format";

/**
 * LE sous-groupe d'une participante, rendu DANS la carte de son atelier
 * (agenda unifié, refonte §6) : qui (co-membres, coachs ou tête-à-tête), le
 * lien pour se retrouver, et « fait le » pré-rempli à aujourd'hui — « Marquer
 * comme fait » enregistre toujours une vraie date (fini le faux succès sur
 * champ vide). Présentation pure : l'action serveur (et sa garde « membre du
 * sous-groupe ») est fournie par la page.
 *
 * Aucun libellé de groupe ici : il se désigne par qui est dedans, et c'est
 * exactement ce que dit cette phrase.
 */
export default function SousGroupeDetail({
  sg,
  editionId,
  aujourdhui,
  action,
}: {
  sg: MonSousGroupe;
  editionId: number;
  /** Date du jour (YYYY-MM-DD), hoistée par la page (un seul calcul). */
  aujourdhui: string;
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  // `nbCoachs` et pas `coachNoms.length` : une coach invitée par e-mail n'a pas
  // encore de nom en base, et la faire disparaître ferait lire « tu es seule » à
  // une participante qui a bel et bien une coach.
  const avecCoach = sg.nbCoachs > 0;
  return (
    <div className="mt-3 border-t border-navy-lighter pt-3">
      <p className="text-sm">
        {sg.coMembres.length > 0 ? (
          <>
            Avec{" "}
            <span className="text-white font-medium">{enumererFr(sg.coMembres)}</span>
            {avecCoach && (
              <>
                {" · "}
                {sg.nbCoachs > 1 ? "Coachs" : "Coach"}&nbsp;:{" "}
                <span className="text-white font-medium">{libelleCoachs(sg.coachNoms)}</span>
              </>
            )}
          </>
        ) : avecCoach ? (
          // Point individuel : dire ce qui EST (un tête-à-tête), jamais un
          // « tu es seule » anxiogène pour un 1-1 voulu.
          <>
            {sg.nbCoachs === 1 ? "En tête-à-tête avec ta coach" : "Avec tes coachs"}{" "}
            <span className="text-white font-medium">{libelleCoachs(sg.coachNoms)}</span>
          </>
        ) : (
          // Forme positive : ce qui vient, pas ce qui manque.
          "Ton sous-groupe se compose bientôt : l'équipe t'y ajoute des binômes."
        )}
      </p>
      {sg.lienVisio && (
        <p className="text-sm mt-1">
          <ExternalLink
            href={sg.lienVisio}
            aria-label={`Lien pour vous retrouver : ${sg.atelierTitre}`}
            className="text-cyan underline underline-offset-2 hover:text-cyan-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded"
          >
            Lien pour vous retrouver
          </ExternalLink>
        </p>
      )}
      <div className="mt-2">
        <InlineActionForm
          action={action}
          hidden={{ editionId, sousGroupeId: sg.sousGroupeId }}
          fields={[
            {
              kind: "input",
              name: "faitLe",
              label: "Fait le",
              type: "date",
              clearable: true,
              defaultValue: sg.faitLe ?? aujourdhui,
            },
          ]}
          submitLabel={sg.faitLe ? "Mettre à jour la date" : "Marquer comme fait"}
          pendingLabel="Enregistrement…"
          successMessage="C'est noté, merci."
        />
      </div>
    </div>
  );
}
