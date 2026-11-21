// Integración de INV-SPEC-13 contra la base de PRUEBAS, con un Yahoo falso. Datos inventados.
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { actualizarPrecios } from "@/precios/actualizar";
import { PRECIO_MAXIMO_COP, type Buscar } from "@/precios/yahoo";

const db = new PrismaClient();
const corrida = Date.now().toString(36).toUpperCase().slice(-5);
let instrumentoId = "";
let duenoId = "";
const desde = new Date("2024-03-12T00:00:00Z");
const hasta = new Date("2024-03-13T00:00:00Z");
const T = [Date.UTC(2024, 2, 12, 14, 30) / 1000, Date.UTC(2024, 2, 13, 14, 30) / 1000];
const vigentes = () => db.precioCierre.findMany({ where: { instrumentoId, reemplazadoEn: null }, orderBy: { fecha: "asc" } });
/** Respuesta de /v8/finance/chart como la entrega `fetch`: un `Response` real con el JSON. */
const respuestaChart = (timestamp: number[], close: number[]) =>
  new Response(JSON.stringify({ chart: { result: [{ meta: { currency: "COP" }, timestamp, indicators: { quote: [{ close }] } }] } }));
const yahoo = (closes: number[]): Buscar => async () => respuestaChart(T, closes);
const preciosDe = async (id: string) => (await db.precioCierre.findMany({ where: { instrumentoId: id, reemplazadoEn: null }, orderBy: { fecha: "asc" } })).map((p) => p.precio.toString());

beforeAll(async () => {
  const base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a correr sobre «${base}»`);
  instrumentoId = (await db.instrumento.create({ data: { tipo: "ACCION", nemotecnico: `PRC${corrida}`, nombre: "Ficticia" } })).id;
  duenoId = (await db.usuario.create({ data: { email: `dueno-prc-${corrida}@ejemplo.invalid`, rol: "DUENO" } })).id;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("actualizarPrecios", () => {
  it("guarda los cierres nuevos; sin certificación del día quedan NO_VERIFICADO", async () => {
    const r = await actualizarPrecios(db, { desde, hasta, buscar: yahoo([100, 101]), instrumentoIds: [instrumentoId] });
    expect(r).toMatchObject({ especies: 1, cierresNuevos: 2, cierresRevisados: 0, fallidas: [] });
    expect((await vigentes()).map((p) => [p.precio.toString(), p.estado])).toEqual([["100", "NO_VERIFICADO"], ["101", "NO_VERIFICADO"]]);
  });

  it("repetir con los mismos cierres no cambia nada", async () => {
    const r = await actualizarPrecios(db, { desde, hasta, buscar: yahoo([100, 101]), instrumentoIds: [instrumentoId] });
    expect(r).toMatchObject({ cierresNuevos: 0, cierresRevisados: 0 });
  });

  it("un cierre revisado por Yahoo reemplaza al vigente y el viejo queda como historia", async () => {
    const r = await actualizarPrecios(db, { desde, hasta, buscar: yahoo([100, 102]), instrumentoIds: [instrumentoId] });
    expect(r.cierresRevisados).toBe(1);
    expect((await vigentes()).map((p) => p.precio.toString())).toEqual(["100", "102"]);
    expect(await db.precioCierre.count({ where: { instrumentoId, reemplazadoEn: { not: null } } })).toBe(1);
  });

  it("con certificación del mismo día, ±1 % queda VERIFICADO y más allá NO_VERIFICADO", async () => {
    const carga = await db.cargaArchivo.create({ data: { tipoFuente: "AV_CERTIFICACION", nombreArchivo: "cert.ficticio.pdf", sha256: "c".repeat(64), estado: "CARGADO", cargadoPorId: duenoId } });
    const cert = await db.certificacion.create({ data: { cargaId: carga.id, fechaCorte: hasta, saldoEfectivo: new Prisma.Decimal(0) } });
    await db.certificacionPosicion.create({ data: { certificacionId: cert.id, instrumentoId, cantidad: 10n, precioValoracion: new Prisma.Decimal(103), valorMercado: new Prisma.Decimal(1030) } });
    await actualizarPrecios(db, { desde, hasta, buscar: yahoo([100, 103.5]), instrumentoIds: [instrumentoId] });
    const dia2 = (await vigentes())[1]!;
    expect([dia2.estado, dia2.fuenteReferencia]).toEqual(["VERIFICADO", "certificacion:2024-03-13"]);
    await actualizarPrecios(db, { desde, hasta, buscar: yahoo([100, 110]), instrumentoIds: [instrumentoId] });
    expect((await vigentes())[1]!.estado).toBe("NO_VERIFICADO");
  });

  it("si Yahoo falla, no escribe nada y lo informa", async () => {
    const antes = await db.precioCierre.count({ where: { instrumentoId } });
    const r = await actualizarPrecios(db, { desde, hasta, buscar: async () => new Response("{}", { status: 503 }), instrumentoIds: [instrumentoId] });
    expect(r.fallidas).toEqual([{ instrumentoId, codigo: "YAHOO_HTTP_503", barrasGuardadas: 0, barrasFallidas: 0 }]);
    expect(await db.precioCierre.count({ where: { instrumentoId } })).toBe(antes);
  });

  it("una barra que falla al guardar no aborta ni las demás barras ni las demás especies; se reporta con conteos y sin mensaje", async () => {
    const otro = (await db.instrumento.create({ data: { tipo: "ACCION", nemotecnico: `PRD${corrida}`, nombre: "Ficticia B" } })).id;
    // Certificación del 2-abr con valoración 1: el cierre de 100000 da una desviación que desborda Decimal(9,6).
    const carga = await db.cargaArchivo.create({ data: { tipoFuente: "AV_CERTIFICACION", nombreArchivo: "cert2.ficticio.pdf", sha256: "d".repeat(64), estado: "CARGADO", cargadoPorId: duenoId } });
    const cert = await db.certificacion.create({ data: { cargaId: carga.id, fechaCorte: new Date("2024-04-02T00:00:00Z"), saldoEfectivo: new Prisma.Decimal(0) } });
    await db.certificacionPosicion.create({ data: { certificacionId: cert.id, instrumentoId, cantidad: 10n, precioValoracion: new Prisma.Decimal(1), valorMercado: new Prisma.Decimal(10) } });
    const ts = [Date.UTC(2024, 3, 2, 14, 30) / 1000, Date.UTC(2024, 3, 3, 14, 30) / 1000];
    const buscar: Buscar = async (url) => {
      const cierres = url.includes(`PRC${corrida}`) ? [100000, 150] : [200, 201];
      return respuestaChart(ts, cierres);
    };
    const r = await actualizarPrecios(db, { desde: new Date("2024-04-02T00:00:00Z"), hasta: new Date("2024-04-03T00:00:00Z"), buscar, instrumentoIds: [instrumentoId, otro], ahora: new Date("2024-04-10T20:00:00Z") });
    expect(r.fallidas).toEqual([{ instrumentoId, codigo: "GUARDADO_ERROR", detalle: expect.stringMatching(/^PrismaClient/), barrasGuardadas: 1, barrasFallidas: 1 }]);
    expect(r.cierresNuevos).toBe(3);
    const guardados = async (id: string) => (await db.precioCierre.findMany({ where: { instrumentoId: id, reemplazadoEn: null }, orderBy: { fecha: "asc" } })).map((p) => p.precio.toString());
    expect((await guardados(instrumentoId)).slice(-1)).toEqual(["150"]);
    expect(await guardados(otro)).toEqual(["200", "201"]);
  });

  it("un festivo de hoy en calendario_bvc: pasada la hora tampoco se guarda la barra de hoy", async () => {
    const solo = (await db.instrumento.create({ data: { tipo: "ACCION", nemotecnico: `PRF${corrida}`, nombre: "Ficticia D" } })).id;
    const hoy = new Date("2024-06-05T00:00:00Z"); // miércoles inventado como no hábil
    await db.calendarioBvc.create({ data: { dia: hoy, esHabil: false, nota: "festivo ficticio de prueba" } });
    try {
      const ts = [Date.UTC(2024, 5, 4, 14, 30) / 1000, Date.UTC(2024, 5, 5, 14, 30) / 1000];
      const buscar: Buscar = async () => respuestaChart(ts, [400, 401]);
      const r = await actualizarPrecios(db, { desde: new Date("2024-06-04T00:00:00Z"), hasta: hoy, buscar, instrumentoIds: [solo], ahora: new Date("2024-06-05T23:00:00Z") }); // 18:00 COT
      expect(r.omitidasPorHorario).toBe(1);
      expect((await db.precioCierre.findMany({ where: { instrumentoId: solo, reemplazadoEn: null } })).map((p) => p.precio.toString())).toEqual(["400"]);
    } finally {
      await db.calendarioBvc.delete({ where: { dia: hoy } });
    }
  });

  it("no guarda la barra de hoy antes de la hora definitiva, y sí después", async () => {
    const solo = (await db.instrumento.create({ data: { tipo: "ACCION", nemotecnico: `PRE${corrida}`, nombre: "Ficticia C" } })).id;
    const d1 = new Date("2024-05-07T00:00:00Z");
    const d2 = new Date("2024-05-08T00:00:00Z");
    const ts = [Date.UTC(2024, 4, 7, 14, 30) / 1000, Date.UTC(2024, 4, 8, 14, 30) / 1000];
    const buscar: Buscar = async () => respuestaChart(ts, [300, 301]);
    const guardadas = async () => (await db.precioCierre.findMany({ where: { instrumentoId: solo, reemplazadoEn: null }, orderBy: { fecha: "asc" } })).map((p) => p.precio.toString());
    // 8-may-2024 10:00 COT (15:00 UTC): la barra del 8 es parcial.
    const antes = await actualizarPrecios(db, { desde: d1, hasta: d2, buscar, instrumentoIds: [solo], ahora: new Date("2024-05-08T15:00:00Z") });
    expect(antes.omitidasPorHorario).toBe(1);
    expect(await guardadas()).toEqual(["300"]);
    // 8-may-2024 17:30 COT (22:30 UTC): ya pasó la hora definitiva.
    const despues = await actualizarPrecios(db, { desde: d1, hasta: d2, buscar, instrumentoIds: [solo], ahora: new Date("2024-05-08T22:30:00Z") });
    expect(despues.omitidasPorHorario).toBe(0);
    expect(await guardadas()).toEqual(["300", "301"]);
  });
});

describe("actualizarPrecios · símbolo de Yahoo (SimboloPrecio vigente a la fecha «hasta»)", () => {
  const dHasta = new Date("2024-03-13T00:00:00Z");
  const dSiguiente = new Date("2024-03-14T00:00:00Z");
  const dEnero = new Date("2024-01-01T00:00:00Z");
  const NEMO = "<NEMO>.CL";
  type Equivalencia = { proveedor: string; simbolo: string; vigenteDesde: Date; vigenteHasta: Date | null } | null;
  const yahooFicticio = (vigenteDesde: Date, vigenteHasta: Date | null): Equivalencia => ({ proveedor: "yahoo", simbolo: "FICT1.CL", vigenteDesde, vigenteHasta });
  const casos: [string, Equivalencia, string][] = [
    ["sin equivalencia registrada, cae a <NEMO>.CL", null, NEMO],
    ["equivalencia vigente sin fecha de fin", yahooFicticio(dEnero, null), "FICT1.CL"],
    ["vence el día después de «hasta»: sigue vigente", yahooFicticio(dEnero, dSiguiente), "FICT1.CL"],
    ["vence justo en «hasta»: ya no vale (vigenteHasta es exclusivo)", yahooFicticio(dEnero, dHasta), NEMO],
    ["empieza justo en «hasta»: ya vale", yahooFicticio(dHasta, null), "FICT1.CL"],
    ["empieza después de «hasta»: todavía no vale", yahooFicticio(dSiguiente, null), NEMO],
    ["es de otro proveedor (la clase del fondo): no cuenta", { proveedor: "sfc:qhpu-8ixx", simbolo: "901", vigenteDesde: dEnero, vigenteHasta: null }, NEMO],
  ];

  it.each(casos.map((c, i) => [...c, i] as const))("%s", async (_nombre, equivalencia, esperado, i) => {
    const nemotecnico = `PRS${corrida}${i}`;
    const id = (await db.instrumento.create({ data: { tipo: "ACCION", nemotecnico, nombre: "Ficticia S" } })).id;
    if (equivalencia) await db.simboloPrecio.create({ data: { instrumentoId: id, ...equivalencia } });
    const pedidas: string[] = [];
    const buscar: Buscar = async (url) => {
      pedidas.push(url);
      return new Response("{}", { status: 503 });
    };
    await actualizarPrecios(db, { desde: new Date("2024-03-12T00:00:00Z"), hasta: dHasta, buscar, instrumentoIds: [id] });
    const simbolo = esperado === NEMO ? `${nemotecnico}.CL` : esperado;
    expect(pedidas.map((u) => new URL(u).pathname)).toEqual([`/v8/finance/chart/${simbolo}`]);
  });
});

describe("actualizarPrecios · barra corrupta", () => {
  it("una barra corrupta invalida toda la serie: no se pierde ni se revisa el cierre ya guardado", async () => {
    const id = (await db.instrumento.create({ data: { tipo: "ACCION", nemotecnico: `PRX${corrida}`, nombre: "Ficticia X" } })).id;
    const ts = [Date.UTC(2024, 6, 2, 14, 30) / 1000, Date.UTC(2024, 6, 3, 14, 30) / 1000];
    const opciones = (cierres: number[]) => ({ desde: new Date("2024-07-02T00:00:00Z"), hasta: new Date("2024-07-03T00:00:00Z"), buscar: (async () => respuestaChart(ts, cierres)) as Buscar, instrumentoIds: [id] });
    expect(await actualizarPrecios(db, opciones([700, 701]))).toMatchObject({ cierresNuevos: 2, fallidas: [] });
    // El 710 del primer día es válido: si la serie no se invalidara entera, se guardaría como revisión.
    const r = await actualizarPrecios(db, opciones([710, PRECIO_MAXIMO_COP + 1]));
    expect(r).toMatchObject({ cierresNuevos: 0, cierresRevisados: 0 });
    expect(r.fallidas).toEqual([{ instrumentoId: id, codigo: "YAHOO_FORMATO", barrasGuardadas: 0, barrasFallidas: 0 }]);
    expect(await preciosDe(id)).toEqual(["700", "701"]);
    expect(await db.precioCierre.count({ where: { instrumentoId: id } })).toBe(2);
  });
});
