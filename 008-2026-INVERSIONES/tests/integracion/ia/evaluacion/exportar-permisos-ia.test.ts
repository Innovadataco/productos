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
import { exportarHechos } from "@/ia/evaluacion/exportar/exportar";
import { importarArchivoTrii } from "@/importacion/trii/importar";
import { construirLotes } from "@/lotes/construir";
import { crearVersionPlan } from "@/plan/versiones";
import { conRolIa, type RolIa } from "../apoyo/rol-ia";

const db = new PrismaClient();
const corrida = Date.now().toString(36).toUpperCase().slice(-5);
const ESPECIE = `IP${corrida}`;
const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const dec = (v: string) => new Prisma.Decimal(v);
const PRIMERA_VIGENCIA = dia("2025-03-03");
const HOY_BASE = dia("2027-09-14");
const ORD = "Fecha y hora,Símbolo de la acción,Tipo de orden,Estado,Acciones completadas,Acciones pendientes,Precio por acción,Total invertido,Valor comisión,Total estimado\n";

let ia: RolIa;
let hoy = HOY_BASE;

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
async function sembrarPlan(duenoId: string, instrumentoId: string): Promise<void> {
  const ultima = await db.planVersion.findFirst({ orderBy: { version: "desc" }, select: { vigenteDesde: true } });
  const vigenteDesde = ultima?.vigenteDesde ?? PRIMERA_VIGENCIA;
  if (vigenteDesde > hoy) hoy = vigenteDesde;
  await crearVersionPlan(db, {
    vigenteDesde, motivo: "Plan ficticio del export con inv_ia", autorId: duenoId,
    reglas: [{ instrumentoId, condicion: "CIERRE_BAJO", nivel: "26.93", accion: "COMPRAR", cantidad: 13n, plazoHasta: null, detalle: "Regla ficticia del export con inv_ia" }],
  }, { hoy });
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

async function sembrarConciliacion(duenoId: string): Promise<void> {
  const fecha = dia("2019-08-27");
  const carga = await db.cargaArchivo.create({
    data: { tipoFuente: "AV_CERTIFICACION", nombreArchivo: "certificacion-exp-ia.ficticio.pdf", sha256: `c${corrida.toLowerCase()}`.padEnd(64, "3"), fechaCorte: fecha, estado: "CARGADO", cargadoPorId: duenoId },
  });
  const cert = await db.certificacion.create({ data: { cargaId: carga.id, fechaCorte: fecha, saldoEfectivo: dec("613.29") } });
  await db.conciliacion.create({ data: { certificacionId: cert.id, fechaCorte: fecha, versionCalculo: "conciliacion-v3", resultado: "NO_CUADRA" } });
}

beforeAll(async () => {
  const base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a correr sobre «${base}»: solo bases *_test`);
  const duenoId = (await db.usuario.create({ data: { email: `dueno-exp-ia-${corrida.toLowerCase()}@ejemplo.invalid`, rol: "DUENO" } })).id;
  const instrumentoId = await sembrarPortafolio(duenoId);
  await sembrarPlan(duenoId, instrumentoId);
  await sembrarDecreto(duenoId, instrumentoId);
  await sembrarFondo(duenoId);
  await sembrarConciliacion(duenoId);
  ia = await conRolIa(db, "pg_use_reserved_connections");
}, 60_000);

afterAll(async () => {
  await ia?.soltar();
  await db.$disconnect();
});

describe("exportarHechos con los privilegios de inv_ia (la corrida diaria del servicio)", () => {
  it("el cliente es de verdad el rol restringido", async () => {
    const r = await ia.cliente.$queryRaw<{ u: string }[]>`SELECT current_user::text AS u`;
    expect(r[0]?.u).toBe("pg_use_reserved_connections");
  });

  it("arma las tres tareas sin permiso negado, igual que como dueño, y no escribe nada", async () => {
    const antes = await conteos();
    const comoIa = await exportarHechos(ia.cliente, hoy);
    const comoDueno = await exportarHechos(db, hoy);
    expect(await conteos()).toEqual(antes);
    const tipos = [...comoIa.paquetes.map((p) => p.tipo), ...comoIa.omitidos.map((o) => o.tipo)].sort();
    expect(tipos).toEqual(["DIARIO", "ESCENARIOS", "REGLAS"]);
    expect(comoIa.paquetes.map((p) => p.tipo).sort()).toEqual(["DIARIO", "ESCENARIOS", "REGLAS"]);
    expect(comoIa.paquetes.map((p) => p.hash)).toEqual(comoDueno.paquetes.map((p) => p.hash));
    expect(comoIa.omitidos).toEqual(comoDueno.omitidos);
    expect(comoIa.avisos).toEqual(comoDueno.avisos);
    const reglas = comoIa.paquetes.find((p) => p.tipo === "REGLAS");
    expect(reglas?.hechos.some((h) => h.clave === "REGLA_DEL_PLAN")).toBe(true);
  });
});
