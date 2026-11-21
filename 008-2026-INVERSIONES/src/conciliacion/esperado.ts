/**
 * Lo que calcula el sistema A LA FECHA DE CORTE de una certificación (nunca «a hoy»), para conciliarlo:
 * - cantidades por especie desde las órdenes aprobadas de Trii (no desde AsignacionVenta: no depende de que se
 *   hayan construido los lotes) más los lotes de escisión; por liquidación y por operación (T+2);
 * - el cierre vigente del día EXACTO del corte (Yahoo primero);
 * - las unidades del fondo (MovimientoFondo) y su valor de unidad de la SFC del día del corte;
 * - la caja: depósitos − retiros aprobados, ventas − compras por `totalEstimado`, dividendos netos y ajustes.
 * Solo lectura, con `select` explícito: nunca se lee el encargo ni el crudo.
 */
import { Prisma } from "@prisma/client";
import type { EntradasConciliacion, EspecieEntrada, FondoEntrada } from "./controles";

type Lector = Prisma.TransactionClient;
const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);

interface Movimiento {
  readonly instrumentoId: string;
  readonly cantidad: bigint;
  readonly opera: Date;
  readonly liquida: Date;
}

async function movimientosDeAcciones(db: Lector, corte: Date): Promise<Movimiento[]> {
  const [ordenes, lotes] = await Promise.all([
    db.orden.findMany({
      where: { estado: "APROBADO", cantidadCompletada: { gt: 0n }, fechaOperacion: { lte: corte } },
      select: { instrumentoId: true, lado: true, cantidadCompletada: true, fechaOperacion: true, fechaLiquidacion: true },
    }),
    db.lote.findMany({ where: { origen: "ESCISION", fechaCompra: { lte: corte } }, select: { instrumentoId: true, cantidad: true, fechaCompra: true, fechaLiquidacion: true } }),
  ]);
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

/** Cierre vigente del día exacto: Yahoo si hay; si no, el de otra fuente más reciente. */
async function cierresDelCorte(db: Lector, corte: Date, ids: readonly string[]): Promise<Map<string, string>> {
  const filas = await db.precioCierre.findMany({
    where: { instrumentoId: { in: [...ids] }, fecha: corte, reemplazadoEn: null },
    select: { instrumentoId: true, precio: true, fuente: true, traidoEn: true },
    orderBy: { traidoEn: "desc" },
  });
  const porEspecie = new Map<string, string>();
  for (const f of [...filas].sort((a, b) => Number(b.fuente === "yahoo") - Number(a.fuente === "yahoo"))) {
    if (!porEspecie.has(f.instrumentoId)) porEspecie.set(f.instrumentoId, f.precio.toString());
  }
  return porEspecie;
}

export async function especiesAlCorte(db: Lector, corte: Date, certificadas: ReadonlyMap<string, EspecieEntrada["certificada"]>): Promise<EspecieEntrada[]> {
  const [movimientos, sinLote] = await Promise.all([movimientosDeAcciones(db, corte), destinosSinLote(db, corte)]);
  const suma = new Map<string, { liquidada: bigint; operada: bigint; pendientes: number }>();
  for (const m of movimientos) {
    const s = suma.get(m.instrumentoId) ?? { liquidada: 0n, operada: 0n, pendientes: 0 };
    const liquidada = m.liquida <= corte;
    suma.set(m.instrumentoId, { liquidada: s.liquidada + (liquidada ? m.cantidad : 0n), operada: s.operada + m.cantidad, pendientes: s.pendientes + (liquidada ? 0 : 1) });
  }
  const ids = [...new Set([...certificadas.keys(), ...[...suma].filter(([, s]) => s.liquidada !== 0n || s.operada !== 0n).map(([id]) => id)])].sort();
  const cierres = await cierresDelCorte(db, corte, ids);
  return ids.map((id) => {
    const s = suma.get(id) ?? { liquidada: 0n, operada: 0n, pendientes: 0 };
    return { instrumentoId: id, certificada: certificadas.get(id) ?? null, ...s, cierre: cierres.get(id) ?? null, escisionSinLote: sinLote.has(id) };
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
export async function cajaAlCorte(db: Lector, corte: Date, fondos: readonly string[]): Promise<{ liquidado: string; operado: string; aporteFondoRegistrado: boolean }> {
  const [caja, ordenes, dividendos, ajustes, conAporte] = await Promise.all([
    db.movimientoCaja.findMany({ where: { estado: "APROBADO", fecha: { lte: corte } }, select: { tipo: true, monto: true } }),
    db.orden.findMany({ where: { estado: "APROBADO", cantidadCompletada: { gt: 0n }, fechaOperacion: { lte: corte } }, select: { lado: true, totalEstimado: true, fechaLiquidacion: true } }),
    db.dividendo.aggregate({ where: { fechaPago: { lte: corte } }, _sum: { montoNeto: true } }),
    db.ajusteCaja.aggregate({ where: { fecha: { lte: corte } }, _sum: { monto: true } }),
    db.movimientoFondo.groupBy({ by: ["fondoId"], where: { fondoId: { in: [...fondos] }, fecha: { lte: corte }, ajusteCajaId: { not: null } } }),
  ]);
  const fijo = caja.reduce((s, m) => s.add(m.tipo === "DEPOSITO" ? m.monto : m.monto.neg()), D(0)).add(dividendos._sum.montoNeto ?? 0).add(ajustes._sum.monto ?? 0);
  const neto = (o: { lado: string; totalEstimado: Prisma.Decimal }) => (o.lado === "VENTA" ? o.totalEstimado : o.totalEstimado.neg());
  const operado = ordenes.reduce((s, o) => s.add(neto(o)), fijo);
  const liquidado = ordenes.filter((o) => o.fechaLiquidacion <= corte).reduce((s, o) => s.add(neto(o)), fijo);
  return { liquidado: liquidado.toString(), operado: operado.toString(), aporteFondoRegistrado: conAporte.length === new Set(fondos).size };
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
  const [especies, fondos, caja] = await Promise.all([especiesAlCorte(db, corte, certificadas), fondosAlCorte(db, corte, cert.fondos), cajaAlCorte(db, corte, cert.fondos.map((f) => f.instrumentoId))]);
  return { fechaCorte: corte, entradas: { especies, fondos, efectivo: { certificado: cert.saldoEfectivo.toString(), ...caja, hayFondo: cert.fondos.length > 0 } } };
}
