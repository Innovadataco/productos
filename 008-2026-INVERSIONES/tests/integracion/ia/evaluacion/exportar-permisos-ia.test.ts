// El export de hechos (exportarHechos, las tres tareas: DIARIO, REGLAS y ESCENARIOS) con los privilegios de inv_ia, el
// rol con que corre el servicio inv-008-ia en producción. Defecto medido en una réplica de producción: la corrida diaria
// fallaba con «permission denied for table plan_version» porque el export usaba los lectores de la página del plan
// (leerVersiones y leerReglas), que piden el motivo, la acción, la cantidad, el detalle y conteos que inv_ia no tiene.
// Siembra lo necesario para que corran TODAS las consultas del export, también las de relaciones (Prisma las pide solo
// si hay filas): una compra, una venta y un dividendo de Trii con sus lotes, cierres, una versión del plan con su regla,
// un decreto con ex futura, un fondo con movimientos y valores, y una certificación con su conciliación.
// Control: el export como inv_ia da EXACTAMENTE lo mismo que como dueño (mismos paquetes y hashes), sin escribir nada.
// Datos INVENTADOS: especies propias de la corrida, valores no redondos, fechas de 2027 y una de corte de 2019.
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cifrarCrudo } from "@/cifrado/campos";
import { gastoNubeDelMes } from "@/ia/config/gasto";
import { exportarHechos } from "@/ia/evaluacion/exportar/exportar";
import { reglasParaHechos, versionVigenteParaHechos } from "@/ia/evaluacion/exportar/plan";
import { vigenteEn } from "@/app/plan/vista";
import { importarArchivoTrii } from "@/importacion/trii/importar";
import { construirLotes } from "@/lotes/construir";
import { leerReglas, leerVersiones } from "@/plan/lectura";
import { crearVersionPlan } from "@/plan/versiones";
import { conRolIa, type RolIa } from "../apoyo/rol-ia";

const db = new PrismaClient();
const corrida = Date.now().toString(36).toUpperCase().slice(-5);
const ESPECIE = `IP${corrida}`;
const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const dec = (v: string) => new Prisma.Decimal(v);
const PRIMERA_VIGENCIA = dia("2025-03-03");
const HOY_BASE = dia("2027-09-14");
const ROL = "pg_use_reserved_connections";
const ORD = "Fecha y hora,Símbolo de la acción,Tipo de orden,Estado,Acciones completadas,Acciones pendientes,Precio por acción,Total invertido,Valor comisión,Total estimado\n";

let ia: RolIa;
/** Fijados una vez en beforeAll, antes de sembrar (planVigente), y solo leídos después. */
let hoy = HOY_BASE;
let vigenteDesde = PRIMERA_VIGENCIA;

const conteos = async (): Promise<readonly number[]> =>
  Promise.all([db.usuario.count(), db.instrumento.count(), db.planVersion.count(), db.reglaPlan.count(), db.precioCierre.count(), db.resumenIa.count()]);

async function sembrarPortafolio(duenoId: string): Promise<string> {
  const imp = async (nombre: string, t: string) => {
    const r = await importarArchivoTrii(db, { nombreArchivo: nombre, contenido: new TextEncoder().encode(t), usuarioId: duenoId });
    if (r.estado !== "CARGADO") throw new Error(`siembra ${nombre}: ${r.estado}`);
  };
  await imp("o-exp-ia.ficticio.csv", ORD + `"8 feb 2027, 10:00 a. m.",${ESPECIE},Compra,Aprobado,173,0,23.41,4049.93,7.19,4057.12\n"9 jun 2027, 10:00 a. m.",${ESPECIE},Venta,Aprobado,37,0,29.13,1077.81,7.19,1070.62\n`);
  await imp("d-exp-ia.ficticio.csv", `Fecha y hora,Ticker,Estado,Valor total\n2027-04-21,${ESPECIE},,63.17\n`);
  await construirLotes(db);
  const instrumentoId = (await db.instrumento.findFirstOrThrow({ where: { nemotecnico: ESPECIE } })).id;
  for (const [fecha, precio] of [["2027-09-09", "27.13"], ["2027-09-10", "27.37"], ["2027-09-13", "27.41"]] as const) {
    await db.precioCierre.create({ data: { instrumentoId, fecha: dia(fecha), precio: dec(precio), fuente: "yahoo", estado: "NO_VERIFICADO" } });
  }
  return instrumentoId;
}

/** La versión no retrocede (la base es compartida): la vigencia es la de la última, y hoy no queda antes de ella. */
async function planVigente(): Promise<{ readonly vigenteDesde: Date; readonly hoy: Date }> {
  const ultima = await db.planVersion.findFirst({ orderBy: { version: "desc" }, select: { vigenteDesde: true } });
  const desde = ultima?.vigenteDesde ?? PRIMERA_VIGENCIA;
  return { vigenteDesde: desde, hoy: desde > HOY_BASE ? desde : HOY_BASE };
}

/**
 * Dos versiones con la MISMA vigencia: rige la de mayor número (la segunda), no la primera. Así la equivalencia con
 * vigenteEn cubre el desempate por número; las programadas y las anteriores las ponen los demás archivos de la base.
 */
async function sembrarPlan(duenoId: string, instrumentoId: string): Promise<void> {
  const version = (nivel: string, detalle: string) =>
    crearVersionPlan(db, {
      vigenteDesde, motivo: `Plan ficticio del export con inv_ia ${detalle}`, autorId: duenoId,
      reglas: [{ instrumentoId, condicion: "CIERRE_BAJO", nivel, accion: "COMPRAR", cantidad: 13n, plazoHasta: null, detalle: `Regla ficticia del export con inv_ia ${detalle}` }],
    }, { hoy });
  await version("25.17", "(la que no rige)");
  await version("26.93", "(la que rige)");
}

async function sembrarDecreto(duenoId: string, instrumentoId: string): Promise<void> {
  const carga = await db.cargaArchivo.create({
    data: { tipoFuente: "REGISTRO_DECRETOS", nombreArchivo: "decretos-exp-ia.ficticio.csv", sha256: `e${corrida.toLowerCase()}`.padEnd(64, "7"), estado: "CARGADO", cargadoPorId: duenoId },
  });
  const llave = { tipoFuente: "REGISTRO_DECRETOS" as const, claveNatural: `expia${corrida}decreto1`.padStart(64, "0"), ocurrencia: 1 };
  const fila = await db.filaFuente.create({ data: { ...llave, primeraCargaId: carga.id, primeraFilaNo: 1, crudo: cifrarCrudo({ especie: ESPECIE, valor: "3.17" }, llave) } });
  const ex = new Date(hoy.getTime() + 23 * 86_400_000);
  await db.dividendoDecretado.create({
    data: {
      filaFuenteId: fila.id, instrumentoId, tipo: "ORDINARIO", valorPorAccion: dec("3.17"), fechaAnuncio: dia("2027-03-17"), cuota: 1,
      fechaEx: ex, fechaPago: new Date(ex.getTime() + 7 * 86_400_000), referenciaOficial: "https://www.superfinanciera.gov.co/ficticio/decreto-exp-ia", version: 1, anulada: false,
    },
  });
}

async function sembrarFondo(duenoId: string): Promise<void> {
  const fondoId = (await db.instrumento.create({ data: { tipo: "FIC", codigoFic: `6${corrida}3`, nombre: "Fondo ficticio del export con inv_ia" } })).id;
  const ajuste = await db.ajusteCaja.create({ data: { fecha: dia("2027-08-02"), monto: dec("-1371.4613"), categoria: "APORTE_FIC", fuente: "MANUAL", motivo: "aporte ficticio", creadoPorId: duenoId } });
  await db.movimientoFondo.create({ data: { fondoId, fecha: dia("2027-08-02"), unidades: dec("0.13714613"), monto: dec("1371.4613"), tipo: "CONSTITUCION", fuente: "MANUAL", ajusteCajaId: ajuste.id } });
  await db.valorUnidadFondo.createMany({
    data: [
      { fondoId, fechaValor: dia("2027-09-08"), valorUnidad: dec("10013.41370000") },
      { fondoId, fechaValor: dia("2027-09-09"), valorUnidad: dec("10017.13710000") },
    ],
  });
}

/** El corte es único: si otra corrida sobre la misma base ya lo dejó, se usa ese (lo que importa es que haya filas). */
async function sembrarConciliacion(duenoId: string): Promise<void> {
  const fecha = dia("2019-08-27");
  if ((await db.certificacion.count({ where: { fechaCorte: fecha } })) > 0) return;
  const carga = await db.cargaArchivo.create({
    data: { tipoFuente: "AV_CERTIFICACION", nombreArchivo: "certificacion-exp-ia.ficticio.pdf", sha256: `c${corrida.toLowerCase()}`.padEnd(64, "3"), fechaCorte: fecha, estado: "CARGADO", cargadoPorId: duenoId },
  });
  const cert = await db.certificacion.create({ data: { cargaId: carga.id, fechaCorte: fecha, saldoEfectivo: dec("613.29") } });
  await db.conciliacion.create({ data: { certificacionId: cert.id, fechaCorte: fecha, versionCalculo: "conciliacion-v3", resultado: "NO_CUADRA" } });
}

beforeAll(async () => {
  const base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a correr sobre «${base}»: solo bases *_test`);
  ({ vigenteDesde, hoy } = await planVigente());
  const duenoId = (await db.usuario.create({ data: { email: `dueno-exp-ia-${corrida.toLowerCase()}@ejemplo.invalid`, rol: "DUENO" } })).id;
  const instrumentoId = await sembrarPortafolio(duenoId);
  await sembrarPlan(duenoId, instrumentoId);
  await sembrarDecreto(duenoId, instrumentoId);
  await sembrarFondo(duenoId);
  await sembrarConciliacion(duenoId);
  ia = await conRolIa(db, ROL);
}, 60_000);

afterAll(async () => {
  await ia?.soltar();
  await db.$disconnect();
});

describe("exportarHechos con los privilegios de inv_ia (la corrida diaria del servicio)", () => {
  it("el cliente es de verdad el rol restringido", async () => {
    expect(await ia.usuario()).toBe(ROL);
  });

  it("arma las tres tareas sin permiso negado, igual que como dueño, y no escribe nada", async () => {
    const antes = await conteos();
    const comoIa = await exportarHechos(ia.cliente, hoy);
    // Si Prisma hubiera reabierto la conexión, correría como dueño y la prueba pasaría en falso.
    expect(await ia.usuario()).toBe(ROL);
    const comoDueno = await exportarHechos(db, hoy);
    expect(await conteos()).toEqual(antes);
    const tipos = [...comoIa.paquetes.map((p) => p.tipo), ...comoIa.omitidos.map((o) => o.tipo)].sort();
    expect(tipos).toEqual(["DIARIO", "ESCENARIOS", "REGLAS"]);
    // Sola, esta siembra arma las tres. En la corrida completa la base trae datos de otros archivos posteriores a hoy, y el
    // armador DIARIO puede omitirse por los datos (FECHA_FUTURA) igual para los dos roles: sus lecturas ya corrieron
    // antes del armado (exportar.ts lee todo fuera de `intentar`), y un permiso negado no se omite: se propaga.
    expect(comoIa.paquetes.map((p) => p.tipo)).toContain("REGLAS");
    expect(comoIa.paquetes.map((p) => p.hash)).toEqual(comoDueno.paquetes.map((p) => p.hash));
    expect(comoIa.omitidos).toEqual(comoDueno.omitidos);
    expect(comoIa.avisos).toEqual(comoDueno.avisos);
    const reglas = comoIa.paquetes.find((p) => p.tipo === "REGLAS");
    expect(reglas?.hechos.some((h) => h.clave === "REGLA_DEL_PLAN")).toBe(true);
  });

  it("lo demás que la corrida lee de la base fuera del export: el gasto de la nube del mes y los festivos", async () => {
    await expect(gastoNubeDelMes(ia.cliente, hoy.toISOString().slice(0, 10))).resolves.toMatchObject({ corridas: expect.any(Number) });
    await expect(ia.cliente.calendarioBvc.findMany({ where: { esHabil: false }, select: { dia: true } })).resolves.toBeDefined();
  });

  it("los lectores acotados del plan dan lo mismo que los de la página (como dueño), sin el motivo ni la acción", async () => {
    const versiones = await leerVersiones(db);
    expect(versiones.filter((v) => v.vigenteDesde.getTime() === vigenteDesde.getTime()).length).toBeGreaterThanOrEqual(2);
    // Cada vigencia de la base, el día antes y el día después (programadas, desempates y anteriores), y un día sin plan.
    const dias = [...versiones.flatMap((v) => [-1, 0, 1].map((d) => new Date(v.vigenteDesde.getTime() + d * 86_400_000))), hoy, dia("2001-01-02")];
    for (const h of dias) {
      const esperada = vigenteEn(versiones, h);
      expect(await versionVigenteParaHechos(ia.cliente, h), h.toISOString()).toEqual(esperada === null ? null : { id: esperada.id, vigenteDesde: esperada.vigenteDesde });
    }
    const acotada = await versionVigenteParaHechos(ia.cliente, hoy);
    const deLaPagina = (await leerReglas(db, acotada!.id)).map((r) => ({ instrumentoId: r.instrumentoId, nemotecnico: r.nemotecnico, condicion: r.condicion, nivel: r.nivel, plazoHasta: r.plazoHasta }));
    const reglas = await reglasParaHechos(ia.cliente, acotada!.id);
    expect(reglas).toEqual(deLaPagina);
    expect(reglas.some((r) => r.nemotecnico === ESPECIE)).toBe(true);
    for (const r of reglas) expect(Object.keys(r).sort()).toEqual(["condicion", "instrumentoId", "nemotecnico", "nivel", "plazoHasta"]);
    expect(reglas.map((r) => r.nivel?.toString())).toEqual(["26.93"]);
    expect(await versionVigenteParaHechos(ia.cliente, dia("2001-01-02"))).toBeNull();
  });
});
