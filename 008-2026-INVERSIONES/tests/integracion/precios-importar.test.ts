// `importarPrecios` (el CSV de cierres de la vía B) contra la base de PRUEBAS: mismo resultado que
// `actualizarPrecios` con Yahoo falso para los mismos cierres; idempotente; re-verifica contra una certificación
// cargada después (#1007); retira el vigente de un día sin negociación (#1005); y no escribe nada de una especie
// sin acción activa con lotes. Especies FICT, precios y fechas inventados.
import { randomBytes } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { actualizarPrecios } from "@/precios/actualizar";
import { leerCsvCierres, type ResultadoLectura } from "@/precios/csv-cierres";
import { importarPrecios } from "@/precios/importar";
import type { Buscar } from "@/precios/yahoo";

const db = new PrismaClient();
const corrida = Date.now().toString(36).toUpperCase().slice(-5);
const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);
/** Barra de Yahoo a las 09:30 de Colombia del día dado. */
const ts = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)), 14, 30) / 1000;
const AHORA = new Date("2024-06-20T23:00:00Z");
let usuarioId = "";
let cargaId = "";
let n = 0;

/** Una acción ficticia con un lote de compra (lo que exige `precios:importar`, como `precios:actualizar` por defecto). */
async function accionConLote(nemotecnico: string): Promise<string> {
  const instrumentoId = (await db.instrumento.create({ data: { tipo: "ACCION", nemotecnico, nombre: "Ficticia" } })).id;
  n += 1;
  const fila = await db.filaFuente.create({ data: { tipoFuente: "TRII_ORDENES", claveNatural: `precios-importar-${corrida}-${n}`, ocurrencia: 1, primeraCargaId: cargaId, primeraFilaNo: n, crudo: { ficticio: true } } });
  const dia = utc("2024-01-15");
  const cero = new Prisma.Decimal(0);
  const orden = await db.orden.create({
    data: {
      filaFuenteId: fila.id, ejecutadaEn: dia, fechaOperacion: dia, fechaLiquidacion: utc("2024-01-17"), instrumentoId, lado: "COMPRA", estado: "APROBADO",
      cantidadCompletada: 10n, precioUnitario: new Prisma.Decimal(100), totalInvertido: new Prisma.Decimal(1000), comision: cero, totalEstimado: new Prisma.Decimal(1000),
    },
  });
  await db.lote.create({
    data: { instrumentoId, origen: "COMPRA", ordenId: orden.id, fuenteCosto: "TRII_ORDEN", fechaCompra: dia, fechaLiquidacion: utc("2024-01-17"), cantidad: 10n, costoUnitario: new Prisma.Decimal(100), costoTotal: new Prisma.Decimal(1000) },
  });
  return instrumentoId;
}

const csv = (filas: readonly string[]): ResultadoLectura & { ok: true } => {
  const r = leerCsvCierres(new TextEncoder().encode(`nemotecnico,fecha,cierre,volumen\n${filas.join("\n")}\n`));
  if (!r.ok) throw new Error(JSON.stringify(r));
  return r;
};
const vigentes = async (instrumentoId: string) =>
  (await db.precioCierre.findMany({ where: { instrumentoId, reemplazadoEn: null }, orderBy: { fecha: "asc" } })).map((p) => [
    p.fecha.toISOString().slice(0, 10), p.precio.toString(), p.fuente, p.estado, p.fuenteReferencia, p.precioReferencia?.toString() ?? null, p.desviacionPct?.toString() ?? null,
  ]);
async function certificar(instrumentoId: string, fechaCorte: Date, precioValoracion: string): Promise<void> {
  const carga = await db.cargaArchivo.create({ data: { tipoFuente: "AV_CERTIFICACION", nombreArchivo: `cert-${corrida}-${n}.ficticio.pdf`, sha256: randomBytes(32).toString("hex"), estado: "CARGADO", cargadoPorId: usuarioId } });
  n += 1;
  const cert = await db.certificacion.upsert({ where: { fechaCorte }, update: {}, create: { cargaId: carga.id, fechaCorte, saldoEfectivo: new Prisma.Decimal(0) } });
  await db.certificacionPosicion.create({ data: { certificacionId: cert.id, instrumentoId, cantidad: 10n, precioValoracion: new Prisma.Decimal(precioValoracion), valorMercado: new Prisma.Decimal(precioValoracion).mul(10) } });
}

// Días ficticios de junio de 2024 (calendario sembrado): lunes 17, martes 18 y miércoles 19.
const BARRAS = [{ dia: "2024-06-17", close: 2001.5, volume: 30 }, { dia: "2024-06-18", close: 2002, volume: null }, { dia: "2024-06-19", close: 2003.25, volume: 12 }] as const;
const yahoo: Buscar = async () => new Response(JSON.stringify({
  chart: { result: [{ meta: { currency: "COP" }, timestamp: BARRAS.map((b) => ts(b.dia)), indicators: { quote: [{ close: BARRAS.map((b) => b.close), volume: BARRAS.map((b) => b.volume) }] } }] },
}));
const filasCsv = (nemo: string) => BARRAS.map((b) => `${nemo},${b.dia},${b.close},${b.volume ?? ""}`);

let porYahoo = "";
let porCsv = "";
const nemoCsv = `PIC${corrida}B`;

beforeAll(async () => {
  const base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a correr sobre «${base}»`);
  usuarioId = (await db.usuario.create({ data: { email: `dueno-pic-${corrida.toLowerCase()}@ejemplo.invalid`, rol: "DUENO" } })).id;
  cargaId = (await db.cargaArchivo.create({ data: { tipoFuente: "TRII_ORDENES", nombreArchivo: "ordenes.ficticio.csv", sha256: randomBytes(32).toString("hex"), estado: "CARGADO", cargadoPorId: usuarioId } })).id;
  porYahoo = await accionConLote(`PIC${corrida}A`);
  porCsv = await accionConLote(nemoCsv);
  // La certificación del martes, para las dos especies: 2002 contra 2010 es 0,398 %, dentro del 1 %.
  await certificar(porYahoo, utc("2024-06-18"), "2010");
  await certificar(porCsv, utc("2024-06-18"), "2010");
});

afterAll(async () => {
  await db.$disconnect();
});

describe("importarPrecios contra la base", () => {
  it("deja los mismos vigentes y los mismos conteos que actualizarPrecios con los mismos cierres", async () => {
    const rYahoo = await actualizarPrecios(db, { desde: utc("2024-06-17"), hasta: utc("2024-06-19"), ahora: AHORA, buscar: yahoo, instrumentoIds: [porYahoo] });
    const rCsv = await importarPrecios(db, csv(filasCsv(nemoCsv)), { ahora: AHORA });
    expect(rCsv.sinEspecie).toEqual([]);
    const { verificados: vYahoo, ...restoYahoo } = rYahoo;
    const { verificados: vCsv, ...restoCsv } = rCsv.guardado;
    expect(restoCsv).toEqual({ ...restoYahoo });
    expect(restoCsv).toMatchObject({ especies: 1, cierresNuevos: 3, fallidas: [] });
    expect(vCsv).toBeGreaterThanOrEqual(vYahoo + 1); // cuenta los VERIFICADOS del rango, de todas las especies
    expect(await vigentes(porCsv)).toEqual(await vigentes(porYahoo));
    expect((await vigentes(porCsv)).map((v) => v[3])).toEqual(["NO_VERIFICADO", "VERIFICADO", "NO_VERIFICADO"]);
  });

  it("reimportar el mismo CSV no escribe nada", async () => {
    const r = await importarPrecios(db, csv(filasCsv(nemoCsv)), { ahora: AHORA });
    expect(r.guardado).toMatchObject({ cierresNuevos: 0, cierresRevisados: 0, cierresReverificados: 0, cierresRetirados: 0, fallidas: [] });
  });

  it("con la certificación de otro día cargada después, el mismo CSV re-verifica ese cierre (versión nueva, nuevos 0)", async () => {
    await certificar(porCsv, utc("2024-06-19"), "2003");
    const r = await importarPrecios(db, csv(filasCsv(nemoCsv)), { ahora: AHORA });
    expect(r.guardado).toMatchObject({ cierresNuevos: 0, cierresRevisados: 0, cierresReverificados: 1 });
    expect((await vigentes(porCsv)).at(-1)?.slice(0, 5)).toEqual(["2024-06-19", "2003.25", "yahoo", "VERIFICADO", "certificacion:2024-06-19"]);
  });

  it("un día hábil con volumen 0 retira el vigente de ese día (queda como historia)", async () => {
    const r = await importarPrecios(db, csv([`${nemoCsv},2024-06-17,2001.5,0`]), { ahora: AHORA });
    expect(r.guardado).toMatchObject({ cierresRetirados: 1, omitidasSinNegociacion: 1 });
    expect((await vigentes(porCsv)).map((v) => v[0])).toEqual(["2024-06-18", "2024-06-19"]);
    expect(await db.precioCierre.count({ where: { instrumentoId: porCsv, fecha: utc("2024-06-17"), reemplazadoEn: { not: null } } })).toBe(1);
  });

  it("un nemotécnico sin acción con lotes no escribe nada y se informa por su primera línea", async () => {
    const sinLote = (await db.instrumento.create({ data: { tipo: "ACCION", nemotecnico: `PIC${corrida}S`, nombre: "Ficticia sin lote" } })).id;
    const r = await importarPrecios(db, csv([`PIC${corrida}Z,2024-06-17,10,1`, `PIC${corrida}S,2024-06-17,10,1`]), { ahora: AHORA });
    expect(r.sinEspecie).toEqual([{ linea: 2, codigo: "ESPECIE_NO_REGISTRADA" }, { linea: 3, codigo: "ESPECIE_NO_REGISTRADA" }]);
    expect(r.guardado.especies).toBe(0);
    expect(await db.precioCierre.count({ where: { instrumentoId: sinLote } })).toBe(0);
  });
});
