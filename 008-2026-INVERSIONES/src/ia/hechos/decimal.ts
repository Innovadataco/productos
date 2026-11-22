/**
 * Cifras y días de los armadores, puros y exactos. Las cifras salen en la forma canónica del contrato (`formas.ts`:
 * con signo, sin ceros sobrantes ni exponente); las comparaciones van sobre el texto, con BigInt, sin pasar por Number.
 * Los días son «AAAA-MM-DD» de fechas a medianoche UTC (las columnas `@db.Date`), como en el plan (src/plan/fechas.ts).
 */
import { esDecimalCanonico, esDiaIso } from "../formas";
import type { DiaIso } from "../contrato";
import { esFechaDeNegocio, MS_POR_DIA } from "../../plan/fechas";
import { ErrorArmado } from "./errores";

/** Lo que se lee de un decimal (Prisma.Decimal lo cumple): su notación normal, sin exponente. */
export interface DecimalLike {
  toFixed(): string;
}

const DECIMAL_LIBRE = /^(-?)([0-9]+)(?:\.([0-9]+))?$/;
/** Desde aquí `toFixed` de un número escribe en notación exponencial. */
const LIMITE_TOFIXED = 1e21;

/** «007.10» → «7.1», «-0.00» → «0», «37911.4700» → «37911.47». DECIMAL_INVALIDO si no es un decimal o no cabe en el contrato. */
export function deTextoDecimal(texto: string): string {
  const partes = DECIMAL_LIBRE.exec(texto);
  if (!partes) throw new ErrorArmado("DECIMAL_INVALIDO");
  const [, signo = "", entero = "", fraccion = ""] = partes;
  const sinCerosEntero = entero.replace(/^0+(?=[0-9])/, "");
  const sinCerosFraccion = fraccion.replace(/0+$/, "");
  const cuerpo = sinCerosFraccion === "" ? sinCerosEntero : `${sinCerosEntero}.${sinCerosFraccion}`;
  const canonico = cuerpo === "0" ? "0" : `${signo}${cuerpo}`;
  if (!esDecimalCanonico(canonico)) throw new ErrorArmado("DECIMAL_INVALIDO");
  return canonico;
}

/** La forma canónica de un decimal ya calculado (Prisma.Decimal), por su notación normal. */
export function deDecimal(valor: DecimalLike): string {
  return deTextoDecimal(valor.toFixed());
}

/** Un número (las proyecciones son números) redondeado a `decimales`, en forma canónica. NUMERO_INVALIDO si no es finito o es enorme. */
export function deNumero(valor: number, decimales: number): string {
  if (!Number.isFinite(valor) || Math.abs(valor) >= LIMITE_TOFIXED) throw new ErrorArmado("NUMERO_INVALIDO");
  return deTextoDecimal(valor.toFixed(decimales));
}

/** El signo de un decimal canónico. */
export function signoDe(valor: string): -1 | 0 | 1 {
  if (valor === "0") return 0;
  return valor.startsWith("-") ? -1 : 1;
}

/** El decimal como entero escalado a `escala` decimales (exacto). */
function escalado(valor: string, escala: number): bigint {
  const partes = DECIMAL_LIBRE.exec(valor);
  if (!partes) throw new ErrorArmado("DECIMAL_INVALIDO");
  const [, signo = "", entero = "", fraccion = ""] = partes;
  const magnitud = BigInt(`${entero}${fraccion.padEnd(escala, "0")}`);
  return signo === "-" ? -magnitud : magnitud;
}

const decimalesDe = (valor: string): number => valor.split(".")[1]?.length ?? 0;

/** −1, 0 o 1 según `a` sea menor, igual o mayor que `b` (decimales canónicos), exacto. */
export function compararDecimales(a: string, b: string): -1 | 0 | 1 {
  const escala = Math.max(decimalesDe(a), decimalesDe(b));
  const [x, y] = [escalado(a, escala), escalado(b, escala)];
  return x < y ? -1 : x > y ? 1 : 0;
}

/** El valor absoluto de un decimal canónico. */
export const valorAbsoluto = (valor: string): string => (valor.startsWith("-") ? valor.slice(1) : valor);

/** El día ISO de una fecha de negocio (medianoche UTC). FECHA_INVALIDA si no lo es. */
export function diaDe(fecha: Date): DiaIso {
  if (!esFechaDeNegocio(fecha)) throw new ErrorArmado("FECHA_INVALIDA");
  return fecha.toISOString().slice(0, 10);
}

/** Exige un día ISO que existe. */
export function exigirDia(dia: string, codigo: "FECHA_INVALIDA" | "HOY_INVALIDO" = "FECHA_INVALIDA"): DiaIso {
  if (!esDiaIso(dia)) throw new ErrorArmado(codigo);
  return dia;
}

const msDe = (dia: DiaIso): number => Date.parse(`${exigirDia(dia)}T00:00:00.000Z`);

/** Días calendario de `desde` a `hasta` (negativo si `hasta` es anterior). */
export function diasEntre(desde: DiaIso, hasta: DiaIso): number {
  return Math.round((msDe(hasta) - msDe(desde)) / MS_POR_DIA);
}

/** El día `dias` días calendario después (o antes, si es negativo). */
export function sumarDiasIso(dia: DiaIso, dias: number): DiaIso {
  return new Date(msDe(dia) + dias * MS_POR_DIA).toISOString().slice(0, 10);
}

/** El menor de dos días ISO (el orden del texto es el del calendario). */
export const menorDia = (a: DiaIso, b: DiaIso): DiaIso => (a <= b ? a : b);
