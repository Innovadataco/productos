// Integración de INV-SPEC-13 contra la base de PRUEBAS, con un Yahoo falso. Datos inventados.
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { actualizarPrecios } from "@/precios/actualizar";
import type { Buscar } from "@/precios/yahoo";

const db = new PrismaClient();
const corrida = Date.now().toString(36).toUpperCase().slice(-5);
let instrumentoId = "";
let duenoId = "";
const desde = new Date("2024-03-12T00:00:00Z");
const hasta = new Date("2024-03-13T00:00:00Z");
const T = [Date.UTC(2024, 2, 12, 14, 30) / 1000, Date.UTC(2024, 2, 13, 14, 30) / 1000];
const yahoo = (closes: number[]): Buscar => async () => ({
  ok: true, status: 200, json: async () => ({ chart: { result: [{ meta: { currency: "COP" }, timestamp: T, indicators: { quote: [{ close: closes }] } }] } }),
});
const vigentes = () => db.precioCierre.findMany({ where: { instrumentoId, reemplazadoEn: null }, orderBy: { fecha: "asc" } });

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
    const r = await actualizarPrecios(db, { desde, hasta, buscar: async () => ({ ok: false, status: 503, json: async () => ({}) }), instrumentoIds: [instrumentoId] });
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
      return { ok: true, status: 200, json: async () => ({ chart: { result: [{ meta: { currency: "COP" }, timestamp: ts, indicators: { quote: [{ close: cierres }] } }] } }) };
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
      const buscar: Buscar = async () => ({ ok: true, status: 200, json: async () => ({ chart: { result: [{ meta: { currency: "COP" }, timestamp: ts, indicators: { quote: [{ close: [400, 401] }] } }] } }) });
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
    const buscar: Buscar = async () => ({ ok: true, status: 200, json: async () => ({ chart: { result: [{ meta: { currency: "COP" }, timestamp: ts, indicators: { quote: [{ close: [300, 301] }] } }] } }) });
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
