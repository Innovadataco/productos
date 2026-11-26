// La cifra oficial y la variación de un índice (fase C, C5a; src/datos-oficiales/series/consulta.ts), puro:
// - `esValorOficial`: lo que la base guarda (DECIMAL(20,8), > 0) en su forma canónica, como texto (nunca Number);
// - `variacionIndice`: (final / base − 1) × 100 con BigInt sobre el texto, 2 decimales y la mitad lejos de cero; sale
//   CALCULADA (calculada por Inversiones, nunca atribuida a la fuente), con signo si es negativa y sin «-0.00». Solo entre dos
//   cifras OFICIALES de una misma serie índice, con la base antes del final.
// El oráculo de la prueba es Prisma.Decimal (decimal.js) con 80 dígitos; el código no lo usa. Cifras inventadas.
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  DECIMALES_VARIACION, ErrorLecturaSeries, SERIES_INDICE, UNIDAD_VARIACION, esValorOficial, variacionIndice, type CifraOficial,
} from "@/datos-oficiales/series/consulta";

const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);
const instante = (iso: string) => new Date(iso);

/** El índice de un mes (vigencia MES), tal como lo entrega leer.ts. */
const indice = (mes: string, valor: string, o: Partial<CifraOficial> = {}): CifraOficial => {
  const desde = dia(`${mes}-01`);
  const hasta = new Date(Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth() + 1, 0));
  return {
    serie: "IPC_INDICE", valor, unidad: "índice (base dic-2018 = 100)", desde, hasta, fuente: "dane:anex-IPC-Indices",
    traidoEn: instante("2027-04-09T14:37:11Z"), origen: "OFICIAL", ...o,
  };
};

const Oraculo = Prisma.Decimal.clone({ precision: 80, rounding: Prisma.Decimal.ROUND_HALF_UP });
function esperado(base: string, final: string): string {
  const v = new Oraculo(final).div(base).minus(1).times(100).toDecimalPlaces(DECIMALES_VARIACION, Oraculo.ROUND_HALF_UP).toFixed(DECIMALES_VARIACION);
  return v === "-0.00" ? "0.00" : v;
}

/** Generador con semilla (LCG): los mismos pares inventados en cada corrida. */
function generador(semilla: number): () => number {
  let s = semilla >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** Un valor canónico inventado: de 1 a 12 enteros y de 0 a 8 decimales, sin ceros sobrantes ni «0». */
function valorInventado(azar: () => number): string {
  const enteros = 1 + Math.floor(azar() * 12);
  let entero = String(1 + Math.floor(azar() * 9));
  for (let i = 1; i < enteros; i += 1) entero += String(Math.floor(azar() * 10));
  const decimales = Math.floor(azar() * 9);
  let fraccion = "";
  for (let i = 0; i < decimales; i += 1) fraccion += String(Math.floor(azar() * 10));
  fraccion = fraccion.replace(/0+$/, "");
  return fraccion === "" ? entero : `${entero}.${fraccion}`;
}

const codigoDe = (f: () => unknown): string | null => {
  try {
    f();
    return null;
  } catch (e) {
    return e instanceof ErrorLecturaSeries ? e.codigo : `otro: ${String(e)}`;
  }
};

describe("esValorOficial · lo que guarda la base, canónico", () => {
  it("acepta decimales canónicos positivos de hasta 12 enteros y 8 decimales", () => {
    for (const v of ["137.41", "4619", "0.53", "9.53", "0.00000001", "999999999999.99999999", "4613.27"]) expect(esValorOficial(v), v).toBe(true);
  });

  it("rechaza el cero, el signo, ceros sobrantes, exponentes, espacios y lo que no cabe en DECIMAL(20,8)", () => {
    for (const v of ["0", "0.0", "-3.71", "+3.71", "03.71", "3.710", "3.", ".71", "1e3", " 3.71", "3,71", "", "NaN", "Infinity", "1000000000000", "0.000000001"]) {
      expect(esValorOficial(v), v).toBe(false);
    }
  });
});

describe("variacionIndice · la variación del IPC sale del índice (CALCULADA)", () => {
  it("anual: 2 decimales, unidad «calculada por Inversiones», del desde de la base al hasta del final, la fuente del final y el traído más reciente", () => {
    const base = indice("2027-01", "137.41", { traidoEn: instante("2027-02-11T15:03:17Z") });
    const final = indice("2028-01", "143.29", { traidoEn: instante("2028-02-09T13:41:29Z") });
    expect(variacionIndice(base, final)).toEqual({
      serie: "IPC_INDICE", valor: "4.28", unidad: UNIDAD_VARIACION, desde: dia("2027-01-01"), hasta: dia("2028-01-31"),
      fuente: "dane:anex-IPC-Indices", traidoEn: instante("2028-02-09T13:41:29Z"), origen: "CALCULADA",
    });
    expect(UNIDAD_VARIACION).toMatch(/calculada por Inversiones/);
  });

  it("el traído más reciente aunque sea el de la base (una revisión del mes viejo)", () => {
    const base = indice("2027-02", "137.43", { traidoEn: instante("2028-03-10T16:07:43Z") });
    const final = indice("2027-03", "137.47", { traidoEn: instante("2027-04-08T12:19:05Z") });
    expect(variacionIndice(base, final).traidoEn).toEqual(instante("2028-03-10T16:07:43Z"));
  });

  it("negativa (deflación) con signo; igual da 0.00; una caída que redondea a cero da 0.00, nunca -0.00", () => {
    expect(variacionIndice(indice("2027-01", "143.29"), indice("2027-02", "137.41")).valor).toBe("-4.10");
    expect(variacionIndice(indice("2027-01", "137.41"), indice("2027-02", "137.41")).valor).toBe("0.00");
    expect(variacionIndice(indice("2027-01", "371.2"), indice("2027-02", "371.19999")).valor).toBe("0.00");
    expect(variacionIndice(indice("2027-01", "371.2"), indice("2027-02", "371.20001")).valor).toBe("0.00");
  });

  it("la mitad exacta se aleja de cero con los dos signos; justo debajo de la mitad, no", () => {
    expect(variacionIndice(indice("2027-01", "371.2"), indice("2027-02", "374.93056")).valor).toBe("1.01");
    expect(variacionIndice(indice("2027-01", "371.2"), indice("2027-02", "367.46944")).valor).toBe("-1.01");
    expect(variacionIndice(indice("2027-01", "371.2"), indice("2027-02", "374.93055")).valor).toBe("1.00");
    expect(variacionIndice(indice("2027-01", "371.2"), indice("2027-02", "367.46945")).valor).toBe("-1.00");
  });

  it("escalas distintas, 8 decimales y el máximo de la base", () => {
    expect(variacionIndice(indice("2027-01", "137.4"), indice("2027-02", "143.29871")).valor).toBe(esperado("137.4", "143.29871"));
    expect(variacionIndice(indice("2027-01", "0.00000001"), indice("2027-02", "999999999999.99999999")).valor).toBe(esperado("0.00000001", "999999999999.99999999"));
    expect(variacionIndice(indice("2027-01", "999999999999.99999999"), indice("2027-02", "0.00000001")).valor).toBe("-100.00");
  });

  it("coincide con decimal.js en 3 713 pares inventados (semilla fija)", () => {
    const azar = generador(4613);
    for (let i = 0; i < 3713; i += 1) {
      const [b, f] = [valorInventado(azar), valorInventado(azar)];
      expect(variacionIndice(indice("2027-01", b), indice("2027-02", f)).valor, `${b} → ${f}`).toBe(esperado(b, f));
    }
  });

  it("siempre con exactamente DECIMALES_VARIACION decimales", () => {
    expect(DECIMALES_VARIACION).toBe(2);
    expect(variacionIndice(indice("2027-01", "137.41"), indice("2027-02", "151.151")).valor).toMatch(/^-?(0|[1-9][0-9]*)\.[0-9]{2}$/);
  });

  it("solo series índice del catálogo (la TPM es una tasa: su cambio no es un % de variación)", () => {
    expect(SERIES_INDICE).toEqual(["IPC_INDICE"]);
    const tpm = (mes: string, v: string) => indice(mes, v, { serie: "TPM", fuente: "banrep:DF_CBR_DAILY_HIST.IRCBRM01.PA" });
    expect(codigoDe(() => variacionIndice(tpm("2027-01", "9.53"), tpm("2027-02", "9.37")))).toBe("NO_ES_INDICE");
  });

  it("errores tipados: otra serie, una entrada CALCULADA, la base no anterior, valores y fechas inválidos", () => {
    const b = indice("2027-01", "137.41");
    const f = indice("2027-02", "137.43");
    expect(codigoDe(() => variacionIndice(b, { ...f, serie: "TRM" }))).toBe("SERIES_DISTINTAS");
    expect(codigoDe(() => variacionIndice({ ...b, origen: "CALCULADA" }, f))).toBe("NO_ES_OFICIAL");
    expect(codigoDe(() => variacionIndice(b, { ...f, origen: "CALCULADA" }))).toBe("NO_ES_OFICIAL");
    expect(codigoDe(() => variacionIndice(b, b))).toBe("BASE_NO_ANTERIOR");
    expect(codigoDe(() => variacionIndice(f, b))).toBe("BASE_NO_ANTERIOR");
    expect(codigoDe(() => variacionIndice({ ...b, hasta: dia("2027-02-01") }, f))).toBe("BASE_NO_ANTERIOR");
    for (const v of ["0", "-137.41", "137.410", "1e2", ""]) {
      expect(codigoDe(() => variacionIndice({ ...b, valor: v }, f)), v).toBe("VALOR_INVALIDO");
      expect(codigoDe(() => variacionIndice(b, { ...f, valor: v })), v).toBe("VALOR_INVALIDO");
    }
    expect(codigoDe(() => variacionIndice({ ...b, desde: new Date("x") }, f))).toBe("FECHA_INVALIDA");
    expect(codigoDe(() => variacionIndice(b, { ...f, hasta: new Date(Number.NaN) }))).toBe("FECHA_INVALIDA");
    expect(codigoDe(() => variacionIndice(b, { ...f, desde: instante("2027-02-01T05:00:00Z") }))).toBe("FECHA_INVALIDA");
    expect(codigoDe(() => variacionIndice(b, { ...f, traidoEn: new Date("x") }))).toBe("FECHA_INVALIDA");
    // Hallazgo MEDIO del code-reviewer: una vigencia al revés (hasta antes de desde), en la base o en el final.
    expect(codigoDe(() => variacionIndice({ ...b, hasta: dia("2026-12-31") }, f))).toBe("FECHA_INVALIDA");
    expect(codigoDe(() => variacionIndice(b, { ...f, desde: dia("2027-03-01"), hasta: dia("2027-02-28") }))).toBe("FECHA_INVALIDA");
  });

  it("el mensaje del error es solo el código: ni valores ni fechas", () => {
    try {
      variacionIndice(indice("2027-01", "4613.27"), indice("2027-02", "-4613.29"));
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ErrorLecturaSeries);
      expect((e as Error).message).toBe("VALOR_INVALIDO");
      expect((e as Error).name).toBe("ErrorLecturaSeries");
    }
  });

  it("no comparte fechas con las entradas (cambiar el resultado no toca la base ni el final) y queda congelado", () => {
    const base = indice("2027-01", "137.41");
    const final = indice("2027-02", "137.43");
    const r = variacionIndice(base, final);
    expect(r.desde).not.toBe(base.desde);
    expect(r.hasta).not.toBe(final.hasta);
    expect(r.traidoEn).not.toBe(final.traidoEn);
    expect(Object.isFrozen(r)).toBe(true);
  });
});
