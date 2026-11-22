// `importarSeries` (el CSV de series ya validado → el camino único de guardar.ts, serie por serie) y lo que imprime
// scripts/importar-series.ts: conteos, códigos de serie (públicos) y fechas, nunca valores ni mensajes de error; salida
// 0 bien · 3 con avisos · 2 uso o archivo ilegible · 1 CSV rechazado o error; en producción (vía B) todo fallo termina
// con PARE_VIA_B y ningún texto invita a repetir por su cuenta. Cifras inventadas; fechas de 2027 o anteriores a 2022.
import { describe, expect, it } from "vitest";
import { PARE_VIA_B } from "@/cli/via-b";
import { USO_IMPORTAR_SERIES } from "@/datos-oficiales/series/argumentos";
import { ENCABEZADO_CSV_SERIES, MAX_BYTES_CSV_SERIES, leerCsvSeries } from "@/datos-oficiales/series/csv-series";
import type { BalanceSerie } from "@/datos-oficiales/series/guardar";
import {
  emitir, importarSeries, salidaArchivo, salidaCsvInvalido, salidaImportacion, salidaInesperada, salidaUso, type ResultadoImportacionSeries,
} from "@/datos-oficiales/series/importar";
import { MAX_ERRORES_CONTADOS } from "@/precios/csv-cierres";
import { baseFalsaSeries, errorConocido } from "./base-falsa-series";

const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);
const HOY = dia("2027-06-15");
const LOCAL = { produccion: false };
const PROD = { produccion: true };
const TRM = "sfc:32sa-8pi3";
const TPM = "banrep:DF_CBR_DAILY_HIST.IRCBRM01.PA";

function lectura(...filas: string[]) {
  const r = leerCsvSeries(new TextEncoder().encode(`${ENCABEZADO_CSV_SERIES}\n${filas.map((f) => `${f}\n`).join("")}`), HOY);
  if (!r.ok) throw new Error(JSON.stringify(r.errores));
  return r;
}

const balance = (codigo: string, extra: Partial<BalanceSerie> = {}): BalanceSerie => ({
  codigo, filas: 3, nuevas: 1, revisadas: 1, retiradas: 1, sinCambios: 1, diasDescubiertos: 0, ultimoHasta: dia("2027-03-08"), fallo: null, ...extra,
});
const resultado = (...series: BalanceSerie[]): ResultadoImportacionSeries => ({ filas: series.reduce((a, s) => a + s.filas, 0), series });

describe("importarSeries · el CSV por el camino único", () => {
  it("guarda serie por serie con la fuente del catálogo y devuelve un balance por serie, en el orden del CSV", async () => {
    const b = baseFalsaSeries({ previas: [{ serie: "TPM", desde: "2027-03-08", hasta: "2027-03-08", valor: "9.37", fuente: TPM }] });
    const r = await importarSeries(b.db, lectura(`TRM,2027-03-05,2027-03-07,4613.27,${TRM}`, `TPM,2027-03-08,2027-03-08,9.37,${TPM}`, `TRM,2027-03-08,2027-03-08,4613.29,${TRM}`));
    expect(r.filas).toBe(3);
    expect(r.series.map((s) => [s.codigo, s.filas, s.nuevas, s.sinCambios, s.fallo])).toEqual([["TRM", 2, 2, 0, null], ["TPM", 1, 0, 1, null]]);
    expect(b.llamadas.creadas.flat().map((d) => [d.serie, d.fuente])).toEqual([["TRM", TRM], ["TRM", TRM]]);
  });

  it("una serie que falla no frena las demás", async () => {
    const b = baseFalsaSeries({ falloSiempre: { serie: "TRM", error: () => errorConocido("P2028") } });
    const r = await importarSeries(b.db, lectura(`TRM,2027-03-05,2027-03-07,4613.27,${TRM}`, `TPM,2027-03-08,2027-03-08,9.37,${TPM}`));
    expect(r.series.map((s) => [s.codigo, s.fallo?.codigo ?? null])).toEqual([["TRM", "GUARDADO_ERROR"], ["TPM", null]]);
  });
});

describe("salidaImportacion · el reporte", () => {
  it("todo bien: 0, conteos por serie y el último hasta; nada por stderr", () => {
    const s = salidaImportacion(resultado(balance("TRM"), balance("TPM", { ultimoHasta: null, filas: 2 })), LOCAL);
    expect(s).toEqual({
      codigoSalida: 0,
      lineas: [
        "📄 CSV de series · filas: 5 · series: 2",
        "✅ TRM · filas: 3 · nuevas: 1 · revisadas: 1 · retiradas: 1 · sin cambios: 1 · último hasta: 2027-03-08",
        "✅ TPM · filas: 2 · nuevas: 1 · revisadas: 1 · retiradas: 1 · sin cambios: 1 · último hasta: sin datos",
      ],
      errores: [],
    });
  });

  it("días que una revisión dejó sin vigente: 3 con el aviso (la fuente acortó una vigencia)", () => {
    const s = salidaImportacion(resultado(balance("TRM", { diasDescubiertos: 2 })), LOCAL);
    expect(s.codigoSalida).toBe(3);
    expect(s.errores).toEqual(["⚠️  TRM · 2 día(s) quedaron sin vigente al revisar: la fuente acortó una vigencia; revíselo antes de usar la serie."]);
  });

  it("una serie con fallo: 3, su código y detalle, cuántas filas quedaron sin guardar y, en local, que se puede repetir", () => {
    const s = salidaImportacion(resultado(balance("TPM", { fallo: { codigo: "GUARDADO_ERROR", detalle: "PrismaClientUnknownRequestError", sinGuardar: 500 } })), LOCAL);
    expect(s.codigoSalida).toBe(3);
    expect(s.lineas[1]).toBe("⚠️  TPM · filas: 3 · nuevas: 1 · revisadas: 1 · retiradas: 1 · sin cambios: 1 · último hasta: 2027-03-08");
    expect(s.errores).toEqual(["⚠️  TPM · GUARDADO_ERROR · PrismaClientUnknownRequestError · sin guardar: 500. Vuelva a correr el mismo CSV: completa sin duplicar."]);
  });

  it("en producción no invita a repetir y termina con PARE_VIA_B; si todo sale bien, no lo dice", () => {
    const mal = salidaImportacion(resultado(balance("TPM", { fallo: { codigo: "BASE_ERROR", sinGuardar: 0 } })), PROD);
    expect(mal.errores).toEqual(["⚠️  TPM · BASE_ERROR · sin guardar: 0.", PARE_VIA_B]);
    expect(salidaImportacion(resultado(balance("TPM")), PROD).errores).toEqual([]);
  });
});

describe("salidas de error del CLI", () => {
  it("uso: 2 con el mensaje y el uso; en producción, PARE_VIA_B al final", () => {
    expect(salidaUso("Falta --archivo <series.csv>.", LOCAL)).toEqual({ codigoSalida: 2, lineas: [], errores: ["❌ Falta --archivo <series.csv>.", USO_IMPORTAR_SERIES] });
    expect(salidaUso("x", PROD).errores.at(-1)).toBe(PARE_VIA_B);
  });

  it("archivo: ilegible o no regular sale con 2; más grande que el tope, con 1 (CSV_DEMASIADO_GRANDE)", () => {
    expect(salidaArchivo("ARCHIVO_ILEGIBLE", LOCAL)).toEqual({ codigoSalida: 2, lineas: [], errores: ["❌ ARCHIVO_ILEGIBLE · no se pudo leer el CSV indicado (debe ser un archivo regular); no se tocó la base."] });
    expect(salidaArchivo("ARCHIVO_NO_REGULAR", LOCAL).codigoSalida).toBe(2);
    expect(salidaArchivo("ARCHIVO_DEMASIADO_GRANDE", LOCAL)).toEqual({ codigoSalida: 1, lineas: [], errores: [`❌ CSV_DEMASIADO_GRANDE · el archivo pasa de ${MAX_BYTES_CSV_SERIES} bytes; no se guardó nada.`] });
    expect(salidaArchivo("ARCHIVO_ILEGIBLE", PROD).errores.at(-1)).toBe(PARE_VIA_B);
  });

  it("CSV rechazado: 1 con línea y código (y «al menos» si se dejó de leer); el demasiado grande, con su línea", () => {
    const s = salidaCsvInvalido({ ok: false, codigo: "CSV_INVALIDO", errores: [{ linea: 3, codigo: "SOLAPE" }], totalErrores: 1 }, LOCAL);
    expect(s).toEqual({ codigoSalida: 1, lineas: [], errores: ["❌ CSV_INVALIDO · 1 error(es); no se guardó nada:", "   · línea 3 · SOLAPE"] });
    const cortado = salidaCsvInvalido({ ok: false, codigo: "CSV_INVALIDO", errores: [{ linea: 2, codigo: "COLUMNAS" }], totalErrores: MAX_ERRORES_CONTADOS }, PROD);
    expect(cortado.errores.at(-2)).toContain("al menos");
    expect(cortado.errores.at(-1)).toBe(PARE_VIA_B);
    expect(salidaCsvInvalido({ ok: false, codigo: "CSV_DEMASIADO_GRANDE", errores: [], totalErrores: 0 }, LOCAL).errores).toEqual([`❌ CSV_DEMASIADO_GRANDE · el archivo pasa de ${MAX_BYTES_CSV_SERIES} bytes; no se guardó nada.`]);
  });

  it("inesperado: 1 con solo el nombre y el código del error, nunca su mensaje", () => {
    const s = salidaInesperada(errorConocido("P1001"), PROD);
    expect(s).toEqual({ codigoSalida: 1, lineas: [], errores: ["❌ La importación de series falló: PrismaClientKnownRequestError P1001.", PARE_VIA_B] });
    expect(JSON.stringify(s)).not.toContain("4613.27");
  });

  it("emitir: las líneas por stdout, después los errores por stderr, y devuelve el código", () => {
    const vistas: string[] = [];
    const codigo = emitir({ codigoSalida: 3, lineas: ["a", "b"], errores: ["c"] }, { log: (l) => vistas.push(`out ${l}`), error: (l) => vistas.push(`err ${l}`) });
    expect([codigo, vistas]).toEqual([3, ["out a", "out b", "err c"]]);
  });
});
