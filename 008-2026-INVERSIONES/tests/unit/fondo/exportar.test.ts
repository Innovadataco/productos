// `exportarValoresFondo` (en el Mac, con red): pide a la SFC los valores de unidad de cada fondo de la lista, en serie
// y con pausa, con `obtenerValores` (sin redirecciones, plazo y tope de bytes), y arma el CSV que acepta
// `importar-valores-fondo`. Un fondo que falla queda fuera y se informa por su línea de la lista. Sin red: `buscar`
// siempre es un doble. Códigos, clases y cifras inventados.
import { describe, expect, it } from "vitest";
import { leerCsvValoresFondo } from "@/fondo/csv-valores";
import { PAUSA_ENTRE_PEDIDOS_FONDO_MS, exportarValoresFondo } from "@/fondo/exportar";
import { reporteExportacionFondo } from "@/fondo/reporte";
import type { BuscarSfc } from "@/fondo/sfc";
import type { InitHttp } from "@/lib/http-acotado";

const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);
const DESDE = dia("2024-03-10");
const HASTA = dia("2024-03-15");
const AHORA = new Date("2024-03-15T15:00:00Z");
type Fila = Record<string, string>;
const fila = (codigo: string, fecha: string, valor: string, clase = "800", fondo = "500000000"): Fila => ({
  fecha_corte: `${fecha}T00:00:00.000`, codigo_negocio: codigo, tipo_participacion: clase, valor_unidad_operaciones: valor, valor_fondo_cierre_dia_t: fondo,
});

/** SFC falsa por código de negocio; como Socrata, filtra por tipo_participacion si se pide. Guarda URL e init. */
function sfc(porCodigo: Readonly<Record<string, readonly Fila[] | number | "lanza">>) {
  const pedidos: { url: URL; init: InitHttp }[] = [];
  const buscar: BuscarSfc = async (url, init) => {
    const u = new URL(url);
    pedidos.push({ url: u, init });
    const r = porCodigo[u.searchParams.get("codigo_negocio") ?? ""] ?? [];
    if (r === "lanza") throw new TypeError("sin red ficticia 5544");
    if (typeof r === "number") return new Response("{}", { status: r });
    const clase = u.searchParams.get("tipo_participacion");
    return new Response(JSON.stringify(clase ? r.filter((f) => f.tipo_participacion === clase) : r));
  };
  return { buscar, pedidos };
}

const sinPausa = async () => {};

describe("exportarValoresFondo", () => {
  it("pide cada fondo con su clase (o sin filtro), en serie, y escribe un CSV que el importador acepta", async () => {
    const s = sfc({
      "9990001": [fila("9990001", "2024-03-12", "10001.5"), fila("9990001", "2024-03-13", "10002", "800", "x"), fila("9990001", "2024-03-12", "77", "801")],
      "9990002": [fila("9990002", "2024-03-13", "1.25", "900")],
    });
    const pausas: number[] = [];
    const r = await exportarValoresFondo({
      lista: [{ codigo: "9990001", participacion: "800", linea: 2 }, { codigo: "9990002", participacion: null, linea: 3 }],
      desde: DESDE, hasta: HASTA, ahora: AHORA, buscar: s.buscar, esperar: async (ms) => void pausas.push(ms),
    });
    expect(s.pedidos.map((p) => [p.url.searchParams.get("codigo_negocio"), p.url.searchParams.get("tipo_participacion")])).toEqual([["9990001", "800"], ["9990002", null]]);
    expect(s.pedidos.every((p) => p.init.redirect === "error")).toBe(true);
    expect(pausas).toEqual([PAUSA_ENTRE_PEDIDOS_FONDO_MS]);
    expect(r.csv).toBe("codigo_fic,participacion,fecha,valor_unidad,valor_fondo\n9990001,800,2024-03-12,10001.5,500000000\n9990001,800,2024-03-13,10002,\n9990002,,2024-03-13,1.25,500000000\n");
    expect(r).toMatchObject({ fondos: 2, conValores: 2, filas: 3, descartados: 0, fallidos: [], codigoCsv: null });
    expect(r.porLinea).toEqual([{ linea: 2, valores: 2, ultimaFecha: dia("2024-03-13"), descartados: 0 }, { linea: 3, valores: 1, ultimaFecha: dia("2024-03-13"), descartados: 0 }]);
    const leido = leerCsvValoresFondo(new TextEncoder().encode(r.csv!), dia("2024-03-15"));
    expect(leido.ok && leido.filas).toBe(3);
  });

  it("un fondo con error de la SFC, que lanza o con varias clases sin indicar queda fuera, por su línea; los demás salen", async () => {
    const s = sfc({ "9990001": 500, "9990002": "lanza", "9990003": [fila("9990003", "2024-03-12", "1", "800"), fila("9990003", "2024-03-12", "2", "801")], "9990004": [fila("9990004", "2024-03-12", "3")] });
    const lista = ["9990001", "9990002", "9990003", "9990004"].map((codigo, i) => ({ codigo, participacion: null, linea: i + 1 }));
    const r = await exportarValoresFondo({ lista, desde: DESDE, hasta: HASTA, ahora: AHORA, buscar: s.buscar, esperar: sinPausa });
    expect(r.fallidos).toEqual([{ linea: 1, codigo: "SFC_HTTP_500" }, { linea: 2, codigo: "SFC_RED" }, { linea: 3, codigo: "SFC_VARIAS_PARTICIPACIONES" }]);
    expect(r).toMatchObject({ conValores: 1, filas: 1, codigoCsv: null });
    expect(reporteExportacionFondo(r).codigoSalida).toBe(3);
    expect(JSON.stringify(r.fallidos)).not.toContain("5544");
  });

  it("los valores de unidad inválidos de la SFC se descartan y se cuentan; los válidos salen (salida 3)", async () => {
    const s = sfc({ "9990001": [fila("9990001", "2024-03-12", "0"), fila("9990001", "2024-03-13", "10002")] });
    const r = await exportarValoresFondo({ lista: [{ codigo: "9990001", participacion: "800", linea: 1 }], desde: DESDE, hasta: HASTA, ahora: AHORA, buscar: s.buscar, esperar: sinPausa });
    expect(r).toMatchObject({ filas: 1, descartados: 1, fallidos: [] });
    expect(r.porLinea).toEqual([{ linea: 1, valores: 1, ultimaFecha: dia("2024-03-13"), descartados: 1 }]);
    expect(reporteExportacionFondo(r).codigoSalida).toBe(3);
  });

  it("sin ningún valor en el rango no escribe CSV: SIN_FILAS (salida 1)", async () => {
    const r = await exportarValoresFondo({ lista: [{ codigo: "9990001", participacion: "800", linea: 1 }], desde: DESDE, hasta: HASTA, ahora: AHORA, buscar: sfc({}).buscar, esperar: sinPausa });
    expect(r).toMatchObject({ csv: null, codigoCsv: "SIN_FILAS", conValores: 0 });
    expect(r.porLinea).toEqual([{ linea: 1, valores: 0, ultimaFecha: null, descartados: 0 }]);
    expect(reporteExportacionFondo(r).codigoSalida).toBe(1);
  });

  it("una fecha posterior a hoy de la SFC no llega al CSV (la rechaza la propia SFC: fuera del rango pedido)", async () => {
    const s = sfc({ "9990001": [fila("9990001", "2024-03-16", "1")] });
    const r = await exportarValoresFondo({ lista: [{ codigo: "9990001", participacion: "800", linea: 1 }], desde: DESDE, hasta: HASTA, ahora: AHORA, buscar: s.buscar, esperar: sinPausa });
    expect(r.fallidos).toEqual([{ linea: 1, codigo: "SFC_FORMATO" }]);
    expect(r.csv).toBeNull();
  });
});
