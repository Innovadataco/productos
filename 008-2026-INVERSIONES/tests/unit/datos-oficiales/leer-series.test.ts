// Lectura de las series oficiales (fase C, C5a; src/datos-oficiales/series/leer.ts) contra una base falsa: la consulta
// EXACTA que se le pide a Prisma (la misma que mide el candado de rendimiento: tests/integracion/series-leer-rendimiento.
// test.ts), que solo se leen vigentes (reemplazadoEn: null), que nunca se entrega un valor viejo como el de una fecha que
// no cubre, y que una entrada inválida no consulta la base. La integración (tests/integracion/series-leer.test.ts) lo
// repite contra PostgreSQL. Fechas de 2027; cifras inventadas.
import { describe, expect, it } from "vitest";
import { CATALOGO, serieDelCatalogo } from "@/datos-oficiales/catalogo";
import { ErrorLecturaSeries } from "@/datos-oficiales/series/consulta";
import { MAX_DIAS_RANGO_SERIES, MAX_DIAS_TRAS_DESDE_LECTURA, serieEnRango, ultimoValor, valorVigenteEn } from "@/datos-oficiales/series/leer";
import { baseFalsaLectura, type FilaLecturaFalsa } from "./base-falsa-lectura";

const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);
const SELECCION = { desde: true, hasta: true, valor: true, fuente: true, traidoEn: true };
const TRM = serieDelCatalogo("TRM")!;

const trm = (desde: string, hasta: string, valor: string, o: Partial<FilaLecturaFalsa> = {}): FilaLecturaFalsa => ({ serie: "TRM", desde, hasta, valor, fuente: TRM.fuente, ...o });

/** Una semana inventada de TRM: un fin de semana (TRAMO), un día retirado (revisado) y un hueco el 2027-03-11. */
const SEMANA: readonly FilaLecturaFalsa[] = [
  trm("2027-03-05", "2027-03-05", "4613.27"),
  trm("2027-03-06", "2027-03-08", "4617.13", { traidoEn: "2027-03-05T21:07:19Z" }),
  trm("2027-03-09", "2027-03-09", "4611.83", { retirada: true }),
  trm("2027-03-09", "2027-03-09", "4611.87"),
  trm("2027-03-10", "2027-03-10", "4609.41"),
  trm("2027-03-12", "2027-03-12", "4608.37"),
  { serie: "TPM", desde: "2027-03-10", hasta: "2027-03-10", valor: "9.53", fuente: serieDelCatalogo("TPM")!.fuente },
];

async function codigoDe(p: () => Promise<unknown>): Promise<string | null> {
  try {
    await p();
    return null;
  } catch (e) {
    return e instanceof ErrorLecturaSeries ? e.codigo : `otro: ${String(e)}`;
  }
}

describe("ultimoValor · el último YA en vigor (desde ≤ hoy), solo vigentes", () => {
  it("una sola sonda por el índice (serie, desde): desde ≤ hoy, más reciente primero, select explícito", async () => {
    const { db, llamadas } = baseFalsaLectura(SEMANA);
    await ultimoValor(db, "TRM", dia("2027-03-10"));
    expect(llamadas).toEqual([{ metodo: "findFirst", args: { where: { serie: "TRM", reemplazadoEn: null, desde: { lte: dia("2027-03-10") } }, orderBy: { desde: "desc" }, select: SELECCION } }]);
  });

  it("la cifra OFICIAL: valor canónico, unidad del catálogo, la vigencia, la fuente y cuándo se trajo", async () => {
    const { db } = baseFalsaLectura(SEMANA);
    expect(await ultimoValor(db, "TRM", dia("2027-03-07"))).toEqual({
      serie: "TRM", valor: "4617.13", unidad: "COP por USD", desde: dia("2027-03-06"), hasta: dia("2027-03-08"),
      fuente: "sfc:32sa-8pi3", traidoEn: new Date("2027-03-05T21:07:19Z"), origen: "OFICIAL",
    });
  });

  it("la TRM publicada por adelantado no es la de hoy: el 05 da la del 05 aunque la del fin de semana ya esté cargada", async () => {
    const { db } = baseFalsaLectura(SEMANA);
    expect((await ultimoValor(db, "TRM", dia("2027-03-05")))?.valor).toBe("4613.27");
  });

  it("ignora el retirado; sin vigentes que hayan empezado, null; con hueco, entrega el último con SU vigencia (la frescura dice si es viejo)", async () => {
    const { db } = baseFalsaLectura(SEMANA);
    expect((await ultimoValor(db, "TRM", dia("2027-03-09")))?.valor).toBe("4611.87");
    expect(await ultimoValor(db, "TRM", dia("2027-03-04"))).toBeNull();
    expect(await ultimoValor(db, "IBR_3M_EA", dia("2027-03-10"))).toBeNull();
    const enElHueco = await ultimoValor(db, "TRM", dia("2027-03-11"));
    expect([enElHueco?.valor, enElHueco?.desde, enElHueco?.hasta]).toEqual(["4609.41", dia("2027-03-10"), dia("2027-03-10")]);
  });

  it("los ceros sobrantes de DECIMAL(20,8) no salen y la cifra queda congelada", async () => {
    const { db } = baseFalsaLectura([{ serie: "TPM", desde: "2027-03-10", hasta: "2027-03-10", valor: "9.50000000" }]);
    const c = await ultimoValor(db, "TPM", dia("2027-03-10"));
    expect(c?.valor).toBe("9.5");
    expect(Object.isFrozen(c)).toBe(true);
  });
});

describe("valorVigenteEn · el que cubre la fecha o nada (nunca el anterior)", () => {
  it("la misma sonda que ultimoValor, con la fecha", async () => {
    const { db, llamadas } = baseFalsaLectura(SEMANA);
    await valorVigenteEn(db, "TRM", dia("2027-03-07"));
    expect(llamadas).toEqual([{ metodo: "findFirst", args: { where: { serie: "TRM", reemplazadoEn: null, desde: { lte: dia("2027-03-07") } }, orderBy: { desde: "desc" }, select: SELECCION } }]);
  });

  it("dentro de un TRAMO, en sus dos bordes, y el revisado en lugar del retirado", async () => {
    const { db } = baseFalsaLectura(SEMANA);
    for (const f of ["2027-03-06", "2027-03-07", "2027-03-08"]) expect((await valorVigenteEn(db, "TRM", dia(f)))?.valor, f).toBe("4617.13");
    expect((await valorVigenteEn(db, "TRM", dia("2027-03-09")))?.valor).toBe("4611.87");
  });

  it("un día sin vigente (hueco), antes del primero o después del último: null, aunque haya uno anterior", async () => {
    const { db } = baseFalsaLectura(SEMANA);
    expect(await valorVigenteEn(db, "TRM", dia("2027-03-11"))).toBeNull();
    expect(await valorVigenteEn(db, "TRM", dia("2027-03-04"))).toBeNull();
    expect(await valorVigenteEn(db, "TRM", dia("2027-03-13"))).toBeNull();
  });
});

describe("serieEnRango · las vigentes que se solapan con el rango, en orden", () => {
  it("consulta acotada por el índice: desde entre (desde − 31 días) y hasta, hasta ≥ desde, orden ascendente y take = días + 1", async () => {
    const { db, llamadas } = baseFalsaLectura(SEMANA);
    await serieEnRango(db, "TRM", dia("2027-03-07"), dia("2027-03-10"));
    expect(MAX_DIAS_TRAS_DESDE_LECTURA).toBe(31);
    expect(llamadas).toEqual([{
      metodo: "findMany",
      args: { where: { serie: "TRM", reemplazadoEn: null, desde: { gte: dia("2027-02-04"), lte: dia("2027-03-10") }, hasta: { gte: dia("2027-03-07") } }, orderBy: { desde: "asc" }, take: 5, select: SELECCION },
    }]);
  });

  it("entra entera la vigencia que empieza antes del rango; el retirado no; la otra serie no", async () => {
    const { db } = baseFalsaLectura(SEMANA);
    const r = await serieEnRango(db, "TRM", dia("2027-03-07"), dia("2027-03-11"));
    expect(r.map((c) => [c.desde, c.hasta, c.valor])).toEqual([
      [dia("2027-03-06"), dia("2027-03-08"), "4617.13"], [dia("2027-03-09"), dia("2027-03-09"), "4611.87"], [dia("2027-03-10"), dia("2027-03-10"), "4609.41"],
    ]);
    expect(new Set(r.map((c) => c.origen))).toEqual(new Set(["OFICIAL"]));
    expect(Object.isFrozen(r)).toBe(true);
  });

  it("una vigencia de 32 días que empieza 31 antes del rango entra; un rango sin vigentes da vacío", async () => {
    const { db } = baseFalsaLectura([{ serie: "TPM", desde: "2027-01-08", hasta: "2027-02-08", valor: "9.37" }]);
    expect((await serieEnRango(db, "TPM", dia("2027-02-08"), dia("2027-02-08"))).map((c) => c.valor)).toEqual(["9.37"]);
    expect(await serieEnRango(db, "TPM", dia("2027-02-09"), dia("2027-02-20"))).toEqual([]);
  });

  it("un día (desde = hasta) vale; el rango más largo (MAX_DIAS_RANGO_SERIES) vale; uno más, no, sin consultar", async () => {
    const { db, llamadas } = baseFalsaLectura(SEMANA);
    expect((await serieEnRango(db, "TRM", dia("2027-03-09"), dia("2027-03-09"))).map((c) => c.valor)).toEqual(["4611.87"]);
    const inicio = dia("1951-01-08");
    const finMaximo = new Date(inicio.getTime() + (MAX_DIAS_RANGO_SERIES - 1) * 86_400_000);
    expect(finMaximo.getTime()).toBeLessThan(dia("2027-03-05").getTime());
    expect(await serieEnRango(db, "TRM", inicio, finMaximo)).toEqual([]);
    expect(llamadas.at(-1)?.args.take).toBe(MAX_DIAS_RANGO_SERIES + 1);
    const antes = llamadas.length;
    expect(await codigoDe(() => serieEnRango(db, "TRM", inicio, new Date(finMaximo.getTime() + 86_400_000)))).toBe("RANGO_DEMASIADO_LARGO");
    expect(llamadas.length).toBe(antes);
  });

  it("más filas que días en el rango (la exclusión de la base no lo deja): DEMASIADAS_FILAS, nunca un recorte en silencio", async () => {
    const forzadas = ["2027-03-07", "2027-03-08", "2027-03-09"].map((d) => trm(d, d, "4613.27"));
    const { db } = baseFalsaLectura([], { forzarMany: forzadas });
    expect(await codigoDe(() => serieEnRango(db, "TRM", dia("2027-03-07"), dia("2027-03-08")))).toBe("DEMASIADAS_FILAS");
    expect((await serieEnRango(baseFalsaLectura([], { forzarMany: forzadas }).db, "TRM", dia("2027-03-07"), dia("2027-03-09"))).length).toBe(3);
  });
});

describe("leer.ts · entradas inválidas: error tipado y sin consultar la base", () => {
  it("una serie fuera del catálogo", async () => {
    const { db, llamadas } = baseFalsaLectura(SEMANA);
    expect(await codigoDe(() => ultimoValor(db, "UVR", dia("2027-03-10")))).toBe("SERIE_DESCONOCIDA");
    expect(await codigoDe(() => valorVigenteEn(db, "trm", dia("2027-03-10")))).toBe("SERIE_DESCONOCIDA");
    expect(await codigoDe(() => serieEnRango(db, "FICTA", dia("2027-03-01"), dia("2027-03-10")))).toBe("SERIE_DESCONOCIDA");
    expect(llamadas).toEqual([]);
  });

  it("fechas que no son un día (medianoche UTC) o inválidas, y un rango invertido", async () => {
    const { db, llamadas } = baseFalsaLectura(SEMANA);
    expect(await codigoDe(() => ultimoValor(db, "TRM", new Date("2027-03-10T05:00:00Z")))).toBe("FECHA_INVALIDA");
    expect(await codigoDe(() => valorVigenteEn(db, "TRM", new Date("x")))).toBe("FECHA_INVALIDA");
    expect(await codigoDe(() => serieEnRango(db, "TRM", new Date("2027-03-01T12:00:00Z"), dia("2027-03-10")))).toBe("FECHA_INVALIDA");
    expect(await codigoDe(() => serieEnRango(db, "TRM", dia("2027-03-01"), new Date(Number.NaN)))).toBe("FECHA_INVALIDA");
    expect(await codigoDe(() => serieEnRango(db, "TRM", dia("2027-03-10"), dia("2027-03-09")))).toBe("RANGO_INVALIDO");
    expect(llamadas).toEqual([]);
  });

  it("un valor que la base no debería tener (cero, negativo, exponente): VALOR_INVALIDO, nunca se muestra", async () => {
    for (const malo of ["0", "-4613.27", "4.61327e3"]) {
      const { db } = baseFalsaLectura([trm("2027-03-05", "2027-03-05", { toFixed: () => malo } as never)]);
      expect(await codigoDe(() => ultimoValor(db, "TRM", dia("2027-03-05"))), malo).toBe("VALOR_INVALIDO");
      expect(await codigoDe(() => serieEnRango(db, "TRM", dia("2027-03-05"), dia("2027-03-05"))), malo).toBe("VALOR_INVALIDO");
    }
  });

  it("un catálogo inyectado (las pruebas de integración usan series ficticias) y, por omisión, el de 008", async () => {
    const ficticia = { ...serieDelCatalogo("TPM")!, codigo: "FICTA", unidad: "unidad ficticia" };
    const { db } = baseFalsaLectura([{ serie: "FICTA", desde: "2027-03-10", hasta: "2027-03-10", valor: "7.13" }]);
    expect(await ultimoValor(db, "FICTA", dia("2027-03-10"), [ficticia])).toMatchObject({ serie: "FICTA", valor: "7.13", unidad: "unidad ficticia" });
    expect(await codigoDe(() => ultimoValor(db, "TPM", dia("2027-03-10"), [ficticia]))).toBe("SERIE_DESCONOCIDA");
    expect(CATALOGO.map((s) => s.codigo)).toContain("TRM");
  });
});
