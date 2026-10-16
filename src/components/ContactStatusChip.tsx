/**
 * Pastille de statut d'un message de contact : picto + couleur + libellé.
 * Le picto est décoratif (`aria-hidden`) ; le sens passe par le TEXTE (RGAA :
 * jamais la couleur seule). Palette : transmis = cyan (fait), rejeté = gris
 * (décision close, neutre — PAS magenta qui est la couleur de marque),
 * à modérer = orange (à traiter).
 */
const CONFIG: Record<
  string,
  { label: string; icon: string; cls: string }
> = {
  transmis: { label: "Transmis", icon: "✓", cls: "border-cyan/40 text-cyan bg-cyan/10" },
  rejete: { label: "Rejeté", icon: "✕", cls: "border-gray-light/30 text-gray-light bg-gray-light/10" },
  en_attente: { label: "À modérer", icon: "•", cls: "border-orange/40 text-orange bg-orange/10" },
};

export default function ContactStatusChip({ status }: { status: string }) {
  const c = CONFIG[status] ?? CONFIG.en_attente;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide border rounded-full px-2 py-0.5 ${c.cls}`}
    >
      <span aria-hidden="true">{c.icon}</span>
      {c.label}
    </span>
  );
}
