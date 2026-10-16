import DocList from "@/components/DocList";
import RangeeAtelier from "@/components/RangeeAtelier";
import type { Edition } from "@/lib/tremplin-editions";
import type { Atelier } from "@/lib/tremplin-ateliers";
import type { TremplinDocument } from "@/lib/tremplin-documents";
import { nomConference } from "@/lib/tremplin-conf";
import { nb } from "@/lib/format";

/**
 * Niveau d'accès à l'espace (3 états mutuellement exclusifs) :
 * - `registered`   : participante inscrite → ses documents privés.
 * - `orga-preview` : orga non inscrite qui prévisualise → message neutre.
 * - `guest`        : connectée mais non rattachée → invite à écrire à l'orga.
 */
export type EspaceAccess = "registered" | "orga-preview" | "guest";

/**
 * Espace ressources & résultats d'une participante (objectif prioritaire §13).
 * Présentation pure : tout le contrôle d'accès est fait côté page/lib (la page
 * ne passe QUE les documents partagés + ceux de la participante connectée).
 */
export default function TremplinEspace({
  edition,
  ateliers,
  sharedDocs,
  myDocs,
  access,
}: {
  edition: Edition;
  ateliers: Atelier[];
  sharedDocs: TremplinDocument[];
  myDocs: TremplinDocument[];
  access: EspaceAccess;
}) {
  const generalDocs = sharedDocs.filter((d) => d.atelierId === null);
  const confLabel = nomConference(edition.confNom, edition.confLieu);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">{edition.nom}</h1>
        {confLabel && <p className="text-sm text-gray-light mt-1">{confLabel}</p>}
      </header>

      {/* Le programme : un bloc par atelier, avec ses docs de travail. */}
      <section
        aria-labelledby="programme-title"
        className="bg-navy-light border border-navy-lighter rounded-2xl p-6"
      >
        <h2
          id="programme-title"
          className="text-xs font-bold uppercase tracking-wider text-gray-light mb-4"
        >
          Le programme
        </h2>
        {ateliers.length === 0 ? (
          <p className="text-sm text-gray-light">Le programme n&apos;est pas encore publié : tes ateliers apparaîtront ici.</p>
        ) : (
          <ul role="list" className="flex flex-col gap-2 list-none">
            {/* Une RANGÉE par séance, et sa PAGE derrière : le détail (visio,
                supports, sous-groupe) s'empilait ici, si bien qu'une carte
                d'agenda ne pouvait mener qu'à une ancre au milieu d'une longue
                page. Une carte mène à une page — comme côté orga. */}
            {ateliers.map((a) => {
              const nbSupports = sharedDocs.filter((d) => d.atelierId === a.id).length;
              return (
                <li key={a.id}>
                  <RangeeAtelier
                    href={`/mon-espace/tremplin/${edition.id}/ateliers/${a.id}`}
                    titre={a.titre}
                    infos={[
                      a.coachs && `Coach\u00a0: ${a.coachs}`,
                      a.lieu,
                      nbSupports > 0 && nb(nbSupports, "support"),
                    ]}
                    date={a.date}
                    dateFin={a.dateFin}
                  />
                </li>
              );
            })}
          </ul>
        )}

        {generalDocs.length > 0 && (
          <div className="mt-5 pt-4 border-t border-navy-lighter">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-light mb-2">
              Ressources
            </h3>
            <DocList docs={generalDocs} />
          </div>
        )}
      </section>

      {/* Mes documents : strictement privés à la participante. */}
      <section
        aria-labelledby="mes-docs-title"
        className="bg-navy-light border border-navy-lighter rounded-2xl p-6"
      >
        <h2
          id="mes-docs-title"
          className="text-xs font-bold uppercase tracking-wider text-gray-light mb-1"
        >
          Mes documents
        </h2>
        <p className="text-sm text-gray-light mb-4">
          Ton retour individuel du jury et la vidéo de ton pitch.
        </p>
        {access === "orga-preview" ? (
          <p className="text-sm text-gray-light">
            Aperçu pour une organisatrice : une participante rattachée verrait ici son retour
            individuel du jury et la vidéo de son pitch.
          </p>
        ) : access === "guest" ? (
          <p className="text-sm text-gray-light">
            Ton compte n&apos;est pas encore rattaché à cette édition. Écris à
            l&apos;équipe organisatrice si tu penses que c&apos;est une erreur.
          </p>
        ) : (
          <DocList
            docs={myDocs}
            empty="Rien pour le moment. Tes documents apparaîtront ici dès que l’équipe organisatrice les aura ajoutés."
          />
        )}
      </section>
    </div>
  );
}
