// Integración de INV-SPEC-12 contra la base de PRUEBAS. Datos inventados.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
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
const posicionDe = async (n: string) => (await posiciones(db)).posiciones.find((p) => p.nemotecnico === n);

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
    const r2 = await posiciones(db);
    expect(r2.especiesIncompletas).toContain(id);
    expect(r2.posiciones.find((p) => p.instrumentoId === id)).toBeUndefined();
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

  it("el lote madre es el más antiguo VIVO al corte del evento (no uno ya vendido)", async () => {
    const [a, b] = [nemo("MA"), nemo("MB")];
    await ordenes(fila("8 ene 2024", a, "Compra", "Aprobado", 10, 10) + fila("5 feb 2024", a, "Compra", "Aprobado", 20, 11) + fila("6 feb 2024", a, "Venta", "Aprobado", 10, 12));
    await construirLotes(db);
    const v = validarEscision({ origen: a, destino: b, fecha: "2024-03-04" });
    if (!v.ok) throw new Error("validación");
    await registrarEscision(db, v.valor, { crearDestino: true });
    const { loteId } = await registrarLoteEscision(db, { destino: b, fechaEvento: "2024-03-04", cantidad: "3", costoUnitario: "9" });
    const lote = await db.lote.findUniqueOrThrow({ where: { id: loteId }, include: { loteOrigen: true } });
    expect(lote.loteOrigen?.fechaCompra.toISOString().slice(0, 10)).toBe("2024-02-05");
  });

  it("sin evento registrado o con datos inválidos, se rechaza", async () => {
    await expect(registrarLoteEscision(db, { destino: nemo("ZZ"), fechaEvento: "2024-02-12", cantidad: "5", costoUnitario: "1" })).rejects.toMatchObject({ codigo: "EVENTO_NO_ENCONTRADO" });
    await expect(registrarLoteEscision(db, { destino: nemo("EB"), fechaEvento: "2024-02-12", cantidad: "0", costoUnitario: "1" })).rejects.toThrow(ErrorLote);
    await expect(registrarLoteEscision(db, { destino: nemo("EB"), fechaEvento: "2024-02-12", cantidad: "5", costoUnitario: "-1" })).rejects.toThrow(/costoUnitario/);
  });
});

// ───────────── Asignaciones bloqueadas (D2–D6) y aislamiento por especie ─────────────
const idDe = async (n: string) => (await db.instrumento.findFirstOrThrow({ where: { nemotecnico: n } })).id;
const ordenDe = async (n: string, lado: "COMPRA" | "VENTA", fecha: string) =>
  db.orden.findFirstOrThrow({ where: { instrumento: { nemotecnico: n }, lado, fechaOperacion: new Date(`${fecha}T00:00:00Z`) } });
const loteDe = async (n: string, fecha: string) =>
  db.lote.findFirstOrThrow({ where: { instrumento: { nemotecnico: n }, fechaCompra: new Date(`${fecha}T00:00:00Z`) } });
type Fija = { ordenVentaId: string; loteId: string; cantidad: bigint; costoBase: string };
/** Señal para deshacer una transacción de prueba. */
class Deshacer extends Error {}
/**
 * Simula una bloqueada YA guardada en la base del dueño (anterior a las defensas de la base): se inserta sin
 * disparadores, solo en la base de pruebas y dentro de su propia transacción.
 */
const fijarComoAntes = (filas: readonly Fija[]) =>
  db.$transaction(async (tx) => {
    const base = (await tx.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
    if (!base.endsWith("_test")) throw new Error(`fijarComoAntes se negó a correr sobre «${base}»`);
    await tx.$executeRawUnsafe("SET LOCAL session_replication_role = replica");
    for (const f of filas) await tx.asignacionVenta.create({ data: { ...f, metodo: "ESPECIFICA", bloqueada: true } });
  });

describe("asignaciones bloqueadas", () => {
  it("D3: una bloqueada ya guardada mayor que su venta rechaza la especie, no la toca y no sale en posiciones", async () => {
    const n = nemo("BV");
    await ordenes(fila("8 ene 2024", n, "Compra", "Aprobado", 100, 10) + fila("4 mar 2024", n, "Venta", "Aprobado", 30, 15) + fila("5 mar 2024", n, "Venta", "Aprobado", 10, 15));
    await construirLotes(db);
    const [v, l] = [await ordenDe(n, "VENTA", "2024-03-04"), await loteDe(n, "2024-01-08")];
    await db.asignacionVenta.deleteMany({ where: { ordenVentaId: v.id } });
    await fijarComoAntes([{ ordenVentaId: v.id, loteId: l.id, cantidad: 80n, costoBase: "800" }]);
    const antes = await db.asignacionVenta.findMany({ where: { loteId: l.id }, orderBy: { id: "asc" } });

    const r = await construirLotes(db);

    expect(await db.asignacionVenta.findMany({ where: { loteId: l.id }, orderBy: { id: "asc" } })).toEqual(antes);
    const p = await posiciones(db);
    expect(p.especiesIncompletas).toContain(l.instrumentoId);
    expect(p.posiciones.find((x) => x.instrumentoId === l.instrumentoId)).toBeUndefined();
    expect(r.especiesRechazadas).toContainEqual(expect.objectContaining({ instrumentoId: l.instrumentoId, codigo: "BLOQUEADA_EXCEDE_VENTA", ventaId: v.id }));
  });

  it("D2: una bloqueada ya guardada mayor que su lote deja la especie fuera de posiciones (nunca negativa)", async () => {
    const n = nemo("BL");
    await ordenes(fila("8 ene 2024", n, "Compra", "Aprobado", 100, 10) + fila("4 mar 2024", n, "Venta", "Aprobado", 150, 15));
    await construirLotes(db);
    const [v, l] = [await ordenDe(n, "VENTA", "2024-03-04"), await loteDe(n, "2024-01-08")];
    await fijarComoAntes([{ ordenVentaId: v.id, loteId: l.id, cantidad: 150n, costoBase: "1500" }]);

    const r = await construirLotes(db);

    expect((await posiciones(db)).especiesIncompletas).toContain(l.instrumentoId);
    expect(r.especiesRechazadas).toContainEqual(expect.objectContaining({ instrumentoId: l.instrumentoId, codigo: "BLOQUEADA_EXCEDE_LOTE", loteId: l.id }));
  });

  it("D6: una bloqueada que cruza especies rechaza las DOS (la de la venta y la del lote)", async () => {
    const [a, b] = [nemo("XA"), nemo("XB")];
    await ordenes(fila("8 ene 2024", a, "Compra", "Aprobado", 100, 10) + fila("4 mar 2024", a, "Venta", "Aprobado", 40, 15) + fila("8 ene 2024", b, "Compra", "Aprobado", 100, 10));
    await construirLotes(db);
    const [v, lb] = [await ordenDe(a, "VENTA", "2024-03-04"), await loteDe(b, "2024-01-08")];
    await db.asignacionVenta.deleteMany({ where: { ordenVentaId: v.id } });
    await fijarComoAntes([{ ordenVentaId: v.id, loteId: lb.id, cantidad: 40n, costoBase: "400" }]);

    const r = await construirLotes(db);

    expect(await db.asignacionVenta.count({ where: { ordenVentaId: v.id } })).toBe(1);
    const p = await posiciones(db);
    expect(p.especiesIncompletas).toEqual(expect.arrayContaining([v.instrumentoId, lb.instrumentoId]));
    expect(r.especiesRechazadas).toContainEqual(expect.objectContaining({ instrumentoId: lb.instrumentoId, codigo: "BLOQUEADA_VENTA_AJENA" }));
    expect(r.especiesRechazadas).toContainEqual(expect.objectContaining({ instrumentoId: v.instrumentoId, codigo: "BLOQUEADA_LOTE_AJENO" }));
  });

  it("D6: una bloqueada sobre una orden de COMPRA rechaza la especie", async () => {
    const n = nemo("BC");
    await ordenes(fila("8 ene 2024", n, "Compra", "Aprobado", 100, 10) + fila("5 feb 2024", n, "Compra", "Aprobado", 50, 12));
    await construirLotes(db);
    const [c, l] = [await ordenDe(n, "COMPRA", "2024-02-05"), await loteDe(n, "2024-01-08")];
    await ordenes(fila("4 mar 2024", n, "Venta", "Aprobado", 10, 15));
    await fijarComoAntes([{ ordenVentaId: c.id, loteId: l.id, cantidad: 10n, costoBase: "100" }]);

    const r = await construirLotes(db);

    expect((await posiciones(db)).especiesIncompletas).toContain(l.instrumentoId);
    expect(r.especiesRechazadas).toContainEqual(expect.objectContaining({ instrumentoId: l.instrumentoId, codigo: "BLOQUEADA_VENTA_AJENA", ventaId: c.id }));
  });
});

describe("rechazos dentro del FIFO (BLOQUEADA_INCOMPLETA, COSTO_NEGATIVO)", () => {
  it("COSTO_NEGATIVO borra las FIFO de la especie, conserva la bloqueada y la deja fuera de posiciones", async () => {
    const n = nemo("CN");
    await ordenes(fila("8 ene 2024", n, "Compra", "Aprobado", 100, 10) + fila("4 mar 2024", n, "Venta", "Aprobado", 50, 15) + fila("5 mar 2024", n, "Venta", "Aprobado", 30, 15));
    await construirLotes(db);
    const [v1, l] = [await ordenDe(n, "VENTA", "2024-03-04"), await loteDe(n, "2024-01-08")];
    const fifo = await db.asignacionVenta.findFirstOrThrow({ where: { ordenVentaId: v1.id } });
    await db.asignacionVenta.update({ where: { id: fifo.id }, data: { bloqueada: true, metodo: "ESPECIFICA", costoBase: "900" } });

    const r = await construirLotes(db);

    expect(r.especiesRechazadas).toContainEqual({ instrumentoId: l.instrumentoId, codigo: "COSTO_NEGATIVO", ventaId: null, loteId: l.id });
    expect(await db.asignacionVenta.findMany({ where: { loteId: l.id }, select: { ordenVentaId: true, bloqueada: true } })).toEqual([{ ordenVentaId: v1.id, bloqueada: true }]);
    expect((await posiciones(db)).especiesIncompletas).toContain(l.instrumentoId);
  });
});

describe("scripts/contar-bloqueadas.sql (solo conteos, solo lectura)", () => {
  /** La consulta del script, sin su BEGIN READ ONLY ni su ROLLBACK. */
  const consulta = (): string =>
    readFileSync(fileURLToPath(new URL("../../scripts/contar-bloqueadas.sql", import.meta.url)), "utf8").replace(/--.*$/gm, "").split(";")[1]!;
  const contar = async () => new Map((await db.$queryRawUnsafe<{ codigo: string; filas: bigint }[]>(consulta())).map((f) => [f.codigo, Number(f.filas)]));

  it("cuenta por código las bloqueadas inválidas ya guardadas, sin mostrar ninguna fila", async () => {
    const n = nemo("CB");
    await ordenes(
      fila("8 ene 2024", n, "Compra", "Aprobado", 100, 10) + fila("4 mar 2024", n, "Venta", "Aprobado", 30, 15) +
      fila("5 mar 2024", n, "Venta", "Aprobado", 200, 15) + fila("5 jun 2024", n, "Compra", "Aprobado", 20, 12),
    );
    await construirLotes(db);
    const [v, vg, c, l, lp] = [
      await ordenDe(n, "VENTA", "2024-03-04"), await ordenDe(n, "VENTA", "2024-03-05"), await ordenDe(n, "COMPRA", "2024-01-08"),
      await loteDe(n, "2024-01-08"), await loteDe(n, "2024-06-05"),
    ];
    const antes = await contar();
    await fijarComoAntes([
      { ordenVentaId: c.id, loteId: l.id, cantidad: 1n, costoBase: "1" }, // orden que no es venta (mismo día que el lote)
      { ordenVentaId: v.id, loteId: lp.id, cantidad: 5n, costoBase: "60" }, // lote posterior a la venta
      { ordenVentaId: vg.id, loteId: l.id, cantidad: 150n, costoBase: "1500" }, // pasa el lote de 100
    ]);
    const despues = await contar();
    const delta = (codigo: string) => (despues.get(codigo) ?? 0) - (antes.get(codigo) ?? 0);
    expect([delta("BLOQUEADAS"), delta("BLOQUEADA_VENTA_AJENA"), delta("BLOQUEADA_LOTE_POSTERIOR"), delta("BLOQUEADA_EXCEDE_LOTE")]).toEqual([3, 1, 1, 1]);
    expect(Object.keys((await db.$queryRawUnsafe<object[]>(consulta()))[0] ?? {}).sort()).toEqual(["codigo", "filas"]);
  });

  it("cuenta los 8 códigos, y los bordes (costo igual al del lote; lote agotado con 1 COP de más) dan 0", async () => {
    const [n, m, k] = [nemo("CC"), nemo("CM"), nemo("CK")];
    await ordenes(
      fila("8 ene 2024", n, "Compra", "Aprobado", 100, 10) + fila("5 feb 2024", n, "Compra", "Aprobado", 100, 10) +
      fila("6 feb 2024", n, "Compra", "Aprobado", 10, 10) + fila("4 mar 2024", n, "Venta", "Aprobado", 30, 15) +
      fila("5 mar 2024", n, "Venta", "Aprobado", 200, 15) + fila("8 ene 2024", m, "Compra", "Aprobado", 100, 10) +
      fila("8 ene 2024", k, "Compra", "Aprobado", 10, 10) + fila("9 ene 2024", k, "Compra", "Aprobado", 100, 10) +
      fila("4 mar 2024", k, "Venta", "Aprobado", 120, 15),
    );
    await construirLotes(db); // n y k: VENTA_SIN_LOTES (sin FIFO); m: sin ventas
    const [v1, v2, kv] = [await ordenDe(n, "VENTA", "2024-03-04"), await ordenDe(n, "VENTA", "2024-03-05"), await ordenDe(k, "VENTA", "2024-03-04")];
    const [l1, l2, l3, m1, k1, k2] = [
      await loteDe(n, "2024-01-08"), await loteDe(n, "2024-02-05"), await loteDe(n, "2024-02-06"),
      await loteDe(m, "2024-01-08"), await loteDe(k, "2024-01-08"), await loteDe(k, "2024-01-09"),
    ];
    const antes = await contar();
    await fijarComoAntes([
      { ordenVentaId: v1.id, loteId: m1.id, cantidad: 5n, costoBase: "50" }, // lote de otra especie
      { ordenVentaId: v1.id, loteId: l1.id, cantidad: 40n, costoBase: "400" }, // v1: 45 sobre 30
      { ordenVentaId: v2.id, loteId: l2.id, cantidad: 50n, costoBase: "1500" }, // lote no agotado con más costo que el suyo
      { ordenVentaId: v2.id, loteId: l3.id, cantidad: 10n, costoBase: "98.9" }, // lote agotado, 1,1 COP de menos
      { ordenVentaId: kv.id, loteId: k1.id, cantidad: 10n, costoBase: "101" }, // borde: agotado con 1 COP de más
      { ordenVentaId: kv.id, loteId: k2.id, cantidad: 50n, costoBase: "1000" }, // borde: no agotado, costo igual al total
    ]);
    const despues = await contar();
    const delta = (codigo: string) => (despues.get(codigo) ?? 0) - (antes.get(codigo) ?? 0);
    expect(Object.fromEntries([...despues.keys()].map((c) => [c, delta(c)]))).toEqual({
      BLOQUEADAS: 6, BLOQUEADA_VENTA_AJENA: 0, BLOQUEADA_LOTE_AJENO: 1, BLOQUEADA_LOTE_POSTERIOR: 0,
      BLOQUEADA_EXCEDE_VENTA: 1, BLOQUEADA_EXCEDE_LOTE: 0, BLOQUEADA_EXCEDE_COSTO: 1, BLOQUEADA_COSTO_DESCUADRADO: 1,
    });
  });
});

describe("construirLotes en ensayo", () => {
  it("con una especie que cambiaría su FIFO, no deja nada: ni lotes nuevos ni asignaciones borradas o creadas", async () => {
    const n = nemo("EF");
    await ordenes(fila("5 feb 2024", n, "Compra", "Aprobado", 50, 12) + fila("4 mar 2024", n, "Venta", "Aprobado", 40, 15));
    await construirLotes(db);
    await ordenes(fila("8 ene 2024", n, "Compra", "Aprobado", 100, 10)); // el FIFO pasaría la venta al lote de enero
    const foto = async () => ({
      lotes: await db.lote.count(),
      asignaciones: (await db.asignacionVenta.findMany({ orderBy: { id: "asc" } })).map((a) => [a.id, a.loteId, a.cantidad, a.costoBase.toString()]),
    });
    const antes = await foto();
    const r = await construirLotes(db, { ensayo: true });
    expect(r).toMatchObject({ ensayo: true });
    expect(r.lotesCreados).toBeGreaterThanOrEqual(1);
    expect(await foto()).toEqual(antes);
  });

  it("calcula lo mismo pero no escribe nada", async () => {
    const n = nemo("EN");
    await ordenes(fila("8 ene 2024", n, "Compra", "Aprobado", 100, 10) + fila("4 mar 2024", n, "Venta", "Aprobado", 30, 15));
    const r = await construirLotes(db, { ensayo: true });
    expect(r.lotesCreados).toBeGreaterThanOrEqual(1);
    expect(r.asignacionesRecalculadas).toBeGreaterThanOrEqual(1);
    expect(await db.lote.count({ where: { instrumento: { nemotecnico: n } } })).toBe(0);
  });
});

describe("defensa de la base: asignacion_venta coherente y lote fijo (D4, D6)", () => {
  // Datos: compra 100 (ene), venta 30 (mar), venta 200 (abr), compra 20 (jun, posterior) y otra especie con 100.
  // Las ventas no caben en los lotes (VENTA_SIN_LOTES): la construcción no deja asignaciones FIFO en ellos.
  const preparar = async (base: string) => {
    const [n, otra] = [nemo(`${base}1`), nemo(`${base}2`)];
    await ordenes(
      fila("8 ene 2024", n, "Compra", "Aprobado", 100, 10) + fila("4 mar 2024", n, "Venta", "Aprobado", 30, 15) +
      fila("1 abr 2024", n, "Venta", "Aprobado", 200, 15) + fila("5 jun 2024", n, "Compra", "Aprobado", 20, 12) +
      fila("8 ene 2024", otra, "Compra", "Aprobado", 100, 10),
    );
    await construirLotes(db);
    return {
      venta: await ordenDe(n, "VENTA", "2024-03-04"), ventaGrande: await ordenDe(n, "VENTA", "2024-04-01"), compra: await ordenDe(n, "COMPRA", "2024-01-08"),
      lote: await loteDe(n, "2024-01-08"), posterior: await loteDe(n, "2024-06-05"), ajeno: await loteDe(otra, "2024-01-08"),
    };
  };
  const insertar = (ordenVentaId: string, loteId: string, cantidad: bigint) =>
    db.asignacionVenta.create({ data: { ordenVentaId, loteId, cantidad, costoBase: "1", metodo: "ESPECIFICA", bloqueada: true } });

  it("rechaza una orden que no es venta, un lote de otra especie y un lote comprado después de la venta", async () => {
    const x = await preparar("DB");
    await expect(insertar(x.compra.id, x.lote.id, 10n)).rejects.toThrow(/asignación: la orden no es una venta aprobada/);
    await expect(insertar(x.venta.id, x.ajeno.id, 10n)).rejects.toThrow(/asignación: el lote es de otra especie que la venta/);
    await expect(insertar(x.venta.id, x.posterior.id, 10n)).rejects.toThrow(/asignación: el lote se compró después de la venta/);
    expect(await db.asignacionVenta.count({ where: { ordenVentaId: { in: [x.compra.id, x.venta.id] } } })).toBe(0);
  });

  it("rechaza una fila que pasa sola su venta (80 sobre 30) o su lote (150 sobre 100, con una venta de 200)", async () => {
    const x = await preparar("DC");
    await expect(insertar(x.venta.id, x.lote.id, 80n)).rejects.toThrow(/asignación: la cantidad pasa la de la venta/);
    await expect(insertar(x.ventaGrande.id, x.lote.id, 150n)).rejects.toThrow(/asignación: la cantidad pasa la del lote/);
    await expect(insertar(x.venta.id, x.lote.id, 30n)).resolves.toMatchObject({ cantidad: 30n });
  });

  it("un UPDATE de la asignación pasa por la misma regla (cambiar de lote o de cantidad)", async () => {
    const x = await preparar("DU");
    const a = await insertar(x.venta.id, x.lote.id, 10n);
    await expect(db.asignacionVenta.update({ where: { id: a.id }, data: { loteId: x.ajeno.id } })).rejects.toThrow(/otra especie que la venta/);
    await expect(db.asignacionVenta.update({ where: { id: a.id }, data: { cantidad: 31n } })).rejects.toThrow(/pasa la de la venta/);
    await expect(db.asignacionVenta.update({ where: { id: a.id }, data: { bloqueada: false } })).resolves.toMatchObject({ bloqueada: false });
  });

  it("un lote con asignaciones no cambia de especie, fecha de compra, cantidad ni costo; sin asignaciones, sí", async () => {
    const x = await preparar("DL");
    await insertar(x.venta.id, x.lote.id, 10n);
    for (const data of [{ instrumentoId: x.ajeno.instrumentoId }, { fechaCompra: new Date("2024-03-10T00:00:00Z") }, { cantidad: 5n }, { costoTotal: "1" }]) {
      await expect(db.lote.update({ where: { id: x.lote.id }, data })).rejects.toThrow(/lote: con asignaciones no cambia/);
    }
    await expect(db.lote.update({ where: { id: x.posterior.id }, data: { cantidad: 21n } })).resolves.toMatchObject({ cantidad: 21n });
  });

  it("FOR SHARE: mientras una inserción no confirma, un UPDATE de su lote espera (con lock_timeout, falla)", async () => {
    const x = await preparar("DS");
    let soltar = () => {};
    const suelta = new Promise<void>((r) => (soltar = r));
    let avisar = () => {};
    const insertada = new Promise<void>((r) => (avisar = r));
    const a = db
      .$transaction(async (tx) => {
        await tx.asignacionVenta.create({ data: { ordenVentaId: x.venta.id, loteId: x.lote.id, cantidad: 10n, costoBase: "100", metodo: "ESPECIFICA", bloqueada: true } });
        avisar();
        await suelta;
        throw new Deshacer();
      }, { timeout: 20_000 })
      .catch((e: unknown) => {
        if (!(e instanceof Deshacer)) throw e;
      });
    await insertada;
    const b = db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '500ms'");
      await tx.lote.update({ where: { id: x.lote.id }, data: { cantidad: 99n } });
    });
    await expect(b).rejects.toThrow(/lock timeout/);
    soltar();
    await a;
    expect((await db.lote.findUniqueOrThrow({ where: { id: x.lote.id } })).cantidad).toBe(100n);
  });
});

describe("el guardián del esquema vigila los disparadores y funciones nuevos", () => {
  const guardian = readFileSync(fileURLToPath(new URL("../../scripts/verificar-esquema.sql", import.meta.url)), "utf8");
  /** Corre el guardián después de romper algo, todo en una transacción que se deshace. Devuelve su error o null. */
  const guardianTras = async (romper: readonly string[]): Promise<string | null> => {
    let error: string | null = null;
    await db
      .$transaction(async (tx) => {
        for (const sql of romper) await tx.$executeRawUnsafe(sql);
        try {
          await tx.$executeRawUnsafe(guardian);
        } catch (e) {
          error = e instanceof Error ? e.message : String(e);
        }
        throw new Deshacer();
      }, { timeout: 30_000 })
      .catch((e: unknown) => {
        if (!(e instanceof Deshacer)) throw e;
      });
    return error;
  };
  const vacia = (f: string) => `CREATE OR REPLACE FUNCTION "${f}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END; $$`;

  it("sin romper nada, pasa", async () => {
    expect(await guardianTras([])).toBeNull();
  });

  it.each([
    [['DROP TRIGGER "asignacion_venta_coherente" ON "asignacion_venta"'], "disparador asignacion_venta_coherente"],
    [['DROP TRIGGER "lote_fijo" ON "lote"'], "disparador lote_fijo"],
    [[vacia("inv_asignacion_coherente")], "función inv_asignacion_coherente"],
    [[vacia("inv_lote_fijo")], "función inv_lote_fijo"],
    [['ALTER TABLE "asignacion_venta" DISABLE TRIGGER "asignacion_venta_coherente"'], "disparador asignacion_venta_coherente"],
    [['ALTER TABLE "lote" DISABLE TRIGGER "lote_fijo"'], "disparador lote_fijo"],
  ])("falla si se rompe: %j", async (romper, esperado) => {
    expect(await guardianTras(romper)).toContain(esperado);
  });
});

// Al final a propósito: antes del arreglo, la bloqueada parcial que deja hacía fallar con P2002 cada
// construirLotes posterior (de cualquier especie), y la evidencia roja de las demás pruebas quedaría mezclada.
describe("una bloqueada inválida no aborta a las demás especies", () => {
  it("D5: una bloqueada parcial no aborta la construcción: esa especie se rechaza y las demás siguen", async () => {
    const [n, otra] = [nemo("BP"), nemo("BQ")];
    await ordenes(fila("8 ene 2024", n, "Compra", "Aprobado", 100, 10) + fila("4 mar 2024", n, "Venta", "Aprobado", 60, 15));
    await construirLotes(db);
    const [v, l] = [await ordenDe(n, "VENTA", "2024-03-04"), await loteDe(n, "2024-01-08")];
    await db.asignacionVenta.deleteMany({ where: { ordenVentaId: v.id } });
    await db.asignacionVenta.create({ data: { ordenVentaId: v.id, loteId: l.id, cantidad: 20n, costoBase: "200", metodo: "ESPECIFICA", bloqueada: true } });
    await ordenes(fila("8 ene 2024", otra, "Compra", "Aprobado", 50, 10) + fila("4 mar 2024", otra, "Venta", "Aprobado", 10, 15));

    const r = await construirLotes(db);

    expect(r.especiesRechazadas).toContainEqual(expect.objectContaining({ instrumentoId: await idDe(n), codigo: "BLOQUEADA_INCOMPLETA" }));
    expect(await db.asignacionVenta.findMany({ where: { ordenVentaId: v.id }, select: { cantidad: true, bloqueada: true } })).toEqual([{ cantidad: 20n, bloqueada: true }]);
    expect(await db.asignacionVenta.count({ where: { lote: { instrumento: { nemotecnico: otra } } } })).toBe(1);
    expect((await posiciones(db)).especiesIncompletas).toContain(await idDe(n));
  });
});
