// Integración de INV-SPEC-15: el resumen sale de la base y cuadra. Datos inventados.
// Frente tablero-cierres: fechas de los cierres y «Qué movió» con el calendario de la BVC sembrado.
// Sus cierres son de noviembre de 2027 (el calendario sembrado cubre 2027) para quedar por encima de los
// cierres que dejan los demás archivos en la base compartida; una guarda lo verifica.
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
const fre = `TF${corrida}`; // cerró en las dos últimas ruedas (12 y 16-nov-2027; el 15 es festivo)
const ili = `TL${corrida}`; // ilíquida: su último cierre es del 28-oct-2027
const fes = `TH${corrida}`; // tiene una barra suelta en el festivo del 15-nov-2027
const REF = new Date("2027-11-16T00:00:00Z");
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
  await imp("oc.ficticio.csv", ORD + [fre, ili, fes].map((x) => `"8 ene 2024, 10:00 a. m.",${x},Compra,Aprobado,10,0,10.0,100.0,7.0,107.0\n`).join(""));
  await construirLotes(db);
  const id = (await db.instrumento.findFirstOrThrow({ where: { nemotecnico: n } })).id;
  await db.precioCierre.create({ data: { instrumentoId: id, fecha: new Date("2024-05-02T00:00:00Z"), precio: new Prisma.Decimal(12), fuente: "yahoo", estado: "NO_VERIFICADO" } });
  const cierres: Record<string, readonly (readonly [string, number])[]> = {
    [fre]: [["2027-11-12", 10], ["2027-11-16", 14]],
    [ili]: [["2027-10-27", 10], ["2027-10-28", 11]],
    [fes]: [["2027-11-12", 10], ["2027-11-15", 12], ["2027-11-16", 13]],
  };
  for (const [nemo, serie] of Object.entries(cierres)) {
    const instrumentoId = (await db.instrumento.findFirstOrThrow({ where: { nemotecnico: nemo } })).id;
    await db.precioCierre.createMany({
      data: serie.map(([f, p]) => ({ instrumentoId, fecha: new Date(`${f}T00:00:00Z`), precio: new Prisma.Decimal(p), fuente: "yahoo", estado: "NO_VERIFICADO" as const })),
    });
  }
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
    expect(r.tablero.fechaReferencia).toBeInstanceOf(Date);
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

describe("obtenerResumen · fechas de los cierres y «Qué movió»", () => {
  const dia = (d: Date | null) => d?.toISOString().slice(0, 10) ?? null;
  const resumen = async () => {
    const r = await obtenerResumen(db);
    // Guarda: si otro archivo deja cierres vivos posteriores, esta prueba no mide lo que dice.
    expect(dia(r.tablero.fechaReferencia), "la referencia debe ser la de este archivo (16-nov-2027)").toBe(dia(REF));
    return r;
  };
  const fila = (r: Awaited<ReturnType<typeof obtenerResumen>>, nemo: string) => r.tablero.filas.find((f) => f.nemotecnico === nemo)!;

  it("una ilíquida queda atrasada y sigue en el valor con su último precio; la que cerró en la referencia no", async () => {
    const r = await resumen();
    expect([fila(r, ili).cierreAtrasado, dia(fila(r, ili).cierre!.fecha), fila(r, ili).valor!.toString()]).toEqual([true, "2027-10-28", "110"]);
    expect(fila(r, fre).cierreAtrasado).toBe(false);
    expect([fila(r, n).cierreAtrasado, fila(r, n).valor!.toString()]).toEqual([true, "720"]);
    expect(r.tablero.especiesAtrasadas).toBeGreaterThanOrEqual(2);
    expect(r.tablero.gananciaTotal.equals(r.tablero.sinVender.add(r.tablero.porVentas).add(r.tablero.dividendos).sub(r.tablero.comisiones))).toBe(true);
  });

  it("«Qué movió» compara la referencia con la rueda previa del calendario (salta el festivo del 15) y omite las demás", async () => {
    const m = (await resumen()).movimiento;
    expect([dia(m.previa), dia(m.referencia), m.motivo]).toEqual(["2027-11-12", "2027-11-16", null]);
    const nemos = m.especies.map((e) => e.nemotecnico);
    expect(nemos).toContain(fre);
    expect(nemos).not.toContain(ili);
    expect(nemos).not.toContain(fes); // su penúltimo cierre es del festivo, no de la rueda previa
    expect(nemos).not.toContain(n);
    expect(m.especies.find((e) => e.nemotecnico === fre)!.aporte.toString()).toBe("40"); // (14 − 10) × 10
    expect(m.omitidas).toBeGreaterThanOrEqual(3);
  });
});
