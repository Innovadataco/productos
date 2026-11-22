// Integración de la evolución del tablero (frente graficas-tablero): el lector arma las entradas desde la base y el
// último punto cuadra con el tablero. Datos inventados (especies TE<corrida>A/B), de marzo de 2027: el calendario
// sembrado cubre 2027 y todo queda antes del 16-nov-2027 (la guarda de referencia de tablero.test.ts). La base es
// compartida con los demás archivos: la evolución se pide solo para las especies de este archivo.
// Un cierre por día: si dos fuentes dejaron cierre vigente el mismo día, el tablero y la evolución toman el traído
// más recientemente (la regla de ultimosCierres).
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { importarArchivoTrii } from "@/importacion/trii/importar";
import { construirLotes } from "@/lotes/construir";
import { obtenerResumen, type Resumen } from "@/tablero/datos";
import { obtenerEvolucion } from "@/tablero/datos-evolucion";

const db = new PrismaClient();
const corrida = Date.now().toString(36).toUpperCase().slice(-5);
const A = `TE${corrida}A`;
const B = `TE${corrida}B`;
const ORD = "Fecha y hora,Símbolo de la acción,Tipo de orden,Estado,Acciones completadas,Acciones pendientes,Precio por acción,Total invertido,Valor comisión,Total estimado\n";
const csv = (t: string) => new TextEncoder().encode(t);
const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const REF = dia("2027-03-09");

const CIERRES: Record<string, readonly (readonly [string, string])[]> = {
  [A]: [["2027-03-01", "1237"], ["2027-03-02", "1250.37"], ["2027-03-03", "1199.13"], ["2027-03-04", "1213.89"], ["2027-03-05", "1222.47"], ["2027-03-08", "1301.17"], ["2027-03-09", "1289.91"]],
  [B]: [["2027-03-03", "459.11"], ["2027-03-04", "463.07"], ["2027-03-08", "470.21"], ["2027-03-09", "468.83"]],
};

async function resumenPropio(): Promise<Resumen> {
  const r = await obtenerResumen(db);
  const filas = r.tablero.filas.filter((f) => f.nemotecnico === A || f.nemotecnico === B);
  return { ...r, tablero: { ...r.tablero, filas, cerradas: [], fechaReferencia: REF } };
}

beforeAll(async () => {
  const base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a correr sobre «${base}»`);
  const duenoId = (await db.usuario.create({ data: { email: `dueno-te-${corrida}@ejemplo.invalid`, rol: "DUENO" } })).id;
  const imp = (nombre: string, t: string) => importarArchivoTrii(db, { nombreArchivo: nombre, contenido: csv(t), usuarioId: duenoId });
  await imp("oe.ficticio.csv", ORD + [
    `"1 mar 2027, 10:00 a. m.",${A},Compra,Aprobado,19,0,1237.0,23503.0,16.11,23519.11`,
    `"3 mar 2027, 10:00 a. m.",${B},Compra,Aprobado,37,0,461.3,17068.1,11.19,17079.29`,
    `"8 mar 2027, 10:00 a. m.",${A},Venta,Aprobado,7,0,1301.17,9108.19,6.31,9101.88`,
  ].join("\n") + "\n");
  await imp("de.ficticio.csv", `Fecha y hora,Ticker,Estado,Valor total\n2027-03-05,${A},,371.13\n`);
  await construirLotes(db);
  for (const [nemo, serie] of Object.entries(CIERRES)) {
    const instrumentoId = (await db.instrumento.findFirstOrThrow({ where: { nemotecnico: nemo } })).id;
    await db.precioCierre.createMany({
      data: serie.map(([f, p]) => ({ instrumentoId, fecha: dia(f), precio: D(p), fuente: "yahoo", estado: "NO_VERIFICADO" as const, traidoEn: new Date("2027-03-10T02:00:00Z") })),
    });
  }
  // El mismo día, otra fuente traída después: gana esta (nunca al azar).
  const idB = (await db.instrumento.findFirstOrThrow({ where: { nemotecnico: B } })).id;
  await db.precioCierre.create({ data: { instrumentoId: idB, fecha: dia("2027-03-09"), precio: D("471.37"), fuente: "otra-ficticia", estado: "NO_VERIFICADO", traidoEn: new Date("2027-03-10T05:00:00Z") } });
});

afterAll(async () => {
  await db.$disconnect();
});

describe("un cierre por día en el tablero", () => {
  it("la serie de 60 cierres no repite el día y el cierre del tablero es el traído más recientemente", async () => {
    const fila = (await obtenerResumen(db)).tablero.filas.find((f) => f.nemotecnico === B)!;
    expect(fila.serie.filter((p) => iso(p.fecha) === "2027-03-09").map((p) => p.precio.toString())).toEqual(["471.37"]);
    expect(fila.cierre!.precio.toString()).toBe("471.37");
    expect(fila.serie.map((p) => iso(p.fecha))).toEqual(["2027-03-03", "2027-03-04", "2027-03-08", "2027-03-09"]);
  });
});

describe("obtenerEvolucion", () => {
  it("un punto por día con cierre desde la primera compra, hasta la referencia", async () => {
    const e = await obtenerEvolucion(db, await resumenPropio());
    expect(e.puntos.map((p) => iso(p.fecha))).toEqual(["2027-03-01", "2027-03-02", "2027-03-03", "2027-03-04", "2027-03-05", "2027-03-08", "2027-03-09"]);
    expect(e.puntos.map((p) => p.atrasadas)).toEqual([0, 0, 0, 0, 1, 0, 0]);
    expect([e.omitidos, e.sinCierre]).toEqual([0, []]);
  });

  it("el último punto cuadra con el tablero: valor = Σ valor y costo = Σ costo vivo de sus especies", async () => {
    const r = await resumenPropio();
    const e = await obtenerEvolucion(db, r);
    const ultimo = e.puntos[e.puntos.length - 1]!;
    expect(ultimo.valor.toString()).toBe(r.tablero.filas.reduce((s, f) => s.add(f.valor!), D(0)).toString());
    expect(ultimo.costo.toString()).toBe(r.tablero.filas.reduce((s, f) => s.add(f.costoVivo), D(0)).toString());
    expect(ultimo.valor.toString()).toBe(D(12).mul("1289.91").add(D(37).mul("471.37")).toString());
  });

  it("los flujos salen de las órdenes de los lotes y de las ventas asignadas; el dividendo, del día de pago", async () => {
    const e = await obtenerEvolucion(db, await resumenPropio());
    const f = (k: number) => e.puntos[k]!.twr.add(1);
    const v = (k: number) => e.puntos[k]!.valor;
    // 3-mar: la compra de B entra al inicio del día (con su comisión).
    expect(f(2).div(f(1)).sub(1).toFixed(10)).toBe(v(2).div(v(1).add("17079.29")).sub(1).toFixed(10));
    // 5-mar: el dividendo de A suma al cierre.
    expect(f(4).div(f(3)).sub(1).toFixed(10)).toBe(v(4).add("371.13").div(v(3)).sub(1).toFixed(10));
    // 8-mar: la venta de A sale al cierre con su ingreso neto (total estimado).
    expect(f(5).div(f(4)).sub(1).toFixed(10)).toBe(v(5).add("9101.88").div(v(4)).sub(1).toFixed(10));
    expect(e.puntos[5]!.costo.toString()).toBe(D(23503).sub(D(7).mul(1237)).add("17068.1").toString());
  });

  it("nada después de la referencia", async () => {
    const r = await resumenPropio();
    const e = await obtenerEvolucion(db, { ...r, tablero: { ...r.tablero, fechaReferencia: dia("2027-03-05") } });
    expect(e.puntos.map((p) => iso(p.fecha)).at(-1)).toBe("2027-03-05");
  });

  it("sin referencia no hay puntos", async () => {
    const r = await resumenPropio();
    const e = await obtenerEvolucion(db, { ...r, tablero: { ...r.tablero, fechaReferencia: null } });
    expect(e.puntos).toEqual([]);
  });
});
