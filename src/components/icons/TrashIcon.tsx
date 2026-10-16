/**
 * Poubelle. Trait ÉPAIS (2) et non 1,5 comme les icônes de lien : celle-ci
 * porte un geste destructif et doit rester lisible sur téléphone en plein
 * soleil (principes §9). Toujours `aria-hidden` : le sens vient du libellé du
 * bouton qui la contient, jamais du dessin.
 */
export default function TrashIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 7h16M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7m-8 0 .8 11.2A2 2 0 0 0 9.8 20h4.4a2 2 0 0 0 2-1.8L17 7M10 11v5m4-5v5"
      />
    </svg>
  );
}
