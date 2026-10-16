type Props = {
  children: React.ReactNode;
  tone?: "cream" | "deep";
  className?: string;
};

const tones = {
  cream: "bg-cream text-navy",
  deep: "bg-navy text-magenta",
} as const;

export default function StickyNote({ children, tone = "cream", className = "" }: Props) {
  return (
    <span
      className={`inline-block px-4 py-2 rounded-[5px] font-bold uppercase tracking-wider ${tones[tone]} ${className}`}
      style={{
        transform: "rotate(-6deg)",
        boxShadow: "var(--shadow-sticky)",
        letterSpacing: "0.05em",
      }}
    >
      {children}
    </span>
  );
}
