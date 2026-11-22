// El lector de /operar (frente operar-informe) contra la base de PRUEBAS: órdenes ficticias importadas con el importador
// de Trii, lotes armados a mano (como plan-pagina.test.ts), cierres ficticios, una versión del plan por el dominio y
// decretos por su camino único. La base es compartida por todas las pruebas, que corren en serie y en un orden que no se
// garantiza: el plan es global y solo avanza, y la fecha de referencia del tablero es la de todas las especies. Por eso
// la prueba elige sus fechas a partir de lo que ya hay (la última vigencia y el último cierre) y solo afirma sobre sus
// propias especies (OP<corrida>*). Datos inventados.
import { Prisma, PrismaClient } from "@prisma/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ENCABEZADO_DECRETOS } from "@/datos-oficiales/decretos/csv";
import { importarDecretos } from "@/datos-oficiales/decretos/importar";
import { importarArchivoTrii } from "@/importacion/trii/importar";
import { sumarDias } from "@/plan/fechas";
import { calendarioBvc } from "@/plan/lectura";
import { crearVersionPlan } from "@/plan/versiones";
import { esDiaHabil, fechaEnBogota } from "@/precios/horario";

const exigirSesion = vi.hoisted(() => vi.fn());
vi.mock("@/auth/sesion", () => ({ exigirSesion }));

import { datosDeOperar } from "@/app/operar/datos";
import PaginaOperar from "@/app/operar/page";
import { AVISO_DECISION } from "@/app/operar/textos";
import type { VistaOperar } from "@/app/operar/tipos";

const db = new PrismaClient();
const corrida = Date.now().toString(36).toUpperCase().slice(-5);
const NEMO = { a: `OP${corrida}A`, b: `OP${corrida}B`, c: `OP${corrida}C` } as const;
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const ENCABEZADO_ORDENES = "Fecha y hora,Símbolo de la acción,Tipo de orden,Estado,Acciones completadas,Acciones pendientes,Precio por acción,Total invertido,Valor comisión,Total estimado";
const HOY_REAL = fechaEnBogota(new Date());
const COMPRA = new Date("2021-06-02T00:00:00.000Z");
/** La vigencia más temprana que usa la prueba (si la base no tiene un plan posterior): un año que el calendario cubre. */
const VIGENCIA_MINIMA = new Date("2022-02-09T00:00:00.000Z");
const ULTIMO_ANIO_CALENDARIO = 2027;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const trii = (d: Date) => `"${d.getUTCDate()} ${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()}, 10:00 a. m."`;
const ordenCsv = (nemo: string, cantidad: number, precio: string) => {
  const total = new Prisma.Decimal(precio).mul(cantidad).toFixed(2);
  return `${trii(COMPRA)},${nemo},Compra,Aprobado,${cantidad}/${cantidad},0,${precio},${total},0,${total}`;
};

let duenoEmail = "";
let numeroVersion = 0;
let reglaIds: readonly string[] = [];
const fechas = { v: COMPRA, r: COMPRA, hoy1: COMPRA, hoy2: COMPRA };

function primerHabilDesde(d: Date, noHabiles: ReadonlySet<string>): Date {
  let t = d;
  while (!esDiaHabil(t, noHabiles)) t = sumarDias(t, 1);
  return t;
}

async function sembrarPosiciones(duenoId: string): Promise<void> {
  const csv = [ENCABEZADO_ORDENES, ordenCsv(NEMO.a, 37, "4296.37"), ordenCsv(NEMO.b, 113, "1165.59"), ordenCsv(NEMO.c, 19, "917.43"), ""].join("\n");
  const r = await importarArchivoTrii(db, { nombreArchivo: `ordenes-operar-${corrida}.ficticio.csv`, contenido: new TextEncoder().encode(csv), usuarioId: duenoId });
  if (r.estado !== "CARGADO") throw new Error(`Las órdenes quedaron ${r.estado}: ${r.errores.map((e) => e.codigo).join(", ")}`);
  for (const nemo of Object.values(NEMO)) {
    const o = await db.orden.findFirstOrThrow({ where: { instrumento: { nemotecnico: nemo }, lado: "COMPRA" } });
    await db.lote.create({
      data: {
        instrumentoId: o.instrumentoId, origen: "COMPRA", ordenId: o.id, fuenteCosto: "TRII_ORDEN", fechaCompra: o.fechaOperacion, fechaLiquidacion: o.fechaLiquidacion,
        cantidad: o.cantidadCompletada, costoUnitario: o.precioUnitario, costoTotal: o.totalInvertido, comision: o.comision,
      },
    });
  }
}

const idDe = async (nemo: string) => (await db.instrumento.findUniqueOrThrow({ where: { nemotecnico: nemo }, select: { id: true } })).id;

/** La vigencia (después de la última del plan), el día de los cierres (≥ el último cierre de la base) y los dos «hoy». */
async function elegirFechas(): Promise<void> {
  const { noHabiles } = await calendarioBvc(db);
  const ultima = await db.planVersion.findFirst({ orderBy: { version: "desc" }, select: { vigenteDesde: true } });
  const v = ultima && ultima.vigenteDesde >= VIGENCIA_MINIMA ? sumarDias(ultima.vigenteDesde, 1) : VIGENCIA_MINIMA;
  if (v > HOY_REAL) throw new Error("La base de pruebas tiene versiones del plan que empiezan después de hoy: reiníciela.");
  const ultimoCierre = (await db.precioCierre.aggregate({ where: { reemplazadoEn: null }, _max: { fecha: true } }))._max.fecha;
  const r = primerHabilDesde(ultimoCierre && ultimoCierre > v ? ultimoCierre : v, noHabiles);
  const hoy2 = sumarDias(r, 14);
  if (hoy2.getUTCFullYear() > ULTIMO_ANIO_CALENDARIO) throw new Error("La base de pruebas tiene cierres demasiado recientes para el calendario de la BVC: reiníciela.");
  Object.assign(fechas, { v, r, hoy1: primerHabilDesde(sumarDias(r, 1), noHabiles), hoy2 });
}

async function sembrarCierres(): Promise<void> {
  const fila = (nemoId: string, fecha: Date, precio: string) => ({ instrumentoId: nemoId, fecha, precio: new Prisma.Decimal(precio), fuente: "yahoo", estado: "NO_VERIFICADO" as const });
  const [a, b, c] = await Promise.all([idDe(NEMO.a), idDe(NEMO.b), idDe(NEMO.c)]);
  await db.precioCierre.createMany({ data: [fila(a, fechas.r, "4597.31"), fila(b, fechas.r, "1237"), fila(c, sumarDias(fechas.r, -7), "899.11")] });
}

async function sembrarPlan(duenoId: string): Promise<void> {
  const [a, b, c] = await Promise.all([idDe(NEMO.a), idDe(NEMO.b), idDe(NEMO.c)]);
  const v = await crearVersionPlan(db, {
    vigenteDesde: fechas.v, motivo: "Plan ficticio del informe para operar", autorId: duenoId,
    reglas: [
      { instrumentoId: a, condicion: "CIERRE_BAJO", nivel: "4613.17", accion: "VENDER", cantidad: 37n, plazoHasta: null, detalle: "Regla ficticia A" },
      { instrumentoId: b, condicion: "CIERRE_SOBRE", nivel: "1259.17", accion: "VENDER", cantidad: 13n, plazoHasta: sumarDias(fechas.hoy1, 30), detalle: "Regla ficticia B" },
      { instrumentoId: c, condicion: "CIERRE_BAJO", nivel: "917.43", accion: "COMPRAR", cantidad: 1n, plazoHasta: sumarDias(fechas.hoy1, 31), detalle: "Regla ficticia C" },
      { instrumentoId: null, condicion: "LIBRE", nivel: null, accion: "NO_ACTUAR", cantidad: null, plazoHasta: null, detalle: "Orden límite siempre (ficticia)" },
    ],
  }, { hoy: HOY_REAL });
  numeroVersion = v.version;
  reglaIds = v.reglaIds;
}

async function sembrarDecretos(): Promise<void> {
  const linea = (nemo: string, ex: Date) => [nemo, "ORDINARIO", iso(sumarDias(ex, -20)), "1", "37.91", "COP", "DINERO", iso(ex), iso(sumarDias(ex, 7)), "sfc:FICTICIO-OP-4613", "", ""].join(",");
  const contenido = new TextEncoder().encode(`${ENCABEZADO_DECRETOS.join(",")}\n${linea(NEMO.a, fechas.hoy1)}\n${linea(NEMO.b, sumarDias(fechas.hoy1, 31))}\n`);
  const r = await importarDecretos(db, { contenido, email: duenoEmail, aplicar: true }, { ahora: new Date(fechas.hoy1.getTime() + 17 * 3_600_000) });
  if (r.estado !== "APLICADO") throw new Error(`Los decretos no se registraron: ${r.estado}`);
}

beforeAll(async () => {
  const nombre = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!nombre.endsWith("_test")) throw new Error(`Se negó a correr sobre «${nombre}»: solo bases *_test`);
  duenoEmail = `dueno-operar-${corrida.toLowerCase()}@ejemplo.invalid`;
  const dueno = await db.usuario.create({ data: { email: duenoEmail, rol: "DUENO" } });
  exigirSesion.mockResolvedValue({ id: dueno.id, email: dueno.email, rol: "DUENO" });
  await sembrarPosiciones(dueno.id);
  await elegirFechas();
  await sembrarCierres();
  await sembrarPlan(dueno.id);
  await sembrarDecretos();
});

afterAll(async () => {
  await db.$disconnect();
});

const especie = (v: VistaOperar, nemo: string) => v.estado.especies.find((e) => e.nemo === nemo);
const propias = <T extends { readonly especie: string | null }>(xs: readonly T[]) => xs.filter((x) => x.especie !== null && x.especie.startsWith(`OP${corrida}`));

describe("datosDeOperar contra la base", () => {
  it("con los precios al día: la referencia es el día de los cierres y las tres especies vivas, la de C atrasada", async () => {
    const v = await datosDeOperar(db, fechas.hoy1);
    expect(v.hoy).toBe(iso(fechas.hoy1));
    expect(v.referencia).toBe(iso(fechas.r));
    expect(v.preciosAtrasados).toBe(false);
    expect([NEMO.a, NEMO.b, NEMO.c].map((n) => [especie(v, n)?.cantidad, especie(v, n)?.atrasado])).toEqual([["37", false], ["113", false], ["19", true]]);
    expect(especie(v, NEMO.a)?.valor).toBe("170100.47");
  });

  it("sus reglas de la versión vigente, en sus grupos: A se cumple, B está cerca y C no tiene cierre al día", async () => {
    const v = await datosDeOperar(db, fechas.hoy1);
    expect(v.reglas.version).toEqual({ numero: numeroVersion, desde: iso(fechas.v) });
    expect(propias(v.reglas.seCumplen).map((r) => [r.id, r.estado])).toEqual([[reglaIds[0], { tipo: "TOCADA", lado: "BAJO", cierre: { precio: "4597.31", fecha: iso(fechas.r) } }]]);
    expect(propias(v.reglas.cercanas).map((r) => [r.id, r.estado])).toEqual([[reglaIds[1], { tipo: "A_DISTANCIA", distanciaPct: "1.79", cierre: { precio: "1237", fecha: iso(fechas.r) } }]]);
    expect(propias(v.reglas.resto).map((r) => [r.id, r.estado])).toEqual([[reglaIds[2], { tipo: "SIN_CIERRE_AL_DIA", ultimo: { precio: "899.11", fecha: iso(sumarDias(fechas.r, -7)) } }]]);
    expect(v.reglas.resto.find((r) => r.id === reglaIds[3])).toMatchObject({ especie: null, condicion: "LIBRE", estado: { tipo: "POSTURA" } });
    expect(v.reglas.seCumplen[0]).toMatchObject({ accion: "VENDER", cantidad: "37", nivel: "4613.17", condicion: "CIERRE_BAJO" });
  });

  it("las fechas: el ex-dividendo de hoy y el plazo de hoy + 30, no lo que cae en hoy + 31", async () => {
    const v = await datosDeOperar(db, fechas.hoy1);
    const mias = propias(v.fechas).map((f) => [f.tipo, f.especie, f.fecha]);
    expect(mias).toEqual([["EX_DIVIDENDO", NEMO.a, iso(fechas.hoy1)], ["PLAZO", NEMO.b, iso(sumarDias(fechas.hoy1, 30))]]);
    expect(propias(v.fechas).find((f) => f.tipo === "EX_DIVIDENDO")).toMatchObject({ tenencia: "37", valorPorAccion: "37.91", cuota: 1 });
  });

  it("dos semanas después sin cierres nuevos: los precios atrasados, y el ex-dividendo pasado ya no está", async () => {
    const v = await datosDeOperar(db, fechas.hoy2);
    expect(v.preciosAtrasados).toBe(true);
    expect(propias(v.reglas.seCumplen).map((r) => r.id)).toEqual([reglaIds[0]]);
    expect(propias(v.fechas).filter((f) => f.tipo === "EX_DIVIDENDO")).toEqual([]);
  });
});

describe("la página /operar contra la base", () => {
  it("con la sesión del dueño: el aviso fijo y «Su regla … dice …» con la acción y la cantidad del plan", async () => {
    const html = renderToStaticMarkup(await PaginaOperar());
    expect(html).toContain(AVISO_DECISION);
    expect(html).toContain(`Su regla de ${NEMO.a} dice: vender 37 acciones si el cierre queda por debajo de $ 4.613,17.`);
    expect(html).toContain(`Su regla de ${NEMO.b} dice: vender 13 acciones si el cierre queda por encima de $ 1.259,17.`);
  });
});
