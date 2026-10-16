/**
 * État de chargement instantané des pages plateforme (`loading.tsx`) : les
 * pages sont `force-dynamic` (données fraîches à chaque visite) et la preview
 * ou un départ à froid peuvent prendre une seconde — sans feedback, le clic
 * semble ignoré. Squelette sobre + annonce lecteur d'écran.
 */
export default function ChargementPage() {
  return (
    <div className="py-10 px-4">
      <div className="max-w-2xl mx-auto flex flex-col gap-6" role="status">
        <span className="sr-only">Chargement de la page…</span>
        <div aria-hidden="true" className="flex flex-col gap-6 animate-pulse">
          <div className="h-8 w-2/3 rounded-lg bg-navy-lighter" />
          <div className="h-4 w-1/2 rounded bg-navy-lighter" />
          <div className="h-24 rounded-2xl bg-navy-lighter/60" />
          <div className="h-24 rounded-2xl bg-navy-lighter/60" />
        </div>
      </div>
    </div>
  );
}
