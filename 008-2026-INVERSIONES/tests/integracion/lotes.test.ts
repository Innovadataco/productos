// Integración de INV-SPEC-12 contra la base de PRUEBAS. Datos inventados.
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registrarEscision, validarEscision } from "@/eventos/escision";
import { importarArchivoTrii } from "@/importacion/trii/importar";
import { construirLotes } from "@/lotes/construir";
import { ErrorLote, registrarLoteEscision } from "@/lotes/escision";
import { posiciones } from "@/lotes/posiciones";

const db = new PrismaClient();
const corrida = Date.now().toString(36).toUpperCase().slice(-5);
const nemo = (b: string) => `${b}${corrida}`;
let duenoId = "";
const ORDENES =
  "Fecha y hora,Símbolo de la acción,Tipo de orden,Estado,Acciones completadas,Acciones pendientes,Precio por acción,Total invertido,Valor comisión,Total estimado\n";
const ordenes = (filas: string) =>
  importarArchivoTrii(db, { nombreArchivo: "o.ficticio.csv", contenido: new TextEncoder().encode(ORDENES + filas), usuarioId: duenoId });
const fila = (fecha: string, n: string, lado: string, estado: string, cant: number, precio: number) =>
  `"${fecha}, 10:00 a. m.",${n},${lado},${estado},${cant},0,${precio}.0,${cant * precio}.0,7.0,${cant * precio + (lado === "Compra" ? 7 : -7)}.0\n`;
const posicionDe = async (n: string) => (await posiciones(db)).find((p) => p.nemotecnico === n);

beforeAll(async () => {
  const base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a correr sobre «${base}»`);
  duenoId = (await db.usuario.create({ data: { email: `dueno-lot-${corrida}@ejemplo.invalid`, rol: "DUENO" } })).id;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("lotes desde las órdenes", () => {
  it("un lote por compra aprobada (las canceladas no), y es idempotente", async () => {
    const n = nemo("L");
    await ordenes(fila("8 ene 2024", n, "Compra", "Aprobado", 100, 10) + fila("9 ene 2024", n, "Compra", "Cancelado", 50, 10) + fila("5 feb 2024", n, "Compra", "Aprobado", 50, 12));
    const primera = await construirLotes(db);
    expect(primera.lotesCreados).toBeGreaterThanOrEqual(2);
    const segunda = await construirLotes(db);
    expect(segunda.lotesCreados).toBe(0);
    const lotes = await db.lote.findMany({ where: { instrumento: { nemotecnico: n } }, orderBy: { fechaCompra: "asc" } });
    expect(lotes.map((l) => [l.cantidad, l.costoTotal.toString(), l.comision.toString(), l.fuenteCosto])).toEqual([
      [100n, "1000", "7", "TRII_ORDEN"],
      [50n, "600", "7", "TRII_ORDEN"],
    ]);
  });

  it("las ventas se asignan FIFO y la posición queda con el costo de lo que sobra", async () => {
    const n = nemo("V");
    await ordenes(fila("8 ene 2024", n, "Compra", "Aprobado", 100, 10) + fila("5 feb 2024", n, "Compra", "Aprobado", 50, 12) + fila("4 mar 2024", n, "Venta", "Aprobado", 120, 15));
    await construirLotes(db);
    const asignaciones = await db.asignacionVenta.findMany({ where: { lote: { instrumento: { nemotecnico: n } } }, include: { lote: true }, orderBy: { lote: { fechaCompra: "asc" } } });
    expect(asignaciones.map((a) => [a.cantidad, a.costoBase.toString()])).toEqual([[100n, "1000"], [20n, "240"]]);
    expect(await posicionDe(n)).toMatchObject({ cantidad: 30n, lotesVivos: 1 });
    expect((await posicionDe(n))!.costoVivo.toString()).toBe("360");
  });

  it("una compra con fecha anterior importada después recalcula la asignación FIFO", async () => {
    const n = nemo("R");
    await ordenes(fila("5 feb 2024", n, "Compra", "Aprobado", 50, 12) + fila("4 mar 2024", n, "Venta", "Aprobado", 40, 15));
    await construirLotes(db);
    await ordenes(fila("8 ene 2024", n, "Compra", "Aprobado", 100, 10));
    await construirLotes(db);
    const a = await db.asignacionVenta.findMany({ where: { lote: { instrumento: { nemotecnico: n } } }, include: { lote: true } });
    expect(a.map((x) => [x.lote.fechaCompra.toISOString().slice(0, 10), x.cantidad])).toEqual([["2024-01-08", 40n]]);
  });

  it("ventas que no caben en los lotes no producen posiciones negativas: se informan", async () => {
    const n = nemo("S");
    await ordenes(fila("8 ene 2024", n, "Compra", "Aprobado", 10, 10) + fila("4 mar 2024", n, "Venta", "Aprobado", 25, 15));
    const r = await construirLotes(db);
    const id = (await db.instrumento.findFirstOrThrow({ where: { nemotecnico: n } })).id;
    expect(r.especiesSinLotes).toContain(id);
    expect(await db.asignacionVenta.count({ where: { lote: { instrumentoId: id } } })).toBe(0);
  });
});

describe("lote de escisión", () => {
  it("se registra con el costo del portal, enlazado al evento y al lote madre, y suma a la posición", async () => {
    const [a, b] = [nemo("EA"), nemo("EB")];
    await ordenes(fila("8 ene 2024", a, "Compra", "Aprobado", 200, 10));
    await construirLotes(db);
    const v = validarEscision({ origen: a, destino: b, fecha: "2024-02-12" });
    if (!v.ok) throw new Error("validación");
    await registrarEscision(db, v.valor, { crearDestino: true });
    const { loteId } = await registrarLoteEscision(db, { destino: b, fechaEvento: "2024-02-12", cantidad: "16", costoUnitario: "50.5" });
    const lote = await db.lote.findUniqueOrThrow({ where: { id: loteId }, include: { loteOrigen: true } });
    expect(lote).toMatchObject({ origen: "ESCISION", fuenteCosto: "AV_PORTAL", cantidad: 16n });
    expect(lote.costoTotal.toString()).toBe("808");
    expect(lote.loteOrigen?.instrumentoId).toBe((await db.instrumento.findFirstOrThrow({ where: { nemotecnico: a } })).id);
    expect(await posicionDe(b)).toMatchObject({ cantidad: 16n });
    await expect(registrarLoteEscision(db, { destino: b, fechaEvento: "2024-02-12", cantidad: "16", costoUnitario: "50.5" })).rejects.toMatchObject({ codigo: "LOTE_YA_REGISTRADO" });
  });

  it("sin evento registrado o con datos inválidos, se rechaza", async () => {
    await expect(registrarLoteEscision(db, { destino: nemo("ZZ"), fechaEvento: "2024-02-12", cantidad: "5", costoUnitario: "1" })).rejects.toMatchObject({ codigo: "EVENTO_NO_ENCONTRADO" });
    await expect(registrarLoteEscision(db, { destino: nemo("EB"), fechaEvento: "2024-02-12", cantidad: "0", costoUnitario: "1" })).rejects.toThrow(ErrorLote);
    await expect(registrarLoteEscision(db, { destino: nemo("EB"), fechaEvento: "2024-02-12", cantidad: "5", costoUnitario: "-1" })).rejects.toThrow(/costoUnitario/);
  });
});
