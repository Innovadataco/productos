// Candado: las validaciones de src/datos-oficiales/decretos/filas.ts son espejo exacto de las reglas de
// dividendo_decretado (migración 20261122030100_datos_oficiales y schema.prisma). Si la base rechazara algo que el
// lector deja pasar, el rechazo llegaría a mitad de la transacción, después de retirar la versión anterior (se
// desharía, pero el dueño vería un error de la base en vez de la línea y el código). Si una de las dos cambia, esta
// prueba obliga a cambiar la otra.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CUOTA_MAX, CUOTA_MIN, ESCALA_VALOR, MAX_NOTA, MAX_REFERENCIA, REFERENCIAS_OFICIALES } from "@/datos-oficiales/decretos/filas";

const RAIZ = path.join(__dirname, "..", "..", "..", "..");
const SQL = readFileSync(path.join(RAIZ, "prisma", "migrations", "20261122030100_datos_oficiales", "migration.sql"), "utf8");
const ESQUEMA = readFileSync(path.join(RAIZ, "prisma", "schema.prisma"), "utf8");

/** El texto de una restricción ADD CONSTRAINT "<nombre>" hasta su punto y coma. */
function restriccion(nombre: string): string {
  const inicio = SQL.indexOf(`ADD CONSTRAINT "${nombre}"`);
  expect(inicio, nombre).toBeGreaterThan(-1);
  return SQL.slice(inicio, SQL.indexOf(";", inicio));
}

describe("decretos · el lector es espejo de las reglas de la base", () => {
  it("la referencia oficial: los mismos tres patrones, carácter por carácter, y el mismo tope", () => {
    const check = restriccion("dividendo_decretado_referencia_chk");
    const patrones = [...check.matchAll(/~ '([^']+)'/g)].map((m) => m[1]);
    expect(patrones).toEqual([...REFERENCIAS_OFICIALES]);
    expect(check).toContain(`char_length("referenciaOficial") <= ${MAX_REFERENCIA}`);
  });

  it("la cuota, la nota y la escala del valor por acción", () => {
    expect(restriccion("dividendo_decretado_cuota_chk")).toContain(`"cuota" BETWEEN ${CUOTA_MIN} AND ${CUOTA_MAX}`);
    expect(restriccion("dividendo_decretado_nota_chk")).toContain(`char_length("nota") <= ${MAX_NOTA}`);
    expect(ESQUEMA).toMatch(new RegExp(`valorPorAccion\\s+Decimal\\s+@db\\.Decimal\\(20, ${ESCALA_VALOR}\\)`));
  });

  it("las fechas (anuncio ≤ ex ≤ pago) y el valor positivo siguen siendo las reglas de la base", () => {
    expect(restriccion("dividendo_decretado_fechas_chk")).toContain(`"fechaAnuncio" <= "fechaEx" AND "fechaEx" <= "fechaPago"`);
    expect(restriccion("dividendo_decretado_valor_chk")).toContain(`"valorPorAccion" > 0`);
    expect(restriccion("dividendo_decretado_anulada_chk")).toContain(`"version" >= 2 AND "nota" IS NOT NULL`);
  });
});
