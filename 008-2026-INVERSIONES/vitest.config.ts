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
    // Cobertura de la unidad SIN pisos: sola mide mal (el código con base lo cubre la integración). La usa
    // `npm run test:cobertura:unidad` para escribir su blob; los pisos están en la medida unida
    // (vitest.cobertura.config.ts, `npm run test:cobertura`). Candado: tests/unit/cobertura/configuracion.test.ts.
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      reporter: ["text-summary"],
      reportsDirectory: "node_modules/.cache/cobertura",
    },
  },
});
