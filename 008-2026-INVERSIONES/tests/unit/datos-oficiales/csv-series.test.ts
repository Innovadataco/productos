// El CSV canónico de series oficiales (fase C, C2a): lo escriben los exportadores del Mac (C2b TRM, C2c BanRep, C2d
// DANE) y lo lee `importar-series` en producción (vía B, sin red). Formato exacto, todo o nada, ida y vuelta con el
// escritor, las reglas del catálogo (serie, fuente, forma de la vigencia, escala, rango y adelanto) y errores con línea y
// código, nunca valores. Cifras inventadas; fechas de 2027 o anteriores a 2022.
import { describe, expect, it } from "vitest";
import { CATALOGO, type SerieCatalogo } from "@/datos-oficiales/catalogo";
import {
  ENCABEZADO_CSV_SERIES, MAX_BYTES_CSV_SERIES, MAX_FILAS_CSV_SERIES, MAX_LARGO_LINEA_SERIES, MAX_SERIES_CSV, canonizarValor,
  compararDecimales, escribirCsvSeries, leerCsvSeries, type LecturaCsvSeries,
} from "@/datos-oficiales/series/csv-series";
import { MAX_ERRORES_CONTADOS, MAX_ERRORES_LISTADOS } from "@/precios/csv-cierres";

const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);
const HOY = dia("2027-06-15");
const bytes = (texto: string) => new TextEncoder().encode(texto);
const csv = (...filas: string[]) => bytes(`${ENCABEZADO_CSV_SERIES}\n${filas.map((f) => `${f}\n`).join("")}`);
const leer = (b: Uint8Array, hoy = HOY, catalogo: readonly SerieCatalogo[] = CATALOGO) => leerCsvSeries(b, hoy, catalogo);
const errores = (b: Uint8Array, hoy = HOY, catalogo: readonly SerieCatalogo[] = CATALOGO) => {
  const r = leer(b, hoy, catalogo);
  return r.ok ? [] : r.errores.map((e) => [e.linea, e.codigo]);
};
const valida = (r: LecturaCsvSeries) => {
  if (!r.ok) throw new Error(JSON.stringify(r.errores));
  return r;
};

const TRM = "sfc:32sa-8pi3";
const TPM = "banrep:DF_CBR_DAILY_HIST.IRCBRM01.PA";
const IBR = "banrep:DF_IBR_DAILY_HIST.IRIBRM03.ER";
const IPC = "dane:anex-IPC-Indices";

/** Una serie ficticia para el catálogo inyectado (topes de series y de filas). */
const ficticia = (codigo: string, fuente = "sfc:x"): SerieCatalogo => ({
  codigo, nombre: "Serie ficticia", unidad: "unidad ficticia", cadencia: "DIARIA_CALENDARIO", vigencia: { tipo: "DIA" }, escala: 2,
  rango: { min: "0.5", max: "999" }, adelantoMaximoDias: 0, umbralFrescuraDias: 7, fuente, origen: "ficticio", entrada: "VIA_B",
});

describe("leerCsvSeries · lo válido", () => {
  it("agrupa por serie en el orden en que aparecen, ordena por desde y trae la fuente del catálogo", () => {
    const r = leer(csv(
      `TRM,2027-03-08,2027-03-08,4613.29,${TRM}`,
      `IPC_INDICE,2027-04-01,2027-04-30,139.83,${IPC}`,
      `TRM,2027-03-05,2027-03-07,4613.27,${TRM}`,
    ));
    expect(r).toEqual({
      ok: true,
      filas: 3,
      series: [
        { codigo: "TRM", fuente: TRM, primeraLinea: 2, valores: [
          { desde: dia("2027-03-05"), hasta: dia("2027-03-07"), valor: "4613.27" },
          { desde: dia("2027-03-08"), hasta: dia("2027-03-08"), valor: "4613.29" },
        ] },
        { codigo: "IPC_INDICE", fuente: IPC, primeraLinea: 3, valores: [{ desde: dia("2027-04-01"), hasta: dia("2027-04-30"), valor: "139.83" }] },
      ],
    });
  });

  it("acepta los extremos: rango cerrado, escala exacta, la TRM de mañana, la TPM de hoy, un tramo de 7 días y meses de 28, 29 y 31 días", () => {
    const r = leer(csv(
      `TPM,2027-06-14,2027-06-14,0.5,${TPM}`,
      `TPM,2027-06-15,2027-06-15,50,${TPM}`,
      `IBR_3M_EA,2027-06-15,2027-06-15,12.461,${IBR}`,
      `TRM,2027-06-16,2027-06-16,100,${TRM}`,
      `TRM,2027-06-01,2027-06-07,50000,${TRM}`,
      `IPC_INDICE,2021-02-01,2021-02-28,105.37,${IPC}`,
      `IPC_INDICE,2020-02-01,2020-02-29,103.91,${IPC}`,
      `IPC_INDICE,2027-05-01,2027-05-31,141.07,${IPC}`,
      `TRM,1991-11-27,1991-11-27,623.73,${TRM}`,
    ));
    expect(valida(r).filas).toBe(9);
  });

  it("vigencias adyacentes de la misma serie y vigencias solapadas de series distintas entran", () => {
    expect(leer(csv(
      `TRM,2027-03-05,2027-03-07,4613.27,${TRM}`, `TRM,2027-03-08,2027-03-08,4613.29,${TRM}`, `TPM,2027-03-06,2027-03-06,9.37,${TPM}`,
    )).ok).toBe(true);
  });
});

describe("leerCsvSeries · forma del archivo: se rechaza entero, con línea y código", () => {
  it.each([
    ["vacío", bytes(""), [[1, "VACIO"]]],
    ["sin encabezado exacto", bytes(`serie,desde,hasta,valor\nTPM,2027-03-08,2027-03-08,9.37,${TPM}\n`), [[1, "ENCABEZADO"]]],
    ["solo el encabezado", bytes(`${ENCABEZADO_CSV_SERIES}\n`), [[2, "SIN_FILAS"]]],
    ["la última línea sin LF", bytes(`${ENCABEZADO_CSV_SERIES}\nTPM,2027-03-08,2027-03-08,9.37,${TPM}`), [[2, "SIN_FIN_DE_LINEA"]]],
    ["un CR (fin de línea de Windows)", bytes(`${ENCABEZADO_CSV_SERIES}\r\nTPM,2027-03-08,2027-03-08,9.37,${TPM}\r\n`), [[1, "NO_ASCII"], [2, "NO_ASCII"]]],
    ["un BOM", bytes(`﻿${ENCABEZADO_CSV_SERIES}\nTPM,2027-03-08,2027-03-08,9.37,${TPM}\n`), [[1, "NO_ASCII"]]],
    ["un tabulador o una tilde", csv(`TPM,2027-03-08,2027-03-08,9.37,${TPM}\t`, `TPM,2027-03-09,2027-03-09,9.37,${TPM}é`), [[2, "NO_ASCII"], [3, "NO_ASCII"]]],
    ["una línea vacía", csv(`TPM,2027-03-08,2027-03-08,9.37,${TPM}`, "", `TPM,2027-03-09,2027-03-09,9.37,${TPM}`), [[3, "LINEA_VACIA"]]],
    ["columnas de menos o de más", csv("TPM,2027-03-08,2027-03-08,9.37", `TPM,2027-03-09,2027-03-09,9.37,${TPM},`), [[2, "COLUMNAS"], [3, "COLUMNAS"]]],
  ])("%s", (_, entrada, esperado) => {
    expect(errores(entrada)).toEqual(esperado);
  });

  it(`una línea de ${MAX_LARGO_LINEA_SERIES} bytes pasa la forma y una de ${MAX_LARGO_LINEA_SERIES + 1} no`, () => {
    const base = `TPM,2027-03-08,2027-03-08,9.37,${TPM}`;
    const justa = `${base},${"x".repeat(MAX_LARGO_LINEA_SERIES - base.length - 1)}`;
    expect(justa.length).toBe(MAX_LARGO_LINEA_SERIES);
    expect(errores(csv(justa))).toEqual([[2, "COLUMNAS"]]);
    expect(errores(csv(`${justa}x`))).toEqual([[2, "LINEA_DEMASIADO_LARGA"]]);
  });

  it(`más de ${MAX_BYTES_CSV_SERIES} bytes: CSV_DEMASIADO_GRANDE sin leer las líneas`, () => {
    expect(leer(new Uint8Array(MAX_BYTES_CSV_SERIES + 1).fill(0x41))).toEqual({ ok: false, codigo: "CSV_DEMASIADO_GRANDE", errores: [], totalErrores: 0 });
  });

  it(`lista ${MAX_ERRORES_LISTADOS} errores y deja de leer en ${MAX_ERRORES_CONTADOS}`, () => {
    const r = leer(csv(...Array.from({ length: MAX_ERRORES_CONTADOS + 517 }, () => "x")));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.totalErrores).toBe(MAX_ERRORES_CONTADOS);
    expect(r.errores).toHaveLength(MAX_ERRORES_LISTADOS);
    expect(r.errores[0]).toEqual({ linea: 2, codigo: "COLUMNAS" });
  });
});

describe("leerCsvSeries · campos de la fila", () => {
  it.each([
    ["una serie fuera del catálogo, en minúsculas, entre comillas o heredada de Object", [
      `UVR,2027-03-08,2027-03-08,317.43,${TRM}`, `trm,2027-03-08,2027-03-08,4613.27,${TRM}`, `"TRM",2027-03-08,2027-03-08,4613.27,${TRM}`,
      `constructor,2027-03-08,2027-03-08,4613.27,${TRM}`, `__proto__,2027-03-08,2027-03-08,4613.27,${TRM}`,
    ], ["SERIE_DESCONOCIDA", "SERIE_DESCONOCIDA", "SERIE_DESCONOCIDA", "SERIE_DESCONOCIDA", "SERIE_DESCONOCIDA"]],
    ["una fuente que no es la del catálogo", [
      `TRM,2027-03-08,2027-03-08,4613.27,banrep:DF_TRM_DAILY_HIST`, `TPM,2027-03-08,2027-03-08,9.37,${IBR}`, `TPM,2027-03-08,2027-03-08,9.37,`,
    ], ["FUENTE_DISTINTA", "FUENTE_DISTINTA", "FUENTE_DISTINTA"]],
    ["desde o hasta mal escritas, de otro siglo o que no existen", [
      `TPM,08/03/2027,08/03/2027,9.37,${TPM}`, `TPM,2027-3-08,2027-3-08,9.37,${TPM}`, `TPM,1899-12-31,1899-12-31,9.37,${TPM}`,
      `TPM,2027-02-29,2027-02-29,9.37,${TPM}`, `TPM,2027-03-08,2027-13-01,9.37,${TPM}`, `TPM,2027-03-08, 2027-03-08,9.37,${TPM}`,
    ], ["FECHA_FORMATO", "FECHA_FORMATO", "FECHA_FORMATO", "FECHA_INVALIDA", "FECHA_INVALIDA", "FECHA_FORMATO"]],
    ["una vigencia que no tiene la forma de la serie", [
      `TPM,2027-03-08,2027-03-09,9.37,${TPM}`, `IBR_3M_EA,2027-03-09,2027-03-08,9.713,${IBR}`, `TRM,2027-03-09,2027-03-08,4613.27,${TRM}`,
      `TRM,2027-03-01,2027-03-08,4613.27,${TRM}`, `IPC_INDICE,2027-03-02,2027-03-31,139.83,${IPC}`, `IPC_INDICE,2027-03-01,2027-03-30,139.83,${IPC}`,
      `IPC_INDICE,2027-03-01,2027-04-30,139.83,${IPC}`, `IPC_INDICE,2021-02-01,2021-03-01,105.37,${IPC}`,
    ], ["VIGENCIA_FORMA", "VIGENCIA_FORMA", "VIGENCIA_FORMA", "VIGENCIA_FORMA", "VIGENCIA_FORMA", "VIGENCIA_FORMA", "VIGENCIA_FORMA", "VIGENCIA_FORMA"]],
    ["un desde después de hoy + el adelanto de la serie", [
      `TRM,2027-06-17,2027-06-17,4613.27,${TRM}`, `TPM,2027-06-16,2027-06-16,9.37,${TPM}`, `IBR_3M_EA,2027-06-16,2027-06-16,9.713,${IBR}`,
    ], ["FECHA_FUTURA", "FECHA_FUTURA", "FECHA_FUTURA"]],
    ["un mes del IPC que no ha terminado", [`IPC_INDICE,2027-06-01,2027-06-30,141.29,${IPC}`], ["MES_ABIERTO"]],
    ["un valor no canónico (ceros sobrantes, exponente, signo, coma, espacios, sin entero o sin fracción, 13 enteros)", [
      `TRM,2027-03-01,2027-03-01,4613.270,${TRM}`, `TRM,2027-03-02,2027-03-02,04613.27,${TRM}`, `TRM,2027-03-03,2027-03-03,4.61327e3,${TRM}`,
      `TPM,2027-03-04,2027-03-04,-9.37,${TPM}`, `TPM,2027-03-05,2027-03-05,+9.37,${TPM}`, `TPM,2027-03-06,2027-03-06,9;37,${TPM}`,
      `TPM,2027-03-07,2027-03-07, 9.37,${TPM}`, `TPM,2027-03-08,2027-03-08,.37,${TPM}`, `TPM,2027-03-09,2027-03-09,9.,${TPM}`,
      `TPM,2027-03-10,2027-03-10,,${TPM}`, `TRM,2027-03-11,2027-03-11,1234567890123,${TRM}`, `TPM,2027-03-12,2027-03-12,NaN,${TPM}`,
    ], Array.from({ length: 12 }, () => "VALOR_FORMATO")],
    ["más decimales que la escala de la serie", [
      `TRM,2027-03-01,2027-03-01,4613.271,${TRM}`, `IBR_3M_EA,2027-03-02,2027-03-02,9.7131,${IBR}`, `IPC_INDICE,2027-03-01,2027-03-31,139.831,${IPC}`,
    ], ["VALOR_ESCALA", "VALOR_ESCALA", "VALOR_ESCALA"]],
    ["un valor fuera del rango de cordura (fracción en vez de %, cero, o una cifra de más)", [
      `TPM,2027-03-01,2027-03-01,0.49,${TPM}`, `TPM,2027-03-02,2027-03-02,50.01,${TPM}`, `TPM,2027-03-03,2027-03-03,0,${TPM}`,
      `TRM,2027-03-04,2027-03-04,99.99,${TRM}`, `TRM,2027-03-05,2027-03-05,461327,${TRM}`, `IPC_INDICE,2027-03-01,2027-03-31,9.99,${IPC}`,
      `IPC_INDICE,2027-04-01,2027-04-30,1000.01,${IPC}`,
    ], Array.from({ length: 7 }, () => "VALOR_FUERA_DE_RANGO")],
  ])("%s", (_, filas, codigos) => {
    expect(errores(csv(...filas))).toEqual(codigos.map((c, i) => [i + 2, c]));
  });

  it("el día de hoy es el tope de la TPM (mañana no) y el de mañana el de la TRM: se mide con el `hoy` que se pasa", () => {
    expect(leer(csv(`TPM,2027-06-16,2027-06-16,9.37,${TPM}`), dia("2027-06-16")).ok).toBe(true);
    expect(errores(csv(`TRM,2027-06-18,2027-06-18,4613.27,${TRM}`), dia("2027-06-16"))).toEqual([[2, "FECHA_FUTURA"]]);
  });

  it("un mes del IPC cuyo último día es hoy sigue abierto; el día siguiente ya entra", () => {
    const mayo = csv(`IPC_INDICE,2027-05-01,2027-05-31,141.07,${IPC}`);
    expect(errores(mayo, dia("2027-05-31"))).toEqual([[2, "MES_ABIERTO"]]);
    expect(leer(mayo, dia("2027-06-01")).ok).toBe(true);
  });
});

describe("leerCsvSeries · el archivo entero", () => {
  it("una serie y un desde repetidos: FILA_REPETIDA en la segunda", () => {
    expect(errores(csv(`TPM,2027-03-08,2027-03-08,9.37,${TPM}`, `TPM,2027-03-08,2027-03-08,9.41,${TPM}`))).toEqual([[3, "FILA_REPETIDA"]]);
  });

  it("dos vigencias de la misma serie que se solapan: SOLAPE en la que aparece después, se lean en el orden que se lean", () => {
    expect(errores(csv(`TRM,2027-03-05,2027-03-07,4613.27,${TRM}`, `TRM,2027-03-07,2027-03-07,4613.29,${TRM}`))).toEqual([[3, "SOLAPE"]]);
    expect(errores(csv(`TRM,2027-03-07,2027-03-07,4613.29,${TRM}`, `TRM,2027-03-05,2027-03-07,4613.27,${TRM}`))).toEqual([[3, "SOLAPE"]]);
    expect(errores(csv(
      `TPM,2027-03-01,2027-03-01,9.37,${TPM}`, `TRM,2027-03-05,2027-03-07,4613.27,${TRM}`, `TPM,2027-03-02,2027-03-02,9.37,${TPM}`, `TRM,2027-03-06,2027-03-08,4613.29,${TRM}`,
    ))).toEqual([[5, "SOLAPE"]]);
  });

  it("una vigencia contenida en otra no esconde el solape de la siguiente (code-reviewer, BAJO)", () => {
    expect(errores(csv(`TRM,2027-03-05,2027-03-10,4613.27,${TRM}`, `TRM,2027-03-06,2027-03-07,4613.29,${TRM}`, `TRM,2027-03-08,2027-03-09,4613.31,${TRM}`))).toEqual([
      [3, "SOLAPE"], [4, "SOLAPE"],
    ]);
  });

  it("los errores salen ordenados por línea aunque el solape se descubra al final", () => {
    expect(errores(csv(`TRM,2027-03-05,2027-03-07,4613.27,${TRM}`, `TRM,2027-03-06,2027-03-06,4613.29,${TRM}`, `UVR,2027-03-08,2027-03-08,317.43,${TRM}`))).toEqual([
      [3, "SOLAPE"], [4, "SERIE_DESCONOCIDA"],
    ]);
  });

  it(`${MAX_SERIES_CSV} series pasan y la serie ${MAX_SERIES_CSV + 1} no (catálogo inyectado)`, () => {
    const codigos = Array.from({ length: MAX_SERIES_CSV + 1 }, (_, i) => `F${String.fromCharCode(65 + i)}`);
    const catalogo = codigos.map((c) => ficticia(c));
    const filas = codigos.map((c) => `${c},2021-03-08,2021-03-08,7.13,sfc:x`);
    expect(leer(csv(...filas.slice(0, MAX_SERIES_CSV)), HOY, catalogo).ok).toBe(true);
    expect(errores(csv(...filas), HOY, catalogo)).toEqual([[MAX_SERIES_CSV + 2, "DEMASIADAS_SERIES"]]);
  });

  it(`${MAX_FILAS_CSV_SERIES} filas pasan y la fila ${MAX_FILAS_CSV_SERIES + 1} no: se deja de leer (catálogo inyectado, líneas cortas)`, () => {
    const catalogo = [ficticia("FA")];
    const inicio = dia("1917-01-01").getTime();
    const fila = (i: number) => `FA,${new Date(inicio + i * 86_400_000).toISOString().slice(0, 10)},${new Date(inicio + i * 86_400_000).toISOString().slice(0, 10)},7.13,sfc:x`;
    const justas = csv(...Array.from({ length: MAX_FILAS_CSV_SERIES }, (_, i) => fila(i)));
    expect(justas.length).toBeLessThanOrEqual(MAX_BYTES_CSV_SERIES);
    expect(valida(leer(justas, HOY, catalogo)).filas).toBe(MAX_FILAS_CSV_SERIES);
    const demas = csv(...Array.from({ length: MAX_FILAS_CSV_SERIES + 1 }, (_, i) => fila(i)), "basura");
    expect(errores(demas, HOY, catalogo)).toEqual([[MAX_FILAS_CSV_SERIES + 2, "DEMASIADAS_FILAS"]]);
  });

  it("con líneas largas el tope que muerde primero es el de bytes: menos de 40 000 filas de la IBR ya pasan los 2 MiB y el lector lo rechaza (code-reviewer, MEDIO)", () => {
    const inicio = dia("1950-01-01").getTime();
    const fila = (i: number) => {
      const d = new Date(inicio + i * 86_400_000).toISOString().slice(0, 10);
      return `IBR_3M_EA,${d},${d},12.461,${IBR}`;
    };
    const cuantas = Math.ceil(MAX_BYTES_CSV_SERIES / (fila(0).length + 1));
    const archivo = csv(...Array.from({ length: cuantas }, (_, i) => fila(i)));
    expect(cuantas).toBeLessThan(MAX_FILAS_CSV_SERIES);
    expect(archivo.length).toBeGreaterThan(MAX_BYTES_CSV_SERIES);
    expect(leer(archivo)).toEqual({ ok: false, codigo: "CSV_DEMASIADO_GRANDE", errores: [], totalErrores: 0 });
  });
});

describe("escribirCsvSeries · ida y vuelta", () => {
  it("lo que escribe lo lee igual el importador, con la fuente del catálogo", () => {
    const series = [
      { codigo: "TRM", valores: [{ desde: dia("2027-03-05"), hasta: dia("2027-03-07"), valor: "4613.27" }, { desde: dia("2027-03-08"), hasta: dia("2027-03-08"), valor: "4613.29" }] },
      { codigo: "IBR_3M_EA", valores: [{ desde: dia("2027-03-08"), hasta: dia("2027-03-08"), valor: "9.713" }] },
    ];
    const w = escribirCsvSeries(series, HOY);
    expect(w.ok).toBe(true);
    if (!w.ok) return;
    expect(w.filas).toBe(3);
    expect(w.texto).toBe(`${ENCABEZADO_CSV_SERIES}\nTRM,2027-03-05,2027-03-07,4613.27,${TRM}\nTRM,2027-03-08,2027-03-08,4613.29,${TRM}\nIBR_3M_EA,2027-03-08,2027-03-08,9.713,${IBR}\n`);
    expect(valida(leer(bytes(w.texto))).series.map((s) => [s.codigo, s.fuente, s.valores])).toEqual(series.map((s) => [s.codigo, s.codigo === "TRM" ? TRM : IBR, s.valores]));
  });

  it("nunca escribe lo que el importador rechazaría", () => {
    const una = (codigo: string, valor: string, desde = "2027-03-08", hasta = desde) => [{ codigo, valores: [{ desde: dia(desde), hasta: dia(hasta), valor }] }];
    expect(escribirCsvSeries([], HOY)).toEqual({ ok: false, codigo: "SIN_FILAS" });
    expect(escribirCsvSeries([{ codigo: "TRM", valores: [] }], HOY)).toEqual({ ok: false, codigo: "SIN_FILAS" });
    expect(escribirCsvSeries(una("TRM", "4613.270"), HOY)).toEqual({ ok: false, codigo: "FILA_INVALIDA" });
    expect(escribirCsvSeries(una("UVR", "317.43"), HOY)).toEqual({ ok: false, codigo: "FILA_INVALIDA" });
    expect(escribirCsvSeries(una("TPM", "9.37", "2027-06-16"), HOY)).toEqual({ ok: false, codigo: "FILA_INVALIDA" });
    expect(escribirCsvSeries(una("TPM", "9.37", "2027-03-08", "2027-03-09"), HOY)).toEqual({ ok: false, codigo: "FILA_INVALIDA" });
  });

  it(`más de ${MAX_FILAS_CSV_SERIES} filas: CSV_DEMASIADO_GRANDE sin armar el texto`, () => {
    const valores = Array.from({ length: MAX_FILAS_CSV_SERIES + 1 }, () => ({ desde: dia("2027-03-08"), hasta: dia("2027-03-08"), valor: "9.37" }));
    expect(escribirCsvSeries([{ codigo: "TPM", valores }], HOY)).toEqual({ ok: false, codigo: "CSV_DEMASIADO_GRANDE" });
  });

  it("si el texto pasa de 2 MiB, CSV_DEMASIADO_GRANDE", () => {
    const inicio = dia("1960-01-01").getTime();
    const valores = Array.from({ length: 30_000 }, (_, i) => ({ desde: new Date(inicio + i * 86_400_000), hasta: new Date(inicio + i * 86_400_000), valor: "12.461" }));
    expect(escribirCsvSeries([{ codigo: "IBR_3M_EA", valores }], HOY)).toEqual({ ok: false, codigo: "CSV_DEMASIADO_GRANDE" });
  });
});

describe("canonizarValor y compararDecimales · sin Number", () => {
  it.each([
    ["9.250", "9.25"], ["009.25", "9.25"], ["0.50", "0.5"], ["5", "5"], ["5.000", "5"], ["0", "0"], ["0.0", "0"], ["000", "0"],
    ["9.25000000", "9.25"], ["4613.27", "4613.27"], ["0.00000001", "0.00000001"],
  ])("%s → %s", (entrada, salida) => {
    expect(canonizarValor(entrada)).toBe(salida);
  });

  it.each(["-1", "+1", "1e3", "", ".", "1.", ".5", "1,5", " 1", "1 ", "NaN", "Infinity", "0x10", "1.2.3"])("«%s» no es un decimal", (entrada) => {
    expect(canonizarValor(entrada)).toBeNull();
  });

  it.each([
    ["9.25", "9.3", -1], ["10", "9.99", 1], ["50", "50", 0], ["100.01", "100.1", -1], ["0.5", "0.49", 1], ["0", "0.00000001", -1], ["12345678901", "9", 1],
  ] as const)("%s frente a %s → %i", (a, b, esperado) => {
    expect(compararDecimales(a, b)).toBe(esperado);
  });
});
