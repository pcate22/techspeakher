import type { Talk } from "@/lib/talks";
import TalkCard from "@/components/TalkCard";
import TalksActions from "./TalksActions";

/**
 * Liste des talks de la speakeuse — la LISTE seule : les actions vivent dans
 * l'en-tête de la page (porte d'entrée unique, cf. TalksActions). Exception,
 * la fiche VIDE : l'en-tête s'efface et c'est la carte qui accueille avec la
 * paire d'actions — à l'arrivée, c'est elle l'essentiel. État vide à la forme
 * positive (§5).
 */
export default function TalksManager({ talks }: { talks: Talk[] }) {
  if (talks.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4">
        <p className="text-sm text-gray-light">
          Aucun talk pour l&apos;instant. Ajoute ton premier talk, ou importe
          ton historique d&apos;un coup (fichier JSON ou CSV).
        </p>
        <TalksActions />
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3 list-none">
      {talks.map((t) => (
        <li key={t.id}>
          <TalkCard talk={t} manageHref={`/mon-espace/talks/${t.id}`} />
        </li>
      ))}
    </ul>
  );
}
