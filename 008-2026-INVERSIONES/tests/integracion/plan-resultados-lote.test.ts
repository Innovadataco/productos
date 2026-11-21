// Resultado de varias decisiones en lote, con dividendos (fase B, corte 3), contra la base de PRUEBAS. Órdenes y
// dividendos ficticios importados con el importador de Trii; escisión ficticia registrada con su comando. El plan
// es global y no retrocede: los casos empiezan después de la última versión. Datos inventados.
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { especiesAlCorte, ordenesAlCorte } from "@/conciliacion/esperado";
import { registrarEscision, validarEscision } from "@/eventos/escision";
import { importarArchivoTrii } from "@/importacion/trii/importar";
import { registrarLoteEscision } from "@/lotes/escision";
import { registrarDecision } from "@/plan/decisiones";
import { sumarDias } from "@/plan/fechas";
import { resultadoDeDecision } from "@/plan/resultado-db";
import { movimientosDeEspecies, resultadosDeDecisiones } from "@/plan/resultados-lote";
import { tenenciaEn } from "@/plan/tenencia";
import { crearVersionPlan } from "@/plan/versiones";
import { fechaEnBogota } from "@/precios/horario";

const db = new PrismaClient();
const corrida = Date.now().toString(36).toUpperCase().slice(-5);
const NEMO = { a: `LA${corrida}`, b: `LB${corrida}`, x: `LX${corrida}`, y: `LY${corrida}` };
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const ENCABEZADO_ORDENES = "Fecha y hora,Símbolo de la acción,Tipo de orden,Estado,Acciones completadas,Acciones pendientes,Precio por acción,Total invertido,Valor comisión,Total estimado";
const ENCABEZADO_DIVIDENDOS = "Fecha y hora,Ticker,Estado,Valor total";
const HOY = fechaEnBogota(new Date());
const iso = (d: Date) => d.toISOString().slice(0, 10);
const trii = (d: Date) => `"${d.getUTCDate()} ${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()}, 10:00 a. m."`;
const ordenCsv = (d: Date, nemo: string, lado: "Compra" | "Venta", cantidad: number, precio: number) =>
  `${trii(d)},${nemo},${lado},Aprobado,${cantidad}/${cantidad},0,${precio}.0,${cantidad * precio}.0,0,${cantidad * precio}.0`;

let base = new Date("2025-03-03T00:00:00.000Z");
const d = (dias: number) => sumarDias(base, dias);
let duenoId = "";
const ids = { a: "", b: "", x: "", y: "" };
const decisiones = { noActuar: "", vender: "", sinTenencia: "", sinLote: "" };

async function cargarTrii(nombreArchivo: string, csv: string): Promise<void> {
  const r = await importarArchivoTrii(db, { nombreArchivo, contenido: new TextEncoder().encode(csv), usuarioId: duenoId });
  if (r.estado !== "CARGADO") throw new Error(`${nombreArchivo} quedó ${r.estado}: ${r.errores.map((e) => e.codigo).join(", ")}`);
}

async function cierres(instrumentoId: string, filas: readonly (readonly [number, string])[]): Promise<void> {
  await db.precioCierre.createMany({ data: filas.map(([dia, precio]) => ({ instrumentoId, fecha: d(dia), precio: new Prisma.Decimal(precio), fuente: "yahoo", estado: "NO_VERIFICADO" as const })) });
}

async function escisiones(): Promise<void> {
  const madre = await db.orden.findFirstOrThrow({ where: { instrumentoId: ids.a, lado: "COMPRA" } });
  await db.lote.create({
    data: {
      instrumentoId: ids.a, origen: "COMPRA", ordenId: madre.id, fuenteCosto: "TRII_ORDEN", fechaCompra: madre.fechaOperacion, fechaLiquidacion: madre.fechaLiquidacion,
      cantidad: madre.cantidadCompletada, costoUnitario: madre.precioUnitario, costoTotal: madre.totalInvertido, comision: madre.comision,
    },
  });
  for (const destino of [NEMO.x, NEMO.y]) {
    const v = validarEscision({ origen: NEMO.a, destino, fecha: iso(d(80)) });
    if (!v.ok) throw new Error(`escisión ficticia inválida: ${JSON.stringify(v.errores)}`);
    await registrarEscision(db, v.valor, { crearDestino: true });
  }
  // X recibe su lote; Y queda sin lote.
  await registrarLoteEscision(db, { destino: NEMO.x, fechaEvento: iso(d(80)), cantidad: "30", costoUnitario: "100" });
}

const idDe = async (nemo: string) => (await db.instrumento.findUniqueOrThrow({ where: { nemotecnico: nemo } })).id;
const decidir = async (instrumentoId: string, fecha: Date, accion: "NO_ACTUAR" | "VENDER", cantidad: bigint | null) =>
  (await registrarDecision(db, { fechaDecision: fecha, instrumentoId, accion, cantidad, motivo: "Decisión ficticia del lote", autorId: duenoId }, { hoy: HOY })).id;

beforeAll(async () => {
  const nombre = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!nombre.endsWith("_test")) throw new Error(`Se negó a correr sobre «${nombre}»: solo bases *_test`);
  const ultima = await db.planVersion.findFirst({ orderBy: { version: "desc" } });
  if (ultima && ultima.vigenteDesde >= base) base = sumarDias(ultima.vigenteDesde, 1);
  if (d(120) >= HOY) throw new Error("La base de pruebas tiene versiones del plan demasiado recientes para medir 90 días: reiníciela.");
  duenoId = (await db.usuario.create({ data: { email: `dueno-lote-${corrida.toLowerCase()}@ejemplo.invalid`, rol: "DUENO" } })).id;
  // A: compra 100 el día 0 y vende 20 el día 40; paga 1.000 netos el día 20 (10 por acción sobre 100). El día 80
  // se escinde en X (con lote) y en Y (sin lote).
  await cargarTrii(`ordenes-lote-${corrida}.ficticio.csv`, `${ENCABEZADO_ORDENES}\n${ordenCsv(d(0), NEMO.a, "Compra", 100, 10)}\n${ordenCsv(d(40), NEMO.a, "Venta", 20, 12)}\n`);
  await cargarTrii(`dividendos-lote-${corrida}.ficticio.csv`, `${ENCABEZADO_DIVIDENDOS}\n${iso(d(20))},${NEMO.a},,1000.0\n`);
  ids.a = await idDe(NEMO.a);
  ids.b = (await db.instrumento.create({ data: { tipo: "ACCION", nemotecnico: NEMO.b, nombre: "Acción ficticia del lote B" } })).id;
  await escisiones();
  [ids.x, ids.y] = [await idDe(NEMO.x), await idDe(NEMO.y)];
  await crearVersionPlan(db, {
    vigenteDesde: d(0), motivo: "Plan ficticio del lote", autorId: duenoId,
    reglas: [{ instrumentoId: ids.a, condicion: "NINGUNA", nivel: null, accion: "NO_ACTUAR", cantidad: 50n, plazoHasta: null, detalle: "Mantener A, ficticia" }],
  }, { hoy: HOY });
  await cierres(ids.a, [[5, "10"], [35, "12"], [70, "11"], [95, "9"]]);
  await cierres(ids.b, [[5, "20"], [35, "21"]]);
  await cierres(ids.y, [[85, "5"], [115, "6"]]);
  decisiones.noActuar = await decidir(ids.a, d(5), "NO_ACTUAR", 50n);
  decisiones.vender = await decidir(ids.a, d(39), "VENDER", null);
  decisiones.sinTenencia = await decidir(ids.b, d(5), "NO_ACTUAR", 10n);
  decisiones.sinLote = await decidir(ids.y, d(85), "NO_ACTUAR", 5n);
  const venta = await db.orden.findFirstOrThrow({ where: { instrumentoId: ids.a, lado: "VENTA" } });
  await db.enlaceDecisionOrden.create({ data: { ordenId: venta.id, decisionId: decisiones.vender, creadoPorId: duenoId } });
});

afterAll(async () => {
  await db.$disconnect();
});

describe("resultado en lote con dividendos", () => {
  it("«no actuar»: suma el dividendo prorrateado; a 90 días la escisión del origen deja sin veredicto", async () => {
    const r = (await resultadosDeDecisiones(db, [decisiones.noActuar], HOY)).get(decisiones.noActuar)!;
    // 50 × (12 − 10) = 100 de precio; 1.000 netos sobre 100 acciones → 10 por acción → 500.
    expect(r.d30).toMatchObject({ estado: "CALCULADO", incluyeDividendos: true, veredicto: "FUNCIONO", escisionEnVentana: false });
    expect([r.d30.resultadoPrecio?.toString(), r.d30.dividendosPesos?.toString(), r.d30.resultadoPesos?.toString()]).toEqual(["100", "500", "600"]);
    expect(r.d90).toMatchObject({ estado: "CALCULADO", incluyeDividendos: true, escisionEnVentana: true, veredicto: null });
    expect([r.d90.resultadoPrecio?.toString(), r.d90.resultadoPesos?.toString()]).toEqual(["-50", "450"]);
  });

  it("vender: la orden enlazada desde su ejecución, sin dividendos en su ventana", async () => {
    const r = (await resultadosDeDecisiones(db, [decisiones.vender], HOY)).get(decisiones.vender)!;
    // Vendió 20 a 12 (240, sin comisión) y a los 30 días valían 20 × 11 = 220 → +20.
    expect(r.d30).toMatchObject({ estado: "CALCULADO", incluyeDividendos: true, veredicto: "FUNCIONO" });
    expect([r.d30.resultadoPrecio?.toString(), r.d30.dividendosPesos?.toString()]).toEqual(["20", "0"]);
  });

  it("sin tenencia o con un destino de escisión sin lote: solo precio, con su motivo", async () => {
    const lote = await resultadosDeDecisiones(db, [decisiones.sinTenencia, decisiones.sinLote], HOY);
    expect(lote.get(decisiones.sinTenencia)!.d30).toMatchObject({ estado: "CALCULADO", incluyeDividendos: false, motivoSinDividendos: "SIN_TENENCIA" });
    expect(lote.get(decisiones.sinTenencia)!.d30.resultadoPesos?.toString()).toBe("10");
    expect(lote.get(decisiones.sinLote)!.d30).toMatchObject({ estado: "CALCULADO", incluyeDividendos: false, motivoSinDividendos: "ESCISION_SIN_LOTE" });
  });

  it("da lo mismo que el resultado de una sola decisión, para cada una", async () => {
    const todas = Object.values(decisiones);
    const lote = await resultadosDeDecisiones(db, todas, HOY);
    for (const id of todas) expect(lote.get(id)).toEqual(await resultadoDeDecision(db, id, HOY));
  });

  it("no hace una consulta por decisión: con 1 o con 4 decisiones son las mismas consultas", async () => {
    const contado = new PrismaClient({ log: [{ emit: "event", level: "query" }] });
    let consultas = 0;
    contado.$on("query", () => { consultas += 1; });
    try {
      await resultadosDeDecisiones(contado, [decisiones.noActuar], HOY);
      const conUna = consultas;
      consultas = 0;
      await resultadosDeDecisiones(contado, Object.values(decisiones), HOY);
      expect(consultas).toBe(conUna);
    } finally {
      await contado.$disconnect();
    }
  });

  it("ids que no existen no salen en el lote; sin ids no consulta nada", async () => {
    expect((await resultadosDeDecisiones(db, ["no-existe"], HOY)).size).toBe(0);
    expect((await resultadosDeDecisiones(db, [], HOY)).size).toBe(0);
  });

  it("la tenencia por operación es la misma cantidad operada que calcula la conciliación al corte", async () => {
    const movimientos = await movimientosDeEspecies(db, [ids.a, ids.x], d(200));
    for (const corte of [d(0), d(20), d(39), d(40), d(79), d(80), d(81)]) {
      const operadas = await db.$transaction(async (tx) => especiesAlCorte(tx, corte, new Map(), await ordenesAlCorte(tx, corte)));
      for (const id of [ids.a, ids.x]) {
        const esperada = operadas.find((e) => e.instrumentoId === id)?.operada ?? 0n;
        expect(tenenciaEn(movimientos.get(id) ?? [], corte), `${id} al ${iso(corte)}`).toBe(esperada);
      }
    }
  });
});
