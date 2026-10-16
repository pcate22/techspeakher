type Props = {
  id: string;
  title: React.ReactNode;
  subtitle?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  /** Rythme vertical de la section. Par défaut généreux ; une page peut le
   *  resserrer (ex. l'annuaire, pour rapprocher la recherche du titre sur mobile). */
  padY?: string;
};

export default function PageHero({ id, title, subtitle, titleClassName = "mb-4", subtitleClassName = "max-w-2xl", padY = "py-16 sm:py-24" }: Props) {
  return (
    <section className={`${padY} px-4`} aria-labelledby={id}>
      <div className="max-w-4xl mx-auto text-center">
        <h1 id={id} className={`text-3xl sm:text-4xl font-bold ${titleClassName}`}>
          {title}
        </h1>
        {subtitle && (
          <p className={`text-gray-light mx-auto ${subtitleClassName}`}>
            {subtitle}
          </p>
        )}
      </div>
    </section>
  );
}
