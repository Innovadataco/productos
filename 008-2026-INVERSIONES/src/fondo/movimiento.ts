/**
 * Constitución del fondo (FIC): las unidades y el aporte que dice el extracto del FIC, registrados por el dueño (frente
 * fondo-movimientos, GATE 1 aprobada por la Fábrica). Es lo que ningún archivo trae: el CSV de caja de Trii solo tiene
 * depósitos y retiros, y la certificación de A&V, el saldo al corte (MODELO-DATOS §1 #2 y #6).
 * - Nada se infiere ni se redondea: unidades hasta 8 decimales y monto hasta 4, tal cual (NUMERO_PRECISION si sobran).
 * - El contraste con el valor de unidad de la SFC del MISMO día (±0,5 %, la tolerancia de valor de la conciliación) no
 *   corrige nada: si no cuadra o falta ese valor, se niega. Nunca se usa el valor de otro día.
 * - Puro: no toca la base ni la red. Los errores llevan campo y código, nunca el valor (son datos reales).
 */
import { Prisma } from "@prisma/client";
import { correoDeCli } from "../cli/correo";
import { TOLERANCIA_VALOR } from "../conciliacion/controles";
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
