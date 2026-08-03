"use client";

// Frontière d'erreur de dernier recours. Elle remplace intégralement le layout
// racine, d'où les balises <html> et <body> obligatoires.
//
// Sa présence est aussi ce qui débloque le build de production : sans fichier
// global-error, Next prérend une page interne `/_global-error` qui échouait ici
// (« Cannot read properties of null (reading 'useContext') »), interrompant
// l'export. Fournir la nôtre remplace cette page générée.

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="fr-CA">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0b",
          color: "#f4efe6",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          padding: "2rem",
        }}
      >
        <main style={{ maxWidth: "28rem", textAlign: "center" }}>
          <p
            style={{
              margin: 0,
              color: "#e8c87e",
              fontSize: "0.7rem",
              letterSpacing: "0.4em",
              textTransform: "uppercase",
            }}
          >
            Les Brunos
          </p>
          <h1
            style={{
              margin: "0.75rem 0 0",
              fontFamily: "ui-serif, Georgia, serif",
              fontSize: "2.25rem",
              fontWeight: 600,
            }}
          >
            La soirée est interrompue.
          </h1>
          <p style={{ margin: "0.75rem 0 0", color: "#b9b2a4", fontSize: "0.9rem" }}>
            Un incident technique nous empêche d&apos;afficher cette page. Veuillez réessayer.
          </p>
          {error.digest && (
            <p style={{ margin: "0.75rem 0 0", color: "#6f6a60", fontSize: "0.7rem" }}>
              Référence : {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={() => unstable_retry()}
            style={{
              marginTop: "2rem",
              padding: "0.75rem 2rem",
              borderRadius: "999px",
              border: "none",
              background: "linear-gradient(to bottom, #f0d77b, #b8932f)",
              color: "#0a0a0b",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Réessayer
          </button>
        </main>
      </body>
    </html>
  );
}
