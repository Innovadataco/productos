// El CSV de valores de unidad del fondo de la vía B (fondo:exportar en el Mac → importar-valores-fondo en
// producción): formato exacto, todo o nada, ida y vuelta con el escritor y errores con línea y código, nunca
// valores. Códigos de negocio, clases y cifras inventados.
import { describe, expect, it } from "vitest";
import {
  ENCABEZADO_CSV_FONDO, MAX_BYTES_CSV_FONDO, MAX_FILAS_CSV_FONDO, MAX_FONDOS_CSV, MAX_LARGO_LINEA_FONDO, escribirCsvValoresFondo, leerCsvValoresFondo,
} from "@/fondo/csv-valores";
import { MAX_ERRORES_CONTADOS, MAX_ERRORES_LISTADOS } from "@/precios/csv-cierres";
import { leerValorFondo, leerValorUnidad, type ValorDia } from "@/fondo/sfc";

const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);
const HOY = dia("2024-03-15");
const bytes = (texto: string) => new TextEncoder().encode(texto);
const csv = (...filas: string[]) => bytes(`${ENCABEZADO_CSV_FONDO}\n${filas.map((f) => `${f}\n`).join("")}`);
const leer = (b: Uint8Array) => leerCsvValoresFondo(b, HOY);
const errores = (b: Uint8Array) => {
  const r = leer(b);
  return r.ok ? [] : r.errores.map((e) => [e.linea, e.codigo]);
};

describe("leerCsvValoresFondo · lo válido", () => {
  it("agrupa por fondo con su clase, ordena por fecha y da el rango", () => {
    const r = leer(csv("9990001,800,2024-03-12,10002.5,500000000", "9990001,800,2024-03-11,10001,", "9990002,,2024-03-13,1.12345678,0.5"));
    expect(r).toEqual({
      ok: true,
      filas: 3,
      desde: dia("2024-03-11"),
      hasta: dia("2024-03-13"),
      fondos: [
        { codigoFic: "9990001", participacion: "800", primeraLinea: 2, valores: [{ fecha: dia("2024-03-11"), valorUnidad: "10001", valorFondo: null }, { fecha: dia("2024-03-12"), valorUnidad: "10002.5", valorFondo: "500000000" }] },
        { codigoFic: "9990002", participacion: null, primeraLinea: 4, valores: [{ fecha: dia("2024-03-13"), valorUnidad: "1.12345678", valorFondo: "0.5" }] },
      ],
    });
  });

  it("acepta los extremos: 12 dígitos de código, 6 de clase, el valor de unidad máximo y una fecha de hoy", () => {
    const r = leer(csv("123456789012,123456,2024-03-15,10000000,10000000000000000"));
    expect(r.ok).toBe(true);
  });
});

describe("leerCsvValoresFondo · se rechaza el archivo entero, con línea y código", () => {
  it.each([
    ["sin encabezado exacto", bytes("codigo,participacion,fecha,valor_unidad,valor_fondo\n9990001,800,2024-03-12,1,\n"), [[1, "ENCABEZADO"]]],
    ["vacío", bytes(""), [[1, "VACIO"]]],
    ["solo el encabezado", bytes(`${ENCABEZADO_CSV_FONDO}\n`), [[2, "SIN_FILAS"]]],
    ["la última línea sin LF", bytes(`${ENCABEZADO_CSV_FONDO}\n9990001,800,2024-03-12,1,`), [[2, "SIN_FIN_DE_LINEA"]]],
    ["un CR (fin de línea de Windows)", bytes(`${ENCABEZADO_CSV_FONDO}\r\n9990001,800,2024-03-12,1,\r\n`), [[1, "NO_ASCII"], [2, "NO_ASCII"]]],
    ["un BOM", bytes(`﻿${ENCABEZADO_CSV_FONDO}\n9990001,800,2024-03-12,1,\n`), [[1, "NO_ASCII"]]],
    ["una línea vacía", csv("9990001,800,2024-03-12,1,", "", "9990001,800,2024-03-13,1,"), [[3, "LINEA_VACIA"]]],
    ["una línea de más de 80 bytes", csv(`9990001,800,2024-03-12,1,${"1".repeat(80)}`), [[2, "LINEA_DEMASIADO_LARGA"]]],
    ["comillas o columnas de más", csv('"9990001",800,2024-03-12,1,', "9990001,800,2024-03-12,1,,"), [[2, "CODIGO_FIC_FORMATO"], [3, "COLUMNAS"]]],
    ["un código con letras o de 13 dígitos", csv("99A0001,800,2024-03-12,1,", "1234567890123,800,2024-03-12,1,"), [[2, "CODIGO_FIC_FORMATO"], [3, "CODIGO_FIC_FORMATO"]]],
    ["una clase con letras o de 7 dígitos", csv("9990001,80a,2024-03-12,1,", "9990002,1234567,2024-03-12,1,"), [[2, "PARTICIPACION_FORMATO"], [3, "PARTICIPACION_FORMATO"]]],
    ["una fecha mal escrita o que no existe", csv("9990001,800,12/03/2024,1,", "9990001,800,2024-02-30,1,"), [[2, "FECHA_FORMATO"], [3, "FECHA_INVALIDA"]]],
    ["una fecha después de hoy", csv("9990001,800,2024-03-16,1,"), [[2, "FECHA_FUTURA"]]],
    ["un valor de unidad no canónico (ceros sobrantes, exponente, signo, coma, 9 decimales)", csv(
      "9990001,800,2024-03-01,10000.50,", "9990001,800,2024-03-02,1e4,", "9990001,800,2024-03-03,-1,", "9990001,800,2024-03-04,1;5,", "9990001,800,2024-03-05,1.123456789,", "9990001,800,2024-03-06,010,",
    ), [[2, "VALOR_UNIDAD_FORMATO"], [3, "VALOR_UNIDAD_FORMATO"], [4, "VALOR_UNIDAD_FORMATO"], [5, "VALOR_UNIDAD_FORMATO"], [6, "VALOR_UNIDAD_FORMATO"], [7, "VALOR_UNIDAD_FORMATO"]]],
    ["un valor de unidad 0, vacío o sobre el tope de cordura", csv("9990001,800,2024-03-01,0,", "9990001,800,2024-03-02,,", "9990001,800,2024-03-03,10000000.5,"), [[2, "VALOR_UNIDAD_FUERA_DE_RANGO"], [3, "VALOR_UNIDAD_FORMATO"], [4, "VALOR_UNIDAD_FUERA_DE_RANGO"]]],
    ["un valor del fondo no canónico, 0 o sobre el tope", csv("9990001,800,2024-03-01,1,5.10", "9990001,800,2024-03-02,1,0", "9990001,800,2024-03-03,1,10000000000000001"), [[2, "VALOR_FONDO_FORMATO"], [3, "VALOR_FONDO_FUERA_DE_RANGO"], [4, "VALOR_FONDO_FUERA_DE_RANGO"]]],
    ["el mismo día del mismo fondo dos veces", csv("9990001,800,2024-03-12,1,", "9990001,800,2024-03-12,1,"), [[3, "FILA_REPETIDA"]]],
    ["un fondo con dos clases", csv("9990001,800,2024-03-12,1,", "9990001,801,2024-03-13,1,", "9990001,,2024-03-14,1,"), [[3, "PARTICIPACION_DISTINTA"], [4, "PARTICIPACION_DISTINTA"]]],
  ] as const)("%s", (_nombre, entrada, esperado) => {
    expect(errores(entrada)).toEqual(esperado);
  });

  it(`más de ${MAX_FONDOS_CSV} fondos: DEMASIADOS_FONDOS en la línea del primero de más`, () => {
    const filas = Array.from({ length: MAX_FONDOS_CSV + 1 }, (_, i) => `99900${String(i).padStart(2, "0")},800,2024-03-12,1,`);
    expect(errores(csv(...filas))).toEqual([[MAX_FONDOS_CSV + 2, "DEMASIADOS_FONDOS"]]);
  });

  it(`más de ${MAX_FILAS_CSV_FONDO} filas: DEMASIADAS_FILAS y deja de leer`, () => {
    const inicio = Date.UTC(2010, 0, 1);
    const filas = Array.from({ length: MAX_FILAS_CSV_FONDO + 1 }, (_, i) => `9990001,800,${new Date(inicio + i * 86_400_000).toISOString().slice(0, 10)},1,`);
    // Días seguidos desde 2010 (llegan a 2064): con «hoy» en 2099 todas las filas son válidas y solo muerde el tope.
    const r = leerCsvValoresFondo(csv(...filas), dia("2099-12-31"));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errores.at(-1)).toEqual({ linea: MAX_FILAS_CSV_FONDO + 2, codigo: "DEMASIADAS_FILAS" });
  });

  it(`más de ${MAX_BYTES_CSV_FONDO} bytes: CSV_DEMASIADO_GRANDE sin leerlo`, () => {
    expect(leer(new Uint8Array(MAX_BYTES_CSV_FONDO + 1).fill(0x41))).toEqual({ ok: false, codigo: "CSV_DEMASIADO_GRANDE", errores: [], totalErrores: 0 });
  });

  it(`lista ${MAX_ERRORES_LISTADOS} errores, cuenta el total y deja de leer en ${MAX_ERRORES_CONTADOS}`, () => {
    const r = leer(csv(...Array.from({ length: MAX_ERRORES_CONTADOS + 50 }, () => "x")));
    expect(r.ok).toBe(false);
    expect(!r.ok && [r.errores.length, r.totalErrores]).toEqual([MAX_ERRORES_LISTADOS, MAX_ERRORES_CONTADOS]);
  });

  it("los errores nunca traen el código, la clase, la fecha ni el valor", () => {
    const r = leer(csv("9990001,800,2024-03-12,4321.5,", "9990001,800,2024-03-12,4321.5,"));
    expect(JSON.stringify(r)).not.toMatch(/9990001|800|2024-03-12|4321/);
  });
});

describe("escribirCsvValoresFondo · ida y vuelta", () => {
  const valores: ValorDia[] = [{ fecha: dia("2024-03-11"), valorUnidad: leerValorUnidad("10001.25000000")!, valorFondo: leerValorFondo("500000000.12345")! }, { fecha: dia("2024-03-12"), valorUnidad: "10002", valorFondo: null }];

  it("lo que escribe se lee igual (con los textos canónicos de la SFC) y termina en LF", () => {
    const w = escribirCsvValoresFondo([{ codigoFic: "9990001", participacion: "800", valores }], HOY);
    expect(w).toEqual({ ok: true, filas: 2, texto: `${ENCABEZADO_CSV_FONDO}\n9990001,800,2024-03-11,10001.25,500000000.1235\n9990001,800,2024-03-12,10002,\n` });
    const r = w.ok ? leer(bytes(w.texto)) : null;
    expect(r?.ok && r.fondos).toEqual([{ codigoFic: "9990001", participacion: "800", primeraLinea: 2, valores }]);
  });

  it("sin clase escribe la columna vacía", () => {
    const w = escribirCsvValoresFondo([{ codigoFic: "9990002", participacion: null, valores: valores.slice(1) }], HOY);
    expect(w.ok && w.texto.split("\n")[1]).toBe("9990002,,2024-03-12,10002,");
  });

  it("sin filas no escribe nada: SIN_FILAS", () => {
    expect(escribirCsvValoresFondo([{ codigoFic: "9990001", participacion: "800", valores: [] }], HOY)).toEqual({ ok: false, codigo: "SIN_FILAS" });
  });

  it("nunca escribe un CSV que el importador rechazaría: FILA_INVALIDA", () => {
    expect(escribirCsvValoresFondo([{ codigoFic: "9990001", participacion: "800", valores: [{ fecha: dia("2024-03-20"), valorUnidad: "1", valorFondo: null }] }], HOY)).toEqual({ ok: false, codigo: "FILA_INVALIDA" });
    expect(escribirCsvValoresFondo([{ codigoFic: "999-1", participacion: null, valores }], HOY)).toEqual({ ok: false, codigo: "FILA_INVALIDA" });
  });

  it(`más de ${MAX_FILAS_CSV_FONDO} filas: CSV_DEMASIADO_GRANDE`, () => {
    const muchas = Array.from({ length: MAX_FILAS_CSV_FONDO + 1 }, (_, i) => ({ fecha: new Date(Date.UTC(2000, 0, 1) + i * 86_400_000), valorUnidad: "1", valorFondo: null }));
    expect(escribirCsvValoresFondo([{ codigoFic: "9990001", participacion: "800", valores: muchas }], dia("2099-01-01"))).toEqual({ ok: false, codigo: "CSV_DEMASIADO_GRANDE" });
  });
});

describe("los topes caben entre sí", () => {
  it("la línea más larga posible cabe en MAX_LARGO_LINEA_FONDO y el tope de filas en MAX_BYTES_CSV_FONDO", () => {
    const larga = `${"1".repeat(12)},${"1".repeat(6)},2024-03-12,1234567.12345678,1234567890123456.1234`;
    expect(larga.length).toBeLessThanOrEqual(MAX_LARGO_LINEA_FONDO);
    expect(ENCABEZADO_CSV_FONDO.length + 1 + MAX_FILAS_CSV_FONDO * (MAX_LARGO_LINEA_FONDO + 1)).toBeLessThanOrEqual(MAX_BYTES_CSV_FONDO);
  });
});
