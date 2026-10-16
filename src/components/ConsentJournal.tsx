import { formatDateFr } from "@/lib/format";
import type { ConsentLogEntry, ConsentBase } from "@/lib/tremplin-registrations";

/**
 * Journal de consentement à la diffusion, en LECTURE seule (RGPD). Rendu côté
 * orga (démontrabilité) ET côté personne concernée (transparence, droit d'accès
 * art. 12-15) : même composant, même vérité. Présentation pure, sérialisable.
 *
 * Wording à la forme POSITIVE (cf. principes §5) : on dit ce qui EST (« Accordé
 * le … via … »), jamais « n'a pas ». La base n'a de sens qu'à l'octroi ; sur un
 * retrait on n'affiche pas d'origine (le retrait ne « provient » de rien).
 */
function baseLabel(base: ConsentBase): string {
  switch (base) {
    case "self":
      return "par la personne, dans son espace";
    case "formulaire_inscription":
      return "via le formulaire d'inscription";
    case "email":
      return "via un accord par e-mail";
    case "autre":
      return "via un autre recueil";
  }
}

export default function ConsentJournal({
  entries,
  emptyLabel = "Aucun consentement consigné pour l'instant.",
}: {
  entries: ConsentLogEntry[];
  emptyLabel?: string;
}) {
  if (entries.length === 0) {
    return <p className="text-sm text-gray-light">{emptyLabel}</p>;
  }

  return (
    <ol className="flex flex-col gap-2 list-none text-sm">
      {entries.map((e, i) => {
        const date = formatDateFr(e.createdAt, {
          day: "numeric",
          month: "long",
          year: "numeric",
        });
        const accorde = e.action === "accorde";
        return (
          <li
            key={`${e.createdAt}:${i}`}
            className="flex flex-wrap items-baseline gap-x-2 gap-y-1"
          >
            <span className={accorde ? "text-white" : "text-gray-light"}>
              {accorde ? "Accordé" : "Retiré"} le {date}
              {accorde ? ` ${baseLabel(e.base)}` : ""}
            </span>
            {accorde && e.preuveLien && (
              <a
                href={e.preuveLien}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan hover:text-cyan-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded"
              >
                voir la preuve
                <span className="sr-only"> (nouvelle fenêtre)</span>
              </a>
            )}
          </li>
        );
      })}
    </ol>
  );
}
