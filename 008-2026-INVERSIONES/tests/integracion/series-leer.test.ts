// La lectura de las series oficiales (src/datos-oficiales/series/leer.ts) contra la base de PRUEBAS, sembrada por el
// camino único (guardarSeries, con las reglas de C1: índice único parcial, exclusión de vigencias e inv_solo_retiro):
// - solo vigentes: tras una revisión, el retirado no se lee y el día que quedó sin vigente da null (nunca el retirado ni
//   el anterior);
// - la TRM publicada por adelantado no es la de hoy; la frescura de lo leído (ATRASADA y sin cubrir hoy);
// - serieEnRango: la vigencia que empieza 31 días antes entra entera, en orden, sin los retirados;
// - el valor sale canónico de DECIMAL(20,8) y se puede leer dentro de una transacción de solo lectura (C6a);
// - la variación del IPC, CALCULADA desde dos índices leídos.
// No se puede borrar (inv_solo_retiro): cada caso usa su propia serie ficticia (FICTL_<corrida>_<n>) con un catálogo
// inyectado. Solo el IPC usa el código real (SERIES_INDICE) y lo hace en 1913, lejos de cualquier otra prueba.
// Cifras inventadas.
import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { serieDelCatalogo, type SerieCatalogo } from "@/datos-oficiales/catalogo";
import { variacionIndice } from "@/datos-oficiales/series/consulta";
import { frescura } from "@/datos-oficiales/series/frescura";
import { guardarSeries, type SerieAGuardar } from "@/datos-oficiales/series/guardar";
import { serieEnRango, ultimoValor, valorVigenteEn } from "@/datos-oficiales/series/leer";

const db = new PrismaClient();
const corrida = Date.now().toString(36).toUpperCase();
let n = 0;
const nuevaSerie = () => `FICTL_${corrida}_${(n += 1)}`;
const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);
const fila = (desde: string, hasta: string, valor: string) => ({ desde: dia(desde), hasta: dia(hasta), valor });
const FUENTE = "sfc:ficticia";

/** Una serie ficticia para el catálogo inyectado: la forma de la TRM (TRAMO, umbral 3), con su propio código. */
const ficticia = (codigo: string): SerieCatalogo => ({
  ...serieDelCatalogo("TRM")!, codigo, nombre: "Serie ficticia", unidad: "unidad ficticia", vigencia: { tipo: "TRAMO", maxDias: 32 }, fuente: FUENTE,
});

async function sembrar(codigo: string, valores: SerieAGuardar["valores"], fuente = FUENTE): Promise<void> {
  const [balance] = await guardarSeries(db, [{ codigo, fuente, valores }]);
  expect(balance?.fallo).toBeNull();
}

afterAll(async () => {
  await db.$disconnect();
});

describe("lectura de series contra la base · solo vigentes", () => {
  it("tras una revisión: el retirado no se lee, el día descubierto da null (ni el retirado ni el anterior)", async () => {
    const s = nuevaSerie();
    const cat = [ficticia(s)];
    await sembrar(s, [fila("2027-02-26", "2027-02-28", "4611.83"), fila("2027-03-01", "2027-03-03", "4613.27")]);
    await sembrar(s, [fila("2027-03-01", "2027-03-01", "4613.29")]);
    expect(await db.valorSerieOficial.count({ where: { serie: s, reemplazadoEn: { not: null } } })).toBe(1);

    expect((await valorVigenteEn(db, s, dia("2027-03-01"), cat))?.valor).toBe("4613.29");
    expect(await valorVigenteEn(db, s, dia("2027-03-02"), cat)).toBeNull();
    expect(await valorVigenteEn(db, s, dia("2027-03-03"), cat)).toBeNull();
    expect((await valorVigenteEn(db, s, dia("2027-02-27"), cat))?.valor).toBe("4611.83");

    const ultimo = await ultimoValor(db, s, dia("2027-03-05"), cat);
    expect(ultimo).toMatchObject({ serie: s, valor: "4613.29", unidad: "unidad ficticia", desde: dia("2027-03-01"), hasta: dia("2027-03-01"), fuente: FUENTE, origen: "OFICIAL" });
    expect(ultimo?.traidoEn).toBeInstanceOf(Date);

    const rango = await serieEnRango(db, s, dia("2027-02-20"), dia("2027-03-10"), cat);
    expect(rango.map((c) => [c.desde, c.hasta, c.valor])).toEqual([[dia("2027-02-26"), dia("2027-02-28"), "4611.83"], [dia("2027-03-01"), dia("2027-03-01"), "4613.29"]]);
  });

  it("la TRM por adelantado no es la de hoy; después de su vigencia, la frescura la marca ATRASADA y sin cubrir hoy", async () => {
    const s = nuevaSerie();
    const cat = [ficticia(s)];
    await sembrar(s, [fila("2027-04-02", "2027-04-02", "4613.71"), fila("2027-04-03", "2027-04-05", "4617.13")]);
    expect(await ultimoValor(db, s, dia("2027-04-01"), cat)).toBeNull();
    expect((await ultimoValor(db, s, dia("2027-04-02"), cat))?.valor).toBe("4613.71");
    expect((await ultimoValor(db, s, dia("2027-04-03"), cat))?.valor).toBe("4617.13");
    expect((await valorVigenteEn(db, s, dia("2027-04-04"), cat))?.valor).toBe("4617.13");
    expect(await valorVigenteEn(db, s, dia("2027-04-06"), cat)).toBeNull();

    const hoy = dia("2027-04-09");
    const viejo = await ultimoValor(db, s, hoy, cat);
    expect(viejo?.hasta).toEqual(dia("2027-04-05"));
    expect(frescura(s, viejo, hoy, cat)).toEqual({ estado: "ATRASADA", dias: 4, umbralDias: 3, cubreHoy: false });
    expect(frescura(s, await ultimoValor(db, s, dia("2027-04-04"), cat), dia("2027-04-04"), cat)).toEqual({ estado: "AL_DIA", dias: 0, umbralDias: 3, cubreHoy: true });
  });

  it("serieEnRango: la vigencia que empieza 31 días antes entra entera; en orden; un rango sin vigentes da vacío", async () => {
    const s = nuevaSerie();
    const cat = [ficticia(s)];
    await sembrar(s, [fila("2027-01-01", "2027-02-01", "137.41"), fila("2027-02-02", "2027-02-02", "137.43"), fila("2027-02-03", "2027-02-03", "137.47")]);
    const r = await serieEnRango(db, s, dia("2027-02-01"), dia("2027-02-02"), cat);
    expect(r.map((c) => [c.desde, c.hasta, c.valor])).toEqual([[dia("2027-01-01"), dia("2027-02-01"), "137.41"], [dia("2027-02-02"), dia("2027-02-02"), "137.43"]]);
    expect((await serieEnRango(db, s, dia("2027-02-02"), dia("2027-02-02"), cat)).map((c) => c.valor)).toEqual(["137.43"]);
    expect(await serieEnRango(db, s, dia("2027-02-04"), dia("2027-02-10"), cat)).toEqual([]);
    expect((await serieEnRango(db, s, dia("2026-12-01"), dia("2027-03-31"), cat)).map((c) => c.valor)).toEqual(["137.41", "137.43", "137.47"]);
  });

  it("el valor sale canónico de DECIMAL(20,8) y se lee dentro de una transacción de solo lectura", async () => {
    const s = nuevaSerie();
    const cat = [ficticia(s)];
    await sembrar(s, [fila("2027-05-03", "2027-05-03", "7.31"), fila("2027-05-04", "2027-05-04", "4619"), fila("2027-05-05", "2027-05-05", "0.00000371")]);
    const leidos = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      return serieEnRango(tx, s, dia("2027-05-03"), dia("2027-05-05"), cat);
    });
    expect(leidos.map((c) => c.valor)).toEqual(["7.31", "4619", "0.00000371"]);
  });
});

describe("lectura de series contra la base · la variación del IPC es CALCULADA", () => {
  it("con dos índices leídos (enero de 1913 y de 1914): 2 decimales, calculada por Inversiones", async () => {
    const ipc = serieDelCatalogo("IPC_INDICE")!;
    await sembrar(ipc.codigo, [fila("1913-01-01", "1913-01-31", "13.71"), fila("1914-01-01", "1914-01-31", "14.37")], ipc.fuente);
    const final = await ultimoValor(db, ipc.codigo, dia("1914-03-02"));
    const base = await valorVigenteEn(db, ipc.codigo, dia("1913-01-01"));
    expect(final?.desde).toEqual(dia("1914-01-01"));
    expect(base?.valor).toBe("13.71");
    const v = variacionIndice(base!, final!);
    expect(v).toMatchObject({ serie: "IPC_INDICE", valor: "4.81", origen: "CALCULADA", desde: dia("1913-01-01"), hasta: dia("1914-01-31"), fuente: ipc.fuente });
    expect(v.unidad).toMatch(/calculada por Inversiones/);
  });
});
