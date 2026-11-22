/**
 * Constitución del fondo (FIC): las unidades y el aporte que dice el extracto del FIC, registrados por el dueño (frente
 * fondo-movimientos, GATE 1 aprobada por la Fábrica). Es lo que ningún archivo trae: el CSV de caja de Trii solo tiene
 * depósitos y retiros, y la certificación de A&V, el saldo al corte (MODELO-DATOS §1 #2 y #6).
 * - Nada se infiere ni se redondea: unidades hasta 8 decimales y monto hasta 4, tal cual (NUMERO_PRECISION si sobran).
 * - El contraste con el valor de unidad de la SFC del MISMO día (±0,5 %, la tolerancia de valor de la conciliación) no
 *   corrige nada: si no cuadra o falta ese valor, se niega. Nunca se usa el valor de otro día.
 * - El registro (registrarConstitucion) es el ÚNICO camino que escribe movimiento_fondo y ajuste_caja (un candado lo
 *   verifica): en UNA transacción, con un candado consultivo por fondo; la base exige además la coherencia entre los
 *   dos (migración movimiento_fondo_reglas). Sin `aplicar`, es ensayo y no escribe.
 * - La validación y el contraste son puros. Los errores llevan campo y código, nunca el valor (son datos reales).
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { correoDeCli } from "../cli/correo";
import { TOLERANCIA_VALOR } from "../conciliacion/controles";
import { candadoFondo } from "../lib/candados";
import { ESCALA_MONTO, leerDecimal, leerFechaIso, type ResultadoValor } from "../importacion/trii/valores";
import { CODIGO_FIC_RE } from "./sfc";

/** Escala de las unidades del fondo en la base: Decimal(24, 8). */
export const ESCALA_UNIDADES = 8;

export interface EntradaConstitucion {
  readonly email?: string | undefined;
  readonly fondo?: string | undefined;
  readonly fecha?: string | undefined;
  readonly unidades?: string | undefined;
  readonly monto?: string | undefined;
}

export interface ConstitucionValida {
  readonly email: string;
  /** `codigo_negocio` de la SFC (instrumento.codigoFic). */
  readonly codigoFic: string;
  /** Día del cargo en caja y de la asignación de las unidades (uno solo). */
  readonly fecha: Date;
  /** Texto decimal canónico, > 0. */
  readonly unidades: string;
  /** Lo que salió de la caja, en COP; texto decimal canónico, > 0. */
  readonly monto: string;
}

export interface ErrorCampo {
  readonly campo: string;
  readonly codigo: string;
}

export type ResultadoValidacion = { readonly ok: true; readonly valor: ConstitucionValida } | { readonly ok: false; readonly errores: ErrorCampo[] };

export type Contraste = "CUADRA" | "NO_CUADRA" | "SIN_VALOR_UNIDAD";

function positivo(texto: string | undefined, escala: number): ResultadoValor<string> {
  const r = leerDecimal(texto ?? "", escala);
  if (!r.ok) return r;
  return new Prisma.Decimal(r.valor).gt(0) ? r : { ok: false, codigo: "DEBE_SER_POSITIVO" };
}

function fechaNoFutura(texto: string | undefined, hoy: Date): ResultadoValor<Date> {
  const r = leerFechaIso(texto ?? "");
  if (!r.ok) return r;
  return r.valor.getTime() > hoy.getTime() ? { ok: false, codigo: "FECHA_FUTURA" } : r;
}

/** `hoy` es la fecha de negocio de Bogotá (medianoche UTC): la constitución no puede ser posterior. */
export function validarConstitucion(e: EntradaConstitucion, hoy: Date): ResultadoValidacion {
  const errores: ErrorCampo[] = [];
  const tomar = <T>(campo: string, r: ResultadoValor<T>): T | undefined => {
    if (r.ok) return r.valor;
    errores.push({ campo, codigo: r.codigo });
    return undefined;
  };
  const correo = correoDeCli(e.email);
  const email = tomar("email", correo === null ? { ok: false, codigo: "CORREO_FORMATO" } : { ok: true, valor: correo });
  const codigoFic = tomar("fondo", CODIGO_FIC_RE.test(e.fondo ?? "") ? { ok: true, valor: e.fondo! } : { ok: false, codigo: "CODIGO_FIC_FORMATO" });
  const fecha = tomar("fecha", fechaNoFutura(e.fecha, hoy));
  const unidades = tomar("unidades", positivo(e.unidades, ESCALA_UNIDADES));
  const monto = tomar("monto", positivo(e.monto, ESCALA_MONTO));
  if (email === undefined || codigoFic === undefined || fecha === undefined || unidades === undefined || monto === undefined) {
    return { ok: false, errores };
  }
  return { ok: true, valor: { email, codigoFic, fecha, unidades, monto } };
}

/** ¿El monto es unidades × valor de unidad del día, con ±0,5 % del monto? Sin el valor del día, no se decide. */
export function contrastarConValorUnidad(unidades: string, monto: string, valorUnidad: string | null): Contraste {
  if (valorUnidad === null) return "SIN_VALOR_UNIDAD";
  const real = new Prisma.Decimal(monto);
  const esperado = new Prisma.Decimal(unidades).mul(valorUnidad);
  return real.sub(esperado).abs().lte(real.abs().mul(TOLERANCIA_VALOR)) ? "CUADRA" : "NO_CUADRA";
}

// ───────────── Registro (una transacción) ─────────────

/** Motivo fijo del ajuste: nunca texto libre (no lleva datos del extracto ni del encargo). */
export const MOTIVO_CONSTITUCION = "Constitución del fondo: aporte pagado con la caja, según el extracto del FIC (lo registra el dueño).";
const MAX_INTENTOS = 2;

export type CodigoRechazo =
  | "USUARIO_NO_AUTORIZADO"
  | "FONDO_NO_REGISTRADO"
  | "FONDO_INACTIVO"
  | "CONSTITUCION_DISTINTA"
  | "MOVIMIENTO_ANTES_DE_LA_CONSTITUCION"
  | "SIN_VALOR_UNIDAD_DEL_DIA"
  | "MONTO_NO_CUADRA_CON_VALOR_UNIDAD"
  | "REGISTRO_EN_CONFLICTO";

/** Rechazo de negocio: solo un código, nunca datos (los del fondo y del extracto son reales). */
export class ErrorMovimientoFondo extends Error {
  constructor(readonly codigo: CodigoRechazo) {
    super(codigo);
    this.name = "ErrorMovimientoFondo";
  }
}

export type EstadoConstitucion = "ENSAYO" | "REGISTRADA" | "YA_EXISTIA";

export interface ResultadoConstitucion {
  readonly estado: EstadoConstitucion;
  readonly fondoId: string;
  readonly movimientoId: string | null;
  readonly ajusteId: string | null;
}

export interface OpcionesConstitucion {
  /** Sin `aplicar` es ensayo: valida todo contra la base y no escribe. */
  readonly aplicar: boolean;
}

type Tx = Prisma.TransactionClient;

async function duenoActivo(tx: Tx, email: string): Promise<string> {
  const u = await tx.usuario.findUnique({ where: { email }, select: { id: true, rol: true, activo: true } });
  if (!u || u.rol !== "DUENO" || !u.activo) throw new ErrorMovimientoFondo("USUARIO_NO_AUTORIZADO");
  return u.id;
}

async function fondoActivo(tx: Tx, codigoFic: string): Promise<string> {
  const f = await tx.instrumento.findUnique({ where: { codigoFic }, select: { id: true, tipo: true, activo: true } });
  if (!f || f.tipo !== "FIC") throw new ErrorMovimientoFondo("FONDO_NO_REGISTRADO");
  if (!f.activo) throw new ErrorMovimientoFondo("FONDO_INACTIVO");
  return f.id;
}

/** La constitución que ya tiene el fondo, si la hay: la misma (YA_EXISTIA) u otra (CONSTITUCION_DISTINTA). */
async function constitucionPrevia(tx: Tx, fondoId: string, d: ConstitucionValida): Promise<ResultadoConstitucion | null> {
  const previa = await tx.movimientoFondo.findFirst({
    where: { fondoId, tipo: "CONSTITUCION" },
    select: { id: true, fecha: true, unidades: true, monto: true, ajusteCajaId: true },
  });
  if (!previa) return null;
  const misma = previa.fecha.getTime() === d.fecha.getTime() && previa.unidades.equals(d.unidades) && previa.monto !== null && previa.monto.equals(d.monto);
  if (!misma) throw new ErrorMovimientoFondo("CONSTITUCION_DISTINTA");
  return { estado: "YA_EXISTIA", fondoId, movimientoId: previa.id, ajusteId: previa.ajusteCajaId };
}

/** Nada del fondo antes de la constitución, y el contraste con el valor de unidad VIGENTE del día exacto (no cuenta uno reemplazado ni el de otro día). */
async function comprobarFechaYValor(tx: Tx, fondoId: string, d: ConstitucionValida): Promise<void> {
  if ((await tx.movimientoFondo.count({ where: { fondoId, fecha: { lt: d.fecha } } })) > 0) throw new ErrorMovimientoFondo("MOVIMIENTO_ANTES_DE_LA_CONSTITUCION");
  const vu = await tx.valorUnidadFondo.findFirst({ where: { fondoId, fechaValor: d.fecha, reemplazadoEn: null }, select: { valorUnidad: true } });
  const contraste = contrastarConValorUnidad(d.unidades, d.monto, vu?.valorUnidad.toString() ?? null);
  if (contraste === "SIN_VALOR_UNIDAD") throw new ErrorMovimientoFondo("SIN_VALOR_UNIDAD_DEL_DIA");
  if (contraste === "NO_CUADRA") throw new ErrorMovimientoFondo("MONTO_NO_CUADRA_CON_VALOR_UNIDAD");
}

async function registrarEnTransaccion(db: PrismaClient, d: ConstitucionValida, opciones: OpcionesConstitucion): Promise<ResultadoConstitucion> {
  return db.$transaction(async (tx) => {
    // Dos registros del mismo fondo a la vez se serializan; el índice único de la constitución es la red de abajo.
    await tx.$queryRaw`SELECT 1 AS ok FROM pg_advisory_xact_lock(hashtext(${candadoFondo(d.codigoFic)}))`;
    const creadoPorId = await duenoActivo(tx, d.email);
    const fondoId = await fondoActivo(tx, d.codigoFic);
    const previa = await constitucionPrevia(tx, fondoId, d);
    if (previa) return previa;
    await comprobarFechaYValor(tx, fondoId, d);
    if (!opciones.aplicar) return { estado: "ENSAYO", fondoId, movimientoId: null, ajusteId: null };
    const monto = new Prisma.Decimal(d.monto);
    const ajuste = await tx.ajusteCaja.create({
      data: { fecha: d.fecha, monto: monto.neg(), categoria: "APORTE_FIC", fuente: "EXTRACTO", motivo: MOTIVO_CONSTITUCION, referenciaEvidencia: null, creadoPorId },
      select: { id: true },
    });
    const movimiento = await tx.movimientoFondo.create({
      data: { fondoId, fecha: d.fecha, unidades: new Prisma.Decimal(d.unidades), monto, tipo: "CONSTITUCION", fuente: "EXTRACTO", ajusteCajaId: ajuste.id },
      select: { id: true },
    });
    return { estado: "REGISTRADA", fondoId, movimientoId: movimiento.id, ajusteId: ajuste.id };
  });
}

const esConflicto = (e: unknown): boolean => (e as { code?: unknown } | null)?.code === "P2002";

/**
 * Registra la constitución del fondo: el ajuste de caja (−monto, APORTE_FIC, EXTRACTO, el dueño como autor) y el
 * movimiento CONSTITUCION enlazado, de la misma fecha, todo o nada. Idempotente. Un choque se relee una vez y, si
 * sigue, es un código. Los rechazos de negocio son ErrorMovimientoFondo; lo demás (la base) sube tal cual.
 */
export async function registrarConstitucion(db: PrismaClient, d: ConstitucionValida, opciones: OpcionesConstitucion): Promise<ResultadoConstitucion> {
  for (let intento = 1; ; intento += 1) {
    try {
      return await registrarEnTransaccion(db, d, opciones);
    } catch (err) {
      if (!esConflicto(err)) throw err;
      if (intento >= MAX_INTENTOS) throw new ErrorMovimientoFondo("REGISTRO_EN_CONFLICTO");
    }
  }
}
