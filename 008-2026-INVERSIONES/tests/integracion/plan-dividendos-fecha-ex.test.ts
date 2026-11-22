// Los dividendos del plan con la fecha ex del decreto (fase C, C5c) contra la base de PRUEBAS: el lote lee solo los
// decretos que cuentan (vigentes y no anulados: src/datos-oficiales/decretos/vigentes.ts) de sus especies y en el rango
// de la ventana del cruce, y con ellos la fecha ex manda sobre la aproximación de VENTANA_EX_DIAS.
// Órdenes y dividendos ficticios importados con el importador de Trii; decretos por su camino único (importarDecretos):
// una corrección que cambia la ex (la v1 queda retirada) y una anulación. La ex de la v1 y el pago del anulado se eligieron
// para que, si se leyeran, el resultado cambiara. Datos INVENTADOS y cifras raras.
// Fechas: la cobertura de las cargas de Trii usa la hora real de la carga, así que los hechos van antes de hoy; se
// derivan de hoy al correr (ningún literal de fecha). El plan es global y no retrocede: se empieza después de la última
// versión.
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ENCABEZADO_DECRETOS } from "@/datos-oficiales/decretos/csv";
import { importarDecretos } from "@/datos-oficiales/decretos/importar";
import { leerFechasDeDecretos } from "@/datos-oficiales/decretos/vigentes";
import { importarArchivoTrii } from "@/importacion/trii/importar";
import { registrarDecision } from "@/plan/decisiones";
import { sumarDias } from "@/plan/fechas";
import { resultadoDeDecision } from "@/plan/resultado-db";
import { resultadosDeDecisiones } from "@/plan/resultados-lote";
import { crearVersionPlan } from "@/plan/versiones";
import { fechaEnBogota } from "@/precios/horario";

const db = new PrismaClient();
const corrida = Date.now().toString(36).toUpperCase().slice(-5);
const NEMO = { p: `XP${corrida}`, q: `XQ${corrida}` };
const email = `dueno-fecha-ex-${corrida.toLowerCase()}@ejemplo.invalid`;
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const ORD = "Fecha y hora,Símbolo de la acción,Tipo de orden,Estado,Acciones completadas,Acciones pendientes,Precio por acción,Total invertido,Valor comisión,Total estimado\n";
const DIV = "Fecha y hora,Ticker,Estado,Valor total\n";
const REF = "https://www.bvc.com.co/ficticio/c5c";
const HOY = fechaEnBogota(new Date());
/** Cuántos días antes de hoy empieza, como mínimo, la cadena de este archivo (deja margen a los demás archivos del plan). */
const DIAS_ATRAS = 300;
/** Lo último que mide este archivo (la decisión de comprar a 90 días): tiene que quedar antes de hoy. */
const ULTIMO_DIA = 140;

let base = sumarDias(HOY, -DIAS_ATRAS);
const d = (dias: number) => sumarDias(base, dias);
const iso = (f: Date) => f.toISOString().slice(0, 10);
const trii = (f: Date) => `"${f.getUTCDate()} ${MESES[f.getUTCMonth()]} ${f.getUTCFullYear()}, 10:00 a. m."`;
const bytes = (t: string) => new TextEncoder().encode(t);
const orden = (f: Date, lado: "Compra" | "Venta", cantidad: number, precio: string) => {
  const total = new Prisma.Decimal(precio).mul(cantidad).toFixed(2);
  return `${trii(f)},${NEMO.p},${lado},Aprobado,${cantidad}/${cantidad},0,${precio},${total},0,${total}`;
};
/** especie,tipo,fecha_anuncio,cuota,valor_por_accion,moneda,forma,fecha_ex,fecha_pago,referencia,anulada,nota */
const decreto = (especie: string, cuota: number, valor: string, ex: Date, pago: Date, anulada = "", nota = "") =>
  [especie, "ORDINARIO", iso(d(30)), String(cuota), valor, "COP", "DINERO", iso(ex), iso(pago), `${REF}-${cuota}`, anulada, nota].join(",");

const ids = { p: "", q: "" };
const decisiones = { noActuar: "", comprar: "" };
let duenoId = "";

async function cargarTrii(nombreArchivo: string, csv: string): Promise<void> {
  const r = await importarArchivoTrii(db, { nombreArchivo, contenido: bytes(csv), usuarioId: duenoId });
  if (r.estado !== "CARGADO") throw new Error(`${nombreArchivo} quedó ${r.estado}: ${r.errores.map((e) => e.codigo).join(", ")}`);
}

async function registrarDecretos(filas: readonly string[]): Promise<void> {
  const r = await importarDecretos(db, { contenido: bytes(`${ENCABEZADO_DECRETOS.join(",")}\n${filas.join("\n")}\n`), email, aplicar: true });
  if (r.estado !== "APLICADO") throw new Error(`no se registraron los decretos: ${JSON.stringify(r)}`);
}

const decidir = async (fecha: Date, accion: "NO_ACTUAR" | "COMPRAR", cantidad: bigint | null) =>
  (await registrarDecision(db, { fechaDecision: fecha, instrumentoId: ids.p, accion, cantidad, motivo: "Decisión ficticia de la fecha ex", autorId: duenoId }, { hoy: HOY })).id;

beforeAll(async () => {
  const nombre = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!nombre.endsWith("_test")) throw new Error(`Se negó a correr sobre «${nombre}»: solo bases *_test`);
  const ultima = await db.planVersion.findFirst({ orderBy: { version: "desc" } });
  if (ultima && ultima.vigenteDesde >= base) base = sumarDias(ultima.vigenteDesde, 1);
  if (d(ULTIMO_DIA) >= HOY) throw new Error("La base de pruebas tiene versiones del plan demasiado recientes para medir 90 días: reiníciela.");
  duenoId = (await db.usuario.create({ data: { email, rol: "DUENO" } })).id;
  // P: compra 1.237 el día 0; compra 311 el día 43 y vende 97 el día 44 (después de la ex del 41 y antes del pago del 48);
  // Trii paga 4.613,27 netos el día 48.
  await cargarTrii(`ordenes-fecha-ex-${corrida}.ficticio.csv`, ORD + [orden(d(0), "Compra", 1237, "12.37"), orden(d(43), "Compra", 311, "14.13"), orden(d(44), "Venta", 97, "14.19")].join("\n") + "\n");
  await cargarTrii(`dividendos-fecha-ex-${corrida}.ficticio.csv`, `${DIV}${iso(d(48))},${NEMO.p},,4613.27\n`);
  ids.p = (await db.instrumento.findUniqueOrThrow({ where: { nemotecnico: NEMO.p } })).id;
  ids.q = (await db.instrumento.create({ data: { tipo: "ACCION", nemotecnico: NEMO.q, nombre: "Acción ficticia Q de la fecha ex" } })).id;
  // v1 de la cuota 1 con ex el 45 (divisor 1.451 si se leyera) y la cuota 2 con pago el 51 (si se leyera, disputaría el
  // pago del 48); Q tiene su decreto, que no es de P.
  await registrarDecretos([
    decreto(NEMO.p, 1, "3.917311", d(45), d(48)),
    decreto(NEMO.p, 2, "1.371937", d(46), d(51)),
    decreto(NEMO.q, 1, "2.613719", d(41), d(48)),
  ]);
  // La corrección (v2, ex el 41, retira a la v1) y la anulación de la cuota 2 (versión anulada).
  await registrarDecretos([decreto(NEMO.p, 1, "3.917311", d(41), d(48)), decreto(NEMO.p, 2, "1.371937", d(46), d(51), "SI", "anulado en la prueba")]);
  await crearVersionPlan(db, {
    vigenteDesde: d(0), motivo: "Plan ficticio de la fecha ex", autorId: duenoId,
    reglas: [{ instrumentoId: ids.p, condicion: "NINGUNA", nivel: null, accion: "NO_ACTUAR", cantidad: 311n, plazoHasta: null, detalle: "Mantener P, ficticia" }],
  }, { hoy: HOY });
  await db.precioCierre.createMany({
    data: ([[5, "13.71"], [35, "14.37"], [73, "13.97"], [95, "14.61"]] as const).map(([dia, precio]) => ({ instrumentoId: ids.p, fecha: d(dia), precio: new Prisma.Decimal(precio), fuente: "yahoo", estado: "NO_VERIFICADO" as const })),
  });
  decisiones.noActuar = await decidir(d(5), "NO_ACTUAR", 311n);
  decisiones.comprar = await decidir(d(43), "COMPRAR", null);
  const compra = await db.orden.findFirstOrThrow({ where: { instrumentoId: ids.p, lado: "COMPRA", fechaOperacion: d(43) } });
  await db.enlaceDecisionOrden.create({ data: { ordenId: compra.id, decisionId: decisiones.comprar, creadoPorId: duenoId } });
});

afterAll(async () => {
  await db.$disconnect();
});

describe("decretos que cuentan · lectura de sus fechas", () => {
  it("de cada especie, solo la versión vigente y no anulada (la v1 corregida y la anulada no salen)", async () => {
    expect(await leerFechasDeDecretos(db, new Map([[ids.p, { desde: d(0), hasta: d(95) }]]))).toEqual([{ instrumentoId: ids.p, fechaEx: d(41), fechaPago: d(48) }]);
    expect(await leerFechasDeDecretos(db, new Map([[ids.q, { desde: d(0), hasta: d(95) }]]))).toEqual([{ instrumentoId: ids.q, fechaEx: d(41), fechaPago: d(48) }]);
  });

  it("el rango de las fechas de pago es el de la ventana del cruce: 10 días antes y 3 después de los pagos", async () => {
    const leer = (desde: number, hasta: number) => leerFechasDeDecretos(db, new Map([[ids.p, { desde: d(desde), hasta: d(hasta) }]]));
    expect(await leer(0, 44)).toEqual([]);
    expect(await leer(0, 45)).toHaveLength(1);
    expect(await leer(58, 60)).toHaveLength(1);
    expect(await leer(59, 60)).toEqual([]);
  });
});

describe("el resultado de las decisiones con la fecha ex del decreto", () => {
  it("«no actuar» antes de la ex: el pago se mide con la tenencia antes de la ex, aunque la tenencia cambie antes del pago", async () => {
    const r = (await resultadosDeDecisiones(db, [decisiones.noActuar], HOY)).get(decisiones.noActuar)!;
    // 30 días: sin pagos en la ventana; 311 × (14,37 − 13,71) = 205,26 de precio.
    expect(r.d30).toMatchObject({ estado: "CALCULADO", incluyeDividendos: true, motivoSinDividendos: null });
    expect([r.d30.resultadoPrecio?.toString(), r.d30.dividendosPesos?.toString()]).toEqual(["205.26", "0"]);
    // 90 días: 4.613,27 netos sobre las 1.237 que había antes de la ex del 41 → 311 acciones: 1.159,844. Sin el decreto,
    // la compra del 43 y la venta del 44 dejarían el tramo sin dividendos (TENENCIA_CAMBIA_CERCA_DEL_PAGO).
    expect(r.d90).toMatchObject({ estado: "CALCULADO", incluyeDividendos: true, motivoSinDividendos: null, veredicto: "FUNCIONO" });
    expect([r.d90.resultadoPrecio?.toString(), r.d90.dividendosPesos?.toString(), r.d90.resultadoPesos?.toString()]).toEqual(["279.9", "1159.844", "1439.744"]);
    const tramo = r.d90.tramos[0]!;
    expect(tramo.dividendos?.medible && tramo.dividendos.atribuidos.map((a) => [a.tenencia, a.porAccion.toString()])).toEqual([[1237n, "3.729402"]]);
  });

  it("comprar después de la ex: el pago no le toca a la compra (dividendos en 0, medibles)", async () => {
    const r = (await resultadosDeDecisiones(db, [decisiones.comprar], HOY)).get(decisiones.comprar)!;
    // 311 × 13,97 − 4.394,43 = −49,76 de precio; el pago del 48 era de quien tenía antes de la ex del 41.
    expect(r.d30).toMatchObject({ estado: "CALCULADO", incluyeDividendos: true, motivoSinDividendos: null, veredicto: "NO_FUNCIONO" });
    expect([r.d30.resultadoPrecio?.toString(), r.d30.dividendosPesos?.toString()]).toEqual(["-49.76", "0"]);
  });

  it("el lote da lo mismo que cada decisión sola", async () => {
    const todas = Object.values(decisiones);
    const lote = await resultadosDeDecisiones(db, todas, HOY);
    for (const id of todas) expect(lote.get(id)).toEqual(await resultadoDeDecision(db, id, HOY));
  });
});
