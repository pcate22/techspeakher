import LienVideo, { CTA_VIDEO } from "@/components/LienVideo";
import type { Video } from "@/data/videos";

/**
 * Carte vidéo du catalogue : la façade, puis de quoi savoir ce qu'on va
 * regarder. Le clic ouvre YouTube — rien n'est chargé depuis un tiers à
 * l'affichage, donc aucun cookie posé.
 */
export default function VideoCard({ video }: { video: Video }) {
  return (
    <LienVideo
      href={video.url}
      titre={video.title}
      duree={video.duree}
      className="bg-navy"
    >
      <div className="p-5">
        <h3 className="text-lg font-bold text-white mb-1.5">{video.title}</h3>
        <p className="text-sm text-gray-light leading-relaxed mb-3">{video.description}</p>
        <p className="flex items-center gap-2 text-xs text-gray-light">
          <span>{video.date}</span>
          <span aria-hidden="true">·</span>
          <span className="font-semibold text-cyan group-hover:text-cyan-light transition-colors">
            {CTA_VIDEO}
          </span>
        </p>
      </div>
    </LienVideo>
  );
}
