// exportar-trm (fase C · C2b), en proceso y sin red: los argumentos, la exportación al CSV canónico de series, el
// reporte (stderr) y el flujo completo del CLI con `buscar`, la salida y la terminal inyectados. Cifras y fechas
// inventadas (trm.ficticio.ts).
import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { ADELANTO_TRM_DIAS, CATALOGO } from "@/datos-oficiales/catalogo";
import {
  USO_EXPORTAR_TRM, correrExportarTrm, exportarTrm, leerArgumentosExportarTrm, reporteExportacionTrm, type EntornoExportarTrm, type ExportacionTrm, type ResultadoExportacionTrm,
} from "@/datos-oficiales/fuentes/exportar-trm";
import { MAX_DIAS_RANGO_TRM, trmDelCatalogo } from "@/datos-oficiales/fuentes/trm-sfc";
import { ENCABEZADO_CSV_SERIES, leerCsvSeries } from "@/datos-oficiales/series/csv-series";
import type { BuscarHttp } from "@/lib/http-acotado";
import { ErrorArgumentosCarga } from "@/precios/argumentos-carga";
import { SEMANA_FICTICIA, TIPO_JSON, VALORES_SEMANA, buscarProhibido, buscarQueResponde, dia, fila } from "./trm.ficticio";

const DIA_MS = 86_400_000;
const VIERNES = dia("2027-03-12");
const MARTES = dia("2027-03-16");
const ADELANTO = 1;
const iso = (d: Date): string => d.toISOString().slice(0, 10);
const CSV_SEMANA = [
  ENCABEZADO_CSV_SERIES,
  "TRM,2027-03-10,2027-03-10,4127.39,sfc:32sa-8pi3",
  "TRM,2027-03-11,2027-03-11,4131.8,sfc:32sa-8pi3",
  "TRM,2027-03-12,2027-03-12,4119.07,sfc:32sa-8pi3",
  "TRM,2027-03-13,2027-03-15,4108.53,sfc:32sa-8pi3",
  "TRM,2027-03-16,2027-03-16,4122.6,sfc:32sa-8pi3",
  "",
].join("\n");

/** El CSV de un resultado que debía tenerlo (si no, la prueba falla con el código). */
function csvDe(r: ResultadoExportacionTrm): string {
  if (!r.ok) throw new Error(`sin CSV: ${r.codigo}`);
  return r.csv;
}
const sinVigencia = (dias: number, primero: string) => ({ dias, primero: dia(primero) });

const argumentos = (argv: readonly string[], entorno: Record<string, string> = {}, hoy = VIERNES) => leerArgumentosExportarTrm(argv, entorno, hoy, ADELANTO);
function errorDe(argv: readonly string[], entorno: Record<string, string> = {}): string {
  try {
    argumentos(argv, entorno);
  } catch (e) {
    expect(e).toBeInstanceOf(ErrorArgumentosCarga);
    return (e as Error).message;
  }
  throw new Error("debía rechazar los argumentos");
}

describe("leerArgumentosExportarTrm", () => {
  it("--desde sola: --hasta es mañana (hoy + el adelanto de la TRM: la SFC la publica por adelantado)", () => {
    expect(argumentos(["--desde", "2027-03-10"])).toEqual({ desde: dia("2027-03-10"), hasta: dia("2027-03-13") });
  });

  it("--desde y --hasta, en cualquier orden; --hasta puede ser mañana", () => {
    expect(argumentos(["--hasta", "2027-03-11", "--desde", "2027-03-10"])).toEqual({ desde: dia("2027-03-10"), hasta: dia("2027-03-11") });
    expect(argumentos(["--desde", "2027-03-13", "--hasta", "2027-03-13"])).toEqual({ desde: dia("2027-03-13"), hasta: dia("2027-03-13") });
  });

  it(`un rango de exactamente ${MAX_DIAS_RANGO_TRM} días pasa; uno más, no`, () => {
    const hasta = dia("2027-03-13");
    const desde = new Date(hasta.getTime() - MAX_DIAS_RANGO_TRM * DIA_MS);
    expect(argumentos(["--desde", iso(desde), "--hasta", iso(hasta)])).toEqual({ desde, hasta });
    expect(errorDe(["--desde", iso(new Date(desde.getTime() - DIA_MS)), "--hasta", iso(hasta)])).toContain(`más de ${MAX_DIAS_RANGO_TRM} días`);
  });

  it.each<[string, readonly string[], string]>([
    ["sin argumentos", [], "Falta --desde"],
    ["--ayuda", ["--ayuda"], "Opción desconocida: «--ayuda»"],
    ["un argumento suelto", ["2027-03-10"], "Argumento suelto"],
    ["uno suelto al final", ["--desde", "2027-03-10", "suelto"], "Argumento suelto"],
    ["--desde sin valor", ["--desde"], "--desde necesita una fecha"],
    ["un valor que empieza por «-»", ["--desde", "-2027-03-10"], "--desde necesita una fecha"],
    ["--desde=valor", ["--desde=2027-03-10"], "Opción desconocida: «--desde»"],
    ["«--» antes de las opciones", ["--", "--desde", "2027-03-10"], "Opción desconocida."],
    ["--desde repetida", ["--desde", "2027-03-10", "--desde", "2027-03-11"], "--desde está repetida"],
    ["una fecha que no existe", ["--desde", "2027-02-29"], "--desde debe ser una fecha AAAA-MM-DD válida"],
    ["una fecha sin ceros", ["--desde", "2027-3-10"], "--desde debe ser una fecha AAAA-MM-DD válida"],
    ["un --hasta inválido", ["--desde", "2027-03-10", "--hasta", "mañana"], "--hasta debe ser una fecha AAAA-MM-DD válida"],
    ["el rango al revés", ["--desde", "2027-03-11", "--hasta", "2027-03-10"], "Rango inválido"],
    ["--hasta pasado mañana", ["--desde", "2027-03-10", "--hasta", "2027-03-14"], "Rango inválido"],
    ["--desde pasado mañana", ["--desde", "2027-03-14"], "Rango inválido"],
    ["una opción con caracteres de control", ["--de\u001b[31msde", "x"], "Opción desconocida."],
  ])("%s: ErrorArgumentosCarga, sin repetir fechas", (_caso, argv, esperado) => {
    const mensaje = errorDe(argv);
    expect(mensaje).toContain(esperado);
    expect(mensaje).not.toMatch(/20[0-9]{2}-/);
    expect(mensaje).not.toContain("\u001b");
  });

  it("trampa de npm: la opción quedó en npm_config_* y no llegó; si llegó, no importa la variable", () => {
    expect(errorDe([], { npm_config_desde: "2027-03-10" })).toContain("npm se quedó con --desde");
    expect(errorDe(["--desde", "2027-03-10"], { npm_config_hasta: "2027-03-11" })).toContain("npm se quedó con --hasta");
    expect(argumentos(["--desde", "2027-03-10"], { npm_config_desde: "2027-03-10" })).toEqual({ desde: dia("2027-03-10"), hasta: dia("2027-03-13") });
  });

  // code-reviewer BAJO: el uso imprime ADELANTO_TRM_DIAS y la lógica usa el adelanto de la serie: son el mismo.
  it("el adelanto del uso es el de la TRM del catálogo", () => {
    expect(trmDelCatalogo()!.serie.adelantoMaximoDias).toBe(ADELANTO_TRM_DIAS);
    expect(USO_EXPORTAR_TRM).toContain(`hoy + ${ADELANTO_TRM_DIAS} día(s)`);
  });

  it("el uso dice el comando, el adelanto, el tope del rango y las salidas", () => {
    expect(USO_EXPORTAR_TRM).toContain("Uso: npx tsx scripts/exportar-trm.ts --desde AAAA-MM-DD [--hasta AAAA-MM-DD]");
    expect(USO_EXPORTAR_TRM).toContain(String(MAX_DIAS_RANGO_TRM));
    expect(USO_EXPORTAR_TRM).toContain("Salida: 0");
  });
});

describe("exportarTrm · el CSV canónico de series", () => {
  it("una semana: el CSV exacto, con la fuente del catálogo, que el importador acepta igual (ida y vuelta)", async () => {
    const { buscar, pedidos } = buscarQueResponde(SEMANA_FICTICIA);
    const r = await exportarTrm({ desde: dia("2027-03-10"), hasta: MARTES, hoy: MARTES, buscar });
    expect(r).toEqual({
      ok: true, csv: CSV_SEMANA, filas: 5, descartadas: 0, primeraDesde: dia("2027-03-10"), ultimaHasta: MARTES, sinVigencia: null,
    });
    expect(pedidos).toHaveLength(1);
    const leido = leerCsvSeries(new TextEncoder().encode(csvDe(r)), MARTES);
    expect(leido.ok && leido.series.map((s) => [s.codigo, s.fuente, s.valores.map((v) => v.valor)])).toEqual([["TRM", "sfc:32sa-8pi3", [...VALORES_SEMANA]]]);
    expect(leerCsvSeries(new TextEncoder().encode(csvDe(r)), new Date(MARTES.getTime() + 30 * DIA_MS)).ok).toBe(true);
  });

  it("el viernes trae la vigencia de sábado a lunes, publicada por adelantado (desde = mañana)", async () => {
    const { buscar } = buscarQueResponde(SEMANA_FICTICIA.slice(0, 4));
    const r = await exportarTrm({ desde: dia("2027-03-10"), hasta: dia("2027-03-13"), hoy: VIERNES, buscar });
    expect(r).toMatchObject({ ok: true, filas: 4, ultimaHasta: dia("2027-03-15"), sinVigencia: null });
  });

  it("una fila con valor inválido queda fuera, se cuenta y deja un día sin vigencia: el CSV trae el resto", async () => {
    const { buscar } = buscarQueResponde([SEMANA_FICTICIA[0], fila("2027-03-11", "2027-03-11", "4131,80"), ...SEMANA_FICTICIA.slice(2)]);
    const r = await exportarTrm({ desde: dia("2027-03-10"), hasta: MARTES, hoy: MARTES, buscar });
    expect(r).toMatchObject({ ok: true, filas: 4, descartadas: 1, sinVigencia: sinVigencia(1, "2027-03-11") });
    expect(csvDe(r)).not.toContain("2027-03-11");
    expect(leerCsvSeries(new TextEncoder().encode(csvDe(r)), MARTES).ok).toBe(true);
  });

  it("días sin vigencia entre dos filas de la fuente: los cuenta, con el primero", async () => {
    const { buscar } = buscarQueResponde([fila("2027-03-10", "2027-03-10", "4127.39"), fila("2027-03-13", "2027-03-15", "4108.53"), fila("2027-03-16", "2027-03-16", "4122.6")]);
    const r = await exportarTrm({ desde: dia("2027-03-10"), hasta: MARTES, hoy: MARTES, buscar });
    expect(r).toMatchObject({ ok: true, filas: 3, descartadas: 0, sinVigencia: sinVigencia(2, "2027-03-11") });
  });

  // code-reviewer MEDIO: varios huecos separados se suman y el primero es el más temprano.
  it("tres huecos separados (11, 13 y 15): suma 3 y el primero es el 11", async () => {
    const { buscar } = buscarQueResponde([fila("2027-03-10", "2027-03-10", "4127.39"), fila("2027-03-12", "2027-03-12", "4119.07"), fila("2027-03-14", "2027-03-14", "4113.29"), fila("2027-03-16", "2027-03-16", "4122.6")]);
    const r = await exportarTrm({ desde: dia("2027-03-10"), hasta: MARTES, hoy: MARTES, buscar });
    expect(r).toMatchObject({ ok: true, filas: 4, sinVigencia: sinVigencia(3, "2027-03-11") });
  });

  // code-reviewer MEDIO y security-reviewer BAJO-1: una respuesta corta por la cola o por la cabeza no salía 0 en silencio.
  it("la fuente no trae los últimos días del rango (ya pasados): los cuenta desde el primero que falta", async () => {
    const { buscar } = buscarQueResponde(SEMANA_FICTICIA.slice(0, 3));
    const r = await exportarTrm({ desde: dia("2027-03-10"), hasta: MARTES, hoy: MARTES, buscar });
    expect(r).toMatchObject({ ok: true, filas: 3, sinVigencia: sinVigencia(4, "2027-03-13") });
  });

  it("la fuente no trae los primeros días del rango: los cuenta desde --desde", async () => {
    const { buscar } = buscarQueResponde(SEMANA_FICTICIA.slice(2));
    const r = await exportarTrm({ desde: dia("2027-03-10"), hasta: MARTES, hoy: MARTES, buscar });
    expect(r).toMatchObject({ ok: true, filas: 3, sinVigencia: sinVigencia(2, "2027-03-10") });
  });

  it("la vigencia de mañana aún sin publicar no es un hueco (el viernes sin la de sábado a lunes): 0", async () => {
    const { buscar } = buscarQueResponde(SEMANA_FICTICIA.slice(0, 3));
    const r = await exportarTrm({ desde: dia("2027-03-10"), hasta: dia("2027-03-13"), hoy: VIERNES, buscar });
    expect(r).toMatchObject({ ok: true, filas: 3, sinVigencia: null });
  });

  it("un rango ya pasado se mide hasta --hasta, no hasta hoy", async () => {
    const { buscar } = buscarQueResponde(SEMANA_FICTICIA.slice(0, 3));
    const r = await exportarTrm({ desde: dia("2027-03-10"), hasta: VIERNES, hoy: dia("2027-04-15"), buscar });
    expect(r).toMatchObject({ ok: true, filas: 3, sinVigencia: null });
  });

  it("una vigencia que empieza antes de --desde lo cubre: sin hueco al inicio", async () => {
    const { buscar } = buscarQueResponde(SEMANA_FICTICIA.slice(3));
    const r = await exportarTrm({ desde: dia("2027-03-14"), hasta: MARTES, hoy: MARTES, buscar });
    expect(r).toMatchObject({ ok: true, filas: 2, sinVigencia: null, primeraDesde: dia("2027-03-13") });
  });

  it("un descartado en el borde final también cuenta como día sin vigencia", async () => {
    const { buscar } = buscarQueResponde([...SEMANA_FICTICIA.slice(0, 4), fila("2027-03-16", "2027-03-16", "4122,6")]);
    const r = await exportarTrm({ desde: dia("2027-03-10"), hasta: MARTES, hoy: MARTES, buscar });
    expect(r).toMatchObject({ ok: true, filas: 4, descartadas: 1, sinVigencia: { dias: 1, primero: MARTES } });
  });

  it.each<[string, unknown, string, number]>([
    ["sin TRM en el rango", [], "SIN_FILAS", 0],
    ["todas descartadas", [fila("2027-03-10", "2027-03-10", "x"), fila("2027-03-11", "2027-03-11", "y")], "SIN_FILAS", 2],
    ["una unidad que no es COP", [fila("2027-03-10", "2027-03-10", "4127.39", "USD")], "TRM_UNIDAD", 0],
  ])("%s: sin CSV, con el código (%s)", async (_caso, cuerpo, esperado, descartadas) => {
    const { buscar } = buscarQueResponde(cuerpo);
    const r = await exportarTrm({ desde: dia("2027-03-10"), hasta: MARTES, hoy: MARTES, buscar });
    expect(r).toEqual({ ok: false, codigo: esperado, descartadas });
  });

  it("la SFC falla: sin CSV, con el código de la fuente", async () => {
    const { buscar } = buscarQueResponde("[]", { status: 503, headers: TIPO_JSON });
    expect(await exportarTrm({ desde: dia("2027-03-10"), hasta: MARTES, hoy: MARTES, buscar })).toEqual({ ok: false, codigo: "TRM_HTTP_503", descartadas: 0 });
  });

  it("una vigencia que el importador rechazaría (empieza después de mañana): FILA_INVALIDA, sin CSV", async () => {
    const { buscar } = buscarQueResponde(SEMANA_FICTICIA);
    expect(await exportarTrm({ desde: dia("2027-03-10"), hasta: MARTES, hoy: VIERNES, buscar })).toEqual({ ok: false, codigo: "FILA_INVALIDA", descartadas: 0 });
  });

  it("si el catálogo no trae la TRM (o cambió su forma): TRM_CATALOGO sin salir a la red", async () => {
    const { buscar, llamado } = buscarProhibido();
    const r = await exportarTrm({ desde: dia("2027-03-10"), hasta: MARTES, hoy: MARTES, buscar, catalogo: CATALOGO.filter((s) => s.codigo !== "TRM") });
    expect(r).toEqual({ ok: false, codigo: "TRM_CATALOGO", descartadas: 0 });
    expect(llamado()).toBe(false);
  });
});

const base: ExportacionTrm = {
  ok: true, csv: CSV_SEMANA, filas: 5, descartadas: 0, primeraDesde: dia("2027-03-10"), ultimaHasta: MARTES, sinVigencia: null,
};
const textoDe = (r: ResultadoExportacionTrm): string => reporteExportacionTrm(r).lineas.join("\n");

describe("reporteExportacionTrm · stderr: conteos, códigos y fechas, nunca valores", () => {
  it("bien: 0, con filas, la primera vigencia y la última", () => {
    const rep = reporteExportacionTrm(base);
    expect(rep.codigoSalida).toBe(0);
    expect(rep.lineas).toEqual(["✅ TRM · SFC (datos.gov.co, 32sa-8pi3) · filas en el CSV: 5 · desde 2027-03-10 hasta 2027-03-16 · descartadas: 0"]);
  });

  it("filas descartadas: 3, con TRM_VALOR_INVALIDO (el CSV trae el resto)", () => {
    const rep = reporteExportacionTrm({ ...base, filas: 4, descartadas: 1, sinVigencia: sinVigencia(1, "2027-03-11") });
    expect(rep.codigoSalida).toBe(3);
    expect(rep.lineas.join("\n")).toContain("⚠️  TRM · 1 fila(s) descartada(s) (TRM_VALOR_INVALIDO)");
    expect(rep.lineas.join("\n")).toContain("⚠️  TRM · 1 día(s) del rango sin vigencia (el primero: 2027-03-11)");
  });

  it("días sin vigencia sin descartes: 3", () => {
    const rep = reporteExportacionTrm({ ...base, sinVigencia: sinVigencia(2, "2027-03-11") });
    expect(rep.codigoSalida).toBe(3);
    expect(rep.lineas.join("\n")).not.toContain("TRM_VALOR_INVALIDO");
  });

  it.each([
    ["TRM_RED", "red o plazo"],
    ["TRM_TIPO", "no respondió JSON"],
    ["TRM_FORMATO", "pida un rango más corto"],
    ["TRM_TRUNCADO", "pida un rango más corto"],
    ["TRM_UNIDAD", "COP"],
    ["TRM_VIGENCIA", "días"],
    ["TRM_SOLAPE", "se solapan"],
    ["TRM_CATALOGO", "catálogo"],
    ["TRM_RANGO_INVALIDO", "rango"],
    ["SIN_FILAS", "no trajo vigencias"],
    ["FILA_INVALIDA", "importador"],
    ["CSV_DEMASIADO_GRANDE", "rango más corto"],
    ["TRM_HTTP_503", "respondió con error"],
  ])("%s: 1, sin CSV, con su indicación", (codigo, indicacion) => {
    const rep = reporteExportacionTrm({ ok: false, codigo, descartadas: 0 });
    expect(rep.codigoSalida).toBe(1);
    expect(rep.lineas.at(-1)).toContain(`❌ ${codigo} · `);
    expect(rep.lineas.at(-1)).toContain(indicacion);
    expect(rep.lineas.at(-1)).toContain("no se escribió el CSV");
  });

  it("sin CSV y con descartes: 1, el conteo sin «el CSV trae el resto» y el código al final", () => {
    const rep = reporteExportacionTrm({ ok: false, codigo: "SIN_FILAS", descartadas: 2 });
    expect(rep.codigoSalida).toBe(1);
    expect(rep.lineas).toHaveLength(2);
    expect(rep.lineas[0]).toContain("⚠️  TRM · 2 fila(s) descartada(s) (TRM_VALOR_INVALIDO)");
    expect(rep.lineas[0]).not.toContain("el CSV trae el resto");
    expect(rep.lineas[1]).toContain("❌ SIN_FILAS · ");
  });

  it("un código que no está en la lista: 1, con una indicación genérica (nunca se queda sin línea)", () => {
    const rep = reporteExportacionTrm({ ok: false, codigo: "TRM_OTRO", descartadas: 0 });
    expect(rep).toEqual({ codigoSalida: 1, lineas: ["❌ TRM_OTRO · fallo de la fuente; no se escribió el CSV."] });
  });

  it("nunca imprime valores", () => {
    const casos: ResultadoExportacionTrm[] = [base, { ...base, descartadas: 3, sinVigencia: sinVigencia(4, "2027-03-11") }, { ok: false, codigo: "SIN_FILAS", descartadas: 2 }];
    for (const r of casos) {
      for (const v of VALORES_SEMANA) expect(textoDe(r), v).not.toContain(v);
    }
  });
});

/** Una salida que guarda lo escrito. */
function salidaQueGuarda(): { salida: Writable; escrito: () => string } {
  const partes: string[] = [];
  const salida = new Writable({
    write(trozo, _cod, listo) {
      partes.push(String(trozo));
      listo();
    },
  });
  return { salida, escrito: () => partes.join("") };
}

function entorno(argv: readonly string[], buscar: BuscarHttp, extra: Partial<EntornoExportarTrm> = {}): { e: EntornoExportarTrm; errores: string[]; escrito: () => string } {
  const errores: string[] = [];
  const { salida, escrito } = salidaQueGuarda();
  const e: EntornoExportarTrm = { argv, entorno: {}, ahora: new Date("2027-03-16T15:00:00Z"), buscar, esTerminal: false, salida, error: (l) => errores.push(l), ...extra };
  return { e, errores, escrito };
}

describe("correrExportarTrm · el CLI entero, sin red", () => {
  it("bien: el CSV a la salida, el reporte a stderr y 0", async () => {
    const { buscar } = buscarQueResponde(SEMANA_FICTICIA);
    const { e, errores, escrito } = entorno(["--desde", "2027-03-10", "--hasta", "2027-03-16"], buscar);
    expect(await correrExportarTrm(e)).toBe(0);
    expect(escrito()).toBe(CSV_SEMANA);
    expect(errores).toEqual(reporteExportacionTrm(base).lineas);
  });

  it("con descartes: 3, y el CSV sale igual", async () => {
    const { buscar } = buscarQueResponde([SEMANA_FICTICIA[0], fila("2027-03-11", "2027-03-11", "x"), ...SEMANA_FICTICIA.slice(2)]);
    const { e, errores, escrito } = entorno(["--desde", "2027-03-10", "--hasta", "2027-03-16"], buscar);
    expect(await correrExportarTrm(e)).toBe(3);
    expect(escrito()).toContain("TRM,2027-03-16,2027-03-16");
    expect(errores.join("\n")).toContain("TRM_VALOR_INVALIDO");
  });

  it("argumentos inválidos: 2, con el error y el uso, sin salir a la red ni escribir", async () => {
    const { buscar, llamado } = buscarProhibido();
    const { e, errores, escrito } = entorno(["--ayuda"], buscar);
    expect(await correrExportarTrm(e)).toBe(2);
    expect(errores).toEqual(["❌ Opción desconocida: «--ayuda».", USO_EXPORTAR_TRM]);
    expect(llamado()).toBe(false);
    expect(escrito()).toBe("");
  });

  it("con la salida en una terminal: 2 SALIDA_TERMINAL, sin salir a la red ni escribir", async () => {
    const { buscar, llamado } = buscarProhibido();
    const { e, errores, escrito } = entorno(["--desde", "2027-03-10"], buscar, { esTerminal: true });
    expect(await correrExportarTrm(e)).toBe(2);
    expect(errores.join("\n")).toContain("SALIDA_TERMINAL");
    expect(llamado()).toBe(false);
    expect(escrito()).toBe("");
  });

  it("la SFC falla: 1, sin escribir nada en la salida", async () => {
    const { buscar } = buscarQueResponde("<html></html>", { headers: { "content-type": "text/html" } });
    const { e, errores, escrito } = entorno(["--desde", "2027-03-10"], buscar);
    expect(await correrExportarTrm(e)).toBe(1);
    expect(errores.join("\n")).toContain("❌ TRM_TIPO");
    expect(escrito()).toBe("");
  });

  it("la salida se cerró a mitad (EPIPE): 1 SALIDA_CERRADA", async () => {
    const { buscar } = buscarQueResponde(SEMANA_FICTICIA);
    const rota = new Writable({
      write(_t, _c, listo) {
        listo(Object.assign(new Error("tubo"), { code: "EPIPE" }));
      },
    });
    const { e, errores } = entorno(["--desde", "2027-03-10", "--hasta", "2027-03-16"], buscar, { salida: rota });
    expect(await correrExportarTrm(e)).toBe(1);
    expect(errores.join("\n")).toContain("SALIDA_CERRADA");
    expect(errores.join("\n")).not.toContain("✅");
  });

  it("si el catálogo no trae la TRM: 1 TRM_CATALOGO, sin salir a la red", async () => {
    const { buscar, llamado } = buscarProhibido();
    const { e, errores } = entorno(["--desde", "2027-03-10"], buscar, { catalogo: CATALOGO.filter((s) => s.codigo !== "TRM") });
    expect(await correrExportarTrm(e)).toBe(1);
    expect(errores.join("\n")).toContain("TRM_CATALOGO");
    expect(llamado()).toBe(false);
  });

  it.each([
    ["2027-03-13T04:59:59Z", "2027-03-13"],
    ["2027-03-13T05:00:00Z", "2027-03-14"],
  ])("hoy es la fecha de Bogotá, una sola vez: a las %s el --hasta por defecto es %s", async (ahora, hasta) => {
    const { buscar, pedidos } = buscarQueResponde([]);
    const { e } = entorno(["--desde", "2027-03-10"], buscar, { ahora: new Date(ahora) });
    await correrExportarTrm(e);
    expect(new URL(pedidos[0]!.url).searchParams.get("$where")).toBe(`vigenciahasta >= '2027-03-10T00:00:00' AND vigenciadesde <= '${hasta}T00:00:00'`);
  });
});
