import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Fuera de Next no existe la condición `react-server`: el paquete lanzaría al importarse.
      // Las pruebas corren en Node (lado servidor), así que usan su módulo vacío.
      "server-only": fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    // `npm run test:cobertura`. Pisos = lo medido en main (fcf8e7c1, 2026-11-21) redondeado hacia abajo:
    // solo muerden con --coverage (el CI corre `npm test` sin cobertura). Statements y lines son lo que
    // manda: el código que solo cubre la integración cuenta aquí como no cubierto. Seguimiento: correrlo en
    // el CI y medir unidad + integración juntas, camino al 80 % de ECC.
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      reporter: ["text"],
      reportsDirectory: "node_modules/.cache/cobertura",
      thresholds: { statements: 57, branches: 93, functions: 87, lines: 57 },
    },
  },
});
