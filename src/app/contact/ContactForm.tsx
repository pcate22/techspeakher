"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Script from "next/script";

/**
 * Clé publique du widget Cloudflare Turnstile. Absente (dev, CI, tant que la
 * clé n'est pas posée dans Vercel) → aucun widget, aucun script tiers chargé,
 * et le serveur laisse passer : le formulaire fonctionne comme avant.
 */
const CLE_TURNSTILE = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

interface OptionsTurnstile {
  sitekey: string;
  theme?: "light" | "dark" | "auto";
  language?: string;
  callback?: (jeton: string) => void;
  "expired-callback"?: () => void;
  "error-callback"?: () => void;
}

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: OptionsTurnstile) => string | undefined;
      reset: (widget?: string) => void;
    };
  }
}

const inputClass =
  "w-full bg-navy border rounded-lg px-4 py-2.5 text-white placeholder-gray-light/75 focus-visible:outline-none focus-visible:border-cyan focus-visible:ring-2 focus-visible:ring-cyan/30 transition-colors border-navy-lighter";

export default function ContactForm() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const alertRef = useRef<HTMLDivElement>(null);
  const successRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  /**
   * Ouverture du formulaire : le serveur écarte les envois trop rapides pour
   * être humains (anti-démarchage, cf. src/lib/anti-spam.ts). Posé au montage
   * (rendu pur) ; à 0, le serveur considère le délai comme inconnu et laisse
   * passer.
   */
  const ouvertA = useRef(0);
  useEffect(() => {
    ouvertA.current = Date.now();
  }, []);

  /**
   * Turnstile en rendu EXPLICITE (`?render=explicit`). Le rendu implicite ne
   * s'exécute qu'au chargement du script : après « Envoyer un autre message »,
   * le formulaire est remonté et le widget resterait vide — deuxième message
   * impossible sans recharger la page. Ici, l'effet re-rend le widget à chaque
   * retour du formulaire.
   */
  const conteneurTurnstile = useRef<HTMLDivElement>(null);
  const widgetTurnstile = useRef<string>("");
  const jetonTurnstile = useRef("");
  const [turnstilePret, setTurnstilePret] = useState(false);
  /**
   * Widget hors service : script retenu par une extension de blocage, clé
   * refusée par Cloudflare, domaine absent de ses Hostnames… Une ref plutôt
   * qu'un état : la valeur ne sert qu'au moment de l'envoi, jamais au rendu.
   */
  const turnstileInjoignable = useRef(false);

  /** Conteneur déjà pourvu d'un widget : évite un double rendu au même endroit. */
  const conteneurRendu = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!CLE_TURNSTILE || !turnstilePret || status === "sent") return;
    const conteneur = conteneurTurnstile.current;
    if (!conteneur || conteneurRendu.current === conteneur) return;
    conteneurRendu.current = conteneur;

    // Turnstile LÈVE quand ses paramètres lui déplaisent (clé invalide, domaine
    // absent de ses Hostnames…). Sans ce filet, l'exception remonte de l'effet
    // jusqu'à la barrière d'erreur de Next et emporte TOUTE la page de contact
    // (« Oups, une erreur est survenue ») : le formulaire disparaîtrait à cause
    // d'un réglage chez un tiers. On dégrade sur le message d'aide à la place.
    try {
      widgetTurnstile.current =
        window.turnstile?.render(conteneur, {
          sitekey: CLE_TURNSTILE,
          theme: "dark",
          language: "fr",
          callback: (jeton) => {
            jetonTurnstile.current = jeton;
          },
          // Un jeton vit 5 minutes : passé ce délai, le widget se rejoue seul et
          // on repart d'un jeton vide en attendant.
          "expired-callback": () => {
            jetonTurnstile.current = "";
          },
          "error-callback": () => {
            jetonTurnstile.current = "";
            turnstileInjoignable.current = true;
          },
        }) ?? "";
    } catch (err) {
      console.error("Turnstile : rendu du widget refusé", err);
      turnstileInjoignable.current = true;
    }
  }, [turnstilePret, status]);

  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      alertRef.current?.focus();
    }
  }, [errors]);

  useEffect(() => {
    if (status === "sent") {
      successRef.current?.focus();
    }
  }, [status]);

  // Après « Envoyer un autre message », le bloc succès (qui portait le focus)
  // se démonte : on repose le focus sur le premier champ du formulaire.
  const resetDemande = useRef(false);
  const handleReset = useCallback(() => {
    resetDemande.current = true;
    setStatus("idle");
  }, []);
  useEffect(() => {
    if (status === "idle" && resetDemande.current) {
      resetDemande.current = false;
      formRef.current
        ?.querySelector<HTMLElement>("input, select, textarea")
        ?.focus();
    }
  }, [status]);

  /** Un jeton Turnstile sert UNE fois : après un envoi, on repart d'un neuf. */
  const reinitialiserTurnstile = useCallback(() => {
    if (!CLE_TURNSTILE) return;
    jetonTurnstile.current = "";
    // Même filet que le rendu : un `reset` refusé ne doit pas emporter la page
    // au moment où la visiteuse vient d'envoyer son message.
    try {
      window.turnstile?.reset(widgetTurnstile.current || undefined);
    } catch (err) {
      console.error("Turnstile : remise à zéro refusée", err);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const name = (form.elements.namedItem("name") as HTMLInputElement).value.trim();
    const email = (form.elements.namedItem("email") as HTMLInputElement).value.trim();
    const subject = (form.elements.namedItem("subject") as HTMLSelectElement).value;
    const message = (form.elements.namedItem("message") as HTMLTextAreaElement).value.trim();
    const website = (form.elements.namedItem("website") as HTMLInputElement | null)?.value ?? "";
    // Jeton remis par le widget Turnstile. Vide tant que la vérification se
    // termine, après expiration, ou si le widget reste injoignable.
    const turnstile = jetonTurnstile.current;

    const newErrors: Record<string, string> = {};
    if (!name) newErrors.name = "Le nom est obligatoire.";
    if (!email) newErrors.email = "L'e-mail est obligatoire.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      newErrors.email = "L'adresse e-mail n'est pas valide.";
    if (!message) newErrors.message = "Le message est obligatoire.";
    if (message.length > 2000) newErrors.message = "Le message ne doit pas dépasser 2\u00A0000 caractères.";

    // Jeton encore vide : on le dit sous le widget (le bandeau global garde son
    // message générique, qui renvoie aux champs à corriger) et on distingue les
    // deux causes — sans ça, « réessayez dans un instant » tournerait en boucle
    // chez une visiteuse dont l'extension de blocage retient Cloudflare.
    if (CLE_TURNSTILE && !turnstile)
      newErrors.turnstile = turnstileInjoignable.current
        ? "La vérification anti-robot reste injoignable depuis ce navigateur : autorisez challenges.cloudflare.com, ou écrivez-nous sur LinkedIn."
        : "La vérification anti-robot se termine. Réessayez dans un instant.";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setStatus("sending");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          subject,
          message,
          website,
          ouvertA: ouvertA.current,
          turnstile,
        }),
      });

      // Un jeton Turnstile sert UNE fois : on repart d'un widget neuf, que
      // l'envoi ait abouti (« Envoyer un autre message ») ou échoué.
      reinitialiserTurnstile();

      if (res.ok) {
        setStatus("sent");
        formRef.current?.reset();
      } else {
        const data = await res.json().catch(() => ({}));
        setErrors({ server: data.error || "Erreur lors de l'envoi." });
        setStatus("error");
      }
    } catch {
      reinitialiserTurnstile();
      setErrors({ server: "Erreur réseau. Vérifiez votre connexion." });
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div
        ref={successRef}
        tabIndex={-1}
        className="bg-navy-light border border-cyan/30 rounded-xl p-6 sm:p-8 text-center focus-visible:outline-none"
        role="status"
        aria-live="polite"
      >
        <div className="text-4xl mb-4" aria-hidden="true">&#10003;</div>
        <h2 className="text-xl font-bold text-cyan mb-2">Message envoyé&nbsp;!</h2>
        <p className="text-gray-light text-sm">
          Merci pour votre message. Nous vous répondrons dans les plus brefs délais.
        </p>
        <button
          onClick={handleReset}
          className="mt-6 px-6 py-2 text-sm text-cyan border border-cyan/40 rounded-lg hover:bg-cyan/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
        >
          Envoyer un autre message
        </button>
      </div>
    );
  }

  return (
    <div className="bg-navy-light border border-navy-lighter rounded-xl p-6 sm:p-8">
      <h2 className="text-xl font-bold mb-6">Envoyez-nous un message</h2>

      {Object.keys(errors).length > 0 && (
        <div
          ref={alertRef}
          tabIndex={-1}
          role="alert"
          className="mb-5 p-3 bg-orange/10 border border-orange/30 rounded-lg text-sm text-orange"
        >
          {errors.server || "Veuillez corriger les erreurs ci-dessous."}
        </div>
      )}

      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="space-y-5"
        aria-label="Formulaire de contact"
        noValidate
      >
        {/*
          Piège à robots : invisible à l'écran, hors du parcours clavier et hors
          de l'arbre d'accessibilité — personne ne le voit, sauf un automate qui
          remplit tous les champs. Le serveur écarte alors l'envoi.
        */}
        <div className="hidden" aria-hidden="true">
          <label htmlFor="website">Site web</label>
          <input
            type="text"
            id="website"
            name="website"
            tabIndex={-1}
            autoComplete="off"
          />
        </div>

        {/* Nom */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-light mb-1">
            Nom <span className="text-magenta" aria-hidden="true">*</span>
            <span className="sr-only">(obligatoire)</span>
          </label>
          <input
            type="text"
            id="name"
            name="name"
            required
            autoComplete="name"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "name-error" : undefined}
            className={`${inputClass} ${errors.name ? "!border-orange" : ""}`}
            placeholder="Votre nom"
          />
          {errors.name && (
            <p id="name-error" className="mt-1 text-xs text-orange" role="alert">
              {errors.name}
            </p>
          )}
        </div>

        {/* E-mail */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-light mb-1">
            E-mail <span className="text-magenta" aria-hidden="true">*</span>
            <span className="sr-only">(obligatoire)</span>
          </label>
          <input
            type="email"
            id="email"
            name="email"
            required
            autoComplete="email"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
            className={`${inputClass} ${errors.email ? "!border-orange" : ""}`}
            placeholder="votre@email.com"
          />
          {errors.email && (
            <p id="email-error" className="mt-1 text-xs text-orange" role="alert">
              {errors.email}
            </p>
          )}
        </div>

        {/* Sujet */}
        <div>
          <label htmlFor="subject" className="block text-sm font-medium text-gray-light mb-1">
            Sujet
          </label>
          <select id="subject" name="subject" className={inputClass}>
            <option value="general">Question générale</option>
            <option value="tremplin">Tremplin DevFest 2026</option>
            <option value="speakeuse">Cherche des speakeuses pour un événement</option>
            <option value="partenariat">Partenariat / Sponsor</option>
            <option value="rejoindre">Rejoindre la communauté</option>
          </select>
        </div>

        {/* Message */}
        <div>
          <label htmlFor="message" className="block text-sm font-medium text-gray-light mb-1">
            Message <span className="text-magenta" aria-hidden="true">*</span>
            <span className="sr-only">(obligatoire)</span>
          </label>
          <textarea
            id="message"
            name="message"
            rows={5}
            required
            aria-invalid={!!errors.message}
            aria-describedby={errors.message ? "message-error" : undefined}
            className={`${inputClass} resize-y ${errors.message ? "!border-orange" : ""}`}
            placeholder="Votre message…"
          />
          {errors.message && (
            <p id="message-error" className="mt-1 text-xs text-orange" role="alert">
              {errors.message}
            </p>
          )}
        </div>

        {/*
          Vérification anti-robot Cloudflare Turnstile, affichée seulement si la
          clé publique existe. Le widget injecte lui-même le champ caché
          `cf-turnstile-response` dans ce formulaire ; il se résout tout seul
          dans la quasi-totalité des cas (aucune énigme à résoudre) et ne pose
          aucun cookie.
        */}
        {CLE_TURNSTILE && (
          <div>
            <Script
              src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
              strategy="afterInteractive"
              // `onReady` se déclenche à CHAQUE montage, y compris quand le
              // script est déjà en cache — c'est ce qui permet de re-rendre le
              // widget après « Envoyer un autre message ». `onLoad` couvre le
              // cas où le même script est déjà en cours de chargement : Next
              // court-circuite alors `onReady`.
              onReady={() => setTurnstilePret(true)}
              onLoad={() => setTurnstilePret(true)}
              onError={() => {
                turnstileInjoignable.current = true;
              }}
            />
            <div ref={conteneurTurnstile} data-testid="turnstile" />
            {errors.turnstile && (
              <p className="mt-1 text-xs text-orange" role="alert">
                {errors.turnstile}
              </p>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={status === "sending"}
          className="w-full py-3 bg-magenta hover:bg-magenta-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-navy-light text-navy font-semibold rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === "sending" ? "Envoi en cours…" : "Envoyer"}
        </button>
      </form>
    </div>
  );
}
