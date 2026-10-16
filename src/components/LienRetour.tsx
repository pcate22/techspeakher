import Link from "next/link";

/**
 * Lien de retour « ← … » en bas d'une sous-page. Extrait pour ne plus recopier
 * la classe (cible tactile, focus visible, flèche décorative) sur chaque page
 * (dette #4). La flèche est `aria-hidden` (le lecteur d'écran lit le libellé).
 */
export default function LienRetour({ href, label }: { href: string; label: string }) {
  return (
    <p>
      <Link
        href={href}
        className="inline-flex items-center min-h-[44px] py-2 -my-2 text-sm text-cyan hover:text-cyan-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded"
      >
        <span aria-hidden="true" className="mr-1">
          ←
        </span>
        {label}
      </Link>
    </p>
  );
}
