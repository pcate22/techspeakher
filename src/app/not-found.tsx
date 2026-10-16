import Link from "next/link";

export default function NotFound() {
  return (
    <section className="py-24 px-4 text-center">
      <h1 className="text-3xl font-bold text-cyan mb-4">Page introuvable</h1>
      <p className="text-gray-light mb-6">Cette page n&apos;existe pas ou a été déplacée.</p>
      <Link
        href="/"
        className="inline-flex items-center justify-center px-8 py-3 bg-magenta hover:bg-magenta-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white text-navy font-semibold rounded-lg transition-colors duration-200"
      >
        Retour à l&apos;accueil
      </Link>
    </section>
  );
}
