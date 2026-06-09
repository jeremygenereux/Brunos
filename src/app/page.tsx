import Link from "next/link";

export default function Home() {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <Link
        href="/login"
        className="text-ivoire-muted hover:text-or-300 absolute top-6 right-6 font-sans text-sm tracking-wide transition"
      >
        Se connecter →
      </Link>

      <p className="text-or-400/80 font-sans text-xs tracking-[0.45em] uppercase">Gala annuel</p>

      <h1 className="font-display text-ivoire mt-6 text-7xl leading-none font-semibold tracking-tight sm:text-8xl">
        Les{" "}
        <span className="from-or-300 to-or-600 bg-gradient-to-b bg-clip-text text-transparent">
          Brunos
        </span>
      </h1>

      <p className="text-ivoire-muted mt-8 max-w-md font-sans text-base">
        Votes, classements et révélations en grand écran. La cérémonie se prépare.
      </p>

      <div className="border-or-400/25 bg-noir-700/60 mt-12 inline-flex items-center gap-3 rounded-full border px-5 py-2 backdrop-blur-md">
        <span className="bg-or-400 h-1.5 w-1.5 rounded-full" />
        <span className="text-ivoire-muted font-sans text-sm tracking-wide">Bientôt</span>
      </div>
    </main>
  );
}
