import { contactMotifLabel } from "@/data/contact-motifs";

/**
 * Pastille du motif d'un message de contact (file orga + « Mes messages »).
 * Composant partagé (server-safe) : une seule source de style pour le badge.
 */
export default function MotifBadge({ motif }: { motif: string }) {
  return (
    <span className="text-[11px] font-bold uppercase tracking-wide border border-cyan/40 text-cyan rounded-full px-2 py-0.5">
      {contactMotifLabel(motif)}
    </span>
  );
}
