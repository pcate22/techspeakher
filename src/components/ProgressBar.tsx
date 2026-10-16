/** Barre de progression réutilisable et accessible (role=progressbar). */
export default function ProgressBar({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={pct}
        aria-valuetext={`${pct} %`}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2.5 rounded-full bg-white/15 border border-white/10 overflow-hidden"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan to-magenta transition-[width]"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-sm text-white mt-2">
        {label} : <span className="font-bold">{pct}&nbsp;%</span>
      </p>
    </div>
  );
}
