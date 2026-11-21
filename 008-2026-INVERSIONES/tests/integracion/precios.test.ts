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
    const ts = [Date.UTC(2024, 3, 2, 14, 30) / 1000, Date.UTC(2024, 3, 3, 14, 30) / 1000];
    const buscar: Buscar = async (url) => {
      const cierres = url.includes(`PRC${corrida}`) ? [100000, 150] : [200, 201];
      return respuestaChart(ts, cierres);
    };
    // Falla la inserción del 2-abr de la primera especie (y solo esa barra).
    const dosAbril = new Date("2024-04-02T00:00:00Z").getTime();
    const cliente = conInsercionFallida(db, (d) => d.instrumentoId === instrumentoId && d.fecha.getTime() === dosAbril);
    const r = await actualizarPrecios(cliente, { desde: new Date("2024-04-02T00:00:00Z"), hasta: new Date("2024-04-03T00:00:00Z"), buscar, instrumentoIds: [instrumentoId, otro], ahora: new Date("2024-04-10T20:00:00Z") });
    expect(r.fallidas).toEqual([{ instrumentoId, codigo: "GUARDADO_ERROR", detalle: "ErrorFicticioDeInsercion", barrasGuardadas: 1, barrasFallidas: 1 }]);
    expect(JSON.stringify(r)).not.toContain("424242");
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

/**
 * Barrera por clave: las primeras `n` llegadas con la misma clave esperan a la última. Si no llegan
 * todas en `ms`, rechaza (la prueba falla en vez de colgarse).
 */
function barreraPorClave(n: number, ms = 5_000): (clave: string) => Promise<void> {
  const esperas = new Map<string, { llegadas: number; abrir: () => void; abierta: Promise<void> }>();
  return (clave) => {
    if (!esperas.has(clave)) {
      let abrir: () => void = () => undefined;
      const abierta = new Promise<void>((resolver) => {
        abrir = resolver;
      });
      esperas.set(clave, { llegadas: 0, abrir, abierta });
    }
    const espera = esperas.get(clave)!;
    espera.llegadas += 1;
    if (espera.llegadas === n) espera.abrir();
    let reloj: ReturnType<typeof setTimeout> | undefined;
    const vencida = new Promise<never>((_resolver, rechazar) => {
      reloj = setTimeout(() => rechazar(new Error("barrera incompleta")), ms);
    });
    return Promise.race([espera.abierta, vencida]).finally(() => clearTimeout(reloj));
  };
}

type Delegado = PrismaClient["precioCierre"];
type ArgsLectura = Parameters<Delegado["findFirst"]>[0];

/**
 * Cliente de prueba que fuerza la carrera: tras la PRIMERA lectura del cierre vigente de cada día (dentro o
 * fuera de una transacción), la corrida espera en la barrera. Así las dos corridas leen el mismo estado antes
 * de que alguna escriba, en cada barra y siempre. Cuenta todas las lecturas (las de los reintentos también).
 */
function conBarreraTrasLeer(base: PrismaClient, esperar: (clave: string) => Promise<void>): { db: PrismaClient; lecturas: () => number } {
  const vistas = new Set<string>();
  let lecturas = 0;
  const leerConBarrera = (delegado: Delegado) => async (args: ArgsLectura) => {
    const fila = await delegado.findFirst(args);
    lecturas += 1;
    const clave = String((args?.where as { fecha?: Date } | undefined)?.fecha?.toISOString());
    if (!vistas.has(clave)) {
      vistas.add(clave);
      await esperar(clave);
    }
    return fila;
  };
  const envolver = <T extends object>(cliente: T): T =>
    new Proxy(cliente, {
      get(objetivo, prop) {
        if (prop === "precioCierre") {
          const delegado = Reflect.get(objetivo, prop) as Delegado;
          return new Proxy(delegado, { get: (d, p) => (p === "findFirst" ? leerConBarrera(d) : Reflect.get(d, p)) });
        }
        if (prop === "$transaction") {
          return (fn: (tx: Prisma.TransactionClient) => Promise<unknown>, opciones?: Parameters<PrismaClient["$transaction"]>[1]) =>
            (objetivo as unknown as PrismaClient).$transaction((tx) => fn(envolver(tx)), opciones);
        }
        return Reflect.get(objetivo, prop);
      },
    });
  return { db: envolver(base), lecturas: () => lecturas };
}

describe("actualizarPrecios · corridas simultáneas", () => {
  it("dos corridas que leen a la vez dejan un solo cierre vigente por día, sin errores, al guardar y al revisar (el reintento corre siempre)", async () => {
    const id = (await db.instrumento.create({ data: { tipo: "ACCION", nemotecnico: `PRG${corrida}`, nombre: "Ficticia G" } })).id;
    // Martes 13 y miércoles 14 de agosto de 2024, hábiles (el 7 es festivo sembrado: Batalla de Boyacá).
    const ts = [Date.UTC(2024, 7, 13, 14, 30) / 1000, Date.UTC(2024, 7, 14, 14, 30) / 1000];
    const ronda = async (cierres: number[]) => {
      const esperar = barreraPorClave(2);
      const [a, b] = [conBarreraTrasLeer(db, esperar), conBarreraTrasLeer(db, esperar)];
      const opciones = { desde: new Date("2024-08-13T00:00:00Z"), hasta: new Date("2024-08-14T00:00:00Z"), buscar: (async () => respuestaChart(ts, cierres)) as Buscar, instrumentoIds: [id] };
      const resultados = await Promise.all([actualizarPrecios(a.db, opciones), actualizarPrecios(b.db, opciones)]);
      return { resultados, lecturas: a.lecturas() + b.lecturas() };
    };
    // 2 barras × 2 corridas = 4 lecturas, más 1 relectura por barra de la corrida que pierde la carrera.
    const nuevas = await ronda([500, 501]);
    expect(nuevas.resultados.flatMap((r) => r.fallidas)).toEqual([]);
    expect(nuevas.resultados[0]!.cierresNuevos + nuevas.resultados[1]!.cierresNuevos).toBe(2);
    expect(nuevas.lecturas).toBe(6);
    const revisadas = await ronda([600, 601]);
    expect(revisadas.resultados.flatMap((r) => r.fallidas)).toEqual([]);
    expect(revisadas.resultados[0]!.cierresRevisados + revisadas.resultados[1]!.cierresRevisados).toBe(2);
    expect(revisadas.lecturas).toBe(6);
    expect(await preciosDe(id)).toEqual(["600", "601"]);
    expect(await db.precioCierre.count({ where: { instrumentoId: id } })).toBe(4);
    expect(await db.precioCierre.count({ where: { instrumentoId: id, reemplazadoEn: { not: null } } })).toBe(2);
  });
});

/**
 * Re-verificación de un cierre igual al vigente: la certificación de A&V de ese día llega (o cambia)
 * después de guardar el cierre. La verificación se recalcula y, si difiere, se versiona como una revisión:
 * el anterior queda con `reemplazadoEn` (historia) y se inserta el mismo precio con la verificación de hoy.
 * Días hábiles inventados de septiembre de 2024 (sin festivos en calendario_bvc), uno por caso, porque
 * `certificacion.fechaCorte` es única.
 */
describe("actualizarPrecios · re-verificación de un cierre igual", () => {
  const AHORA = new Date("2024-09-30T20:00:00Z");
  const especie = async (sufijo: string) => (await db.instrumento.create({ data: { tipo: "ACCION", nemotecnico: `PRV${sufijo}${corrida}`, nombre: "Ficticia V" } })).id;
  const certificar = async (id: string, fechaCorte: Date, precioValoracion: string, sha: string) => {
    const carga = await db.cargaArchivo.create({ data: { tipoFuente: "AV_CERTIFICACION", nombreArchivo: `cert-${sha}.ficticio.pdf`, sha256: sha.repeat(64), estado: "CARGADO", cargadoPorId: duenoId } });
    const cert = await db.certificacion.create({ data: { cargaId: carga.id, fechaCorte, saldoEfectivo: new Prisma.Decimal(0) } });
    await db.certificacionPosicion.create({ data: { certificacionId: cert.id, instrumentoId: id, cantidad: 10n, precioValoracion: new Prisma.Decimal(precioValoracion), valorMercado: new Prisma.Decimal(0) } });
    return cert.id;
  };
  const correr = (id: string, dia: Date, cierre: number, cliente: PrismaClient = db) =>
    actualizarPrecios(cliente, { desde: dia, hasta: dia, buscar: (async () => respuestaChart([dia.getTime() / 1000 + 14.5 * 3600], [cierre])) as Buscar, instrumentoIds: [id], ahora: AHORA });
  const verificacion = (p: { precio: Prisma.Decimal; estado: string; fuenteReferencia: string | null; precioReferencia: Prisma.Decimal | null; desviacionPct: Prisma.Decimal | null }) =>
    [p.precio.toString(), p.estado, p.fuenteReferencia, p.precioReferencia?.toString() ?? null, p.desviacionPct?.toString() ?? null];
  const vigentesDe = async (id: string) => (await db.precioCierre.findMany({ where: { instrumentoId: id, reemplazadoEn: null } })).map(verificacion);
  const historiaDe = async (id: string) => (await db.precioCierre.findMany({ where: { instrumentoId: id, reemplazadoEn: { not: null } } })).map(verificacion);

  it("NO_VERIFICADO sin certificación; llega la certificación del día y el mismo cierre se versiona como VERIFICADO; repetir no cambia nada", async () => {
    const id = await especie("A");
    const dia = new Date("2024-09-10T00:00:00Z");
    expect(await correr(id, dia, 250)).toMatchObject({ cierresNuevos: 1, fallidas: [] });
    expect(await vigentesDe(id)).toEqual([["250", "NO_VERIFICADO", null, null, null]]);
    await certificar(id, dia, "251", "1"); // 1/251 = 0,398406 %
    const r = await correr(id, dia, 250);
    expect(await vigentesDe(id)).toEqual([["250", "VERIFICADO", "certificacion:2024-09-10", "251", "0.398406"]]);
    expect(await historiaDe(id)).toEqual([["250", "NO_VERIFICADO", null, null, null]]);
    const otraVez = await correr(id, dia, 250);
    expect(await db.precioCierre.count({ where: { instrumentoId: id } })).toBe(2);
    expect(r).toMatchObject({ cierresNuevos: 0, cierresRevisados: 0, cierresReverificados: 1, fallidas: [] });
    expect(otraVez).toMatchObject({ cierresNuevos: 0, cierresRevisados: 0, cierresReverificados: 0, fallidas: [] });
  });

  it("VERIFICADO que deja de cuadrar (la certificación del día cambió a más del 1 %): se versiona como NO_VERIFICADO con la referencia nueva", async () => {
    const id = await especie("B");
    const dia = new Date("2024-09-11T00:00:00Z");
    const certificacionId = await certificar(id, dia, "250", "2");
    expect(await correr(id, dia, 250)).toMatchObject({ cierresNuevos: 1, fallidas: [] });
    expect(await vigentesDe(id)).toEqual([["250", "VERIFICADO", "certificacion:2024-09-11", "250", "0"]]);
    // Simula una certificación corregida (en la app se revierte la carga y se importa otra); aquí solo se cambia el dato inventado.
    await db.certificacionPosicion.update({ where: { certificacionId_instrumentoId: { certificacionId, instrumentoId: id } }, data: { precioValoracion: new Prisma.Decimal("260") } });
    const r = await correr(id, dia, 250);
    expect(await vigentesDe(id)).toEqual([["250", "NO_VERIFICADO", "certificacion:2024-09-11", "260", "3.846154"]]); // 10/260
    expect(await historiaDe(id)).toEqual([["250", "VERIFICADO", "certificacion:2024-09-11", "250", "0"]]);
    expect(r).toMatchObject({ cierresNuevos: 0, cierresRevisados: 0, cierresReverificados: 1, fallidas: [] });
  });

  it("si la versión re-verificada no se puede insertar, el retiro se deshace: el vigente queda intacto y se informa GUARDADO_ERROR sin el mensaje", async () => {
    const id = await especie("D");
    const dia = new Date("2024-09-13T00:00:00Z");
    expect(await correr(id, dia, 250)).toMatchObject({ cierresNuevos: 1, fallidas: [] });
    await certificar(id, dia, "251", "4");
    const r = await correr(id, dia, 250, conInsercionFallida(db));
    expect(await vigentesDe(id)).toEqual([["250", "NO_VERIFICADO", null, null, null]]);
    expect(await db.precioCierre.count({ where: { instrumentoId: id } })).toBe(1);
    expect(r.fallidas).toEqual([{ instrumentoId: id, codigo: "GUARDADO_ERROR", detalle: "ErrorFicticioDeInsercion", barrasGuardadas: 0, barrasFallidas: 1 }]);
    expect(JSON.stringify(r)).not.toContain("424242");
    expect(r).toMatchObject({ cierresNuevos: 0, cierresRevisados: 0, cierresReverificados: 0 });
    // Sin la falla, la corrida siguiente re-verifica.
    expect(await correr(id, dia, 250)).toMatchObject({ cierresReverificados: 1, fallidas: [] });
    expect(await vigentesDe(id)).toEqual([["250", "VERIFICADO", "certificacion:2024-09-13", "251", "0.398406"]]);
  });

  it("un VERIFICADO cuya certificación queda absurda (valoración 1: 24 900 %, no cabe en Decimal(9,6)) pasa a NO_VERIFICADO con la referencia y sin desviación; no se atasca", async () => {
    const id = await especie("E");
    const dia = new Date("2024-09-16T00:00:00Z");
    const certificacionId = await certificar(id, dia, "250", "5");
    expect(await correr(id, dia, 250)).toMatchObject({ cierresNuevos: 1, fallidas: [] });
    await db.certificacionPosicion.update({ where: { certificacionId_instrumentoId: { certificacionId, instrumentoId: id } }, data: { precioValoracion: new Prisma.Decimal("1") } });
    const r = await correr(id, dia, 250);
    expect(await vigentesDe(id)).toEqual([["250", "NO_VERIFICADO", "certificacion:2024-09-16", "1", null]]);
    expect(r).toMatchObject({ cierresReverificados: 1, fallidas: [] });
    expect(await correr(id, dia, 250)).toMatchObject({ cierresReverificados: 0, fallidas: [] });
  });

  it("un cierre nuevo con certificación de valoración 0 se guarda NO_VERIFICADO con la referencia y sin desviación (no se pierde el precio)", async () => {
    const id = await especie("F");
    const dia = new Date("2024-09-17T00:00:00Z");
    await certificar(id, dia, "0", "6");
    const r = await correr(id, dia, 250);
    expect(await vigentesDe(id)).toEqual([["250", "NO_VERIFICADO", "certificacion:2024-09-17", "0", null]]);
    expect(r).toMatchObject({ cierresNuevos: 1, fallidas: [] });
  });

  it("dos corridas que re-verifican a la vez dejan una sola versión nueva, sin errores (el reintento corre siempre)", async () => {
    const id = await especie("C");
    const dia = new Date("2024-09-12T00:00:00Z");
    expect(await correr(id, dia, 250)).toMatchObject({ cierresNuevos: 1, fallidas: [] });
    await certificar(id, dia, "250", "3");
    const esperar = barreraPorClave(2);
    const [a, b] = [conBarreraTrasLeer(db, esperar), conBarreraTrasLeer(db, esperar)];
    const resultados = await Promise.all([correr(id, dia, 250, a.db), correr(id, dia, 250, b.db)]);
    expect(resultados.flatMap((r) => r.fallidas)).toEqual([]);
    expect(await vigentesDe(id)).toEqual([["250", "VERIFICADO", "certificacion:2024-09-12", "250", "0"]]);
    expect(await db.precioCierre.count({ where: { instrumentoId: id } })).toBe(2);
    // 2 lecturas a la vez, más 1 relectura de la corrida que pierde la carrera.
    expect(a.lecturas() + b.lecturas()).toBe(3);
    expect(resultados[0]!.cierresReverificados + resultados[1]!.cierresReverificados).toBe(1);
  });
});

type DatosCierre = { readonly instrumentoId: string; readonly fecha: Date };
type ArgsCreacion = Parameters<Delegado["create"]>[0];

/**
 * Cliente de prueba cuya inserción de cierres falla dentro de la transacción (después del retiro con guarda,
 * si lo hay) cuando `debeFallar` lo dice; las demás inserciones pasan a la base.
 */
function conInsercionFallida(base: PrismaClient, debeFallar: (datos: DatosCierre) => boolean = () => true): PrismaClient {
  const crear = (delegado: Delegado) => async (args: ArgsCreacion) => {
    if (debeFallar(args.data as DatosCierre)) throw Object.assign(new Error("valor 424242 en la consulta"), { name: "ErrorFicticioDeInsercion" });
    return delegado.create(args);
  };
  const envolver = <T extends object>(cliente: T): T =>
    new Proxy(cliente, {
      get(objetivo, prop) {
        if (prop === "precioCierre") {
          const delegado = Reflect.get(objetivo, prop) as Delegado;
          return new Proxy(delegado, { get: (d, p) => (p === "create" ? crear(d) : Reflect.get(d, p)) });
        }
        if (prop === "$transaction") {
          return (fn: (tx: Prisma.TransactionClient) => Promise<unknown>, opciones?: Parameters<PrismaClient["$transaction"]>[1]) =>
            (objetivo as unknown as PrismaClient).$transaction((tx) => fn(envolver(tx)), opciones);
        }
        return Reflect.get(objetivo, prop);
      },
    });
  return envolver(base);
}
