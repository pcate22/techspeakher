"use client";

import { useRef, useState } from "react";
import CheckboxGrid, { checkboxClass } from "@/components/CheckboxGrid";
import ChampTexte, {
  inputClass,
  labelClass,
  errorClass,
} from "@/components/ChampTexte";
import { moissonnageConsenti } from "@/lib/cfp-consentement";
import MoissonneurExplainer from "@/components/MoissonneurExplainer";
import ChampPhoto from "./ChampPhoto";
import VilleField from "./VilleField";
import type { SpeakerProfile } from "@/lib/profiles";
import {
  SECTEURS,
  SUJETS,
  REGIONS,
  LANGUES,
  REGIONS_METROPOLE,
  REGION_TOUTE_LA_FRANCE,
} from "@/data/domaines";
import { BASE_URL } from "@/constants/site";
import { slugify } from "@/lib/slug";
import { BIO_MAX, SHORT_MAX } from "@/lib/profile-limits";

/**
 * Les CHAMPS de chaque section de la fiche, un composant par section — source
 * UNIQUE (lot I).
 *
 * Ils étaient inlinés dans `ProfileForm`, qui les rendait tous d'un coup en six
 * panneaux masqués. La fiche s'éditant maintenant section par section, les
 * mêmes champs doivent s'afficher à deux endroits : dans l'assistant de
 * CRÉATION (qui les enchaîne) et sur la page d'UNE section (qui n'en rend
 * qu'un). Recopiés, les deux auraient dérivé — sur un placeholder, puis sur un
 * `aria-describedby`.
 *
 * Le découpage suit `SECTIONS_PROFIL` (`src/lib/profil-sections.ts`), et pas
 * l'ancien découpage en étapes : c'est le registre qui borne l'enregistrement
 * partiel, donc c'est lui qui dit ce qu'une page a le droit d'afficher. D'où le
 * seul déplacement visible : la VILLE (où tu es basée) rejoint « Qui tu es »,
 * là où l'assistant la mettait avec les zones d'intervention — deux questions
 * différentes, comme le disait déjà le registre.
 */

export type ErreursChamps = Record<string, string> | undefined;

/** Préfixe affiché devant le slug (l'hôte, sans le schéma). */
const FICHE_URL_PREFIX = `${BASE_URL.replace(/^https?:\/\//, "")}/speakeuses/`;

export function ChampsIdentite({
  initial,
  nom = "",
  avatarCompte = null,
  linkedinLie = false,
  erreurs,
}: {
  initial: SpeakerProfile | null;
  nom?: string;
  /** Photo du COMPTE, pour seeder le champ Photo quand `initial` (donc
   * `initial.image`) n'existe pas encore (création). */
  avatarCompte?: string | null;
  /** LinkedIn rattaché au compte : la reprise de photo n'a de sens que là. */
  linkedinLie?: boolean;
  erreurs: ErreursChamps;
}) {
  // Aperçu live de l'URL de fiche (miroir non contrôlé du champ « Adresse »).
  const [slugPreview, setSlugPreview] = useState(initial?.slug ?? "");
  // Bio contrôlée : le compteur suit la frappe (`maxLength` tronque en silence).
  const [bio, setBio] = useState(initial?.bio ?? "");

  return (
    <>
      {/* La photo est un champ à part entière (`ChampPhoto`) : elle a deux
          façons d'être remplie, ses propres messages, et elle s'enregistre
          seule — la garder inline ici mélangeait tout ça au reste de la
          section. */}
      <ChampPhoto
        nom={nom}
        imageInitiale={initial?.image ?? avatarCompte}
        linkedinLie={linkedinLie}
      />
      {/* Un seul champ obligatoire ici : on le MARQUE, plutôt que d'écrire
          « (optionnel) » sur les cinq autres (bruit gris répété).
          `maxLength` : nom du COMPTE, borné sur `users.name` (VARCHAR(255)) et
          pas sur la limite des champs de fiche — un nom long reste légitime. */}
      <ChampTexte
        id="nomComplet"
        name="nomComplet"
        label="Prénom et nom"
        required
        autoComplete="name"
        maxLength={255}
        defaultValue={nom}
        placeholder="Ex. Ada Lovelace"
        error={erreurs?.nomComplet}
      />
      <div>
        <label htmlFor="slug" className={labelClass}>
          Adresse de ta fiche
        </label>
        {/* Champ pleine largeur (lisible sur mobile), avec l'URL complète en
            aperçu dessous — plutôt qu'un préfixe en ligne qui rognait la
            largeur. Vide → l'adresse est dérivée du nom côté serveur ; une
            adresse déjà prise revient en erreur ici. */}
        <input
          id="slug"
          name="slug"
          inputMode="url"
          aria-invalid={erreurs?.slug ? true : undefined}
          aria-describedby={erreurs?.slug ? "err-slug" : "hint-slug"}
          defaultValue={initial?.slug ?? ""}
          onChange={(e) => setSlugPreview(e.target.value)}
          placeholder={slugify(nom) || "prenom-nom"}
          className={inputClass}
        />
        {erreurs?.slug ? (
          <p id="err-slug" role="alert" className={errorClass}>
            {erreurs.slug}
          </p>
        ) : (
          <p id="hint-slug" className="text-xs text-gray-light mt-1">
            Ton adresse à partager&nbsp;:{" "}
            <span className="text-white break-all">
              {FICHE_URL_PREFIX}
              {slugify(slugPreview) || slugify(nom) || "prenom-nom"}
            </span>
          </p>
        )}
      </div>
      {/* Ces trois valeurs dépassent souvent la largeur d'un téléphone : sur
          une seule ligne, « Titre de profil » s'arrêtait à « …se r » alors que
          la fiche publique l'affiche en entier. Elles se rendent donc sur
          plusieurs lignes (§ ChampTexte `lignes`). */}
      <ChampTexte
        id="titreProfil"
        name="titreProfil"
        label="Titre de profil"
        multiligne
        maxLength={SHORT_MAX}
        placeholder="Ex. Spécialiste IA & monde physique"
        defaultValue={initial?.titreProfil}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ChampTexte
          id="poste"
          name="poste"
          label="Poste actuel"
          multiligne
          maxLength={SHORT_MAX}
          defaultValue={initial?.poste}
        />
        <ChampTexte
          id="entreprise"
          name="entreprise"
          label="Entreprise actuelle"
          multiligne
          maxLength={SHORT_MAX}
          defaultValue={initial?.entreprise}
        />
      </div>
      <VilleField
        champs={{
          ville: "ville",
          codePostal: "codePostal",
          codeInsee: "codeInsee",
          region: "regionResidence",
        }}
        label={
          <>
            Ville <span className="text-gray-light">(où tu es basée)</span>
          </>
        }
        defaultVille={initial?.ville}
        defaultCodePostal={initial?.codePostal}
        defaultCodeInsee={initial?.codeInsee}
        defaultRegion={initial?.regionResidence}
        error={erreurs?.ville}
      />
      <div>
        <label htmlFor="bio" className={labelClass}>
          Bio
        </label>
        {/* Les bios sont écrites par les speakeuses : on agit ICI, à la saisie,
            plutôt qu'en relisant des textes déjà publiés. Beaucoup y glissent
            leur offre (« elle accompagne les transformations… »), ce
            qui fait lire l'annuaire comme un catalogue de prestataires — le
            genre de signal qui coûte l'éligibilité à Google Ad Grants, et qui
            ne rend service à personne. Une phrase d'aide oriente vers le
            parcours. Voir docs/google-ad-grants.md. */}
        <p id="aide-bio" className="text-xs text-gray-light mb-2">
          Ton parcours, ce qui t&apos;a menée à la scène, ce dont tu aimes
          parler. C&apos;est une présentation de toi&nbsp;; ton offre de
          services a sa place sur ton site.
        </p>
        {/* Champ le plus lu de la fiche : 6 lignes (comme la description d'un
            talk), borné à la limite serveur, avec un compteur vivant —
            `maxLength` tronque la frappe en silence, on montre donc où on en
            est. Le dimensionnement sur le contenu attend la migration vers
            `ChampTexte` (dette : la primitive masque `hint` quand `error` est
            là, le compteur disparaîtrait pile sur « trop long »). */}
        <textarea
          id="bio"
          name="bio"
          rows={6}
          maxLength={BIO_MAX}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          aria-invalid={erreurs?.bio ? true : undefined}
          // L'aide reste annoncée MÊME en erreur : c'est elle qui dit quoi
          // écrire, et une erreur de longueur n'invalide pas ce conseil.
          aria-describedby={erreurs?.bio ? "aide-bio err-bio" : "aide-bio hint-bio"}
          className={`${inputClass} leading-relaxed`}
        />
        <p id="hint-bio" className="text-xs text-gray-light mt-1">
          {bio.length} / {BIO_MAX} caractères
        </p>
        {erreurs?.bio && (
          <p id="err-bio" role="alert" className={errorClass}>
            {erreurs.bio}
          </p>
        )}
      </div>
    </>
  );
}

export function ChampsSecteurs({ initial }: { initial: SpeakerProfile | null }) {
  return (
    <CheckboxGrid
      name="secteurs"
      legend="Secteurs"
      hint="ton domaine d'activité"
      options={SECTEURS}
      defaultSelected={initial?.secteurs}
    />
  );
}

export function ChampsSujets({ initial }: { initial: SpeakerProfile | null }) {
  return (
    <CheckboxGrid
      name="sujets"
      legend="Sujets / métiers"
      hint="tes thèmes tech"
      options={SUJETS}
      defaultSelected={initial?.sujets}
    />
  );
}

export function ChampsInterventions({ initial }: { initial: SpeakerProfile | null }) {
  // Régions : état contrôlé pour que « Toute la France » coche/décoche les 13
  // régions métropolitaines d'un coup. Confort de saisie uniquement : la
  // cohérence des données est garantie côté serveur (normaliserProfil).
  const [regions, setRegions] = useState<Set<string>>(
    () => new Set(initial?.regions ?? []),
  );
  // Sélection mémorisée AVANT le cochage du raccourci : décocher « Toute la
  // France » restaure les régions choisies une à une (au lieu de tout vider).
  const avantRaccourci = useRef<Set<string> | null>(null);

  function toggleRegion(region: string) {
    setRegions((prev) => {
      const next = new Set(prev);
      const checked = !next.has(region);

      if (region === REGION_TOUTE_LA_FRANCE) {
        if (checked) {
          avantRaccourci.current = new Set(prev);
          next.add(region);
          for (const m of REGIONS_METROPOLE) next.add(m);
        } else {
          const restauree = avantRaccourci.current;
          avantRaccourci.current = null;
          next.clear();
          for (const r of restauree ?? []) if (r !== REGION_TOUTE_LA_FRANCE) next.add(r);
          // Conserve les zones hors raccourci cochées entre-temps.
          for (const r of prev)
            if (
              !(REGIONS_METROPOLE as readonly string[]).includes(r) &&
              r !== REGION_TOUTE_LA_FRANCE
            )
              next.add(r);
        }
        return next;
      }

      if (checked) next.add(region);
      else next.delete(region);
      // Une modification manuelle invalide la mémoire du raccourci et ajuste
      // sa cohérence (toutes cochées → raccourci ; une décochée → plus de raccourci).
      if ((REGIONS_METROPOLE as readonly string[]).includes(region)) {
        avantRaccourci.current = null;
        if (!checked) next.delete(REGION_TOUTE_LA_FRANCE);
        else if (REGIONS_METROPOLE.every((m) => next.has(m)))
          next.add(REGION_TOUTE_LA_FRANCE);
      }
      return next;
    });
  }

  return (
    <>
      <CheckboxGrid
        name="regions"
        legend="Où tu interviens"
        options={REGIONS.filter((r) => r !== REGION_TOUTE_LA_FRANCE)}
        selected={regions}
        onToggle={toggleRegion}
      >
        {/* Raccourci mis en avant, expliqué (et annoncé) : il pilote 13 cases. */}
        <label className="flex items-start gap-2 text-sm text-white bg-navy border border-cyan/40 rounded-lg px-3 py-2 cursor-pointer hover:border-cyan mb-2">
          <input
            type="checkbox"
            name="regions"
            value={REGION_TOUTE_LA_FRANCE}
            checked={regions.has(REGION_TOUTE_LA_FRANCE)}
            onChange={() => toggleRegion(REGION_TOUTE_LA_FRANCE)}
            aria-describedby="hint-toute-la-france"
            className={checkboxClass}
          />
          <span>
            {REGION_TOUTE_LA_FRANCE}
            <span id="hint-toute-la-france" className="block text-xs text-gray-light">
              Coche les 13 régions d&apos;un coup. Décocher restaure ta sélection
              précédente.
            </span>
          </span>
        </label>
        <p role="status" className="sr-only">
          {regions.size} zone{regions.size > 1 ? "s" : ""} d&apos;intervention
          sélectionnée{regions.size > 1 ? "s" : ""}
        </p>
      </CheckboxGrid>

      <CheckboxGrid
        name="langues"
        legend="Langues"
        options={LANGUES}
        defaultSelected={initial?.langues}
      />
    </>
  );
}

export function ChampsContact({
  initial,
  erreurs,
}: {
  initial: SpeakerProfile | null;
  erreurs: ErreursChamps;
}) {
  return (
    <>
      <div>
        {/* h2 : la page hôte pose le h1 et rien ne s'intercale — en h3, le
            plan de la page sautait un niveau (RGAA 9.1 / WCAG 1.3.1), sur la
            sous-page « Où te trouver » comme à l'étape 4 de la création. */}
        <h2 className="text-base font-bold text-white">Comment on te contacte</h2>
        <p className="text-sm text-gray-light mt-1">
          Choisis comment les organisateurs peuvent te joindre : ton profil
          LinkedIn et/ou un message par e-mail. Il en faut au moins un pour
          figurer dans l&apos;annuaire.
        </p>
      </div>
      <ChampTexte
        id="linkedin"
        name="linkedin"
        label="LinkedIn"
        inputMode="url"
        placeholder="linkedin.com/in/…"
        defaultValue={initial?.linkedin}
        error={erreurs?.linkedin}
      />
      <fieldset className="bg-navy border border-field-border rounded-lg p-4">
        <legend className="text-sm text-gray-light px-1">Contact par e-mail</legend>
        <label className="flex items-start gap-3 text-sm text-white cursor-pointer">
          <input
            type="checkbox"
            name="contactEmailOk"
            defaultChecked={initial?.contactEmailOk ?? false}
            className="mt-0.5 accent-cyan"
          />
          <span>
            J&apos;accepte d&apos;être contactée par e-mail.
            <span className="block text-xs text-gray-light">
              Ton adresse n&apos;est jamais affichée : chaque message est
              d&apos;abord vérifié par l&apos;équipe Tech Speak&apos;Her avant de
              t&apos;être transmis.
            </span>
          </span>
        </label>
      </fieldset>
      <div className="border-t border-field-border pt-4">
        <p className="text-sm text-gray-light mb-3">Autres liens</p>
        <div className="flex flex-col gap-4">
          <ChampTexte
            id="website"
            name="website"
            label="Site web"
            inputMode="url"
            placeholder="exemple.com"
            defaultValue={initial?.website}
            error={erreurs?.website}
          />
          <ChampTexte
            id="instagram"
            name="instagram"
            label="Instagram"
            inputMode="url"
            placeholder="instagram.com/…"
            defaultValue={initial?.instagram}
            error={erreurs?.instagram}
          />
          <ChampTexte
            id="sessionizeUrl"
            name="sessionizeUrl"
            label="Sessionize"
            inputMode="url"
            placeholder="sessionize.com/…"
            defaultValue={initial?.sessionizeUrl}
            error={erreurs?.sessionizeUrl}
          />
          <ChampTexte
            id="conferenceHallUrl"
            name="conferenceHallUrl"
            label="Conference Hall"
            inputMode="url"
            placeholder="conference-hall.io/…"
            defaultValue={initial?.conferenceHallUrl}
            error={erreurs?.conferenceHallUrl}
          />
          <fieldset className="bg-navy border border-field-border rounded-lg p-4">
            <legend className="text-sm text-gray-light px-1">
              Talks repérés automatiquement
            </legend>
            <label className="flex items-start gap-3 text-sm text-white cursor-pointer">
              <input
                type="checkbox"
                name="cfpSuggestionsOk"
                defaultChecked={initial ? moissonnageConsenti(initial.cfpSyncMode) : true}
                className="mt-0.5 accent-cyan"
              />
              <span>
                Propose-moi les talks trouvés à mon nom dans les programmes
                publics des conférences.
                <span className="block text-xs text-gray-light">
                  Chaque proposition attend ton accord : tu la confirmes ou tu
                  l&apos;écartes. Décoche pour arrêter les propositions.
                </span>
              </span>
            </label>
            <MoissonneurExplainer className="mt-4" />
          </fieldset>
        </div>
      </div>
    </>
  );
}

/**
 * L'attestation ne s'affiche nulle part sur la fiche publique, mais elle
 * s'édite : elle conditionne la présence dans l'annuaire, et une fiche qui la
 * perdrait n'aurait aucun écran pour la retrouver.
 */
export function ChampsAttestation({ initial }: { initial: SpeakerProfile | null }) {
  return (
    <fieldset className="bg-navy border border-field-border rounded-lg p-4">
      <legend className="text-sm text-gray-light px-1">Attestation</legend>
      <label className="flex items-start gap-3 text-sm text-white cursor-pointer">
        {/* Champ `isWoman` conservé (contrat BDD + garde serveur) : il atteste
            l'appartenance à la communauté, femmes ET personnes non binaires. Le
            libellé affiché est la source de vérité du sens. */}
        <input
          type="checkbox"
          name="isWoman"
          defaultChecked={initial?.isWoman ?? false}
          className="mt-0.5 accent-cyan"
        />
        <span>
          J&apos;atteste être une femme ou une personne non binaire.
          <span className="block text-xs text-gray-light">
            Tech Speak&apos;Her est une communauté de femmes de la tech&nbsp;:
            c&apos;est requis pour figurer dans l&apos;annuaire.
          </span>
        </span>
      </label>
    </fieldset>
  );
}

/** Les champs d'une section, choisis par sa clé. */
export function ChampsDeSection({
  cle,
  initial,
  nom,
  linkedinLie = false,
  erreurs,
}: {
  cle: string;
  initial: SpeakerProfile | null;
  nom?: string;
  linkedinLie?: boolean;
  erreurs: ErreursChamps;
}) {
  if (cle === "identite")
    return (
      <ChampsIdentite
        initial={initial}
        nom={nom}
        linkedinLie={linkedinLie}
        erreurs={erreurs}
      />
    );
  if (cle === "secteurs") return <ChampsSecteurs initial={initial} />;
  if (cle === "sujets") return <ChampsSujets initial={initial} />;
  if (cle === "interventions") return <ChampsInterventions initial={initial} />;
  if (cle === "attestation") return <ChampsAttestation initial={initial} />;
  return <ChampsContact initial={initial} erreurs={erreurs} />;
}
