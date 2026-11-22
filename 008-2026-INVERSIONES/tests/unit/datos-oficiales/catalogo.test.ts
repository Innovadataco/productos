// El catálogo de series oficiales (fase C, C2a: decisión P1 de la Fábrica): TRM, TPM, IBR_3M_EA e IPC_INDICE; la tasa
// de referencia de la fase D es IBR_3M_EA (la TPM queda como contexto); TES y UVR quedan fuera. El catálogo vive en el
// código (P4): cada código y cada fuente deben pasar los CHECK de valor_serie_oficial, que se leen de la migración (no
// se copian), y lo que el catálogo deja escribir debe caber en la base (escala ≤ 8, menos de 10^12, vigencia ≤ 32 días)
// y en el tope de línea del CSV. Sin imports: la pantalla (C6a) lo podrá usar desde src/app.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CATALOGO, SERIE_TASA_REFERENCIA, serieDelCatalogo, type SerieCatalogo } from "@/datos-oficiales/catalogo";
import { MAX_LARGO_LINEA_SERIES } from "@/datos-oficiales/series/csv-series";

const RAIZ = path.join(__dirname, "..", "..", "..");
const MIGRACION = readFileSync(path.join(RAIZ, "prisma", "migrations", "20261122030100_datos_oficiales", "migration.sql"), "utf8");

/** El patrón de un CHECK `"columna" ~ '<regex>'` de valor_serie_oficial, tal como está en la migración. */
function patronDelCheck(restriccion: string, columna: string): RegExp {
  const m = new RegExp(`"${restriccion}" CHECK \\("${columna}" ~ '([^']+)'\\)`).exec(MIGRACION);
  if (!m) throw new Error(`no está el CHECK ${restriccion}`);
  return new RegExp(m[1]!);
}

const ESCALA_BASE = 8; // valor DECIMAL(20,8)
const DIGITOS_ENTEROS_BASE = 12;
const MAX_DIAS_VIGENCIA_BASE = 32; // hasta <= desde + 31, cerrada en los dos extremos

/** La línea más larga que el catálogo deja escribir para una serie (vigencia de 10 + 10 y el valor más largo). */
function lineaMasLarga(s: SerieCatalogo): number {
  const enteros = s.rango.max.split(".")[0]!.length;
  const valor = enteros + (s.escala > 0 ? 1 + s.escala : 0);
  return [s.codigo.length, 10, 10, valor, s.fuente.length].reduce((a, b) => a + b, 0) + 4;
}

const decimal = /^(0|[1-9][0-9]*)(\.[0-9]*[1-9])?$/;

describe("catálogo de series oficiales · decisión P1", () => {
  it("trae exactamente TRM, TPM, IBR_3M_EA e IPC_INDICE (TES y UVR fuera)", () => {
    expect(CATALOGO.map((s) => s.codigo)).toEqual(["TRM", "TPM", "IBR_3M_EA", "IPC_INDICE"]);
  });

  it("la tasa de referencia de la fase D es IBR_3M_EA y está en el catálogo", () => {
    expect(SERIE_TASA_REFERENCIA).toBe("IBR_3M_EA");
    expect(serieDelCatalogo(SERIE_TASA_REFERENCIA)?.unidad).toBe("% efectivo anual");
  });

  it("fuentes, unidades, cadencias y forma de la vigencia del §1 y el §2 del plan", () => {
    const resumen = CATALOGO.map((s) => [s.codigo, s.fuente, s.unidad, s.cadencia, s.vigencia.tipo]);
    expect(resumen).toEqual([
      ["TRM", "sfc:32sa-8pi3", "COP por USD", "VIGENCIA_DIARIA", "TRAMO"],
      ["TPM", "banrep:DF_CBR_DAILY_HIST.IRCBRM01.PA", "% anual", "DIARIA_CALENDARIO", "DIA"],
      ["IBR_3M_EA", "banrep:DF_IBR_DAILY_HIST.IRIBRM03.ER", "% efectivo anual", "DIAS_HABILES", "DIA"],
      ["IPC_INDICE", "dane:anex-IPC-Indices", "índice (base dic-2018 = 100)", "MENSUAL", "MES"],
    ]);
  });

  it("las cuatro entran por la vía B (el servicio de la TRM, C7, no está en esta versión)", () => {
    expect(new Set(CATALOGO.map((s) => s.entrada))).toEqual(new Set(["VIA_B"]));
  });

  it("solo la TRM se publica por adelantado; los umbrales de frescura sugeridos por el plan (TRM 3, TPM e IBR 7, IPC 45)", () => {
    expect(CATALOGO.map((s) => [s.codigo, s.adelantoMaximoDias, s.umbralFrescuraDias])).toEqual([
      ["TRM", 1, 3], ["TPM", 0, 7], ["IBR_3M_EA", 0, 7], ["IPC_INDICE", 0, 45],
    ]);
  });

  it("serieDelCatalogo: la serie o undefined (sin heredar de Object)", () => {
    expect(serieDelCatalogo("TRM")?.codigo).toBe("TRM");
    expect(serieDelCatalogo("UVR")).toBeUndefined();
    expect(serieDelCatalogo("constructor")).toBeUndefined();
    expect(serieDelCatalogo("trm")).toBeUndefined();
  });

  it("está congelado: ni el arreglo ni las series ni sus partes se pueden cambiar", () => {
    expect(Object.isFrozen(CATALOGO)).toBe(true);
    for (const s of CATALOGO) {
      expect(Object.isFrozen(s), s.codigo).toBe(true);
      expect(Object.isFrozen(s.rango), s.codigo).toBe(true);
      expect(Object.isFrozen(s.vigencia), s.codigo).toBe(true);
    }
  });
});

describe("catálogo · cabe en la base y en el CSV", () => {
  const serieChk = patronDelCheck("valor_serie_oficial_serie_chk", "serie");
  const fuenteChk = patronDelCheck("valor_serie_oficial_fuente_chk", "fuente");

  it.each(CATALOGO.map((s) => [s.codigo, s] as const))("%s: código y fuente pasan los CHECK de la migración", (_, s) => {
    expect(serieChk.test(s.codigo)).toBe(true);
    expect(fuenteChk.test(s.fuente)).toBe(true);
  });

  it.each(CATALOGO.map((s) => [s.codigo, s] as const))("%s: escala, rango, vigencia y adelanto que la base guarda tal cual", (_, s) => {
    expect(Number.isInteger(s.escala) && s.escala >= 0 && s.escala <= ESCALA_BASE).toBe(true);
    expect(s.rango.min).toMatch(decimal);
    expect(s.rango.max).toMatch(decimal);
    expect(s.rango.min).not.toBe("0");
    expect(s.rango.max.split(".")[0]!.length).toBeLessThanOrEqual(DIGITOS_ENTEROS_BASE);
    for (const lado of [s.rango.min, s.rango.max]) expect((lado.split(".")[1] ?? "").length).toBeLessThanOrEqual(s.escala);
    expect(Number(s.rango.min)).toBeLessThan(Number(s.rango.max));
    if (s.vigencia.tipo === "TRAMO") expect(s.vigencia.maxDias).toBeGreaterThanOrEqual(1);
    if (s.vigencia.tipo === "TRAMO") expect(s.vigencia.maxDias).toBeLessThanOrEqual(MAX_DIAS_VIGENCIA_BASE);
    expect(Number.isInteger(s.adelantoMaximoDias) && s.adelantoMaximoDias >= 0).toBe(true);
    expect(Number.isInteger(s.umbralFrescuraDias) && s.umbralFrescuraDias > 0).toBe(true);
  });

  it.each(CATALOGO.map((s) => [s.codigo, s] as const))("%s: su línea más larga cabe en el tope de línea del CSV", (_, s) => {
    expect(lineaMasLarga(s)).toBeLessThanOrEqual(MAX_LARGO_LINEA_SERIES);
  });

  it("los códigos y las fuentes no se repiten", () => {
    expect(new Set(CATALOGO.map((s) => s.codigo)).size).toBe(CATALOGO.length);
    expect(new Set(CATALOGO.map((s) => s.fuente)).size).toBe(CATALOGO.length);
  });

  it("control positivo: los patrones leídos de la migración muerden", () => {
    expect(serieChk.test("trm")).toBe(false);
    expect(fuenteChk.test("yahoo:TRM")).toBe(false);
  });
});

describe("catálogo · sin imports (lo podrá usar la pantalla)", () => {
  it("catalogo.ts no importa nada", () => {
    const codigo = readFileSync(path.join(RAIZ, "src", "datos-oficiales", "catalogo.ts"), "utf8");
    expect(codigo).not.toMatch(/^\s*import\b|\brequire\s*\(|\bimport\s*\(/m);
  });
});
