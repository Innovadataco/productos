// Espejo entre las listas y los límites de la tarifa (src/operar/tarifa/parametros.ts) y las CHECK escritas a mano en su
// migración: si uno cambia sin el otro, esto se pone rojo. Y el modelo de Prisma tiene las columnas que se otorgan.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { COMISIONISTAS, MAX_NOMBRE_CARGO, MAX_OTROS_CARGOS, MAX_MOTIVO, MAX_PORCENTAJE, TIPOS_CARGO, TOPE_CARGO_TARIFA } from "@/operar/tarifa/parametros";

const RAIZ = path.join(__dirname, "..", "..", "..", "..");
const dir = readdirSync(path.join(RAIZ, "prisma", "migrations")).find((d) => d.endsWith("_tarifa_comision"));
const sql = readFileSync(path.join(RAIZ, "prisma", "migrations", dir ?? "falta", "migration.sql"), "utf8");
const check = (nombre: string): string => new RegExp(`ADD CONSTRAINT "${nombre}" CHECK \\((.*)\\);`).exec(sql)?.[1] ?? "";

describe("migración de tarifa_comision", () => {
  it("existe una sola", () => {
    expect(readdirSync(path.join(RAIZ, "prisma", "migrations")).filter((d) => d.endsWith("_tarifa_comision"))).toHaveLength(1);
  });

  it("los comisionistas de la CHECK son los de la lista", () => {
    expect(check("tarifa_comision_comisionista_chk")).toBe(`"comisionista" IN (${COMISIONISTAS.map((c) => `'${c}'`).join(", ")})`);
  });

  it("porcentaje e IVA de 0 a 100; mínimo y fijo bajo el tope; motivo hasta su largo", () => {
    expect(check("tarifa_comision_porcentaje_chk")).toBe(`"porcentaje" >= 0 AND "porcentaje" <= ${MAX_PORCENTAJE}`);
    expect(check("tarifa_comision_iva_chk")).toBe(`"ivaPct" >= 0 AND "ivaPct" <= ${MAX_PORCENTAJE}`);
    const tope = TOPE_CARGO_TARIFA.toFixed();
    expect(check("tarifa_comision_montos_chk")).toBe(`"minimoPorOrden" >= 0 AND "minimoPorOrden" < ${tope} AND "fijoPorOrden" >= 0 AND "fijoPorOrden" < ${tope}`);
    expect(check("tarifa_comision_motivo_chk")).toContain(`char_length("motivo") <= ${MAX_MOTIVO}`);
  });

  it("los otros cargos: hasta MAX_OTROS_CARGOS, desenrollados uno por uno, con los tipos y el largo del nombre", () => {
    const c = check("tarifa_comision_cargos_chk");
    expect(c).toContain(`jsonb_array_length("otrosCargos") <= ${MAX_OTROS_CARGOS} AND`);
    for (let i = 0; i < MAX_OTROS_CARGOS; i++) expect(c).toContain(`("otrosCargos"->${i})`);
    expect(c).not.toContain(`("otrosCargos"->${MAX_OTROS_CARGOS})`);
    expect(c).toContain(`IN (${TIPOS_CARGO.map((t) => `'${t}'`).join(", ")})`);
    expect(c).toContain(`BETWEEN 1 AND ${MAX_NOMBRE_CARGO}`);
    // El valor: hasta 8 enteros (bajo el tope de cien millones) y 4 decimales; un PCT, hasta 100.
    expect(TOPE_CARGO_TARIFA.toFixed()).toBe(`1${"0".repeat(8)}`);
    expect(c).toContain("'^[0-9]{1,8}([.][0-9]{1,4})?$'");
  });

  it("solo inserción y el instante que pone la base", () => {
    expect(sql).toMatch(/CREATE TRIGGER "tarifa_comision_solo_insercion" BEFORE UPDATE OR DELETE ON "tarifa_comision" FOR EACH ROW EXECUTE FUNCTION "inv_solo_insercion"\(\);/);
    expect(sql).toMatch(/CREATE TRIGGER "tarifa_comision_instante" BEFORE INSERT ON "tarifa_comision"/);
  });
});
