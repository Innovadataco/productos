// Prueba espejo: los CHECK de umbral_version (migración *_alertas) repiten los rangos de src/alertas/umbrales.ts. Si cambia
// uno sin el otro, esta prueba falla. (Que los CHECK muerdan en una base real lo prueba tests/integracion/alertas-esquema.test.ts.)
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RANGOS_UMBRALES, UMBRALES_OMISION, type CampoNumerico } from "@/alertas/umbrales";

const raiz = path.resolve(__dirname, "../../..");
const carpeta = readdirSync(path.join(raiz, "prisma/migrations")).find((n) => n.endsWith("_alertas"));
const sql = carpeta === undefined ? "" : readFileSync(path.join(raiz, "prisma/migrations", carpeta, "migration.sql"), "utf8").replace(/--.*$/gm, "");

/** Los límites que la CHECK de un campo pone: «"campo" >= a AND "campo" <= b». */
function limitesDe(campo: string): { min: number; max: number } | null {
  const m = new RegExp(`CHECK \\("${campo}" >= ([0-9.]+) AND "${campo}" <= ([0-9.]+)\\)`).exec(sql);
  return m === null ? null : { min: Number(m[1]), max: Number(m[2]) };
}

describe("umbral_version · espejo de src/alertas/umbrales.ts", () => {
  it("la migración existe", () => {
    expect(carpeta).toBeDefined();
    expect(sql).toContain('CREATE TABLE "umbral_version"');
  });

  it.each(Object.keys(RANGOS_UMBRALES) as CampoNumerico[])("la CHECK de %s es el rango del código", (campo) => {
    expect(limitesDe(campo)).toEqual({ min: RANGOS_UMBRALES[campo].min, max: RANGOS_UMBRALES[campo].max });
  });

  it("control positivo: el análisis detecta un rango distinto", () => {
    expect(limitesDe("alertaCercaPct")).not.toEqual({ min: 1, max: 10 });
  });

  it("cada umbral y cada interruptor del código es una columna de la tabla, y no sobra ninguno", () => {
    const tabla = /CREATE TABLE "umbral_version" \(([\s\S]*?)\n\);/.exec(sql)?.[1] ?? "";
    const columnas = [...tabla.matchAll(/^\s+"(\w+)"/gm)].map((m) => m[1]!).filter((c) => c.startsWith("alerta"));
    expect(columnas.sort()).toEqual(Object.keys(UMBRALES_OMISION).sort());
  });

  it("los valores de omisión caben en su rango", () => {
    for (const [campo, { min, max }] of Object.entries(RANGOS_UMBRALES)) {
      const v = UMBRALES_OMISION[campo as CampoNumerico];
      expect(v >= min && v <= max, campo).toBe(true);
    }
  });
});
