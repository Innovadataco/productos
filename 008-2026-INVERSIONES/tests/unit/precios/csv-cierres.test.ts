// El CSV de cierres públicos que viaja del Mac (`precios:exportar`) a producción (`precios:importar`): formato
// exacto, validación estricta (todo o nada, errores con línea y código, nunca valores) y topes.
// Especies FICT, precios, volúmenes y fechas inventados.
import { describe, expect, it } from "vitest";
import {
  ENCABEZADO_CSV, MAX_BYTES_CSV, MAX_ERRORES_CONTADOS, MAX_ERRORES_LISTADOS, MAX_ESPECIES_CSV, MAX_FILAS_CSV,
  escribirCsvCierres, leerCsvCierres, volumenExportable, type ResultadoLectura,
} from "@/precios/csv-cierres";
import { parsearYahoo, type Cierre } from "@/precios/yahoo";

const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);
const cierre = (iso: string, precio: string, volumen: number | null): Cierre => ({ fecha: utc(iso), precio, volumen });
const bytes = (texto: string) => new TextEncoder().encode(texto);
const leer = (texto: string) => leerCsvCierres(bytes(texto));
const csv = (...filas: string[]) => `${[ENCABEZADO_CSV, ...filas].join("\n")}\n`;
const errores = (r: ResultadoLectura) => (r.ok ? [] : r.errores);
/** Fechas hábiles ficticias distintas: días de 2024 en adelante (sin importar si caen en fin de semana: el CSV no lo decide). */
const dia = (n: number) => new Date(Date.UTC(2024, 0, 1) + n * 86_400_000).toISOString().slice(0, 10);

describe("CSV de cierres · ida y vuelta", () => {
  it("lo que escribe el exportador lo lee el importador igual: especies en su orden, cierres por fecha y el rango", () => {
    const especies = [
      { nemotecnico: "FICTB", cierres: [cierre("2024-03-13", "1020", null), cierre("2024-03-12", "1010.25", 80)] },
      { nemotecnico: "FICTA", cierres: [cierre("2024-03-11", "1000.5", 0)] },
    ];
    const escrito = escribirCsvCierres(especies);
    expect(escrito).toEqual({ ok: true, filas: 3, texto: csv("FICTB,2024-03-13,1020,", "FICTB,2024-03-12,1010.25,80", "FICTA,2024-03-11,1000.5,0") });
    const leido = leerCsvCierres(bytes(escrito.ok ? escrito.texto : ""));
    expect(leido).toEqual({
      ok: true, filas: 3, desde: utc("2024-03-11"), hasta: utc("2024-03-13"),
      especies: [
        { nemotecnico: "FICTB", primeraLinea: 2, cierres: [cierre("2024-03-12", "1010.25", 80), cierre("2024-03-13", "1020", null)] },
        { nemotecnico: "FICTA", primeraLinea: 4, cierres: [cierre("2024-03-11", "1000.5", 0)] },
      ],
    });
  });

  it("todo precio que deja parsearYahoo (canónico, hasta 6 decimales y el tope) se lee de vuelta tal cual", () => {
    const valores = [0.000001, 1234.5, 999.123456, 10_000_000, 7];
    const ts = valores.map((_, i) => Date.UTC(2024, 2, 4 + i, 14, 30) / 1000);
    const r = parsearYahoo({ chart: { result: [{ meta: { currency: "COP" }, timestamp: ts, indicators: { quote: [{ close: valores, volume: valores.map(() => 1) }] } }] } });
    if (!r.ok) throw new Error(r.codigo);
    const escrito = escribirCsvCierres([{ nemotecnico: "FICTC", cierres: r.cierres }]);
    const leido = leerCsvCierres(bytes(escrito.ok ? escrito.texto : ""));
    expect(leido.ok && leido.especies[0]!.cierres).toEqual(r.cierres);
    expect(r.cierres.map((c) => c.precio)).toEqual(["0.000001", "1234.5", "999.123456", "10000000", "7"]);
  });
});

describe("CSV de cierres · validación estricta: línea y código, nunca el valor", () => {
  const casos: readonly (readonly [string, string, number, string])[] = [
    ["encabezado distinto", "nemotecnico,fecha,cierre\nFICTA,2024-03-11,10,1\n", 1, "ENCABEZADO"],
    ["encabezado en mayúscula", `${csv("FICTA,2024-03-11,10,1").replace("nemotecnico", "Nemotecnico")}`, 1, "ENCABEZADO"],
    ["BOM al inicio", `﻿${csv("FICTA,2024-03-11,10,1")}`, 1, "NO_ASCII"],
    ["fin de línea CRLF", `${ENCABEZADO_CSV}\nFICTA,2024-03-11,10,1\r\n`, 2, "NO_ASCII"],
    ["tabulador", csv("FICTA,2024-03-11,10,\t1"), 2, "NO_ASCII"],
    ["carácter no ASCII", csv("FICTÑ,2024-03-11,10,1"), 2, "NO_ASCII"],
    ["NUL", csv("FICTA,2024-03-11,10,1\u0000"), 2, "NO_ASCII"],
    ["línea vacía en medio", csv("FICTA,2024-03-11,10,1", "", "FICTA,2024-03-12,10,1"), 3, "LINEA_VACIA"],
    ["sin fin de línea al final", `${ENCABEZADO_CSV}\nFICTA,2024-03-11,10,1`, 2, "SIN_FIN_DE_LINEA"],
    ["línea de más de 80 bytes", csv(`FICTA,2024-03-11,10,1${" ".repeat(70)}`), 2, "LINEA_DEMASIADO_LARGA"],
    ["tres columnas", csv("FICTA,2024-03-11,10"), 2, "COLUMNAS"],
    ["cinco columnas", csv("FICTA,2024-03-11,10,1,"), 2, "COLUMNAS"],
    ["nemotécnico en minúscula", csv("ficta,2024-03-11,10,1"), 2, "NEMOTECNICO_FORMATO"],
    ["nemotécnico de 1 carácter", csv("F,2024-03-11,10,1"), 2, "NEMOTECNICO_FORMATO"],
    ["nemotécnico de 21 caracteres", csv(`${"F".repeat(21)},2024-03-11,10,1`), 2, "NEMOTECNICO_FORMATO"],
    ["nemotécnico con espacio", csv(" FICTA,2024-03-11,10,1"), 2, "NEMOTECNICO_FORMATO"],
    ["fecha sin ceros", csv("FICTA,2024-3-11,10,1"), 2, "FECHA_FORMATO"],
    ["fecha del siglo pasado", csv("FICTA,1999-03-11,10,1"), 2, "FECHA_FORMATO"],
    ["fecha que no existe", csv("FICTA,2024-02-30,10,1"), 2, "FECHA_INVALIDA"],
    ["cierre 0", csv("FICTA,2024-03-11,0,1"), 2, "CIERRE_FUERA_DE_RANGO"],
    ["cierre sobre el tope", csv("FICTA,2024-03-11,10000000.5,1"), 2, "CIERRE_FUERA_DE_RANGO"],
    ["cierre con cero final", csv("FICTA,2024-03-11,10.50,1"), 2, "CIERRE_FORMATO"],
    ["cierre con exponente", csv("FICTA,2024-03-11,1e3,1"), 2, "CIERRE_FORMATO"],
    ["cierre negativo", csv("FICTA,2024-03-11,-5,1"), 2, "CIERRE_FORMATO"],
    ["cierre con cero a la izquierda", csv("FICTA,2024-03-11,05,1"), 2, "CIERRE_FORMATO"],
    ["cierre sin entero", csv("FICTA,2024-03-11,.5,1"), 2, "CIERRE_FORMATO"],
    ["cierre con punto final", csv("FICTA,2024-03-11,5.,1"), 2, "CIERRE_FORMATO"],
    ["cierre con 7 decimales", csv("FICTA,2024-03-11,1.0000001,1"), 2, "CIERRE_FORMATO"],
    ["cierre de 9 dígitos", csv("FICTA,2024-03-11,123456789,1"), 2, "CIERRE_FORMATO"],
    ["cierre con coma decimal", csv("FICTA,2024-03-11,10;5,1"), 2, "CIERRE_FORMATO"],
    ["cierre vacío", csv("FICTA,2024-03-11,,1"), 2, "CIERRE_FORMATO"],
    ["volumen negativo", csv("FICTA,2024-03-11,10,-1"), 2, "VOLUMEN_FORMATO"],
    ["volumen fraccionario", csv("FICTA,2024-03-11,10,1.5"), 2, "VOLUMEN_FORMATO"],
    ["volumen con cero a la izquierda", csv("FICTA,2024-03-11,10,01"), 2, "VOLUMEN_FORMATO"],
    ["volumen de 16 dígitos", csv("FICTA,2024-03-11,10,1234567890123456"), 2, "VOLUMEN_FORMATO"],
    ["fila repetida (especie y fecha)", csv("FICTA,2024-03-11,10,1", "FICTB,2024-03-11,10,1", "FICTA,2024-03-11,11,1"), 4, "FILA_REPETIDA"],
    ["solo el encabezado", csv(), 2, "SIN_FILAS"],
    ["archivo vacío", "", 1, "VACIO"],
  ];

  it.each(casos)("%s → línea %i, %s", (_nombre, texto, linea, codigo) => {
    const r = leer(texto);
    expect(r).toEqual({ ok: false, codigo: "CSV_INVALIDO", errores: [{ linea, codigo }], totalErrores: 1 });
  });

  it("los errores traen solo línea y código: nunca la especie, la fecha ni el precio", () => {
    const r = leer(csv("FICTQ,2024-03-11,0,1", "FICTQ,2024-13-11,7777.77,1"));
    expect(errores(r).map((e) => e.codigo)).toEqual(["CIERRE_FUERA_DE_RANGO", "FECHA_INVALIDA"]);
    expect(JSON.stringify(r)).not.toMatch(/FICTQ|7777|2024-13/);
  });

  it(`lista a lo sumo ${MAX_ERRORES_LISTADOS} errores y cuenta todos`, () => {
    const r = leer(csv(...Array.from({ length: 30 }, (_, i) => `ficta,${dia(i)},10,1`)));
    expect(r.ok).toBe(false);
    expect(errores(r)).toHaveLength(MAX_ERRORES_LISTADOS);
    expect(!r.ok && r.totalErrores).toBe(30);
  });

  it(`deja de leer a los ${MAX_ERRORES_CONTADOS} errores (security-reviewer MEDIO: 4 MiB de LF eran 4 millones de errores y +260 MB)`, () => {
    const r = leerCsvCierres(new Uint8Array(MAX_BYTES_CSV).fill(0x0a));
    expect(r.ok).toBe(false);
    expect(!r.ok && [r.totalErrores, r.errores.length]).toEqual([MAX_ERRORES_CONTADOS, MAX_ERRORES_LISTADOS]);
  });

  it("una fila válida no se acepta si otra del archivo falla (todo o nada)", () => {
    expect(leer(csv("FICTA,2024-03-11,10,1", "FICTA,2024-03-12,0,1")).ok).toBe(false);
  });
});

describe("CSV de cierres · topes", () => {
  it(`pasar de ${MAX_BYTES_CSV} bytes se rechaza sin leerlo`, () => {
    const grande = new Uint8Array(MAX_BYTES_CSV + 1).fill(0x41);
    expect(leerCsvCierres(grande)).toEqual({ ok: false, codigo: "CSV_DEMASIADO_GRANDE", errores: [], totalErrores: 0 });
  });

  const filas = (n: number, especies: number) => Array.from({ length: n }, (_, i) => `FICT${i % especies},${dia(Math.floor(i / especies))},10,1`);

  it(`${MAX_FILAS_CSV} filas de ${MAX_ESPECIES_CSV} especies pasan; una más es DEMASIADAS_FILAS en su línea`, () => {
    const justo = leer(csv(...filas(MAX_FILAS_CSV, MAX_ESPECIES_CSV)));
    expect(justo.ok && [justo.filas, justo.especies.length]).toEqual([MAX_FILAS_CSV, MAX_ESPECIES_CSV]);
    const demas = leer(csv(...filas(MAX_FILAS_CSV + 1, MAX_ESPECIES_CSV)));
    expect(errores(demas)).toEqual([{ linea: MAX_FILAS_CSV + 2, codigo: "DEMASIADAS_FILAS" }]);
  });

  it(`la especie ${MAX_ESPECIES_CSV + 1} es DEMASIADAS_ESPECIES en su primera línea`, () => {
    const r = leer(csv(...filas(MAX_ESPECIES_CSV + 1, MAX_ESPECIES_CSV + 1)));
    expect(errores(r)).toEqual([{ linea: MAX_ESPECIES_CSV + 2, codigo: "DEMASIADAS_ESPECIES" }]);
  });
});

describe("CSV de cierres · escritura (exportador)", () => {
  it("sin ningún cierre: SIN_FILAS (no hay CSV que escribir)", () => {
    expect(escribirCsvCierres([])).toEqual({ ok: false, codigo: "SIN_FILAS" });
    expect(escribirCsvCierres([{ nemotecnico: "FICTA", cierres: [] }])).toEqual({ ok: false, codigo: "SIN_FILAS" });
  });

  it(`más de ${MAX_FILAS_CSV} filas: CSV_DEMASIADO_GRANDE (nunca un CSV que el importador rechace)`, () => {
    const cierres = Array.from({ length: MAX_FILAS_CSV + 1 }, (_, i) => cierre(dia(i), "10", 1));
    expect(escribirCsvCierres([{ nemotecnico: "FICTA", cierres }])).toEqual({ ok: false, codigo: "CSV_DEMASIADO_GRANDE" });
  });

  it("una fila que el importador rechazaría (p. ej. volumen fraccionario) no se escribe: FILA_INVALIDA", () => {
    expect(escribirCsvCierres([{ nemotecnico: "FICTA", cierres: [cierre("2024-03-11", "10", 1.5)] }])).toEqual({ ok: false, codigo: "FILA_INVALIDA" });
    expect(escribirCsvCierres([{ nemotecnico: "ficta", cierres: [cierre("2024-03-11", "10", 1)] }])).toEqual({ ok: false, codigo: "FILA_INVALIDA" });
  });
});

describe("volumenExportable", () => {
  it("null y enteros de 0 a 15 dígitos sí; fracciones, negativos, NaN y 16 dígitos no", () => {
    expect([null, 0, 7, 999_999_999_999_999].map(volumenExportable)).toEqual([true, true, true, true]);
    expect([1.5, -1, Number.NaN, Number.POSITIVE_INFINITY, 1e15].map(volumenExportable)).toEqual([false, false, false, false, false]);
  });
});
