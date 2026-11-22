// El CSV de decretos del dueño (fase C, C4a: src/datos-oficiales/decretos/{csv,filas}.ts): encabezado exacto, cada
// columna con su código, las reglas entre columnas, P10 (anular con nota), P11 (solo COP y en dinero), DECRETO_REPETIDO,
// todo o nada y hallazgos sin valores. Datos inventados: especies FICTA y FICTB, números raros, fechas anteriores a 2022
// o de 2027.
import { describe, expect, it } from "vitest";
import { ENCABEZADO_DECRETOS, MAX_BYTES_DECRETOS, MAX_FILAS_DECRETOS, claveTexto, leerCsvDecretos, type LecturaDecretos } from "@/datos-oficiales/decretos/csv";
import { COLUMNAS, interpretarFila } from "@/datos-oficiales/decretos/filas";

const HOY = new Date("2021-06-23T00:00:00Z");
const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);
type Fila = Record<(typeof COLUMNAS)[number], string>;
const FILA: Fila = {
  especie: "FICTA", tipo: "ORDINARIO", fecha_anuncio: "2021-03-17", cuota: "1", valor_por_accion: "1873.204517", moneda: "COP", forma: "DINERO",
  fecha_ex: "2021-04-14", fecha_pago: "2021-04-21", referencia: "https://www.superfinanciera.gov.co/ficticio/decreto?id=4613", anulada: "", nota: "",
};
const celdas = (c: Partial<Fila> = {}) => COLUMNAS.map((k) => ({ ...FILA, ...c })[k]);
const linea = (c: Partial<Fila> = {}) => celdas(c).map((v) => (/[",]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v)).join(",");
const csv = (...filas: Partial<Fila>[]) => new TextEncoder().encode(`${ENCABEZADO_DECRETOS.join(",")}\n${filas.map(linea).join("\n")}\n`);
const leer = (...filas: Partial<Fila>[]): LecturaDecretos => leerCsvDecretos(csv(...filas), HOY);
const codigos = (c: Partial<Fila>) => {
  const r = interpretarFila(celdas(c), 2, HOY);
  return r.ok ? [] : r.hallazgos.map((h) => `${h.columna}:${h.codigo}`);
};

describe("decretos · encabezado", () => {
  it("es exacto y en este orden", () => {
    expect(ENCABEZADO_DECRETOS).toEqual([
      "especie", "tipo", "fecha_anuncio", "cuota", "valor_por_accion", "moneda", "forma", "fecha_ex", "fecha_pago", "referencia", "anulada", "nota",
    ]);
    const r = leerCsvDecretos(new TextEncoder().encode(`${[...ENCABEZADO_DECRETOS].reverse().join(",")}\n${linea()}\n`), HOY);
    expect(r.ok ? [] : r.hallazgos.map((h) => h.codigo)).toEqual(["ENCABEZADO_DISTINTO"]);
  });
});

describe("decretos · una fila", () => {
  it("una fila válida da el decreto con los valores canónicos (valor sin ceros de sobra, fechas de negocio)", () => {
    const r = leer({ valor_por_accion: "01873.2045170", nota: "  primera cuota  " }, { especie: "fictb", tipo: "EXTRAORDINARIO", cuota: "12", referencia: "sfc:FICT-4613", anulada: "NO" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.filas.map((f) => f.decreto)).toEqual([
      {
        linea: 2, especie: "FICTA", tipo: "ORDINARIO", fechaAnuncio: dia("2021-03-17"), cuota: 1, valorPorAccion: "1873.204517",
        fechaEx: dia("2021-04-14"), fechaPago: dia("2021-04-21"), referencia: FILA.referencia, anulada: false, nota: "primera cuota",
      },
      {
        linea: 3, especie: "FICTB", tipo: "EXTRAORDINARIO", fechaAnuncio: dia("2021-03-17"), cuota: 12, valorPorAccion: "1873.204517",
        fechaEx: dia("2021-04-14"), fechaPago: dia("2021-04-21"), referencia: "sfc:FICT-4613", anulada: false, nota: null,
      },
    ]);
    expect(r.filas[0]!.crudo).toMatchObject({ especie: "FICTA", valor_por_accion: "01873.2045170", nota: "  primera cuota  " });
  });

  it("especie, tipo y fechas: cada una con su código", () => {
    expect(codigos({ especie: "FI-CTA" })).toEqual(["especie:NEMOTECNICO_FORMATO"]);
    expect(codigos({ especie: "" })).toEqual(["especie:NEMOTECNICO_FORMATO"]);
    expect(codigos({ tipo: "FRACCION_ESCISION" })).toEqual(["tipo:TIPO_DESCONOCIDO"]);
    expect(codigos({ tipo: "ordinario" })).toEqual(["tipo:TIPO_DESCONOCIDO"]);
    expect(codigos({ fecha_anuncio: "17/03/2021" })).toEqual(["fecha_anuncio:FECHA_FORMATO"]);
    expect(codigos({ fecha_ex: "2021-02-30" })).toEqual(["fecha_ex:FECHA_INVALIDA"]);
    expect(codigos({ fecha_pago: "" })).toEqual(["fecha_pago:FECHA_FORMATO"]);
  });

  it("anuncio ≤ ex ≤ pago (iguales valen) y un anuncio que no sea posterior a hoy", () => {
    expect(codigos({ fecha_anuncio: "2021-04-14", fecha_ex: "2021-04-14", fecha_pago: "2021-04-14" })).toEqual([]);
    expect(codigos({ fecha_ex: "2021-03-16" })).toEqual(["fecha_ex:FECHAS_INCOHERENTES"]);
    expect(codigos({ fecha_pago: "2021-04-13" })).toEqual(["fecha_ex:FECHAS_INCOHERENTES"]);
    expect(codigos({ fecha_anuncio: "2021-06-23", fecha_ex: "2027-04-14", fecha_pago: "2027-04-21" })).toEqual([]);
    expect(codigos({ fecha_anuncio: "2021-06-24", fecha_ex: "2027-04-14", fecha_pago: "2027-04-21" })).toEqual(["fecha_anuncio:FECHA_ANUNCIO_FUTURA"]);
  });

  it("cuota de 1 a 12, entera", () => {
    expect(codigos({ cuota: "12" })).toEqual([]);
    expect(codigos({ cuota: "0" })).toEqual(["cuota:CUOTA_RANGO"]);
    expect(codigos({ cuota: "13" })).toEqual(["cuota:CUOTA_RANGO"]);
    for (const mala of ["1.0", "-1", "uno", "", "123"]) expect(codigos({ cuota: mala }), mala).toEqual(["cuota:CUOTA_FORMATO"]);
  });

  it("valor por acción: punto decimal, hasta 6 decimales, que quepa en DECIMAL(20,6) y mayor que 0", () => {
    expect(codigos({ valor_por_accion: "0.000317" })).toEqual([]);
    expect(codigos({ valor_por_accion: "41.3729170" })).toEqual([]);
    expect(codigos({ valor_por_accion: "0.0000001" })).toEqual(["valor_por_accion:NUMERO_PRECISION"]);
    expect(codigos({ valor_por_accion: "1873,204517" })).toEqual(["valor_por_accion:NUMERO_FORMATO"]);
    expect(codigos({ valor_por_accion: "1.87e3" })).toEqual(["valor_por_accion:NUMERO_FORMATO"]);
    expect(codigos({ valor_por_accion: "123456789012345" })).toEqual(["valor_por_accion:NUMERO_RANGO"]);
    expect(codigos({ valor_por_accion: "12345678901234" })).toEqual([]);
    for (const malo of ["0", "0.000", "-3.7139"]) expect(codigos({ valor_por_accion: malo }), malo).toEqual(["valor_por_accion:VALOR_NO_POSITIVO"]);
  });

  it("P11: solo en pesos (COP) y en dinero (DINERO); un decreto en USD o en acciones no entra", () => {
    expect(codigos({ moneda: "USD" })).toEqual(["moneda:MONEDA_NO_ADMITIDA"]);
    expect(codigos({ moneda: "" })).toEqual(["moneda:MONEDA_NO_ADMITIDA"]);
    expect(codigos({ moneda: "cop" })).toEqual(["moneda:MONEDA_NO_ADMITIDA"]);
    expect(codigos({ forma: "ACCIONES" })).toEqual(["forma:FORMA_NO_ADMITIDA"]);
    expect(codigos({ forma: "" })).toEqual(["forma:FORMA_NO_ADMITIDA"]);
  });

  it("la referencia oficial: una página https de la SFC o de la BVC, o el radicado de la SFC, hasta 500", () => {
    for (const buena of ["https://www.bvc.com.co/emisores/ficticio?x=1&y=2#z", "sfc:2021-4613.7_a", `https://www.superfinanciera.gov.co/${"a".repeat(465)}`]) {
      expect(codigos({ referencia: buena }), buena).toEqual([]);
    }
    const malas = [
      "http://www.superfinanciera.gov.co/x", "https://superfinanciera.gov.co/x", "https://www.superfinanciera.gov.co.ejemplo.invalid/x",
      "https://www.superfinanciera.gov.co/", "https://www.bvc.com.co/x y", "https://www.bvc.com.co/<x>", "sfc:", `sfc:${"a".repeat(61)}`,
      "javascript:alert(1)", "", `https://www.superfinanciera.gov.co/${"a".repeat(466)}`,
    ];
    for (const mala of malas) expect(codigos({ referencia: mala }), mala).toEqual(["referencia:REFERENCIA_NO_OFICIAL"]);
  });

  it("P10: anulada SI (o SÍ) con su nota; NO o vacía no anula; la nota hasta 500 caracteres", () => {
    expect(codigos({ anulada: "SI", nota: "registrado con la cuota equivocada" })).toEqual([]);
    expect(codigos({ anulada: "SÍ", nota: "ídem" })).toEqual([]);
    expect(codigos({ anulada: "SI" })).toEqual(["nota:NOTA_OBLIGATORIA"]);
    expect(codigos({ anulada: "SI", nota: "    " })).toEqual(["nota:NOTA_OBLIGATORIA"]);
    expect(codigos({ anulada: "si" })).toEqual(["anulada:ANULADA_FORMATO"]);
    expect(codigos({ anulada: "1" })).toEqual(["anulada:ANULADA_FORMATO"]);
    expect(codigos({ nota: "ñ".repeat(500) })).toEqual([]);
    expect(codigos({ nota: "ñ".repeat(501) })).toEqual(["nota:NOTA_LARGA"]);
    expect(codigos({ nota: "😀".repeat(500) })).toEqual([]);
  });

  it("varios errores de una fila salen todos, en el orden de las columnas", () => {
    expect(codigos({ especie: "-", cuota: "0", moneda: "USD", referencia: "x" })).toEqual([
      "especie:NEMOTECNICO_FORMATO", "cuota:CUOTA_RANGO", "moneda:MONEDA_NO_ADMITIDA", "referencia:REFERENCIA_NO_OFICIAL",
    ]);
  });
});

describe("decretos · el archivo", () => {
  it("todo o nada: una fila mala rechaza el archivo entero, con su línea y su columna", () => {
    const r = leer({}, { cuota: "2", forma: "ACCIONES" }, { cuota: "3" });
    expect(r).toMatchObject({ ok: false, hallazgos: [{ linea: 3, columna: "forma", codigo: "FORMA_NO_ADMITIDA" }] });
  });

  it("dos filas con la misma especie, anuncio, tipo y cuota: DECRETO_REPETIDO en la segunda", () => {
    const r = leer({}, { cuota: "2" }, { valor_por_accion: "41.3729" }, { tipo: "EXTRAORDINARIO" });
    expect(r).toMatchObject({ ok: false, hallazgos: [{ linea: 4, columna: null, codigo: "DECRETO_REPETIDO" }] });
    expect(claveTexto({ especie: "FICTA", tipo: "ORDINARIO", fechaAnuncio: dia("2021-03-17"), cuota: 1 })).toBe("FICTA|ORDINARIO|2021-03-17|1");
  });

  it("los hallazgos nunca llevan valores: ni la especie, ni el valor, ni la referencia, ni la nota", () => {
    const r = leer({ especie: "FICTA4613", valor_por_accion: "-4613.3719", referencia: "https://ejemplo.invalid/4613", nota: "nota secreta 4613" });
    expect(r.ok).toBe(false);
    expect(JSON.stringify(r)).not.toMatch(/FICTA|4613|ejemplo|secreta/);
  });

  it("topes: MAX_FILAS_DECRETOS filas pasan y una más no; más de MAX_BYTES_DECRETOS bytes no se lee", () => {
    expect(MAX_FILAS_DECRETOS).toBe(2000);
    expect(MAX_BYTES_DECRETOS).toBe(1024 * 1024);
    // 144 claves distintas por especie: 12 meses de anuncio × 12 cuotas.
    const mes = (i: number) => String((Math.floor(i / 12) % 12) + 1).padStart(2, "0");
    const filas = (n: number) => Array.from({ length: n }, (_, i) => ({ cuota: String((i % 12) + 1), fecha_anuncio: `2019-${mes(i)}-01`, especie: `FICT${Math.floor(i / 144)}` }));
    expect(leer(...filas(MAX_FILAS_DECRETOS)).ok).toBe(true);
    expect(leer(...filas(MAX_FILAS_DECRETOS + 1))).toMatchObject({ ok: false, hallazgos: [{ linea: 0, codigo: "DEMASIADAS_FILAS" }] });
    const grande = new Uint8Array(MAX_BYTES_DECRETOS + 1).fill(0x41);
    expect(leerCsvDecretos(grande, HOY)).toMatchObject({ ok: false, hallazgos: [{ linea: 0, codigo: "ARCHIVO_DEMASIADO_GRANDE" }] });
  });
});
