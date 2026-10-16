import { NextResponse } from "next/server";
import { CONTACT_EMAIL, EMAIL_SENDER } from "@/constants/site";
import { isRateLimited, clientIp } from "@/lib/rate-limit";
import { brevoClient } from "@/lib/brevo-client";
import { analyserMessageContact, DELAI_SAISIE_MIN_MS } from "@/lib/anti-spam";
import { verifierTurnstile } from "@/lib/turnstile";

const SUBJECTS: Record<string, string> = {
  general: "Question générale",
  tremplin: "Tremplin DevFest 2026",
  speakeuse: "Cherche des speakeuses pour un événement",
  partenariat: "Partenariat / Sponsor",
  rejoindre: "Rejoindre la communauté",
};

export async function POST(request: Request) {
  // Rate limiting : 5 messages / minute / IP (anti-spam).
  const ip = clientIp(request.headers);
  if (isRateLimited(`contact:${ip}`, 5, 60_000)) {
    return NextResponse.json({ error: "Trop de messages envoyés. Réessayez dans une minute." }, { status: 429 });
  }

  // Parse JSON body
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  try {
    const { name, email, subject, message, website, ouvertA, turnstile } = body as {
      name?: string;
      email?: string;
      subject?: string;
      message?: string;
      /** Piège à robots : champ caché du formulaire, vide chez un humain. */
      website?: string;
      /** Horodatage d'ouverture du formulaire, posé par le navigateur. */
      ouvertA?: number;
      /** Jeton du widget Cloudflare Turnstile, quand il est activé. */
      turnstile?: unknown;
    };

    // Validation serveur
    if (!name?.trim() || name.length > 200) {
      return NextResponse.json({ error: "Le nom est obligatoire (200 caractères max)." }, { status: 400 });
    }
    if (!email?.trim() || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "L'adresse e-mail n'est pas valide." }, { status: 400 });
    }
    if (!subject || !SUBJECTS[subject]) {
      return NextResponse.json({ error: "Sujet invalide." }, { status: 400 });
    }
    if (!message?.trim()) {
      return NextResponse.json({ error: "Le message est obligatoire." }, { status: 400 });
    }
    if (message.length > 2000) {
      return NextResponse.json({ error: "Le message ne doit pas dépasser 2\u00A0000 caractères." }, { status: 400 });
    }

    // Anti-démarchage. Trois filets, du moins au plus faillible : le piège à
    // robots, le délai de saisie, puis l'analyse du contenu (cf. anti-spam.ts).
    // Un message écarté reçoit la MÊME réponse qu'un message envoyé : un
    // démarcheur apprendrait sinon quoi retirer pour repasser. Trace côté
    // serveur (Vercel) avec le seul domaine de l'expéditeur, pour garder une
    // vue sur les faux positifs sans journaliser d'adresse personnelle.
    const ecarter = (motifs: string[]) => {
      console.warn("Message de contact écarté (anti-démarchage)", {
        motifs,
        domaine: email.trim().split("@")[1] ?? "?",
      });
      return NextResponse.json({ success: true });
    };

    if (website?.trim()) return ecarter(["piège à robots rempli"]);

    // `ouvertA` vient de l'horloge du NAVIGATEUR, comparée à celle du serveur :
    // une horloge cliente en avance donne un écart négatif. On ignore alors la
    // mesure (écart hors du temps mesurable) au lieu d'écarter la visiteuse.
    const ecoule = typeof ouvertA === "number" ? Date.now() - ouvertA : Number.NaN;
    if (Number.isFinite(ecoule) && ecoule >= 0 && ecoule < DELAI_SAISIE_MIN_MS) {
      return ecarter(["formulaire rempli trop vite"]);
    }

    const analyse = analyserMessageContact({
      nom: name.trim(),
      email: email.trim(),
      message: message.trim(),
    });
    if (analyse.suspect) return ecarter(analyse.motifs);

    // Cloudflare Turnstile, quand l'environnement porte la clé secrète (cf.
    // turnstile.ts). En dernier, après les filets gratuits : c'est le seul qui
    // coûte un appel réseau. Refus = erreur EXPLICITE, contrairement aux
    // messages écartés : la visiteuse doit pouvoir refaire la vérification.
    const verdict = await verifierTurnstile(turnstile, ip);
    if (verdict === "refuse") {
      return NextResponse.json(
        { error: "La vérification anti-robot doit être refaite. Réessayez dans un instant." },
        { status: 400 },
      );
    }

    const subjectText = `[Tech Speak'Her] ${SUBJECTS[subject]} | ${name.trim()}`;
    const textContent = `Nom : ${name.trim()}\nE-mail : ${email.trim()}\nSujet : ${SUBJECTS[subject]}\n\n${message.trim()}`;

    await brevoClient().transactionalEmails.sendTransacEmail({
      sender: { email: EMAIL_SENDER, name: "Tech Speak'Her" },
      replyTo: { email: email.trim(), name: name.trim() },
      to: [{ email: CONTACT_EMAIL, name: "Tech Speak'Her" }],
      subject: subjectText,
      textContent,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Brevo error:", err);
    return NextResponse.json({ error: "Erreur lors de l'envoi. Réessayez plus tard." }, { status: 500 });
  }
}
