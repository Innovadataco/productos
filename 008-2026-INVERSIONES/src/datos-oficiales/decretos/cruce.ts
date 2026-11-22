/**
 * Cruce de los decretos con lo que pagó Trii (fase C, C5b). Puro: sin base ni reloj. Lo lee leer.ts; lo muestra C6b.
 * - Bruto esperado de un decreto = valor por acción × tenencia antes de la fecha ex: la de src/plan/tenencia.ts (por
 *   fecha de OPERACIÓN) al cierre del día anterior a la ex. La ex es la que publicó la fuente (no se calcula). Que la
 *   compra del día anterior a la ex reciba el dividendo es la regla del periodo ex tal como la toma 008: por verificar
 *   con la norma vigente y con los extractos (P12). Por eso el bruto es ESTIMADO.
 * - Se compara con los netos de Trii (dividendo.montoNeto, sin las FRACCION_ESCISION, que no son dividendos) que
 *   llegaron dentro de la ventana de pago. Los decretos de una especie con la misma fecha de pago forman un grupo, y
 *   cada pago va a un solo grupo (ventana.ts: el último que ya llegó a su fecha de pago). Si la ventana de un pago la
 *   comparten dos grupos, la asignación es una suposición: los dos quedan REVISAR (PAGO_EN_DISPUTA). El motor de
 *   proyecciones usa la misma asignación.
 * - Estados de un grupo: RECIBIDO; PENDIENTE (la ventana no ha pasado, las cargas de Trii no la cubren o ningún pago
 *   guardado es posterior a ella: sin eso no hay prueba de que el archivo cargado la cubra); NO_RECIBIDO (todo eso
 *   pasó); REVISAR, con sus motivos. Un pago sin grupo es SIN_DECRETO. Un grupo sin tenencia antes de la ex, sin pagos
 *   y con las cargas hasta la ex no esperaba nada: va en `sinTenencia`, sin estado.
 * - Dos decretos del grupo con el mismo tipo y cuota (otro anuncio) son un decreto repetido: REVISAR, porque el bruto
 *   saldría doble (la base no lo impide: su clave lleva la fecha de anuncio).
 * - Un grupo entra si su ex ya pasó (la menor de sus ex < hoy) o si tiene pagos; si no, es un próximo (proximos.ts,
 *   ex ≥ hoy). Un decreto con ex desde hoy sale en las dos listas solo si su grupo tiene un pago (adelantado) o mezcla
 *   ex pasadas y por venir; en ese grupo la tenencia de la ex por venir es la de hoy: su bruto es provisional.
 * - La diferencia se llama «diferencia bruto − neto»: no se le da otro nombre mientras el extracto no diga qué es. No
 *   hay umbral sobre ella (sería una tasa supuesta): solo un neto mayor que el bruto es REVISAR.
 * - Los montos se cuentan en millonésimas de peso (bigint): exactos, sin el redondeo a 20 dígitos de Decimal.
 * Informa; no recomienda comprar ni vender.
 */
import { Prisma, type TipoDividendo } from "@prisma/client";
import { sumarDias } from "../../plan/fechas";
import { tenenciaAntesDeLaEx, type MovimientoTenencia } from "../../plan/tenencia";
import {
  VENTANA_PAGO_ANTES_DIAS, VENTANA_PAGO_DESPUES_DIAS, agruparPorFechaDePago, asignarPagos, finVentana, type AsignacionDePagos, type GrupoDePago,
} from "./ventana";

export { asignarPagos };

/** Un decreto vigente y no anulado, con lo que el cruce necesita. */
export interface DecretoCruce {
  readonly id: string;
  readonly instrumentoId: string;
  readonly tipo: TipoDividendo;
  readonly cuota: number;
  /** A lo sumo 6 decimales (DECIMAL(20,6)). */
  readonly valorPorAccion: Prisma.Decimal;
  readonly fechaEx: Date;
  readonly fechaPago: Date;
}

/** Un pago de Trii (tabla dividendo): el neto por TODA la tenencia. */
export interface PagoTrii {
  readonly id: string;
  readonly instrumentoId: string;
  readonly fechaPago: Date;
  /** A lo sumo 6 decimales (DECIMAL(20,4)). */
  readonly montoNeto: Prisma.Decimal;
  readonly tipo: TipoDividendo;
}

export const ESTADOS_CRUCE = ["RECIBIDO", "PENDIENTE", "NO_RECIBIDO", "SIN_DECRETO", "REVISAR"] as const;
export type EstadoCruce = (typeof ESTADOS_CRUCE)[number];

/** Por qué un grupo es REVISAR; salen en este orden. */
export const MOTIVOS_REVISAR = [
  "DECRETO_REPETIDO", "TENENCIA_NEGATIVA", "PAGO_SIN_TENENCIA", "NETO_MAYOR_QUE_BRUTO", "PAGO_ANTES_DE_LA_EX", "PAGO_EN_DISPUTA", "CARGA_NO_CUBRE_LA_EX",
] as const;
export type MotivoRevisar = (typeof MOTIVOS_REVISAR)[number];

export interface DecretoCruzado {
  readonly decretoId: string;
  readonly tipo: TipoDividendo;
  readonly cuota: number;
  readonly fechaEx: Date;
  readonly valorPorAccion: Prisma.Decimal;
  /** Al cierre del día anterior a la ex, por operación. Negativa si faltan compras cargadas (se muestra, no se recorta). */
  readonly tenenciaAntesDeLaEx: bigint;
  /** valor por acción × tenencia antes de la ex: ESTIMADO (P12). */
  readonly bruto: Prisma.Decimal;
}

export interface FilaCruce {
  readonly estado: EstadoCruce;
  readonly instrumentoId: string;
  /** La de los decretos del grupo; en SIN_DECRETO, la del pago. */
  readonly fechaPago: Date;
  /** Vacío en SIN_DECRETO. */
  readonly decretos: readonly DecretoCruzado[];
  readonly pagos: readonly PagoTrii[];
  /** null en SIN_DECRETO. */
  readonly brutoEsperado: Prisma.Decimal | null;
  /** null sin pagos. */
  readonly netoRecibido: Prisma.Decimal | null;
  /** bruto − neto; null si falta alguno de los dos. */
  readonly diferenciaBrutoNeto: Prisma.Decimal | null;
  /** Solo en REVISAR. */
  readonly motivos: readonly MotivoRevisar[];
}

/** Un grupo que no esperaba nada: sin tenencia antes de la ex, sin pagos y con las cargas de Trii hasta la ex. */
export interface SinTenencia {
  readonly instrumentoId: string;
  readonly fechaPago: Date;
  readonly decretoIds: readonly string[];
}

export interface ResultadoCruce {
  readonly filas: readonly FilaCruce[];
  readonly sinTenencia: readonly SinTenencia[];
}

export interface EntradaCruce {
  readonly decretos: readonly DecretoCruce[];
  readonly pagos: readonly PagoTrii[];
  /** Movimientos de la tenencia por especie (órdenes aprobadas y lotes de escisión; src/plan/resultados-lote.ts). */
  readonly movimientos: ReadonlyMap<string, readonly MovimientoTenencia[]>;
  /** El día de la última carga de Trii de órdenes Y de dividendos, el menor de los dos; null si falta alguna. */
  readonly cubiertoHasta: Date | null;
  /** La fecha de la última fila de dividendos de Trii guardada (cualquier especie y tipo); null si no hay ninguna. */
  readonly ultimoPagoTrii: Date | null;
  /** Fecha de negocio en Colombia: lo posterior no cuenta. */
  readonly hoy: Date;
}

// ───────────── Montos exactos ─────────────

const ESCALA = 6;
const FACTOR = 10n ** BigInt(ESCALA);
/** Lo que se tolera por cada fila de pago de Trii al comparar el neto con el bruto: 1 peso (su redondeo, por verificar). */
export const TOLERANCIA_POR_PAGO_MICROS = FACTOR;

/** Millonésimas de peso. Más de 6 decimales sería un dato que la base no guarda: RangeError. */
function aMicros(d: Prisma.Decimal): bigint {
  const escalado = d.mul(FACTOR.toString());
  if (!escalado.isInteger()) throw new RangeError("Monto con más de 6 decimales.");
  return BigInt(escalado.toFixed(0));
}

function deMicros(n: bigint): Prisma.Decimal {
  const absoluto = n < 0n ? -n : n;
  const texto = `${absoluto / FACTOR}.${(absoluto % FACTOR).toString().padStart(ESCALA, "0")}`;
  return new Prisma.Decimal(n < 0n ? `-${texto}` : texto);
}

/** valor por acción × tenencia, exacto (la tenencia puede no caber en un número). */
export const brutoDe = (valorPorAccion: Prisma.Decimal, tenencia: bigint): Prisma.Decimal => deMicros(aMicros(valorPorAccion) * tenencia);

// ───────────── Grupos y asignación ─────────────

/** Los decretos de una especie con la misma fecha de pago, por tipo (el ordinario primero), cuota e id. */
export type Grupo = GrupoDePago<DecretoCruce>;
export type Asignacion = AsignacionDePagos<PagoTrii>;

const RANGO_TIPO: Readonly<Record<TipoDividendo, number>> = { ORDINARIO: 0, EXTRAORDINARIO: 1, FRACCION_ESCISION: 2 };
/** El ordinario antes que el extraordinario (también en proximos.ts). */
export const ordenTipo = (a: TipoDividendo, b: TipoDividendo): number => RANGO_TIPO[a] - RANGO_TIPO[b];
export const compararTexto = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const porDecreto = (a: DecretoCruce, b: DecretoCruce): number => ordenTipo(a.tipo, b.tipo) || a.cuota - b.cuota || compararTexto(a.id, b.id);

/** Los grupos por especie y fecha de pago (ventana.ts), con los decretos en orden. */
export const agruparDecretos = (decretos: readonly DecretoCruce[]): Grupo[] => agruparPorFechaDePago(decretos, porDecreto);

// ───────────── Estados ─────────────

interface Calculo {
  readonly grupo: Grupo;
  readonly decretos: readonly DecretoCruzado[];
  readonly brutoMicros: bigint;
  readonly pagos: readonly PagoTrii[];
  readonly enDisputa: boolean;
  readonly exMinima: Date;
  readonly exMaxima: Date;
}

function calcular(grupo: Grupo, e: EntradaCruce, a: Asignacion): Calculo {
  const movs = e.movimientos.get(grupo.instrumentoId) ?? [];
  const partes = grupo.decretos.map((d) => {
    const tenencia = tenenciaAntesDeLaEx(movs, d.fechaEx);
    return { d, tenencia, micros: aMicros(d.valorPorAccion) * tenencia };
  });
  const decretos = partes.map(({ d, tenencia, micros }): DecretoCruzado => ({
    decretoId: d.id, tipo: d.tipo, cuota: d.cuota, fechaEx: d.fechaEx, valorPorAccion: d.valorPorAccion, tenenciaAntesDeLaEx: tenencia, bruto: deMicros(micros),
  }));
  const ex = grupo.decretos.map((d) => d.fechaEx.getTime());
  return {
    grupo, decretos, brutoMicros: partes.reduce((s, x) => s + x.micros, 0n), pagos: a.porGrupo.get(grupo.clave) ?? [],
    enDisputa: a.enDisputa.has(grupo.clave), exMinima: new Date(Math.min(...ex)), exMaxima: new Date(Math.max(...ex)),
  };
}

const sinTenenciaEn = (c: Calculo): boolean => c.decretos.every((d) => d.tenenciaAntesDeLaEx === 0n);
const hayRepetido = (c: Calculo): boolean => new Set(c.decretos.map((d) => `${d.tipo}|${d.cuota}`)).size < c.decretos.length;
const cargasCubrenLaEx = (c: Calculo, cubiertoHasta: Date | null): boolean => cubiertoHasta !== null && cubiertoHasta >= c.exMaxima;

function motivosDe(c: Calculo, cubiertoHasta: Date | null, netoMicros: bigint): MotivoRevisar[] {
  const conPagos = c.pagos.length > 0;
  const hay: Readonly<Record<MotivoRevisar, boolean>> = {
    DECRETO_REPETIDO: hayRepetido(c),
    TENENCIA_NEGATIVA: c.decretos.some((d) => d.tenenciaAntesDeLaEx < 0n),
    PAGO_SIN_TENENCIA: conPagos && sinTenenciaEn(c),
    NETO_MAYOR_QUE_BRUTO: conPagos && netoMicros > c.brutoMicros + TOLERANCIA_POR_PAGO_MICROS * BigInt(c.pagos.length),
    PAGO_ANTES_DE_LA_EX: c.pagos.some((p) => p.fechaPago < c.exMinima),
    PAGO_EN_DISPUTA: c.enDisputa,
    CARGA_NO_CUBRE_LA_EX: conPagos && !cargasCubrenLaEx(c, cubiertoHasta),
  };
  return MOTIVOS_REVISAR.filter((m) => hay[m]);
}

/** Sin pagos y sin motivos: NO_RECIBIDO solo cuando hoy, las cargas y algún pago guardado pasaron la ventana. */
function estadoSinPagos(c: Calculo, e: EntradaCruce): EstadoCruce {
  if (e.cubiertoHasta === null || e.ultimoPagoTrii === null) return "PENDIENTE";
  const fin = finVentana(c.grupo.fechaPago);
  const referencia = e.cubiertoHasta < e.hoy ? e.cubiertoHasta : e.hoy;
  return referencia > fin && e.ultimoPagoTrii > fin ? "NO_RECIBIDO" : "PENDIENTE";
}

function filaDelGrupo(c: Calculo, e: EntradaCruce): FilaCruce | SinTenencia {
  const netoMicros = c.pagos.reduce((s, p) => s + aMicros(p.montoNeto), 0n);
  const motivos = motivosDe(c, e.cubiertoHasta, netoMicros);
  const conPagos = c.pagos.length > 0;
  if (!conPagos && motivos.length === 0 && sinTenenciaEn(c) && cargasCubrenLaEx(c, e.cubiertoHasta)) {
    return { instrumentoId: c.grupo.instrumentoId, fechaPago: c.grupo.fechaPago, decretoIds: c.decretos.map((d) => d.decretoId) };
  }
  const estado: EstadoCruce = motivos.length > 0 ? "REVISAR" : conPagos ? "RECIBIDO" : estadoSinPagos(c, e);
  return {
    estado, instrumentoId: c.grupo.instrumentoId, fechaPago: c.grupo.fechaPago, decretos: c.decretos, pagos: c.pagos,
    brutoEsperado: deMicros(c.brutoMicros), netoRecibido: conPagos ? deMicros(netoMicros) : null,
    diferenciaBrutoNeto: conPagos ? deMicros(c.brutoMicros - netoMicros) : null, motivos,
  };
}

const filaSinDecreto = (p: PagoTrii): FilaCruce => ({
  estado: "SIN_DECRETO", instrumentoId: p.instrumentoId, fechaPago: p.fechaPago, decretos: [], pagos: [p],
  brutoEsperado: null, netoRecibido: deMicros(aMicros(p.montoNeto)), diferenciaBrutoNeto: null, motivos: [],
});

const idDeFila = (f: FilaCruce): string => f.decretos[0]?.decretoId ?? f.pagos[0]?.id ?? "";
const porFila = (a: FilaCruce, b: FilaCruce): number =>
  a.fechaPago.getTime() - b.fechaPago.getTime() || compararTexto(a.instrumentoId, b.instrumentoId) || compararTexto(idDeFila(a), idDeFila(b));
const porPago = (a: PagoTrii, b: PagoTrii): number => a.fechaPago.getTime() - b.fechaPago.getTime() || compararTexto(a.id, b.id);

export function cruzar(e: EntradaCruce): ResultadoCruce {
  const pagos = e.pagos.filter((p) => p.tipo !== "FRACCION_ESCISION" && p.fechaPago <= e.hoy).sort(porPago);
  const grupos = agruparDecretos(e.decretos);
  const asignacion = asignarPagos(grupos, pagos);
  const filas: FilaCruce[] = asignacion.sinGrupo.map(filaSinDecreto);
  const sinTenencia: SinTenencia[] = [];
  for (const grupo of grupos) {
    const c = calcular(grupo, e, asignacion);
    if (c.pagos.length === 0 && c.exMinima >= e.hoy) continue; // un próximo (proximos.ts)
    const f = filaDelGrupo(c, e);
    if ("estado" in f) filas.push(f);
    else sinTenencia.push(f);
  }
  return { filas: filas.sort(porFila), sinTenencia };
}

// ───────────── Lectura acotada ─────────────

export interface LimitesDeLectura {
  readonly decretosDesde: Date;
  readonly pagosDesde: Date;
}

/**
 * Lo mínimo que hay que leer para mostrar el cruce desde `desde` igual que con toda la historia: los pagos desde
 * `desde` − la ventana de antes (los de un grupo mostrado) y los decretos con pago desde ahí − la ventana de después
 * (los que podrían disputar esos pagos). La prueba de propiedad de cruce.test.ts lo fija.
 */
export function limitesDeLectura(desde: Date): LimitesDeLectura {
  const pagosDesde = sumarDias(desde, -VENTANA_PAGO_ANTES_DIAS);
  return { decretosDesde: sumarDias(pagosDesde, -VENTANA_PAGO_DESPUES_DIAS), pagosDesde };
}

/** Lo que se muestra desde `desde`: las filas y los grupos sin tenencia con fecha de pago desde ese día. */
export const desdeEn = (r: ResultadoCruce, desde: Date): ResultadoCruce => ({
  filas: r.filas.filter((f) => f.fechaPago >= desde),
  sinTenencia: r.sinTenencia.filter((s) => s.fechaPago >= desde),
});
