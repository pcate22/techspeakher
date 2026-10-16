import Button from "@/components/Button";

/**
 * LA paire d'actions de « Mes talks » (ajout en principal, import en
 * secondaire), définie une seule fois : l'en-tête de la page la rend quand il
 * y a des talks, l'accueil de la carte quand la fiche est vide — jamais les
 * deux à la fois (registre d'erreurs, docs/principes-conception-ui.md).
 */
export default function TalksActions({ size }: { size?: "sm" }) {
  return (
    <div className="flex flex-wrap gap-3 shrink-0">
      <Button href="/mon-espace/talks/nouveau" size={size}>
        Ajouter un talk
      </Button>
      <Button href="/mon-espace/talks/importer" variant="secondary" size={size}>
        Importer mes talks
      </Button>
    </div>
  );
}
