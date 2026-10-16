import type { MetadataRoute } from "next";
import { BASE_URL } from "@/constants/site";

// Crawlers IA explicitement autorisés (Tech Speak'Her veut être trouvée par
// les LLM-search type ChatGPT, Claude, Perplexity, Gemini, etc.).
const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-Web",
  "PerplexityBot",
  "Google-Extended",
  "Applebot-Extended",
  "Bytespider",
  "CCBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: "/api/" },
      ...AI_CRAWLERS.map((ua) => ({
        userAgent: ua,
        allow: "/",
        disallow: "/api/",
      })),
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
