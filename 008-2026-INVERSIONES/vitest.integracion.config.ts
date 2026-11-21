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
    // Cobertura de la integración SIN pisos: sola mide mal (el código puro lo cubre la unidad). Se corre solo
    // por `scripts/integracion.mjs` (candado de base *_test local y `migrate reset` antes), con
    // `npm run test:cobertura:integracion`, que escribe su blob; los pisos están en la medida unida
    // (vitest.cobertura.config.ts, `npm run test:cobertura`). Candado: tests/unit/cobertura/configuracion.test.ts.
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      reporter: ["text-summary"],
      reportsDirectory: "node_modules/.cache/cobertura-integracion",
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
