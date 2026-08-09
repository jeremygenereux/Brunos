import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Le même alias que `tsconfig.json`. Sans lui, un test qui importe en `@/`
  // échoue au chargement — ce qui poussait à écrire des chemins relatifs dans
  // les tests seulement, et donc à déplacer du code pour pouvoir le tester.
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
