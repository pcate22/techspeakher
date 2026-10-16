"use client";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <section className="py-24 px-4 text-center" aria-labelledby="error-title">
      <h1 id="error-title" className="text-3xl font-bold text-magenta mb-4">Oups, une erreur est survenue</h1>
      <p className="text-gray-light mb-6">Quelque chose ne s&apos;est pas passé comme prévu.</p>
      <button
        onClick={reset}
        className="inline-flex items-center justify-center px-8 py-3 bg-magenta hover:bg-magenta-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white text-navy font-semibold rounded-lg transition-colors duration-200"
      >
        Réessayer
      </button>
    </section>
  );
}
