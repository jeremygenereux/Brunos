import Link from "next/link";

export default function Home() {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <p className="text-or-400/80 brunos-enter font-sans text-xs tracking-[0.45em] uppercase">
        Gala annuel
      </p>

      <h1
        className="font-display text-ivoire brunos-enter mt-6 text-7xl leading-none font-semibold tracking-tight sm:text-8xl"
        style={{ animationDelay: "120ms" }}
      >
        Les{" "}
        <span className="from-or-300 to-or-600 bg-gradient-to-b bg-clip-text text-transparent">
          Brunos
        </span>
      </h1>

      <p
        className="text-ivoire-muted brunos-enter mt-8 max-w-md font-sans text-base"
        style={{ animationDelay: "240ms" }}
      >
        Votes, classements et révélations en grand écran. Connecte-toi pour voter et retrouver les
        éditions auxquelles tu participes.
      </p>

      {/* L'accès se fait sur invitation : pas de « créer un compte » en vitrine.
          La route /signup reste nécessaire au parcours entourage (/join/<token>),
          où le jury déclare lui-même son lien avec un joueur. */}
      <div className="brunos-enter mt-12" style={{ animationDelay: "360ms" }}>
        <Link
          href="/login"
          className="from-or-300 to-or-600 text-noir-900 hover:from-or-400 hover:to-or-500 rounded-full bg-gradient-to-b px-8 py-3 font-sans text-sm font-semibold shadow-lg transition"
        >
          Se connecter
        </Link>
      </div>

      <p
        className="text-ivoire-faint brunos-enter mt-8 max-w-sm font-sans text-xs"
        style={{ animationDelay: "480ms" }}
      >
        L&apos;accès se fait sur invitation. Tu en as reçu une ? Le lien du courriel te mène
        directement à la création de ton accès.
      </p>
    </main>
  );
}
