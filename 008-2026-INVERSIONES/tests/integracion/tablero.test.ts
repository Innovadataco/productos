// Integración de INV-SPEC-15: el resumen sale de la base y cuadra. Datos inventados.
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { importarArchivoTrii } from "@/importacion/trii/importar";
import { construirLotes } from "@/lotes/construir";
import { obtenerResumen } from "@/tablero/datos";

const db = new PrismaClient();
const corrida = Date.now().toString(36).toUpperCase().slice(-5);
const n = `TB${corrida}`;
const inc = `TI${corrida}`; // vende más de lo que compró: VENTA_SIN_LOTES
const des = `TD${corrida}`; // destino de una escisión: recibe la fracción y un dividendo
let duenoId = "";
const csv = (t: string) => new TextEncoder().encode(t);
const ORD = "Fecha y hora,Símbolo de la acción,Tipo de orden,Estado,Acciones completadas,Acciones pendientes,Precio por acción,Total invertido,Valor comisión,Total estimado\n";

beforeAll(async () => {
  const base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a correr sobre «${base}»`);
  duenoId = (await db.usuario.create({ data: { email: `dueno-tb-${corrida}@ejemplo.invalid`, rol: "DUENO" } })).id;
  const imp = (nombre: string, t: string) => importarArchivoTrii(db, { nombreArchivo: nombre, contenido: csv(t), usuarioId: duenoId });
  await imp("o.ficticio.csv", ORD + `"8 ene 2024, 10:00 a. m.",${n},Compra,Aprobado,100,0,10.0,1000.0,7.0,1007.0\n"4 mar 2024, 10:00 a. m.",${n},Venta,Aprobado,40,0,15.0,600.0,7.0,593.0\n`);
  await imp("d.ficticio.csv", `Fecha y hora,Ticker,Estado,Valor total\n2024-04-15,${n},,33.0\n`);
  await imp("oi.ficticio.csv", ORD + `"8 ene 2024, 10:00 a. m.",${inc},Compra,Aprobado,10,0,10.0,100.0,7.0,107.0\n"4 mar 2024, 10:00 a. m.",${inc},Venta,Aprobado,20,0,15.0,300.0,7.0,293.0\n`);
  const origen = await db.instrumento.create({ data: { tipo: "ACCION", nemotecnico: `TO${corrida}`, nombre: "Origen ficticio" } });
  const destino = await db.instrumento.create({ data: { tipo: "ACCION", nemotecnico: des, nombre: "Destino ficticio" } });
  await db.eventoCorporativo.create({
    data: { tipo: "ESCISION", fecha: new Date("2024-02-26"), origenId: origen.id, destinoId: destino.id, fechaPagoFraccion: new Date("2024-03-08") },
  });
  await imp("df.ficticio.csv", `Fecha y hora,Ticker,Estado,Valor total\n2024-03-08,${des},,40.0\n2024-04-15,${des},,5.0\n`);
  await construirLotes(db);
  const id = (await db.instrumento.findFirstOrThrow({ where: { nemotecnico: n } })).id;
  await db.precioCierre.create({ data: { instrumentoId: id, fecha: new Date("2024-05-02T00:00:00Z"), precio: new Prisma.Decimal(12), fuente: "yahoo", estado: "NO_VERIFICADO" } });
});

afterAll(async () => {
  await db.$disconnect();
});

describe("obtenerResumen", () => {
  it("la fila de la especie cuadra con sus órdenes, dividendos y cierre", async () => {
    const r = await obtenerResumen(db);
    const f = r.tablero.filas.find((x) => x.nemotecnico === n)!;
    expect(f.cantidad).toBe(60n); // 100 − 40
    expect(f.costoVivo.toString()).toBe("600"); // 60 × 10
    expect(f.valor!.toString()).toBe("720"); // 60 × 12
    expect(f.sinVender!.toString()).toBe("120");
    expect(f.realizada.toString()).toBe("200"); // 600 − 400 (FIFO)
    expect(f.dividendos.toString()).toBe("33");
    expect(f.comisiones.toString()).toBe("14");
    expect(r.ultimoCierre).not.toBeNull();
    expect(r.ultimaCarga).not.toBeNull();
  });

  it("una especie con ventas que sus lotes no cubren no entra en filas, cerradas ni totales: se lista aparte", async () => {
    const r = await obtenerResumen(db);
    expect(r.incompletas).toContain(inc);
    expect([...r.tablero.filas, ...r.tablero.cerradas].map((f) => f.nemotecnico)).not.toContain(inc);
  });

  it("la fracción de escisión cuenta como ganancia por ventas (costo 0) y no como dividendo", async () => {
    const f = (await obtenerResumen(db)).tablero.cerradas.find((x) => x.nemotecnico === des)!;
    expect(f.realizada.toString()).toBe("40");
    expect(f.dividendos.toString()).toBe("5");
  });

  it("los totales del tablero son la suma de sus piezas", async () => {
    const t = (await obtenerResumen(db)).tablero;
    expect(t.gananciaTotal.equals(t.sinVender.add(t.porVentas).add(t.dividendos).sub(t.comisiones))).toBe(true);
  });
});
