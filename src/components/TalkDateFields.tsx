import { MOIS_FR, type TalkDateParts } from "@/lib/talk-date";

const selectClass =
  "w-full bg-navy border border-navy-lighter rounded-lg px-3 py-2 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan";
const labelClass = "block text-sm text-gray-light mb-1";

/**
 * Saisie de date d'un talk en trois listes : Jour (option.) / Mois (option.) /
 * Année (obligatoire). Réutilisable. La composition + validation se font côté
 * serveur dans parseTalkForm (buildTalkDate).
 *
 * `repriseDeLEdition` : une édition est choisie, et le serveur reprend SA date
 * quand la saisie est vide (`dateLegueeParEdition`). L'année cesse d'être
 * exigée, et la légende le dit — le navigateur bloquait sinon un envoi que le
 * serveur aurait accepté (revue RGAA du 2026-10-15).
 */
export default function TalkDateFields({
  initial,
  error,
  currentYear,
  repriseDeLEdition = false,
}: {
  initial?: TalkDateParts;
  error?: string;
  currentYear: number;
  repriseDeLEdition?: boolean;
}) {
  const years: number[] = [];
  for (let y = currentYear + 1; y >= 2005; y--) years.push(y);

  return (
    <fieldset>
      <legend className={labelClass}>
        {repriseDeLEdition ? (
          <>
            Date <span className="text-gray-light">(celle de l&apos;édition si tu la laisses vide)</span>
          </>
        ) : (
          <>
            Date * <span className="text-gray-light">(année minimum)</span>
          </>
        )}
      </legend>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label htmlFor="talk-jour" className="sr-only">
            Jour
          </label>
          <select
            id="talk-jour"
            name="jour"
            defaultValue={initial?.jour ?? ""}
            className={selectClass}
          >
            <option value="">Jour</option>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="talk-mois" className="sr-only">
            Mois
          </label>
          <select
            id="talk-mois"
            name="mois"
            defaultValue={initial?.mois ?? ""}
            className={selectClass}
          >
            <option value="">Mois</option>
            {MOIS_FR.map((nom, i) => (
              <option key={nom} value={i + 1}>
                {nom}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="talk-annee" className="sr-only">
            Année
          </label>
          <select
            id="talk-annee"
            name="annee"
            required={!repriseDeLEdition}
            defaultValue={initial?.annee ?? ""}
            className={selectClass}
          >
            <option value="">{repriseDeLEdition ? "Année" : "Année *"}</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-xs text-orange mt-1">
          {error}
        </p>
      )}
    </fieldset>
  );
}
