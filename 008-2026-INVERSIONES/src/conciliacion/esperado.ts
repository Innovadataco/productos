/**
 * Lo que calcula el sistema A LA FECHA DE CORTE de una certificación (nunca «a hoy»), para conciliarlo:
 * - cantidades por especie desde las órdenes aprobadas de Trii (no desde AsignacionVenta: no depende de que se
 *   hayan construido los lotes) más los lotes de escisión; por liquidación y por operación (T+2);
 * - el cierre vigente del día EXACTO del corte (Yahoo primero) y el del día hábil anterior según calendario_bvc (solo
 *   para ver si la certificación es la foto de ese día: nunca se valora con él);
 * - las unidades del fondo (MovimientoFondo) y su valor de unidad de la SFC del día del corte;
 * - la caja: depósitos − retiros aprobados, ventas − compras por `totalEstimado`, dividendos netos y ajustes (entre
 *   ellos, los rendimientos del fondo pagados en efectivo, RENDIMIENTO_FIC; su retención no es caja);
 * - cuántos rendimientos de los fondos certificados están registrados hasta el corte, y el último día.
 * Solo lectura, con `select` explícito: nunca se lee el encargo ni el crudo.
 */
import { Prisma, type LadoOrden, type TipoMovimientoCaja } from "@prisma/client";
import { leerCalendarioCorte, ultimoHabilAnterior } from "../importacion/av/fecha-corte";
import type { EntradasConciliacion, EspecieEntrada, FondoEntrada, RendimientosFicEntrada } from "./controles";

type Lector = Prisma.TransactionClient;
const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);

/** Órdenes aprobadas con acciones operadas hasta el corte: se leen una sola vez para cantidades y caja. */
export interface OrdenAlCorte {
  readonly instrumentoId: string;
  readonly lado: LadoOrden;
  readonly cantidadCompletada: bigint;
  readonly fechaOperacion: Date;
  readonly fechaLiquidacion: Date;
  readonly totalEstimado: Prisma.Decimal;
}

export const ordenesAlCorte = (db: Lector, corte: Date): Promise<OrdenAlCorte[]> =>
  db.orden.findMany({
    where: { estado: "APROBADO", cantidadCompletada: { gt: 0n }, fechaOperacion: { lte: corte } },
    select: { instrumentoId: true, lado: true, cantidadCompletada: true, fechaOperacion: true, fechaLiquidacion: true, totalEstimado: true },
  });

interface Movimiento {
  readonly instrumentoId: string;
  readonly cantidad: bigint;
  readonly opera: Date;
  readonly liquida: Date;
}

async function movimientosDeAcciones(db: Lector, corte: Date, ordenes: readonly OrdenAlCorte[]): Promise<Movimiento[]> {
  const lotes = await db.lote.findMany({ where: { origen: "ESCISION", fechaCompra: { lte: corte } }, select: { instrumentoId: true, cantidad: true, fechaCompra: true, fechaLiquidacion: true } });
  return [
    ...ordenes.map((o) => ({ instrumentoId: o.instrumentoId, cantidad: o.lado === "COMPRA" ? o.cantidadCompletada : -o.cantidadCompletada, opera: o.fechaOperacion, liquida: o.fechaLiquidacion })),
    ...lotes.map((l) => ({ instrumentoId: l.instrumentoId, cantidad: l.cantidad, opera: l.fechaCompra, liquida: l.fechaLiquidacion })),
  ];
}

/** Destinos de una escisión (hasta el corte) que no tienen su lote registrado. */
async function destinosSinLote(db: Lector, corte: Date): Promise<Set<string>> {
  const eventos = await db.eventoCorporativo.findMany({ where: { fecha: { lte: corte } }, select: { destinoId: true, _count: { select: { lotes: true } } } });
  return new Set(eventos.filter((e) => e._count.lotes === 0).map((e) => e.destinoId));
}

const YAHOO = "yahoo";

interface CierreVigente {
  readonly fuente: string;
  readonly traidoEn: Date;
}

/**
 * Orden total entre los cierres vigentes de un mismo día: Yahoo primero; luego el traído más recientemente; con el
 * mismo `traidoEn`, la fuente en orden alfabético (la base deja un solo vigente por fuente). Así el elegido nunca
 * depende del orden en que la base devuelve las filas. Se exporta para que la pantalla diga la procedencia del MISMO
 * cierre (src/app/conciliacion/procedencias.ts, frente fecha-hora-datos).
 */
export const primeroElegido = (a: CierreVigente, b: CierreVigente): number =>
  Number(b.fuente === YAHOO) - Number(a.fuente === YAHOO) || b.traidoEn.getTime() - a.traidoEn.getTime() || (a.fuente < b.fuente ? -1 : a.fuente > b.fuente ? 1 : 0);

/** Cierre vigente de ese día exacto, por especie: Yahoo si hay; si no, el de otra fuente más reciente. */
export async function cierresDelDia(db: Lector, fecha: Date, ids: readonly string[]): Promise<Map<string, string>> {
  const filas = await db.precioCierre.findMany({
    where: { instrumentoId: { in: [...ids] }, fecha, reemplazadoEn: null },
    select: { instrumentoId: true, precio: true, fuente: true, traidoEn: true },
  });
  const porEspecie = new Map<string, string>();
  for (const f of [...filas].sort(primeroElegido)) {
    if (!porEspecie.has(f.instrumentoId)) porEspecie.set(f.instrumentoId, f.precio.toString());
  }
  return porEspecie;
}

/** `anterior`: el día hábil anterior al corte (sus cierres van en `cierreAnterior`); null no lo lee. */
export async function especiesAlCorte(
  db: Lector, corte: Date, certificadas: ReadonlyMap<string, EspecieEntrada["certificada"]>, ordenes: readonly OrdenAlCorte[], anterior: Date | null = null,
): Promise<EspecieEntrada[]> {
  const movimientos = await movimientosDeAcciones(db, corte, ordenes);
  const sinLote = await destinosSinLote(db, corte);
  const suma = new Map<string, { liquidada: bigint; operada: bigint; pendientes: number }>();
  for (const m of movimientos) {
    const s = suma.get(m.instrumentoId) ?? { liquidada: 0n, operada: 0n, pendientes: 0 };
    const liquidada = m.liquida <= corte;
    suma.set(m.instrumentoId, { liquidada: s.liquidada + (liquidada ? m.cantidad : 0n), operada: s.operada + m.cantidad, pendientes: s.pendientes + (liquidada ? 0 : 1) });
  }
  const ids = [...new Set([...certificadas.keys(), ...[...suma].filter(([, s]) => s.liquidada !== 0n || s.operada !== 0n).map(([id]) => id)])].sort();
  const cierres = await cierresDelDia(db, corte, ids);
  const anteriores = anterior === null ? new Map<string, string>() : await cierresDelDia(db, anterior, ids);
  return ids.map((id) => {
    const s = suma.get(id) ?? { liquidada: 0n, operada: 0n, pendientes: 0 };
    return { instrumentoId: id, certificada: certificadas.get(id) ?? null, ...s, cierre: cierres.get(id) ?? null, cierreAnterior: anteriores.get(id) ?? null, escisionSinLote: sinLote.has(id) };
  });
}

const signoFondo = (tipo: string) => (tipo === "RETIRO" ? -1 : 1);

export async function fondosAlCorte(db: Lector, corte: Date, certificados: readonly { instrumentoId: string; saldo: Prisma.Decimal }[]): Promise<FondoEntrada[]> {
  return Promise.all(
    certificados.map(async (f) => {
      const [movs, vu] = await Promise.all([
        db.movimientoFondo.findMany({ where: { fondoId: f.instrumentoId, fecha: { lte: corte } }, select: { unidades: true, tipo: true } }),
        db.valorUnidadFondo.findFirst({ where: { fondoId: f.instrumentoId, fechaValor: corte, reemplazadoEn: null }, select: { valorUnidad: true } }),
      ]);
      const unidades = movs.length === 0 ? null : movs.reduce((s, m) => s.add(m.unidades.mul(signoFondo(m.tipo))), D(0)).toString();
      return { instrumentoId: f.instrumentoId, saldoCertificado: f.saldo.toString(), unidades, valorUnidad: vu?.valorUnidad.toString() ?? null };
    }),
  );
}

/**
 * La caja de la cuenta al corte. `aporteFondoRegistrado`: cada fondo certificado tiene su aporte registrado (un
 * MovimientoFondo hasta el corte enlazado a su AjusteCaja), que es lo que el CSV de Trii no trae.
 */
/** Depósito suma y retiro resta; un tipo nuevo en el enum no compila aquí hasta decidir su signo. */
function signoCaja(tipo: TipoMovimientoCaja): 1 | -1 {
  switch (tipo) {
    case "DEPOSITO":
      return 1;
    case "RETIRO":
      return -1;
  }
}

export async function cajaAlCorte(
  db: Lector, corte: Date, fondos: readonly string[], ordenes: readonly OrdenAlCorte[],
): Promise<{ liquidado: string; operado: string; aporteFondoRegistrado: boolean }> {
  const [caja, dividendos, ajustes, conAporte] = await Promise.all([
    db.movimientoCaja.findMany({ where: { estado: "APROBADO", fecha: { lte: corte } }, select: { tipo: true, monto: true } }),
    db.dividendo.aggregate({ where: { fechaPago: { lte: corte } }, _sum: { montoNeto: true } }),
    db.ajusteCaja.aggregate({ where: { fecha: { lte: corte } }, _sum: { monto: true } }),
    db.movimientoFondo.groupBy({ by: ["fondoId"], where: { fondoId: { in: [...fondos] }, fecha: { lte: corte }, ajusteCajaId: { not: null } } }),
  ]);
  const fijo = caja.reduce((s, m) => s.add(m.monto.mul(signoCaja(m.tipo))), D(0)).add(dividendos._sum.montoNeto ?? 0).add(ajustes._sum.monto ?? 0);
  const neto = (o: { lado: string; totalEstimado: Prisma.Decimal }) => (o.lado === "VENTA" ? o.totalEstimado : o.totalEstimado.neg());
  const operado = ordenes.reduce((s, o) => s.add(neto(o)), fijo);
  const liquidado = ordenes.filter((o) => o.fechaLiquidacion <= corte).reduce((s, o) => s.add(neto(o)), fijo);
  return { liquidado: liquidado.toString(), operado: operado.toString(), aporteFondoRegistrado: conAporte.length === new Set(fondos).size };
}

/**
 * Los RENDIMIENTO (pagados en efectivo) de esos fondos con fecha ≤ corte: cuántos y el último día. Lo sirve el único
 * rendimiento_fondo (fondoId, fecha, tipo) (database-reviewer): no se quita ni se reordena sin revisar esta consulta.
 */
export async function rendimientosFicAlCorte(db: Lector, corte: Date, fondos: readonly string[]): Promise<RendimientosFicEntrada> {
  const r = await db.rendimientoFondo.aggregate({
    where: { fondoId: { in: [...fondos] }, tipo: "RENDIMIENTO", fecha: { lte: corte } },
    _count: { _all: true },
    _max: { fecha: true },
  });
  return { cantidad: r._count._all, ultimo: r._max.fecha === null ? null : r._max.fecha.toISOString().slice(0, 10) };
}

/** Todo lo que necesita `calcularConciliacion` para una certificación. */
export async function leerEntradas(db: Lector, certificacionId: string): Promise<{ fechaCorte: Date; entradas: EntradasConciliacion }> {
  const cert = await db.certificacion.findUniqueOrThrow({
    where: { id: certificacionId },
    select: {
      fechaCorte: true, saldoEfectivo: true,
      posiciones: { select: { instrumentoId: true, cantidad: true, precioValoracion: true, valorMercado: true } },
      fondos: { select: { instrumentoId: true, saldo: true } },
    },
  });
  const corte = cert.fechaCorte;
  const certificadas = new Map(cert.posiciones.map((p) => [p.instrumentoId, { cantidad: p.cantidad, precioValoracion: p.precioValoracion.toString(), valorMercado: p.valorMercado.toString() }]));
  const ordenes = await ordenesAlCorte(db, corte);
  const ultimo = ultimoHabilAnterior(corte, await leerCalendarioCorte(db));
  const diaAnterior = ultimo.ok ? ultimo.dia : null;
  const especies = await especiesAlCorte(db, corte, certificadas, ordenes, diaAnterior === null ? null : new Date(`${diaAnterior}T00:00:00Z`));
  const fondos = await fondosAlCorte(db, corte, cert.fondos);
  const idsFondos = cert.fondos.map((f) => f.instrumentoId);
  const caja = await cajaAlCorte(db, corte, idsFondos, ordenes);
  const rendimientosFic = await rendimientosFicAlCorte(db, corte, idsFondos);
  const efectivo = { certificado: cert.saldoEfectivo.toString(), ...caja, hayFondo: cert.fondos.length > 0, rendimientosFic };
  return { fechaCorte: corte, entradas: { especies, fondos, efectivo, diaAnterior } };
}
