/**
 * Evolución diaria del portafolio en acciones y TWR v1 (frente graficas-tablero). Cálculo puro y en Decimal: las
 * cifras de las gráficas salen de aquí y el último punto cuadra con el tablero por construcción.
 *
 * Universo: las especies «completas» del tablero (sin ventas que sus lotes no cubran) que tienen al menos un cierre;
 * las que no tienen ninguno no entran (ni valor, ni costo, ni flujos) y se informan por su nemotécnico.
 * Días: los de cierre del universo hasta la referencia del tablero. Un día es punto si:
 *   - ya hubo tenencia (antes de la primera no hay serie);
 *   - toda especie tenida tiene un cierre ese día o antes (se arrastra el último, como el tablero); si a alguna le
 *     falta, el día no se grafica y se cuenta en `omitidos`;
 *   - alguna especie tenida cerró ese día (si ninguna, no hay información nueva y no se cuenta).
 *   Sin nada en la mano (después de vender todo), el día es punto con valor 0.
 * Por punto: valor = Σ cantidad × último cierre; costo = el de lo que tiene (lotes menos el costo FIFO vendido; un
 * lote agotado no aporta, como en src/lotes/posiciones.ts); `atrasadas` = especies valoradas con un cierre anterior.
 *
 * TWR «twr-acciones-v1» (solo acciones: sin caja ni fondo, así que no es la cifra de la cuenta de Trii):
 *   r = (V_i + ventas_i + dividendos_i) / (V_{i−1} + compras_i) − 1, con los flujos de (d_{i−1}, d_i].
 *   Las compras entran al inicio del día (la orden del lote, con su comisión); las ventas (su ingreso neto) y los
 *   dividendos y fracciones de escisión (por fecha de pago) salen al cierre. Un lote de escisión no tiene flujo.
 *   Si el denominador es 0 (sin capital ni compras), el periodo rinde 0. El primer punto vale 0.
 */
import { Prisma } from "@prisma/client";

type Decimal = Prisma.Decimal;
const D = (v: Prisma.Decimal.Value): Decimal => new Prisma.Decimal(v);
const CERO = D(0);
const UNO = D(1);

export const METODO_TWR = "twr-acciones-v1";
/** Rangos de la evolución, contados hacia atrás desde el último punto (en meses de calendario; Todo = desde el inicio). */
export const RANGOS = [["1M", 1], ["3M", 3], ["6M", 6], ["1A", 12], ["TODO", null]] as const;
export type ClaveRango = (typeof RANGOS)[number][0];

export interface EspecieEvolucion { readonly id: string; readonly nemo: string }
export interface LoteEvolucion {
  readonly id: string;
  readonly instrumentoId: string;
  readonly fecha: Date;
  readonly cantidad: bigint;
  readonly costoTotal: Decimal;
  /** Lo que salió de caja: el total estimado de la orden de compra (con comisión). null en un lote de escisión. */
  readonly flujo: Decimal | null;
}
export interface AsignacionEvolucion { readonly loteId: string; readonly cantidad: bigint; readonly costoBase: Decimal }
export interface VentaEvolucion {
  readonly instrumentoId: string;
  readonly fecha: Date;
  /** El total estimado de la orden de venta (ingreso menos comisión). */
  readonly ingreso: Decimal;
  readonly asignaciones: readonly AsignacionEvolucion[];
}
export interface DividendoEvolucion { readonly instrumentoId: string; readonly fecha: Date; readonly monto: Decimal }
/** Un cierre por especie y día (src/tablero/cierres.ts). */
export interface CierreEvolucion { readonly instrumentoId: string; readonly fecha: Date; readonly precio: Decimal }

export interface EntradasEvolucion {
  readonly especies: readonly EspecieEvolucion[];
  readonly lotes: readonly LoteEvolucion[];
  readonly ventas: readonly VentaEvolucion[];
  readonly dividendos: readonly DividendoEvolucion[];
  readonly cierres: readonly CierreEvolucion[];
  /** La fecha de referencia del tablero (cierre más reciente entre las vivas); null = sin cierres. */
  readonly referencia: Date | null;
}

export interface PuntoEvolucion {
  readonly fecha: Date;
  readonly valor: Decimal;
  readonly costo: Decimal;
  /** TWR acumulada desde el primer punto, como fracción (0,0123 = 1,23 %). */
  readonly twr: Decimal;
  readonly atrasadas: number;
}

export interface RangoEvolucion {
  readonly clave: ClaveRango;
  /** Índice del primer punto del rango y su fecha. */
  readonly inicio: number;
  readonly desde: Date;
  /** ¿La historia alcanza toda la ventana pedida? (Todo siempre.) */
  readonly cubre: boolean;
  /** TWR del rango: la del último punto sobre la de su primer punto. */
  readonly twr: Decimal;
}

export interface Evolucion {
  readonly metodo: string;
  readonly puntos: readonly PuntoEvolucion[];
  readonly rangos: readonly RangoEvolucion[];
  readonly omitidos: number;
  readonly sinCierre: readonly string[];
}

/** Resta meses de calendario y ajusta el día al último del mes si no existe (31-mar − 1 = 28-feb). */
export function restarMeses(d: Date, meses: number): Date {
  const anio = d.getUTCFullYear();
  const mes = d.getUTCMonth() - meses;
  const ultimo = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  return new Date(Date.UTC(anio, mes, Math.min(d.getUTCDate(), ultimo)));
}

type Evento =
  | { readonly tipo: 0; readonly t: number; readonly lote: LoteEvolucion }
  | { readonly tipo: 1; readonly t: number; readonly venta: VentaEvolucion }
  | { readonly tipo: 2; readonly t: number; readonly monto: Decimal };

/** Lotes, ventas y dividendos del universo por fecha; el mismo día, primero los lotes y al final los dividendos. */
function eventosDe(e: EntradasEvolucion, universo: ReadonlySet<string>): Evento[] {
  const en = (x: { readonly instrumentoId: string }) => universo.has(x.instrumentoId);
  const todos: Evento[] = [
    ...e.lotes.filter(en).map((lote): Evento => ({ tipo: 0, t: lote.fecha.getTime(), lote })),
    ...e.ventas.filter(en).map((venta): Evento => ({ tipo: 1, t: venta.fecha.getTime(), venta })),
    ...e.dividendos.filter(en).map((d): Evento => ({ tipo: 2, t: d.fecha.getTime(), monto: d.monto })),
  ];
  return todos.sort((a, b) => a.t - b.t || a.tipo - b.tipo);
}

interface Flujos { readonly compras: Decimal; readonly ventas: Decimal; readonly dividendos: Decimal }
const SIN_FLUJOS: Flujos = { compras: CERO, ventas: CERO, dividendos: CERO };

interface EstadoLote { readonly instrumentoId: string; restante: bigint; costo: Decimal }

/** Lo que se tiene día a día: aplica los eventos en orden y junta los flujos hasta que se toman. Estado local. */
function nuevaCartera(eventos: readonly Evento[]) {
  const lotes = new Map<string, EstadoLote>();
  let siguiente = 0;
  let flujos = SIN_FLUJOS;
  const vender = (v: VentaEvolucion) => {
    for (const a of v.asignaciones) {
      const l = lotes.get(a.loteId);
      if (!l) throw new Error("Evolución: una venta asignada a un lote que no existe a esa fecha.");
      l.restante -= a.cantidad;
      l.costo = l.costo.sub(a.costoBase);
    }
    flujos = { ...flujos, ventas: flujos.ventas.add(v.ingreso) };
  };
  const aplicar = (ev: Evento) => {
    if (ev.tipo === 0) {
      lotes.set(ev.lote.id, { instrumentoId: ev.lote.instrumentoId, restante: ev.lote.cantidad, costo: ev.lote.costoTotal });
      flujos = { ...flujos, compras: flujos.compras.add(ev.lote.flujo ?? CERO) };
    } else if (ev.tipo === 1) vender(ev.venta);
    else flujos = { ...flujos, dividendos: flujos.dividendos.add(ev.monto) };
  };
  return {
    aplicarHasta(t: number): void {
      while (siguiente < eventos.length && eventos[siguiente]!.t <= t) aplicar(eventos[siguiente++]!);
    },
    tomarFlujos(): Flujos {
      const f = flujos;
      flujos = SIN_FLUJOS;
      return f;
    },
    tenidas(): Map<string, bigint> {
      const m = new Map<string, bigint>();
      for (const l of lotes.values()) if (l.restante > 0n) m.set(l.instrumentoId, (m.get(l.instrumentoId) ?? 0n) + l.restante);
      return m;
    },
    costo(): Decimal {
      return [...lotes.values()].reduce((s, l) => (l.restante > 0n ? s.add(l.costo) : s), CERO);
    },
  };
}

interface CierreT { readonly t: number; readonly precio: Decimal }

/** Último cierre de cada especie a cada día, con punteros que solo avanzan (los días van en orden). */
function nuevosPrecios(porEspecie: ReadonlyMap<string, readonly CierreT[]>) {
  const indice = new Map<string, number>();
  return {
    ultimo(id: string, t: number): CierreT | null {
      const serie = porEspecie.get(id) ?? [];
      let k = indice.get(id) ?? -1;
      while (k + 1 < serie.length && serie[k + 1]!.t <= t) k += 1;
      indice.set(id, k);
      return k >= 0 ? serie[k]! : null;
    },
  };
}

interface Valoracion { readonly valor: Decimal; readonly completa: boolean; readonly cierraHoy: boolean; readonly atrasadas: number }

function valorar(tenidas: ReadonlyMap<string, bigint>, precios: ReturnType<typeof nuevosPrecios>, t: number): Valoracion {
  let valor = CERO;
  let atrasadas = 0;
  let cierraHoy = false;
  for (const [id, cantidad] of tenidas) {
    const c = precios.ultimo(id, t);
    if (!c) return { valor: CERO, completa: false, cierraHoy: false, atrasadas: 0 };
    valor = valor.add(c.precio.mul(cantidad.toString()));
    if (c.t === t) cierraHoy = true;
    else atrasadas += 1;
  }
  return { valor, completa: true, cierraHoy, atrasadas };
}

/** Factor (1 + r) del periodo; sin capital ni compras, 1. */
function factorDelPeriodo(previo: Decimal, valor: Decimal, f: Flujos): Decimal {
  const denominador = previo.add(f.compras);
  return denominador.isZero() ? UNO : valor.add(f.ventas).add(f.dividendos).div(denominador);
}

function cierresDelUniverso(cierres: readonly CierreEvolucion[], universo: ReadonlySet<string>, ref: number): Map<string, CierreT[]> {
  const m = new Map<string, CierreT[]>();
  for (const c of cierres) {
    if (!universo.has(c.instrumentoId) || c.fecha.getTime() > ref) continue;
    const lista = m.get(c.instrumentoId);
    const cierre = { t: c.fecha.getTime(), precio: c.precio };
    if (lista) lista.push(cierre);
    else m.set(c.instrumentoId, [cierre]);
  }
  for (const serie of m.values()) serie.sort((a, b) => a.t - b.t);
  return m;
}

function serie(e: EntradasEvolucion, universo: ReadonlySet<string>, ref: number): { readonly puntos: PuntoEvolucion[]; readonly omitidos: number } {
  const cierres = cierresDelUniverso(e.cierres, universo, ref);
  const dias = [...new Set([...cierres.values()].flatMap((s) => s.map((c) => c.t)))].sort((a, b) => a - b);
  const cartera = nuevaCartera(eventosDe(e, universo));
  const precios = nuevosPrecios(cierres);
  const puntos: PuntoEvolucion[] = [];
  let factor = UNO;
  let previo: Decimal | null = null;
  let omitidos = 0;
  for (const t of dias) {
    cartera.aplicarHasta(t);
    const tenidas = cartera.tenidas();
    const v = valorar(tenidas, precios, t);
    if (tenidas.size === 0 && previo === null) continue;
    if (tenidas.size > 0 && !v.completa) { omitidos += 1; continue; }
    if (tenidas.size > 0 && !v.cierraHoy) continue;
    const flujos = cartera.tomarFlujos();
    if (previo !== null) factor = factor.mul(factorDelPeriodo(previo, v.valor, flujos));
    puntos.push({ fecha: new Date(t), valor: v.valor, costo: cartera.costo(), twr: factor.sub(UNO), atrasadas: v.atrasadas });
    previo = v.valor;
  }
  return { puntos, omitidos };
}

function rangosDe(puntos: readonly PuntoEvolucion[]): RangoEvolucion[] {
  const ultimo = puntos[puntos.length - 1];
  if (!ultimo) return [];
  const primero = puntos[0]!;
  return RANGOS.map(([clave, meses]) => {
    const objetivo = meses === null ? primero.fecha : restarMeses(ultimo.fecha, meses);
    const inicio = puntos.findIndex((p) => p.fecha.getTime() >= objetivo.getTime());
    const p = puntos[inicio]!;
    return { clave, inicio, desde: p.fecha, cubre: primero.fecha.getTime() <= objetivo.getTime(), twr: ultimo.twr.add(UNO).div(p.twr.add(UNO)).sub(UNO) };
  });
}

export function calcularEvolucion(e: EntradasEvolucion): Evolucion {
  // Sin referencia (ninguna viva con cierre) no hay serie; «sin cierre» se cuenta entonces sobre todos los cierres.
  const ref = e.referencia?.getTime() ?? Number.POSITIVE_INFINITY;
  const conCierre = new Set(e.cierres.filter((c) => c.fecha.getTime() <= ref).map((c) => c.instrumentoId));
  const universo = new Set(e.especies.filter((s) => conCierre.has(s.id)).map((s) => s.id));
  const sinCierre = e.especies.filter((s) => !conCierre.has(s.id)).map((s) => s.nemo).sort();
  if (e.referencia === null) return { metodo: METODO_TWR, puntos: [], rangos: [], omitidos: 0, sinCierre };
  const { puntos, omitidos } = serie(e, universo, ref);
  return { metodo: METODO_TWR, puntos, rangos: rangosDe(puntos), omitidos, sinCierre };
}
