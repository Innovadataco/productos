import { defineConfig } from "vitest/config";

// Medida UNIDA de cobertura: une los blobs de la unidad y de la integración (vitest --merge-reports) y aplica
// los ÚNICOS pisos de cobertura de 008. No corre pruebas. Se usa solo con `npm run test:cobertura`
// (= `test:cobertura:unida`: unidad → integración por scripts/integracion.mjs → `test:cobertura:unir`).
// Pisos = lo medido en main 93261e70 (2026-11-21: 93.66 / 94.38 / 98.09 / 93.66) menos 1 punto, redondeado
// hacia abajo; todos ≥ 80 % (ECC). Lo que queda sin cubrir son sobre todo componentes cliente que solo
// cubre el e2e (Playwright), que no entra en esta medida. Candado: tests/unit/cobertura/configuracion.test.ts.
export default defineConfig({
  test: {
    // Vacío a propósito: corrido sin --merge-reports sale con «No test files found» (exit 1) y nunca
    // ejecuta la integración por fuera del candado de base de scripts/integracion.mjs.
    include: [],
    coverage: {
      // Obligatorio: sin `enabled`, el merge no crea el proveedor de cobertura y sale en verde SIN medir.
      enabled: true,
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      reporter: ["text"],
      reportsDirectory: "node_modules/.cache/cobertura-unida",
      thresholds: { statements: 92, branches: 93, functions: 97, lines: 92 },
    },
  },
});
