/**
 * SPEC-821 (I-441) · CANDADO: en `ci.yml`, ningún paso que ejecute un script que importe el cliente
 * Prisma (`src/lib/prisma.ts`) puede correr ANTES de `npx prisma generate`. Imposibilidad estructural,
 * no una regla escrita: el enumerador DESCUBRE los pasos parseando el yaml + caminando imports (ver
 * prisma-generate-antes-del-cliente.ts). Este candado afirma el invariante sobre el ci.yml REAL y, por
 * CONTROL POSITIVO, que un job SIN `generate` antes de un script-cliente se pone ROJO — un candado de
 * ausencia sin control positivo falla hacia cero y parece verde.
 *
 * Los fixtures usan `npm run indices:check`, que se resuelve con el package.json REAL a
 * scripts/verify-hnsw-indexes.ts (importa ../src/lib/prisma): el enumerador descubre el import de verdad.
 */
import { describe, it, expect } from "vitest";
import { enumerarViolaciones, enumerarViolacionesReales } from "./prisma-generate-antes-del-cliente";
import { RAIZ_PRODUCTO } from "../arch/lib/paths";

const YML_CON_GENERATE = `
jobs:
  con_generate:
    steps:
      - run: npm ci
      - run: npx prisma generate
      - run: npm run indices:check
`;

const YML_SIN_GENERATE = `
jobs:
  sin_generate:
    steps:
      - run: npm ci
      - run: npm run indices:check
`;

describe("SPEC-821 · `prisma generate` antes de todo script que importa el cliente (ci.yml)", () => {
    it("el ci.yml REAL no tiene ninguna inversión (cero violaciones)", () => {
        const violaciones = enumerarViolacionesReales();
        expect(violaciones, `inversiones encontradas:\n${JSON.stringify(violaciones, null, 2)}`).toEqual([]);
    });

    it("control NEGATIVO: un job con `generate` ANTES del script-cliente no es violación", () => {
        expect(enumerarViolaciones(YML_CON_GENERATE, RAIZ_PRODUCTO)).toEqual([]);
    });

    it("control POSITIVO: el mismo job SIN `generate` se pone ROJO (≥1 violación, el script-cliente real)", () => {
        const violaciones = enumerarViolaciones(YML_SIN_GENERATE, RAIZ_PRODUCTO);
        expect(violaciones.length).toBeGreaterThan(0);
        expect(violaciones[0].script).toContain("verify-hnsw-indexes");
    });
});
