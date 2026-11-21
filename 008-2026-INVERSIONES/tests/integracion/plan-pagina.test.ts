// Las páginas /plan, /decisiones y /decisiones/[id] REALES contra la base de PRUEBAS (fase B, corte 3), con la
// sesión simulada: órdenes y dividendos ficticios importados con el importador de Trii, lotes armados a mano (como
// en conciliacion.test.ts), cierres ficticios y el plan con el dominio. La fecha de referencia del plan es la del
// tablero. El plan es global y no retrocede: los casos empiezan después de la última versión. Datos inventados.
import { Prisma, PrismaClient } from "@prisma/client";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { fecha } from "@/app/tablero/formato";
import { importarArchivoTrii } from "@/importacion/trii/importar";
import { registrarDecision } from "@/plan/decisiones";
import { enlazarOrden } from "@/plan/enlaces";
import { sumarDias } from "@/plan/fechas";
import { ultimosCierres } from "@/plan/lectura";
import { crearVersionPlan } from "@/plan/versiones";
import { fechaEnBogota } from "@/precios/horario";
import { obtenerResumen } from "@/tablero/datos";

const exigirSesion = vi.hoisted(() => vi.fn());
vi.mock("@/auth/sesion", () => ({ exigirSesion }));

import PaginaDecision from "@/app/decisiones/[id]/page";
import PaginaDiario from "@/app/decisiones/page";
import PaginaPlan from "@/app/plan/page";

const db = new PrismaClient();
const corrida = Date.now().toString(36).toUpperCase().slice(-5);
const P1 = `PP${corrida}A`;
const P2 = `PP${corrida}B`;
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const ENCABEZADO_ORDENES = "Fecha y hora,Símbolo de la acción,Tipo de orden,Estado,Acciones completadas,Acciones pendientes,Precio por acción,Total invertido,Valor comisión,Total estimado";
const HOY = fechaEnBogota(new Date());
const iso = (d: Date) => d.toISOString().slice(0, 10);
const trii = (d: Date) => `"${d.getUTCDate()} ${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()}, 10:00 a. m."`;
const ordenCsv = (d: Date, nemo: string, lado: "Compra" | "Venta", cantidad: number, precio: number) =>
  `${trii(d)},${nemo},${lado},Aprobado,${cantidad}/${cantidad},0,${precio}.0,${cantidad * precio}.0,0,${cantidad * precio}.0`;

let base = new Date("2025-03-03T00:00:00.000Z");
const d = (dias: number) => sumarDias(base, dias);
let duenoId = "";
let versionNumero = 0;
const ids = { p1: "", p2: "", noActuar: "", venta: "", sueltaFila: 0 };

async function cargarTrii(nombreArchivo: string, csv: string): Promise<void> {
  const r = await importarArchivoTrii(db, { nombreArchivo, contenido: new TextEncoder().encode(csv), usuarioId: duenoId });
  if (r.estado !== "CARGADO") throw new Error(`${nombreArchivo} quedó ${r.estado}: ${r.errores.map((e) => e.codigo).join(", ")}`);
}

async function loteDeCompra(instrumentoId: string): Promise<string> {
  const o = await db.orden.findFirstOrThrow({ where: { instrumentoId, lado: "COMPRA" } });
  const { id } = await db.lote.create({
    data: {
      instrumentoId, origen: "COMPRA", ordenId: o.id, fuenteCosto: "TRII_ORDEN", fechaCompra: o.fechaOperacion, fechaLiquidacion: o.fechaLiquidacion,
      cantidad: o.cantidadCompletada, costoUnitario: o.precioUnitario, costoTotal: o.totalInvertido, comision: o.comision,
    },
    select: { id: true },
  });
  return id;
}

const cierres = (instrumentoId: string, filas: readonly (readonly [number, string])[]) =>
  db.precioCierre.createMany({ data: filas.map(([dia, precio]) => ({ instrumentoId, fecha: d(dia), precio: new Prisma.Decimal(precio), fuente: "yahoo", estado: "NO_VERIFICADO" as const })) });

const html = async (p: Promise<ReactElement>) => renderToStaticMarkup(await p);

beforeAll(async () => {
  const nombre = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!nombre.endsWith("_test")) throw new Error(`Se negó a correr sobre «${nombre}»: solo bases *_test`);
  const ultima = await db.planVersion.findFirst({ orderBy: { version: "desc" } });
  if (ultima && ultima.vigenteDesde >= base) base = sumarDias(ultima.vigenteDesde, 1);
  if (d(120) >= HOY) throw new Error("La base de pruebas tiene versiones del plan demasiado recientes para medir 90 días: reiníciela.");
  const dueno = await db.usuario.create({ data: { email: `dueno-pagina-plan-${corrida.toLowerCase()}@ejemplo.invalid`, rol: "DUENO" } });
  duenoId = dueno.id;
  exigirSesion.mockResolvedValue({ id: dueno.id, email: dueno.email, rol: "DUENO" });
  // P1: compra 100 (día 0), vende 10 (día 10, con decisión) y 5 (día 25, sin decisión); paga 900 netos el día 20
  // sobre 90 acciones (10 por acción). P2: compra 50 y su último cierre es del día 5 (no negocia después).
  await cargarTrii(`ordenes-pagina-plan-${corrida}.ficticio.csv`, [
    ENCABEZADO_ORDENES, ordenCsv(d(0), P1, "Compra", 100, 10), ordenCsv(d(0), P2, "Compra", 50, 20), ordenCsv(d(10), P1, "Venta", 10, 11), ordenCsv(d(25), P1, "Venta", 5, 11), "",
  ].join("\n"));
  await cargarTrii(`dividendos-pagina-plan-${corrida}.ficticio.csv`, `Fecha y hora,Ticker,Estado,Valor total\n${iso(d(20))},${P1},,900.0\n`);
  ids.p1 = (await db.instrumento.findUniqueOrThrow({ where: { nemotecnico: P1 } })).id;
  ids.p2 = (await db.instrumento.findUniqueOrThrow({ where: { nemotecnico: P2 } })).id;
  const loteP1 = await loteDeCompra(ids.p1);
  await loteDeCompra(ids.p2);
  // Las ventas de P1 asignadas a su lote (FIFO): así P1 es una posición viva y completa del tablero.
  for (const venta of await db.orden.findMany({ where: { instrumentoId: ids.p1, lado: "VENTA" } })) {
    await db.asignacionVenta.create({ data: { ordenVentaId: venta.id, loteId: loteP1, cantidad: venta.cantidadCompletada, costoBase: new Prisma.Decimal(10).mul(venta.cantidadCompletada.toString()) } });
  }
  await cierres(ids.p1, [[5, "10"], [35, "12"], [60, "13"], [95, "11"]]);
  await cierres(ids.p2, [[5, "20"]]);
  const v = await crearVersionPlan(db, {
    vigenteDesde: d(0), motivo: "Plan ficticio de la página", autorId: duenoId,
    reglas: [
      { instrumentoId: ids.p1, condicion: "CIERRE_SOBRE", nivel: "15", accion: "VENDER", cantidad: 10n, plazoHasta: null, detalle: "Vender 10 si cierra sobre el nivel (ficticia)" },
      { instrumentoId: ids.p2, condicion: "CIERRE_BAJO", nivel: "18", accion: "COMPRAR", cantidad: null, plazoHasta: null, detalle: "Comprar si cierra bajo el nivel (ficticia)" },
      { instrumentoId: null, condicion: "LIBRE", nivel: null, accion: "NO_ACTUAR", cantidad: null, plazoHasta: null, detalle: "Siempre orden límite (ficticia)" },
    ],
  }, { hoy: HOY });
  versionNumero = v.version;
  ids.noActuar = (await registrarDecision(db, { fechaDecision: d(5), instrumentoId: ids.p1, accion: "NO_ACTUAR", cantidad: 50n, reglaId: v.reglaIds[0]!, excepcion: true, motivo: "Mantener hasta el dividendo (ficticio)", autorId: duenoId }, { hoy: HOY })).id;
  ids.venta = (await registrarDecision(db, { fechaDecision: d(9), instrumentoId: ids.p1, accion: "VENDER", reglaId: v.reglaIds[0]!, motivo: "Vender una parte (ficticio)", autorId: duenoId }, { hoy: HOY })).id;
  const venta = await db.orden.findFirstOrThrow({ where: { instrumentoId: ids.p1, lado: "VENTA", fechaOperacion: d(10) } });
  await enlazarOrden(db, { ordenId: venta.id, decisionId: ids.venta, autorId: duenoId });
});

afterAll(async () => {
  await db.$disconnect();
});

describe("/plan contra la base", () => {
  it("muestra la versión vigente, con la fecha de referencia del tablero", async () => {
    const h = await html(PaginaPlan({ searchParams: Promise.resolve({}) }));
    expect(h).toContain(`Plan vigente: versión ${versionNumero}`);
    const referencia = (await obtenerResumen(db)).tablero.fechaReferencia;
    expect(referencia).not.toBeNull();
    expect(h).toContain(`Cierres al ${fecha(iso(referencia!))}`);
    expect(h).toContain(P1);
    expect(h).toContain(P2);
    expect(h).toContain("Siempre orden límite (ficticia)");
  });

  it("una especie que no negocia desde hace días no muestra su precio viejo como de hoy", async () => {
    const h = await html(PaginaPlan({ searchParams: Promise.resolve({}) }));
    const fila = h.slice(h.indexOf(`id="regla-`), h.length).split("</tr>").find((f) => f.includes(`>${P2}<`)) ?? "";
    expect(fila).toContain(`último cierre ${fecha(iso(d(5)))}`);
    expect(fila).toContain("sin cierre al día");
  });

  it("?version= con un número cargado lo acepta, y con otro da el aviso", async () => {
    expect(await html(PaginaPlan({ searchParams: Promise.resolve({ version: String(versionNumero) }) }))).toContain(`Plan vigente: versión ${versionNumero}`);
    expect(await html(PaginaPlan({ searchParams: Promise.resolve({ version: "999999" }) }))).toContain("No hay una versión del plan con ese número");
  });
});

describe("/decisiones contra la base", () => {
  it("cada decisión con su resultado a 30 días, dividendo incluido, y la orden suelta sin decisión registrada", async () => {
    const h = await html(PaginaDiario({ searchParams: Promise.resolve({}) }));
    const fila = h.split("</tr>").find((f) => f.includes(`id="decision-${ids.noActuar}"`)) ?? "";
    // 50 × (12 − 10) = 100 de precio + 50 × 10 de dividendo = 600.
    expect(fila).toContain("Funcionó · +$ 600");
    expect(fila).toContain("precio +$ 100 · dividendos +$ 500");
    const suelta = h.split("</tr>").find((f) => f.includes(`>${P1}<`) && f.includes(fecha(iso(d(25))))) ?? "";
    expect(suelta).toContain("Venta");
    expect(suelta).toMatch(/fila \d+ de la carga del /);
  });

  it("?regla= con la regla citada filtra a sus decisiones", async () => {
    const regla = await db.reglaPlan.findFirstOrThrow({ where: { instrumentoId: ids.p1, planVersion: { version: versionNumero } } });
    const h = await html(PaginaDiario({ searchParams: Promise.resolve({ regla: regla.id }) }));
    expect(h).toContain(`Decisiones que citan la regla de ${P1} de la versión ${versionNumero}.`);
    expect(h).toContain(`id="decision-${ids.noActuar}"`);
    expect(h).toContain(`id="decision-${ids.venta}"`);
  });
});

describe("/decisiones/[id] contra la base", () => {
  it("«no actuar»: la cadena y el dividendo atribuido con su tenencia", async () => {
    const h = await html(PaginaDecision({ params: Promise.resolve({ id: ids.noActuar }) }));
    expect(h).toContain(`/plan?version=${versionNumero}`);
    expect(h).toContain(`Pagado el ${fecha(iso(d(20)))}: $ 900 netos sobre 90 acciones ($ 10 por acción) → $ 500`);
  });

  it("vender: la orden enlazada con su fila importada", async () => {
    const h = await html(PaginaDecision({ params: Promise.resolve({ id: ids.venta }) }));
    expect(h).toContain(fecha(iso(d(10))));
    expect(h).toMatch(/fila \d+ de la carga del /);
    expect(h).not.toMatch(/"(cifrado|nonce|etiqueta)"/);
  });
});

describe("último cierre por especie (database-reviewer MEDIO)", () => {
  it("una sola consulta para todas las especies, con el desempate total y sin los reemplazados", async () => {
    const contado = new PrismaClient({ log: [{ emit: "event", level: "query" }] });
    let consultas = 0;
    contado.$on("query", () => { consultas += 1; });
    try {
      const r = await ultimosCierres(contado, [ids.p1, ids.p2, "no-existe"]);
      expect(consultas).toBe(1);
      expect([r.get(ids.p1)?.fecha, r.get(ids.p1)?.precio.toString(), r.get(ids.p2)?.fecha]).toEqual([d(95), "11", d(5)]);
      expect(r.has("no-existe")).toBe(false);
      expect(await ultimosCierres(contado, [])).toEqual(new Map());
    } finally {
      await contado.$disconnect();
    }
  });
});
