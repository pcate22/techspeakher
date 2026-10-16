type Props = {
  className?: string;
  hover?: boolean;
  children: React.ReactNode;
};

export default function Card({ className = "", hover, children }: Props) {
  return (
    <div
      className={`bg-navy-light border border-navy-lighter rounded-xl p-6 ${hover ? "hover:border-cyan/30 transition-colors" : ""} ${className}`}
    >
      {children}
    </div>
  );
}
