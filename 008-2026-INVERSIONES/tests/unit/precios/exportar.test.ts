// `exportarPrecios` (en el Mac, con red): pide a Yahoo `<NEMO>.CL` por especie, en serie y con pausa, y arma el CSV
// de cierres que acepta `precios:importar`. Nunca deja en el CSV una barra que aún no es definitiva al exportar (la
// de hoy antes de la hora): importada más tarde pasaría como cierre. Una especie que falla queda fuera y se informa
// por su línea de la lista. Sin red: `buscar` siempre es un doble. Especies FICT, precios y fechas inventados.
import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { leerCsvCierres } from "@/precios/csv-cierres";
import { PAUSA_ENTRE_PEDIDOS_MS, escribirCompleto, exportarPrecios } from "@/precios/exportar";
import { reporteExportacion, SALIDA_CON_AVISOS } from "@/precios/reporte";
import type { Buscar } from "@/precios/yahoo";

const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);
const ts = (iso: string, hora = 14) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)), hora, 30) / 1000;
interface Barra { readonly dia: string; readonly close: number; readonly volume: number | null }
const respuesta = (barras: readonly Barra[]) => new Response(JSON.stringify({
  chart: { result: [{ meta: { currency: "COP" }, timestamp: barras.map((b) => ts(b.dia)), indicators: { quote: [{ close: barras.map((b) => b.close), volume: barras.map((b) => b.volume) }] } }] },
}));

/** Yahoo falso por símbolo; guarda los símbolos pedidos. Un símbolo sin barras responde 404. */
function yahoo(porSimbolo: Readonly<Record<string, readonly Barra[] | "lanza">>) {
  const pedidos: string[] = [];
  const buscar: Buscar = async (url) => {
    const simbolo = decodeURIComponent(String(url).split("/chart/")[1]!.split("?")[0]!);
    pedidos.push(simbolo);
    const barras = porSimbolo[simbolo];
    if (barras === "lanza") throw new TypeError("sin red ficticia 5544");
    return barras ? respuesta(barras) : new Response("no", { status: 404 });
  };
  return { buscar, pedidos };
}

const DESDE = utc("2024-03-11");
const HASTA = utc("2024-03-15");
/** Viernes 15-mar 14:00 en Colombia: la barra de ese día todavía no es definitiva. */
const AHORA = new Date("2024-03-15T19:00:00Z");
const lista = (...nemos: string[]) => nemos.map((nemotecnico, i) => ({ nemotecnico, linea: i + 1 }));
const sinPausa = async () => {};

describe("exportarPrecios", () => {
  it("pide <NEMO>.CL en serie y escribe un CSV que el importador acepta, sin la barra de hoy antes de la hora", async () => {
    const y = yahoo({
      "FICTA.CL": [{ dia: "2024-03-11", close: 1000.5, volume: 10 }, { dia: "2024-03-14", close: 1001, volume: null }, { dia: "2024-03-15", close: 1002, volume: 3 }],
      "FICTB.CL": [{ dia: "2024-03-12", close: 20, volume: 0 }],
    });
    const r = await exportarPrecios({ lista: lista("FICTA", "FICTB"), desde: DESDE, hasta: HASTA, ahora: AHORA, buscar: y.buscar, esperar: sinPausa });
    expect(y.pedidos).toEqual(["FICTA.CL", "FICTB.CL"]);
    expect(r).toMatchObject({ especies: 2, conCierres: 2, filas: 3, descartadas: 1, fallidas: [], codigoCsv: null });
    expect(r.csv).toBe("nemotecnico,fecha,cierre,volumen\nFICTA,2024-03-11,1000.5,10\nFICTA,2024-03-14,1001,\nFICTB,2024-03-12,20,0\n");
    const leido = leerCsvCierres(new TextEncoder().encode(r.csv!));
    expect(leido.ok && leido.filas).toBe(3);
  });

  it("descarta las barras fuera de [desde, hasta] (Yahoo puede traer el día siguiente)", async () => {
    const y = yahoo({ "FICTA.CL": [{ dia: "2024-03-08", close: 9, volume: 1 }, { dia: "2024-03-12", close: 10, volume: 1 }, { dia: "2024-03-13", close: 11, volume: 1 }] });
    const r = await exportarPrecios({ lista: lista("FICTA"), desde: DESDE, hasta: utc("2024-03-12"), ahora: AHORA, buscar: y.buscar, esperar: sinPausa });
    expect(r).toMatchObject({ filas: 1, descartadas: 2 });
  });

  it("una especie con fallo de Yahoo, que lanza o con volumen fraccionario queda fuera, informada por su línea", async () => {
    const y = yahoo({ "FICTA.CL": [{ dia: "2024-03-11", close: 10, volume: 1 }], "FICTC.CL": "lanza", "FICTD.CL": [{ dia: "2024-03-11", close: 10, volume: 1.5 }] });
    const r = await exportarPrecios({ lista: lista("FICTA", "FICTB", "FICTC", "FICTD"), desde: DESDE, hasta: HASTA, ahora: AHORA, buscar: y.buscar, esperar: sinPausa });
    expect(r.fallidas).toEqual([{ linea: 2, codigo: "YAHOO_HTTP_404" }, { linea: 3, codigo: "YAHOO_RED" }, { linea: 4, codigo: "VOLUMEN_NO_ENTERO" }]);
    expect(r).toMatchObject({ especies: 4, conCierres: 1, filas: 1, codigoCsv: null });
    expect(r.csv).toBe("nemotecnico,fecha,cierre,volumen\nFICTA,2024-03-11,10,1\n");
    expect(JSON.stringify(r.fallidas)).not.toContain("5544");
  });

  it("sin ninguna fila: no hay CSV (SIN_FILAS)", async () => {
    const r = await exportarPrecios({ lista: lista("FICTA"), desde: DESDE, hasta: HASTA, ahora: AHORA, buscar: yahoo({}).buscar, esperar: sinPausa });
    expect(r).toMatchObject({ csv: null, codigoCsv: "SIN_FILAS", filas: 0 });
  });

  it(`espera ${PAUSA_ENTRE_PEDIDOS_MS} ms entre pedidos (uso moderado de Yahoo), no antes del primero`, async () => {
    const pausas: number[] = [];
    const y = yahoo({});
    await exportarPrecios({ lista: lista("FICTA", "FICTB", "FICTC"), desde: DESDE, hasta: HASTA, ahora: AHORA, buscar: y.buscar, esperar: async (ms) => { pausas.push(ms); } });
    expect(pausas).toEqual([PAUSA_ENTRE_PEDIDOS_MS, PAUSA_ENTRE_PEDIDOS_MS]);
  });
});

describe("reporteExportacion", () => {
  const base = { csv: "x", especies: 3, conCierres: 3, filas: 40, descartadas: 1, fallidas: [], codigoCsv: null } as const;

  it("conteos sin nemotécnicos ni precios; sin avisos sale 0", () => {
    const r = reporteExportacion(base);
    expect(r.lineas).toEqual(["✅ 3 especie(s) pedidas a Yahoo · con cierres: 3 · filas en el CSV: 40 · descartadas (aún no definitivas o fuera del rango): 1"]);
    expect(r.codigoSalida).toBe(0);
  });

  it("especies con fallo: por línea de la lista y sale 3", () => {
    const r = reporteExportacion({ ...base, conCierres: 2, fallidas: [{ linea: 2, codigo: "YAHOO_HTTP_404" }] });
    expect(r.lineas.slice(1)).toEqual(["⚠️  1 especie(s) sin cierres en el CSV:", "   · línea 2 de la lista · YAHOO_HTTP_404"]);
    expect(r.codigoSalida).toBe(SALIDA_CON_AVISOS);
  });

  it("sin CSV (SIN_FILAS, tope o fila inválida): sale 1 y lo dice", () => {
    const r = reporteExportacion({ ...base, csv: null, codigoCsv: "CSV_DEMASIADO_GRANDE" });
    expect(r.lineas.at(-1)).toBe("❌ CSV_DEMASIADO_GRANDE · no se escribió el CSV (pida un rango más corto o menos especies).");
    expect(r.codigoSalida).toBe(1);
  });
});

describe("escribirCompleto", () => {
  it("entrega todo el texto y resuelve cuando la salida lo aceptó", async () => {
    const trozos: string[] = [];
    const salida = new Writable({ write(c, _e, listo) { trozos.push(String(c)); listo(); } });
    await escribirCompleto(salida, "a,b\n");
    expect(trozos.join("")).toBe("a,b\n");
  });

  it("rechaza si la salida falla (EPIPE: el lector cerró el tubo)", async () => {
    const salida = new Writable({ write(_c, _e, listo) { listo(Object.assign(new Error("tubo"), { code: "EPIPE" })); } });
    salida.on("error", () => {});
    await expect(escribirCompleto(salida, "a,b\n")).rejects.toMatchObject({ code: "EPIPE" });
  });
});
