import { defineConfig } from "vitest/config";
import { randomBytes } from "node:crypto";
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
    include: ["tests/integracion/**/*.test.ts"],
    environment: "node",
    fileParallelism: false,
    testTimeout: 20000,
    // Cobertura de la integración (no la corre el CI): después de `prisma migrate reset` sobre la base *_test,
    // `vitest run --config vitest.integracion.config.ts --coverage`. Pisos = lo medido en main (fcf8e7c1,
    // 2026-11-21) redondeado hacia abajo. Seguimiento: correrla en el CI y unirla con la de unidad.
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      reporter: ["text"],
      reportsDirectory: "node_modules/.cache/cobertura-integracion",
      thresholds: { statements: 71, branches: 82, functions: 92, lines: 71 },
    },
    // Claves de cifrado (#11): la v1, aleatoria en cada corrida y nunca versionada. Se fija aquí
    // (no se toma del entorno) y las v2…v9 quedan vacías: una clave real del entorno o de la .env
    // nunca entra al llavero de las pruebas (la .env no pisa variables que ya existen).
    env: {
      CIFRADO_CLAVE_ACTIVA: "v1",
      CIFRADO_CLAVE_V1: randomBytes(32).toString("base64"),
      ...Object.fromEntries([2, 3, 4, 5, 6, 7, 8, 9].map((v) => [`CIFRADO_CLAVE_V${v}`, ""])),
    },
  },
});
