import Breadcrumb from "@/components/Breadcrumb";
import type { Metadata } from "next";
import Image from "next/image";
import Button from "@/components/Button";
import LienTexte from "@/components/LienTexte";
import PageHero from "@/components/PageHero";
import PaletteCouleurs from "./PaletteCouleurs";
import {
  declinaisonsLogo,
  fichiersArchive,
  modelesKit,
  groupesCouleurs,
  typosKit,
  reglesLogo,
  octetsZip,
  poidsLisible,
  DOSSIER_KIT,
  URL_ZIP,
} from "@/data/kit-communication";

export const metadata: Metadata = {
  title: "Kit de communication | Tech Speak'Her Toulouse",
  description:
    "Logos, couleurs et typographies de Tech Speak'Her à télécharger, avec les règles d'usage du logo, pour parler de nous sur vos supports.",
  alternates: {
    canonical: "/kit-de-communication",
  },
};

/**
 * Le kit de communication. RÔLE : donner aux partenaires de quoi parler de
 * nous sans nous écrire. ACTION PRINCIPALE : télécharger tout le kit (une
 * archive). Les téléchargements fichier par fichier sont des liens
 * secondaires, chacun nommé par ce qu'il contient.
 *
 * Toutes les valeurs viennent de `src/data/kit-communication.ts`, qui dit ses
 * sources ; la page n'en écrit aucune.
 */
export default function KitDeCommunication() {
  return (
    <>
      <Breadcrumb items={[{ label: "Accueil", href: "/" }, { label: "Kit de communication" }]} />
      <PageHero
        id="kit-title"
        title={<>Kit de <span className="text-cyan">communication</span></>}
        subtitle="Le logo, les couleurs et les typographies de Tech Speak'Her, pour parler de nous sur vos supports."
      />

      {/* Logos */}
      <section className="py-16 px-4 bg-navy-light" aria-labelledby="logos-title">
        <div className="max-w-4xl mx-auto">
          <h2 id="logos-title" className="text-2xl font-bold text-center mb-3">
            Les <span className="text-magenta">logos</span>
          </h2>
          <p className="text-gray-light text-center max-w-2xl mx-auto mb-8">
            Le logo complet porte la bulle et le nom&nbsp;; l&apos;icône, la
            bulle seule. Préférez la version fond sombre, celle de nos écrans.
          </p>
          <div className="text-center mb-12">
            <Button href={URL_ZIP} download className="flex-col">
              {/* Les espaces entre les deux lignes : flex les efface à
                  l'écran, mais sans eux le nom accessible collait
                  « kitZIP ». */}
              <span>Télécharger tout le kit</span>{" "}
              <span className="text-sm font-normal">
                ZIP · {fichiersArchive.length}&nbsp;fichiers · {poidsLisible(octetsZip)}
              </span>
            </Button>
          </div>

          <ul className="grid grid-cols-1 sm:grid-cols-3 gap-6 list-none" role="list">
            {declinaisonsLogo.map((d) => {
              const disponibles = d.formats.filter((f) => f.fichier !== undefined);
              const aVenir = d.formats.filter((f) => f.fichier === undefined);
              const apercu = disponibles[0];
              return (
                <li
                  key={d.id}
                  className="bg-navy border border-navy-lighter rounded-xl p-6 flex flex-col"
                >
                  {/* La version claire s'expose sur un fond blanc : c'est
                      celui pour lequel elle est faite. */}
                  <div
                    className={`rounded-lg overflow-hidden mb-4 aspect-square flex items-center justify-center ${
                      d.fond === "clair" ? "bg-white p-3" : "bg-navy"
                    }`}
                  >
                    {apercu && (
                      <Image
                        src={`${DOSSIER_KIT}/${apercu.fichier}`}
                        alt={d.alt}
                        width={apercu.largeur}
                        height={apercu.hauteur}
                        sizes="(min-width: 640px) 33vw, 100vw"
                        className="w-full h-auto"
                      />
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">{d.titre}</h3>
                  <p className="text-sm text-gray-light leading-relaxed mb-4">{d.usage}</p>
                  <div className="mt-auto flex flex-col gap-3">
                    {disponibles.map((f) => (
                      <Button
                        key={f.fichier}
                        href={`${DOSSIER_KIT}/${f.fichier}`}
                        download
                        variant="secondary"
                        size="sm"
                        className="flex-col text-center"
                      >
                        <span>Télécharger {d.objet}</span>{" "}
                        <span className="font-normal">
                          {f.libelle} · {f.largeur} × {f.hauteur}&nbsp;px · {poidsLisible(f.octets)}
                        </span>
                      </Button>
                    ))}
                    {aVenir.length > 0 && (
                      <p className="text-sm text-gray-light">
                        À venir&nbsp;: {aVenir.map((f) => f.libelle).join(", ")}.
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Règles d'usage du logo */}
      <section className="py-16 px-4" aria-labelledby="regles-title">
        <div className="max-w-4xl mx-auto">
          <h2 id="regles-title" className="text-2xl font-bold text-center mb-3">
            Bien utiliser le <span className="text-cyan">logo</span>
          </h2>
          {/* Cadre de marque : TRADEMARK.md. Le nom et le logo restent à
              l'association ; le kit sert à parler d'elle, pas à s'en réclamer. */}
          <p className="text-gray-light text-center max-w-2xl mx-auto mb-8">
            Le logo sert à parler de Tech Speak&apos;Her ou d&apos;un événement
            commun. Pour tout autre usage,{" "}
            <LienTexte href="/contact">écrivez-nous</LienTexte>.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[
              { id: "a-faire", titre: "À faire", couleur: "text-cyan", glyphe: "✓", regles: reglesLogo.aFaire },
              { id: "a-eviter", titre: "À éviter", couleur: "text-magenta-light", glyphe: "✗", regles: reglesLogo.aEviter },
            ].map((b) => (
              <div key={b.id} className="bg-navy-light border border-navy-lighter rounded-xl p-6">
                <h3 id={`${b.id}-title`} className={`text-lg font-bold ${b.couleur} mb-4`}>
                  {b.titre}
                </h3>
                <ul className="space-y-3 list-none" role="list" aria-labelledby={`${b.id}-title`}>
                  {b.regles.map((r) => (
                    <li key={r} className="flex gap-3 text-gray-light">
                      <span aria-hidden="true" className={`${b.couleur} font-bold shrink-0`}>{b.glyphe}</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Couleurs */}
      <section className="py-16 px-4 bg-navy-light" aria-labelledby="couleurs-title">
        <div className="max-w-4xl mx-auto">
          <h2 id="couleurs-title" className="text-2xl font-bold text-center mb-3">
            Les <span className="text-cyan">couleurs</span>
          </h2>
          <p className="text-gray-light text-center max-w-2xl mx-auto mb-10">
            Le violet nuit domine, les accents restent des éclats. Un clic sur
            un code le copie.
          </p>
          <PaletteCouleurs groupes={groupesCouleurs} />
        </div>
      </section>

      {/* Typographies */}
      <section className="py-16 px-4" aria-labelledby="typos-title">
        <div className="max-w-4xl mx-auto">
          <h2 id="typos-title" className="text-2xl font-bold text-center mb-8">
            Les <span className="text-magenta">typographies</span>
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-6 list-none" role="list">
            {typosKit.map((t) => (
              <li key={t.nom} className="bg-navy-light border border-navy-lighter rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-2">{t.nom}</h3>
                <p className="text-sm text-gray-light leading-relaxed">{t.usage}</p>
              </li>
            ))}
          </ul>
          <p className="text-gray-light text-center max-w-2xl mx-auto mt-8">
            Les deux sont gratuites sur Google Fonts. Le nom Tech Speak&apos;Her
            se reprend toujours depuis le fichier du logo.
          </p>
        </div>
      </section>

      {/* Modèle de présentation */}
      <section className="py-16 px-4 bg-navy-light" aria-labelledby="modele-title">
        <div className="max-w-4xl mx-auto">
          <h2 id="modele-title" className="text-2xl font-bold text-center mb-8">
            Les <span className="text-cyan">présentations</span>
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-6 list-none" role="list">
            {modelesKit.map((m) => (
              <li
                key={m.id}
                className="bg-navy border border-navy-lighter rounded-xl p-6 flex flex-col"
              >
                <h3 className="text-lg font-bold text-white mb-2">{m.titre}</h3>
                <p className="text-sm text-gray-light leading-relaxed mb-4">{m.description}</p>
                <Button
                  href={`${DOSSIER_KIT}/${m.fichier}`}
                  download
                  variant="secondary"
                  size="sm"
                  className="flex-col text-center mt-auto self-start"
                >
                  <span>Télécharger {m.objet}</span>{" "}
                  <span className="font-normal">
                    PPTX · {m.diapositives}&nbsp;diapositives · {poidsLisible(m.octets)}
                  </span>
                </Button>
              </li>
            ))}
          </ul>
          <p className="text-gray-light text-center max-w-2xl mx-auto mt-6">
            Une question, un format qui vous manque&nbsp;?{" "}
            <LienTexte href="/contact">Écrivez-nous</LienTexte>.
          </p>
        </div>
      </section>
    </>
  );
}
