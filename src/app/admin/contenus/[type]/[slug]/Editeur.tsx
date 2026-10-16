"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import Button from "@/components/Button";
import ExternalLink from "@/components/ExternalLink";
import { MarkdownContenu } from "@/lib/markdown";
import { IDLE, type ActionState } from "@/lib/action-state";
import { inputCls } from "@/app/admin/tremplins/[edition]/styles";
import { CATEGORIES, TAGS } from "@/lib/contenu-form";
import { lienPublicContenu } from "@/lib/contenu-lien-public";
import type { Contenu } from "@/lib/contenus";
import type { EditionOption } from "@/lib/conferences";
import {
  activeMention,
  filterMentions,
  insertMention,
  type ActiveMention,
  type MentionItem,
} from "@/lib/mention";
import { updateContenuAction } from "../../actions";

const labelCls = "block text-sm font-medium text-white mb-1";
const outilCls =
  "min-h-[44px] px-3 rounded-md border border-field-border bg-navy text-sm text-white hover:border-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan";

/**
 * Éditeur d'un contenu (publication ou page). Champs CONTRÔLÉS : la saisie est
 * conservée telle quelle en cas d'erreur (pas de reset React 19). Le corps a une
 * barre d'outils qui insère le Markdown et un onglet « Écrire / Aperçu » (jamais
 * côte à côte — charge cognitive mobile). L'aperçu réutilise le rendu public
 * assaini (`MarkdownContenu`). Reste EN PLACE au succès (confirmation focalisée) ;
 * un renommage (changement de titre → de slug) redirige côté serveur.
 */
export default function Editeur({
  contenu,
  editions,
  mentions,
}: {
  contenu: Contenu;
  /** Éditions de conférence rattachables (répertoire) ; [] si aucune. */
  editions: EditionOption[];
  /** Speakeuses de l'annuaire publié, mentionnables par « @ » ; [] si aucune. */
  mentions: MentionItem[];
}) {
  const estPub = contenu.type === "publication";
  const estPublie = contenu.statut === "publie";
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateContenuAction,
    IDLE,
  );

  const [titre, setTitre] = useState(contenu.titre);
  const [chapo, setChapo] = useState(contenu.chapo ?? "");
  const [corps, setCorps] = useState(contenu.corps);
  const [categorie, setCategorie] = useState(contenu.categorie ?? "");
  const [tag, setTag] = useState(contenu.tag ?? "");
  const [lien, setLien] = useState(contenu.lien ?? "");
  const [lienExterne, setLienExterne] = useState(contenu.lienExterne ?? "");
  const [videoUrl, setVideoUrl] = useState(contenu.videoUrl ?? "");
  const [lienLabel, setLienLabel] = useState(contenu.lienLabel ?? "");
  const [imageUrl, setImageUrl] = useState(contenu.imageUrl ?? "");
  const [imageAlt, setImageAlt] = useState(contenu.imageAlt ?? "");
  // Taille de la photo (migration 065), mesurée ici même : elle voyage en champs
  // cachés et permettra de réserver sa place en tête d'article. "" = inconnue.
  const [imageTaille, setImageTaille] = useState<{ w: string; h: string }>({
    w: contenu.imageWidth != null ? String(contenu.imageWidth) : "",
    h: contenu.imageHeight != null ? String(contenu.imageHeight) : "",
  });
  const [imageErreur, setImageErreur] = useState<string | null>(null);
  const [imagePending, startImageTransition] = useTransition();
  const imageInputRef = useRef<HTMLInputElement>(null);
  // Annule un envoi en vol : incrémenté à chaque nouveau choix de fichier ET au
  // retrait, pour qu'une réponse tardive ne restaure pas une image qu'on vient
  // d'enlever (ou n'écrase pas un second fichier choisi entre-temps).
  const imageRequestRef = useRef(0);
  // Bloque toute soumission (Publier/Enregistrer/Repasser en brouillon) tant
  // qu'un envoi (formulaire ou image) est en cours.
  const busy = pending || imagePending;
  const [conferenceEditionId, setConferenceEditionId] = useState(
    contenu.conferenceEditionId != null ? String(contenu.conferenceEditionId) : "",
  );

  const [onglet, setOnglet] = useState<"ecrire" | "apercu">("ecrire");
  const corpsRef = useRef<HTMLTextAreaElement>(null);
  const confirmationRef = useRef<HTMLParagraphElement>(null);
  const optionActiveRef = useRef<HTMLLIElement>(null);

  // Mention @speakeuse : jeton sous le curseur + option surlignée. Les
  // suggestions se dérivent du jeton (logique pure `@/lib/mention`).
  const [mention, setMention] = useState<ActiveMention | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const suggestions = mention ? filterMentions(mentions, mention.query) : [];
  const mentionOuvert = mention !== null && suggestions.length > 0;
  const indexBorne = Math.min(mentionIndex, suggestions.length - 1);

  // L'option surlignée suit la navigation clavier : on la ramène dans la zone
  // visible de la liste défilante, sinon aria-activedescendant pointe hors écran
  // (même contrat a11y que PersonPicker).
  useEffect(() => {
    if (mentionOuvert) optionActiveRef.current?.scrollIntoView({ block: "nearest" });
  }, [indexBorne, mentionOuvert]);

  /** Réévalue le jeton de mention depuis l'état courant du textarea (valeur + curseur). */
  function syncMention() {
    const ta = corpsRef.current;
    if (ta) {
      setMention(activeMention(ta.value, ta.selectionStart));
      setMentionIndex(0);
    }
  }

  /** Insère le lien vers la fiche à la place du « @… », referme le menu, replace le curseur. */
  function choisirMention(item: MentionItem) {
    if (!mention) return;
    const { value, caret } = insertMention(corps, mention.start, mention.end, item);
    setCorps(value);
    setMention(null);
    requestAnimationFrame(() => {
      const ta = corpsRef.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(caret, caret);
    });
  }

  /** Navigation clavier du menu (quand ouvert) : flèches, Entrée/Tab, Échap. */
  function onCorpsKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!mentionOuvert) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMentionIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setMentionIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      choisirMention(suggestions[indexBorne]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setMention(null);
    }
  }

  // Corps réellement ENREGISTRÉ (capturé à la soumission), distinct de la saisie
  // en cours : le lien « Voir » du message de succès doit pointer vers l'état
  // persisté. Sinon, taper un corps SANS réenregistrer ferait pointer le lien
  // vers /articles/... qui répond 404 tant que le corps n'est pas en base.
  const [corpsEnregistre, setCorpsEnregistre] = useState(contenu.corps);

  // Lien « Voir » après enregistrement (le slug ne change qu'à un renommage, qui
  // redirige côté serveur — donc jamais dans ce succès en place). `null` pour un
  // brouillon (pas encore de page publique).
  const lienCourant = lienPublicContenu({
    type: contenu.type,
    corps: corpsEnregistre,
    slug: contenu.slug,
    statut: contenu.statut,
  });
  const libelleVoir = !estPub
    ? "Voir la page"
    : corpsEnregistre.trim()
      ? "Voir l'article"
      : "Voir sur le site";

  // Confirmation focalisée (COGA) : on porte le focus sur le message de succès.
  useEffect(() => {
    if (state.status === "success") confirmationRef.current?.focus();
  }, [state]);

  /**
   * Insère du Markdown autour de la sélection courante du corps. Si le champ
   * n'a jamais reçu le focus (curseur non placé), on insère À LA FIN plutôt
   * qu'en position 0 — sinon un clic sur un bouton insérait tout en haut.
   * (Les boutons font `preventDefault` au mousedown pour NE PAS voler le focus,
   * donc le curseur reste où il était.)
   */
  function inserer(avant: string, apres: string, placeholder: string) {
    const ta = corpsRef.current;
    if (!ta) return;
    const focusDansChamp = typeof document !== "undefined" && document.activeElement === ta;
    const debut = focusDansChamp ? ta.selectionStart : corps.length;
    const fin = focusDansChamp ? ta.selectionEnd : corps.length;
    const selection = corps.slice(debut, fin) || placeholder;
    const suivant = corps.slice(0, debut) + avant + selection + apres + corps.slice(fin);
    setCorps(suivant);
    setMention(null); // une insertion via la barre d'outils referme un menu @ éventuel.
    requestAnimationFrame(() => {
      ta.focus();
      const pos = debut + avant.length;
      ta.setSelectionRange(pos, pos + selection.length);
    });
  }

  /**
   * Mesure la photo choisie, ICI, avant l'envoi : c'est le navigateur qui sait
   * décoder les quatre formats acceptés (PNG, JPEG, WebP, AVIF), et écrire
   * quatre analyseurs binaires côté serveur pour la même réponse serait
   * fragile — celui d'AVIF (conteneur ISO BMFF) tout particulièrement.
   *
   * Une taille INCONNUE est un état prévu de bout en bout : si le décodage
   * échoue, la photo part quand même, et l'article se replie sur l'affichage
   * d'avant (proportion naturelle, sans place réservée).
   */
  async function mesurer(file: File): Promise<{ w: string; h: string }> {
    try {
      // `from-image` explicitement : une photo prise au téléphone porte souvent
      // une rotation en EXIF (4032×3024 dans le fichier, 3024×4032 à l'écran).
      // Selon la version du navigateur, le défaut ignore cette rotation — on
      // enregistrerait alors des dimensions inversées, et la proportion
      // réservée déformerait la photo au lieu de lui garder sa place.
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      const taille = { w: String(bitmap.width), h: String(bitmap.height) };
      bitmap.close();
      return taille;
    } catch {
      return { w: "", h: "" };
    }
  }

  /**
   * Dépose l'image choisie (lot 6, `/api/admin/contenus/image`) : appel direct
   * hors du formulaire principal, pour que l'image soit déjà en ligne quand on
   * enregistre/publie. L'URL renvoyée alimente le champ caché `imageUrl`.
   * Route API (pas une Server Action) : cf. commentaire de la route.
   */
  function onChangeImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Vide le champ AUSSITÔT le fichier récupéré : sans ça, rechoisir LE MÊME
    // fichier après un échec ne déclenche aucun `change` (valeur inchangée),
    // et le réessai semble mort. L'envoi, lui, part de l'objet `file` déjà en
    // main — le champ n'est plus relu.
    e.target.value = "";
    setImageErreur(null);
    const requeteId = ++imageRequestRef.current;
    startImageTransition(async () => {
      const fd = new FormData();
      fd.set("file", file);
      // Mesure et dépôt en parallèle : la mesure est locale, elle n'a aucune
      // raison d'attendre le réseau.
      const [taille, res] = await Promise.all([
        mesurer(file),
        fetch("/api/admin/contenus/image", { method: "POST", body: fd }),
      ]);
      const result: { url: string } | { error: string } = await res.json();
      // Une réponse pour une requête annulée entre-temps (retrait, ou un autre
      // fichier choisi juste après) ne doit plus rien écrire.
      if (imageRequestRef.current !== requeteId) return;
      if ("error" in result) {
        setImageErreur(result.error);
        return;
      }
      // Ensemble, toujours : l'URL et sa taille décrivent LA MÊME photo.
      setImageUrl(result.url);
      setImageTaille(taille);
    });
  }

  /** Retrait réversible (palier 1) : un nouveau choix de fichier reprend la main. */
  function retirerImage() {
    imageRequestRef.current++; // annule un envoi en vol
    setImageUrl("");
    setImageAlt("");
    setImageTaille({ w: "", h: "" });
    setImageErreur(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  // Données seules (pas de closure lisant un ref pendant le rendu) ; l'insertion
  // est déclenchée dans le onClick, hors rendu (règle react-hooks/refs).
  const outils = [
    { label: "Titre", titre: "Titre de section", avant: "\n## ", apres: "", ph: "Titre" },
    { label: "Sous-titre", titre: "Sous-titre", avant: "\n### ", apres: "", ph: "Sous-titre" },
    { label: "Gras", titre: "Mettre en gras", avant: "**", apres: "**", ph: "texte" },
    { label: "Lien", titre: "Lien vers un site externe (https://…)", avant: "[", apres: "](https://)", ph: "texte du lien" },
    { label: "Lien interne", titre: "Lien vers une page du site (ex. /tremplin)", avant: "[", apres: "](/)", ph: "texte du lien" },
    { label: "Liste", titre: "Élément de liste", avant: "\n- ", apres: "", ph: "élément" },
    { label: "Image", titre: "Insérer une image", avant: "\n![", apres: "](https://)", ph: "description de l'image" },
  ] as const;

  return (
    <form
      action={formAction}
      // Capture le corps SOUMIS : le lien « Voir » du succès reflétera l'état
      // enregistré, pas une saisie ultérieure laissée en attente.
      onSubmit={() => setCorpsEnregistre(corps)}
      className="flex flex-col gap-5"
    >
      <input type="hidden" name="contenuId" value={contenu.id} />
      <input type="hidden" name="type" value={contenu.type} />
      <input type="hidden" name="slug" value={contenu.slug} />

      <div>
        <label htmlFor="titre" className={labelCls}>
          Titre
        </label>
        <input
          id="titre"
          name="titre"
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
          required
          className={inputCls}
        />
        <p className="mt-1 text-xs text-gray-light">
          Changer le titre change l&apos;adresse de la page (tu seras redirigée).
        </p>
      </div>

      <div>
        <label htmlFor="chapo" className={labelCls}>
          {estPub ? "Chapô (accroche)" : "Résumé"}
        </label>
        <textarea
          id="chapo"
          name="chapo"
          value={chapo}
          onChange={(e) => setChapo(e.target.value)}
          rows={3}
          className={inputCls}
        />
        <p className="mt-1 text-xs text-gray-light">
          {estPub
            ? "Affiché sur la carte, dans le flux RSS et sur LinkedIn, et pour le référencement."
            : "Court résumé utilisé pour le référencement."}
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between gap-3 mb-1">
          <span className={labelCls} id="corps-label">
            Contenu
          </span>
          <div className="flex gap-1" role="tablist" aria-label="Mode d'édition">
            <button
              type="button"
              role="tab"
              aria-selected={onglet === "ecrire"}
              onClick={() => setOnglet("ecrire")}
              className={`min-h-[44px] px-3 rounded-md text-sm ${onglet === "ecrire" ? "bg-cyan text-navy font-semibold" : "text-gray-light hover:text-white"}`}
            >
              Écrire
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={onglet === "apercu"}
              onClick={() => setOnglet("apercu")}
              className={`min-h-[44px] px-3 rounded-md text-sm ${onglet === "apercu" ? "bg-cyan text-navy font-semibold" : "text-gray-light hover:text-white"}`}
            >
              Aperçu
            </button>
          </div>
        </div>

        {onglet === "ecrire" ? (
          <>
            <div className="flex flex-wrap gap-1 mb-2" role="toolbar" aria-label="Mise en forme">
              {outils.map((o) => (
                <button
                  key={o.label}
                  type="button"
                  title={o.titre}
                  // Empêche le bouton de voler le focus du champ : le curseur
                  // reste en place, l'insertion se fait au bon endroit (pas en haut).
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => inserer(o.avant, o.apres, o.ph)}
                  className={outilCls}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <div className="relative">
              <textarea
                ref={corpsRef}
                id="corps"
                name="corps"
                aria-labelledby="corps-label"
                value={corps}
                onChange={(e) => {
                  setCorps(e.target.value);
                  syncMention();
                }}
                // Le curseur bouge (flèches, clic) sans changer la valeur : on
                // réévalue le jeton @ pour ouvrir/fermer le menu au bon endroit.
                onSelect={syncMention}
                onKeyDown={onCorpsKeyDown}
                onBlur={() => setMention(null)}
                rows={16}
                className={`${inputCls} font-mono`}
                placeholder={estPub ? "Rédige ton article ici (facultatif pour une simple annonce)…" : "Rédige la page ici…"}
                aria-autocomplete="list"
                aria-controls={mentionOuvert ? "mention-listbox" : undefined}
                aria-activedescendant={mentionOuvert ? `mention-opt-${indexBorne}` : undefined}
              />
              {mentionOuvert && (
                <ul
                  id="mention-listbox"
                  role="listbox"
                  aria-label="Speakeuses de l'annuaire"
                  className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-lg border border-navy-lighter bg-navy-light shadow-sticky list-none"
                >
                  {suggestions.map((s, idx) => (
                    <li
                      key={s.href}
                      id={`mention-opt-${idx}`}
                      ref={idx === indexBorne ? optionActiveRef : undefined}
                      role="option"
                      aria-selected={idx === indexBorne}
                      // mousedown avant le blur : on choisit sans que le textarea
                      // perde le focus et referme le menu avant le clic.
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => choisirMention(s)}
                      className={`cursor-pointer px-3 py-2 text-sm border-l-2 ${
                        idx === indexBorne
                          ? "bg-navy-lighter border-cyan font-medium text-white"
                          : "border-transparent text-white hover:bg-navy-lighter"
                      }`}
                    >
                      {s.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-light">
              Mise en forme Markdown. «&nbsp;Titre&nbsp;» = titre de section,
              «&nbsp;Sous-titre&nbsp;» = niveau en dessous. «&nbsp;Lien&nbsp;»
              ouvre un site externe, «&nbsp;Lien interne&nbsp;» mène vers une page
              du site (ex. /tremplin). Laisse le corps vide pour une simple
              annonce qui pointe vers un lien.
              {mentions.length > 0 && " Tape « @ » pour lier une speakeuse de l'annuaire."}
            </p>
          </>
        ) : (
          <div className="rounded-lg border border-navy-lighter bg-navy p-4 min-h-[10rem]">
            {corps.trim() ? (
              <MarkdownContenu corps={corps} />
            ) : (
              <p className="text-sm text-gray-light">Rien à prévisualiser pour le moment.</p>
            )}
          </div>
        )}
      </div>

      {/* Le bloc image regroupe plusieurs commandes (choisir, texte alternatif,
          retirer) : il porte donc un nom accessible commun, sinon « Image » ne
          serait plus qu'un mot posé au-dessus, rattaché à rien. */}
      <div role="group" aria-labelledby="image-label">
        <span className={labelCls} id="image-label">
          Image
        </span>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          {imageUrl && (
            // L'aperçu doit permettre de RECONNAÎTRE le visuel avant
            // d'enregistrer : entier (nos images sont des cartes à lire, un
            // carré recadré les décapite) et assez large pour être lisible sur
            // un téléphone. Le lien l'ouvre en taille réelle pour la vérification
            // fine (nouvel onglet).
            <ExternalLink
              href={imageUrl}
              aria-label="Voir la photo en grand"
              className="block w-40 shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- aperçu d'un upload tout juste déposé, URL non connue à la compilation (pas de next/image ici) */}
              <img
                src={imageUrl}
                alt=""
                className="w-full h-auto rounded-md border border-navy-lighter hover:border-cyan"
              />
            </ExternalLink>
          )}
          <div className="flex-1">
            {/* Le champ natif annonce « aucun fichier sélectionné » même quand
                l'article EST illustré : il parle du fichier en attente d'envoi,
                pas de la photo en place — ce que personne ne lit ainsi (retour
                de Cateline). On masque donc son libellé natif et on porte
                l'intitulé nous-mêmes, en disant l'état réel. Le champ reste un
                vrai `input` (focusable, au clavier) : `sr-only`, pas `hidden`. */}
            <input
              id="image-fichier"
              ref={imageInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/avif"
              onChange={onChangeImage}
              disabled={imagePending}
              aria-describedby="image-aide"
              className="sr-only peer"
            />
            <label
              htmlFor="image-fichier"
              className={`${outilCls} inline-flex cursor-pointer items-center peer-focus-visible:ring-2 peer-focus-visible:ring-cyan peer-disabled:cursor-default peer-disabled:opacity-60`}
            >
              {imageUrl ? "Remplacer la photo" : "Choisir une photo"}
            </label>
            {imagePending && (
              <p role="status" className="mt-1 text-sm text-gray-light">
                Envoi de l&apos;image…
              </p>
            )}
            {imageErreur && (
              <p role="alert" className="mt-1 text-sm text-orange">
                {imageErreur}
              </p>
            )}
            {imageUrl && (
              <>
                <div className="mt-2">
                  <label htmlFor="imageAlt" className={labelCls}>
                    Texte alternatif
                  </label>
                  <input
                    id="imageAlt"
                    name="imageAlt"
                    value={imageAlt}
                    onChange={(e) => setImageAlt(e.target.value)}
                    required
                    className={inputCls}
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={retirerImage}
                  className="mt-2 min-h-[44px]"
                >
                  Retirer l&apos;image
                </Button>
              </>
            )}
            <input type="hidden" name="imageUrl" value={imageUrl} />
            <input type="hidden" name="imageWidth" value={imageTaille.w} />
            <input type="hidden" name="imageHeight" value={imageTaille.h} />
            <p id="image-aide" className="mt-1 text-xs text-gray-light">
              PNG, JPEG, WebP ou AVIF, 4&nbsp;Mo maximum. Affichée sur la carte,
              dans le partage sur les réseaux et pour le référencement.
            </p>
          </div>
        </div>
      </div>

      {estPub && (
        <fieldset className="flex flex-col gap-5 border-t border-navy-lighter pt-5">
          <legend className="text-xs font-bold uppercase tracking-wider text-gray-light">
            Réglages de l&apos;actualité
          </legend>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="categorie" className={labelCls}>
                Catégorie
              </label>
              <select
                id="categorie"
                name="categorie"
                value={categorie}
                onChange={(e) => setCategorie(e.target.value)}
                className={inputCls}
              >
                <option value="">Aucune</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="tag" className={labelCls}>
                Temporalité
              </label>
              <select
                id="tag"
                name="tag"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                className={inputCls}
              >
                <option value="">Aucune</option>
                {TAGS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="conferenceEditionId" className={labelCls}>
              Conférence rattachée (optionnel)
            </label>
            <select
              id="conferenceEditionId"
              name="conferenceEditionId"
              value={conferenceEditionId}
              onChange={(e) => setConferenceEditionId(e.target.value)}
              className={inputCls}
            >
              <option value="">Aucune</option>
              {editions.map((ed) => (
                <option key={ed.id} value={ed.id}>
                  {ed.libelle}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-light">
              L&apos;article listera alors les speakeuses de l&apos;annuaire ayant un
              talk sur cette édition (mis à jour tout seul quand une speakeuse
              rattache son talk).
            </p>
          </div>

          <div>
            <label htmlFor="videoUrl" className={labelCls}>
              Vidéo de l&apos;article (optionnel)
            </label>
            <input
              id="videoUrl"
              name="videoUrl"
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://youtu.be/…"
              aria-describedby="videoUrl-aide"
              className={inputCls}
            />
            <p id="videoUrl-aide" className="mt-1 text-xs text-gray-light">
              Le lien de la vidéo sur notre chaîne YouTube. Elle s&apos;affiche en
              haut de l&apos;article, avec sa miniature&nbsp;: on choisit de lire ou
              de regarder. La miniature vient de YouTube toute seule.
            </p>
          </div>

          <div>
            <label htmlFor="lienExterne" className={labelCls}>
              Lien externe (optionnel)
            </label>
            <input
              id="lienExterne"
              name="lienExterne"
              type="url"
              value={lienExterne}
              onChange={(e) => setLienExterne(e.target.value)}
              placeholder="https://…"
              className={inputCls}
            />
            <p className="mt-1 text-xs text-gray-light">
              Sur une annonce sans corps, la carte mène directement vers ce lien.
              Sur un article, il devient un bouton en bas de page.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="lienLabel" className={labelCls}>
                Libellé du lien (optionnel)
              </label>
              <input
                id="lienLabel"
                name="lienLabel"
                value={lienLabel}
                onChange={(e) => setLienLabel(e.target.value)}
                placeholder="Ex. Voir sur Meetup"
                className={inputCls}
              />
              <p className="mt-1 text-xs text-gray-light">
                Texte du bouton en bas d&apos;article (sinon «&nbsp;En savoir plus&nbsp;»).
              </p>
            </div>
            <div>
              <label htmlFor="lien" className={labelCls}>
                Lien interne (optionnel)
              </label>
              <input
                id="lien"
                name="lien"
                value={lien}
                onChange={(e) => setLien(e.target.value)}
                placeholder="Ex. /tremplin"
                className={inputCls}
              />
            </div>
          </div>
        </fieldset>
      )}

      {state.status === "error" && (
        <p role="alert" className="text-sm text-orange">
          {state.error}
        </p>
      )}
      {state.status === "success" && (
        <div role="status" className="text-sm text-cyan">
          <p ref={confirmationRef} tabIndex={-1} className="focus-visible:outline-none">
            « {titre} » est enregistré.
          </p>
          {/* Voir le résultat sans quitter l'édition (lien vers l'état
              enregistré, cf. `corpsEnregistre`). Absent pour un brouillon. */}
          {lienCourant && (
            <Link
              href={lienCourant}
              className="mt-1 inline-flex items-center gap-1 underline underline-offset-2 hover:text-cyan-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded"
            >
              {libelleVoir} <span aria-hidden="true">→</span>
            </Link>
          )}
        </div>
      )}

      {/* CTA du bas (sans remonter) : le geste principal est en tête. Brouillon →
          « Publier » ; publié → « Enregistrer ». Chaque bouton porte son intention
          (multi-soumission d'un même form), l'action enregistre TOUJOURS d'abord. */}
      <div className="barre-action-collante -mx-4 flex flex-wrap gap-3 border-t border-navy-lighter bg-navy/95 px-4 py-3 backdrop-blur">
        {/* `busy` inclut l'envoi d'image : sinon la publication enregistrerait
            le contenu SANS l'image (le champ caché `imageUrl` n'a pas encore
            la nouvelle valeur), sans qu'aucune erreur ne le signale. */}
        {estPublie ? (
          <>
            <Button type="submit" name="intention" value="enregistrer" variant="primary" disabled={busy} className="min-h-[44px]">
              {pending ? "Enregistrement…" : "Enregistrer"}
            </Button>
            <Button type="submit" name="intention" value="depublier" variant="secondary" disabled={busy} className="min-h-[44px]">
              Repasser en brouillon
            </Button>
          </>
        ) : (
          <>
            <Button type="submit" name="intention" value="publier" variant="primary" disabled={busy} className="min-h-[44px]">
              {pending ? "Publication…" : "Publier"}
            </Button>
            <Button type="submit" name="intention" value="enregistrer" variant="secondary" disabled={busy} className="min-h-[44px]">
              Enregistrer le brouillon
            </Button>
          </>
        )}
      </div>
    </form>
  );
}
