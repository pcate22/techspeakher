/**
 * Récapitulatif de ce qu'une duplication recopie (et surtout ne recopie pas),
 * PARTAGÉ par les modales « Créer une édition » (sélecteur « À partir de ») et
 * « Dupliquer cette édition » : une orga ne doit jamais croire « repartir avec
 * les inscrites ». Liste de définitions (l'intitulé est rattaché à son texte,
 * pas des faux-titres en gras) — cf. docs/tremplin-duplication-edition.md.
 */
export default function DuplicationRecap() {
  return (
    <dl className="text-xs text-gray-light rounded-lg border border-navy-lighter p-3">
      <dt className="font-medium text-white">Ce qui est recopié</dt>
      <dd className="m-0">Le parcours d&apos;ateliers (titres et descriptions).</dd>
      <dt className="font-medium text-white mt-2">Ce qui ne l&apos;est pas</dt>
      <dd className="m-0">
        Ni participantes, ni photos, ni documents, ni récompenses, ni jury, ni
        dates, ni coachs&nbsp;: tu repars d&apos;une base propre, à compléter. La
        copie naît <strong>en préparation</strong>.
      </dd>
    </dl>
  );
}
