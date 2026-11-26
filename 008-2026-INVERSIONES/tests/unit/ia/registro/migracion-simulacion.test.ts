// M1 (20261126200000_tipo_resumen_simulacion): el valor SIMULACION del enum TipoResumenIa. `prisma migrate deploy` corre
// cada migration.sql en una transacción, y en PostgreSQL 16 un valor nuevo de un enum no se puede USAR en la transacción
// que lo agrega: por eso M1 trae SOLO el ALTER TYPE ... ADD VALUE, y lo que use el valor va en una migración posterior
// (M2, *_config_ia_simulacion, y el código). Precedente: 20261122030000_datos_oficiales_tipos.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const raiz = fileURLToPath(new URL("../../../../", import.meta.url));
const dirMigraciones = path.join(raiz, "prisma/migrations");
const carpetas = readdirSync(dirMigraciones, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
const NOMBRE = "20261126200000_tipo_resumen_simulacion";
const sinComentarios = (sql: string): string => sql.replace(/--.*$/gm, "");
const sentencias = (sql: string): string[] => sinComentarios(sql).split(";").map((s) => s.trim()).filter((s) => s !== "");
const SENTENCIA = `ALTER TYPE "TipoResumenIa" ADD VALUE 'SIMULACION'`;
/** Las sentencias que mencionan el valor nuevo sin ser el ADD VALUE que lo crea. */
const usosDelValor = (sql: string): string[] => sentencias(sql).filter((s) => s !== SENTENCIA && /SIMULACION/.test(s));
const leer = (carpeta: string): string => readFileSync(path.join(dirMigraciones, carpeta, "migration.sql"), "utf8");

describe("migración *_tipo_resumen_simulacion (M1)", () => {
  it("existe, es una sola, va después de la de las alertas (en otra rama) y M2 va después de M1", () => {
    expect(carpetas.filter((c) => c.endsWith("_tipo_resumen_simulacion"))).toEqual([NOMBRE]);
    expect(NOMBRE > "20261126180000_alertas").toBe(true);
    const m2 = carpetas.filter((c) => c.endsWith("_config_ia_simulacion"));
    expect(m2).toHaveLength(1);
    expect(m2[0]! > NOMBRE).toBe(true);
  });

  it("trae SOLO «ALTER TYPE \"TipoResumenIa\" ADD VALUE 'SIMULACION'», sin transacción propia ni otra sentencia", () => {
    const sql = leer(NOMBRE);
    expect(sentencias(sql)).toEqual([SENTENCIA]);
    expect(sinComentarios(sql)).not.toMatch(/\b(BEGIN|COMMIT|START\s+TRANSACTION)\b/i);
  });

  it("ninguna sentencia de M1 usa el valor nuevo (en PostgreSQL 16 no se puede en la transacción que lo agrega)", () => {
    expect(usosDelValor(leer(NOMBRE))).toEqual([]);
  });

  it("control positivo del detector: una migración que sí usa el valor se marca", () => {
    const mala = `${SENTENCIA};\nUPDATE "resumen_ia" SET "tipo" = 'SIMULACION'::"TipoResumenIa" WHERE false;`;
    expect(usosDelValor(mala)).toHaveLength(1);
    expect(sentencias(mala)).not.toEqual([SENTENCIA]);
    const otra = `${SENTENCIA};\nCREATE INDEX "x" ON "resumen_ia"("tipo") WHERE "tipo" = 'SIMULACION';`;
    expect(usosDelValor(otra)).toHaveLength(1);
  });
});
