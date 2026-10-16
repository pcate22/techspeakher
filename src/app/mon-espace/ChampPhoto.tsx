"use client";

import { useRef, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import Avatar from "@/components/Avatar";
import Button from "@/components/Button";
import { labelClass, errorClass } from "@/components/ChampTexte";
import { reprendrePhotoLinkedInAction, reconnecterLinkedInAction } from "./actions";

/**
 * LE champ Photo — la seule surface où l'on choisit sa photo de profil.
 *
 * Elle se choisissait jusqu'ici à DEUX endroits : ici (envoi d'un fichier) et
 * sur « Mes connexions », où un bouton « Utiliser cette photo » par provider
 * relançait une connexion OAuth complète pour un simple avatar. La photo
 * appartient au profil, pas aux moyens de connexion : les deux façons de la
 * remplir sont donc réunies ici, côte à côte, sous le même aperçu.
 *
 * Les deux chemins finissent pareil : une photo déposée chez nous
 * (`avatars/…`), écrite sur `users.image` — celle de la fiche publique ET
 * l'avatar affiché partout sur le site. La reprise LinkedIn COPIE la photo au
 * lieu d'en garder l'URL : les adresses `media.licdn.com` sont signées et
 * expirent, ce qui faisait retomber l'avatar sur les initiales des semaines
 * plus tard.
 *
 * Dépôt IMMÉDIAT, indépendant du « Enregistrer » de la section : d'où le
 * `stopPropagation` (sans lui, la garde de sortie s'armerait pour une photo
 * déjà enregistrée) et les boutons en `type="button"` (sans quoi ils
 * soumettraient le formulaire qui les entoure).
 */

/** `reconnexion` est un ton à part : la seule issue qui fait QUITTER le site.
 * Elle s'annonce, avec son bouton, plutôt que de se produire au clic sur
 * « Reprendre ». */
type Message = { ton: "info" | "erreur" | "reconnexion"; texte: string };

/**
 * Ce qu'on dit d'une réponse en échec. Notre route répond en JSON (`{error}`)
 * et son message est toujours le meilleur ; mais la réponse peut aussi venir
 * de la plateforme, avant elle — un 413 quand le fichier dépasse la taille de
 * corps autorisée, une page d'erreur en HTML — auquel cas `res.json()` lèverait
 * et la personne resterait sans rien. Le 413 est nommé : c'est le seul cas où
 * elle peut agir (envoyer une photo plus légère).
 */
async function messageDEchec(res: Response): Promise<string> {
  const json = await res.json().catch(() => null);
  const erreur = (json as { error?: unknown } | null)?.error;
  if (typeof erreur === "string" && erreur.trim()) return erreur;
  if (res.status === 413) return "Photo trop lourde pour l'envoi. Essaie une image plus légère.";
  return "L'envoi a échoué. Réessaie dans un instant.";
}

export default function ChampPhoto({
  nom,
  imageInitiale,
  linkedinLie,
}: {
  nom: string;
  imageInitiale: string | null;
  /** LinkedIn est rattaché au compte : sans ça, aucune photo à reprendre. */
  linkedinLie: boolean;
}) {
  const [photo, setPhoto] = useState(imageInitiale);
  const [message, setMessage] = useState<Message | null>(null);
  const [enCours, demarrer] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  // Où revenir après un passage par LinkedIn : la page COURANTE, lue de la
  // route elle-même. Chaque appelante passait ce chemin en prop, donc en dur
  // (trois littéraux, sur quatre niveaux de composants) — un renommage de route
  // les aurait laissés pointer dans le vide sans que rien ne le dise. Le
  // serveur borne cette valeur de toute façon (`reconnecterLinkedInAction`).
  const retour = usePathname();

  function envoyerFichier(e: React.ChangeEvent<HTMLInputElement>) {
    e.stopPropagation();
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    setMessage(null);
    demarrer(async () => {
      const fd = new FormData();
      fd.set("file", file);
      // TOUTE issue passe par un message à l'écran, y compris celles qui
      // n'arrivent jamais jusqu'à notre route : une photo de téléphone qui
      // dépasse la limite de corps de requête de la plateforme revient en 413
      // sans JSON, et le réseau qui lâche en cours d'envoi fait rejeter le
      // `fetch` lui-même. Sans ce garde, la promesse rejetait DANS la
      // transition : « Photo en cours d'enregistrement… » disparaissait sans
      // rien mettre à la place, et la section entière pouvait céder la place à
      // l'écran d'erreur — emportant la saisie en cours. C'est la faute déjà
      // corrigée côté serveur (`uploadImageDepuisUrl`), dont la moitié client
      // était restée à nu.
      let result: { url: string } | { error: string };
      try {
        const res = await fetch("/api/mon-espace/avatar", { method: "POST", body: fd });
        result = res.ok
          ? await res.json()
          : { error: await messageDEchec(res) };
      } catch {
        result = { error: "L'envoi s'est interrompu. Vérifie ta connexion et réessaie." };
      }
      if ("error" in result) {
        setMessage({ ton: "erreur", texte: result.error });
        return;
      }
      setPhoto(result.url);
      setMessage({ ton: "info", texte: "Photo enregistrée ✓" });
    });
  }

  function reprendreLinkedIn() {
    setMessage(null);
    demarrer(async () => {
      const r = await reprendrePhotoLinkedInAction();
      if (r.statut === "ok") {
        setPhoto(r.url);
        setMessage({ ton: "info", texte: "Photo LinkedIn reprise ✓" });
        return;
      }
      if (r.statut === "reconnexion") {
        setMessage({
          ton: "reconnexion",
          // Le coût est dit AVANT le départ, et il est vrai partout : sur une
          // page de section on peut enregistrer d'abord, dans l'assistant de
          // création la saisie ne tient à rien tant qu'on n'a pas fini — lui
          // conseiller « enregistre » serait un conseil impossible à suivre.
          texte:
            "LinkedIn demande une nouvelle autorisation. Tu passeras par LinkedIn puis tu reviendras ici : la saisie en cours de cette page sera à retaper.",
        });
        return;
      }
      setMessage({ ton: "erreur", texte: r.message });
    });
  }

  return (
    <div>
      <span className={labelClass} id="photo-label">
        Photo
      </span>
      {/* Colonne sur téléphone : à deux actions côte à côte, l'aperçu écrasait
          les boutons contre le bord. */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <Avatar name={nom} image={photo} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            {/* Le vrai `<input type="file">` reste le déclencheur (clavier et
                lecteur d'écran le connaissent) : seul son bouton natif est
                habillé, jamais remplacé par un faux bouton. */}
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/avif"
              onChange={envoyerFichier}
              disabled={enCours}
              aria-labelledby="photo-label"
              aria-describedby="photo-aide"
              className="max-w-full text-sm text-gray-light file:mr-3 file:min-h-[44px] file:cursor-pointer file:rounded-lg file:border-0 file:bg-cyan file:px-4 file:py-2 file:font-semibold file:text-navy hover:file:bg-cyan-light disabled:opacity-60"
            />
            {linkedinLie && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={enCours}
                onClick={reprendreLinkedIn}
              >
                Reprendre ma photo LinkedIn
              </Button>
            )}
          </div>

          {enCours && (
            <p role="status" className="mt-2 text-sm text-gray-light">
              Photo en cours d&apos;enregistrement…
            </p>
          )}
          {message?.ton === "info" && (
            <p role="status" className="mt-2 text-sm text-cyan">
              {message.texte}
            </p>
          )}
          {message?.ton === "erreur" && (
            <p role="alert" className={errorClass}>
              {message.texte}
            </p>
          )}
          {message?.ton === "reconnexion" && (
            <div
              role="alert"
              className="mt-2 rounded-lg border border-cyan/30 bg-cyan/8 px-3 py-2"
            >
              <p className="text-sm text-white">{message.texte}</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-1 !px-0"
                onClick={() => demarrer(() => reconnecterLinkedInAction(retour))}
              >
                Continuer vers LinkedIn
              </Button>
            </div>
          )}

          <p id="photo-aide" className="mt-2 text-xs text-gray-light">
            PNG, JPEG, WebP ou AVIF, 4&nbsp;Mo maximum. Affichée sur ta fiche et
            utilisée comme avatar sur tout le site.
          </p>
        </div>
      </div>
    </div>
  );
}
