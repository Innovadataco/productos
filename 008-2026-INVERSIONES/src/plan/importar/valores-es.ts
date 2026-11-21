/**
 * Valores de la ficha en formato es-CO: «.» separa miles, «,» decimales y «M» son millones. Lectura
 * estricta: lo que no reconoce da nulo (nunca adivina; «1.5» no es 1,5 ni 15). Los montos salen como
 * texto decimal para Prisma.Decimal, sin pasar por punto flotante.
 */
import { ESCALA_PRECIO, fechaDeNegocio, leerDecimal, leerFechaIso } from "../../importacion/trii/valores";

const MESES: Readonly<Record<string, number>> = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, sept: 9, set: 9, oct: 10, nov: 11, dic: 12,
};
const ENTERO = /^(\d{1,3}(?:\.\d{3})+|\d+)$/;
const MONTO = /^\$?\s*(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?(?:\s*(M))?$/;
const DIA_MES = /^(\d{1,2})-([a-z]{3,4})(?:-(\d{4}))?$/;
const PIE = /^v(\d+(?:\.\d+)*)\s*·\s*(\d{4}-\d{2}-\d{2})(?=\s|·|$)/;
const DIGITOS_MILLON = 6;
/** Número al comienzo de lo que sigue al verbo, con sus separadores (para no truncar «1.5» a 1). */
const NUMERO_INICIAL = /^\s+(?:las\s+|los\s+)?(\d(?:[\d.,]*\d)?)/i;

export type CantidadInicial = { readonly tipo: "CANTIDAD"; readonly cantidad: bigint } | { readonly tipo: "SIN_NUMERO" } | { readonly tipo: "NO_RECONOCIDA" };

/** «3.172» → 3172n · «641» → 641n. */
export function leerEnteroEs(texto: string): bigint | null {
  const t = texto.trim();
  return ENTERO.test(t) ? BigInt(t.replace(/\./g, "")) : null;
}

/** « las 3.172 …» → 3172n · « una parte» → sin número · « 1,5» → no reconocida (nunca 1). */
export function leerCantidadInicial(texto: string): CantidadInicial {
  const m = NUMERO_INICIAL.exec(texto);
  if (!m) return { tipo: "SIN_NUMERO" };
  const cantidad = leerEnteroEs(m[1]!);
  return cantidad === null ? { tipo: "NO_RECONOCIDA" } : { tipo: "CANTIDAD", cantidad };
}

/** «$1.234,5» → «1234.5» · «$7,3 M» → «7300000». A lo sumo 6 decimales. */
export function leerMontoEs(texto: string): string | null {
  const m = MONTO.exec(texto.trim());
  if (!m) return null;
  const entero = m[1]!.replace(/\./g, "");
  const fraccion = m[2] ?? "";
  const decimal = m[3] === "M" ? `${entero}${fraccion.padEnd(DIGITOS_MILLON, "0").slice(0, DIGITOS_MILLON)}.${fraccion.slice(DIGITOS_MILLON)}` : `${entero}.${fraccion}`;
  const r = leerDecimal(decimal.replace(/\.$/, ""), ESCALA_PRECIO);
  return r.ok ? r.valor : null;
}

function fechaExacta(anio: number, mes: number, dia: number): Date | null {
  const f = fechaDeNegocio(anio, mes, dia);
  return f.getUTCMonth() === mes - 1 && f.getUTCDate() === dia ? f : null;
}

/**
 * «15-mar» → fecha pasada: con el año de `referencia` (el pie de la ficha) o, si quedaría después de
 * ella (o si no existe en ese año, como un 29-feb), con el anterior. Un año explícito («7-ago-2031») manda.
 */
export function leerDiaMes(texto: string, referencia: Date): Date | null {
  const m = DIA_MES.exec(texto.trim().toLowerCase());
  const mes = m ? MESES[m[2]!] : undefined;
  if (!m || !mes) return null;
  const dia = Number(m[1]);
  if (m[3]) return fechaExacta(Number(m[3]), mes, dia);
  const anio = referencia.getUTCFullYear();
  const enElAnio = fechaExacta(anio, mes, dia);
  if (enElAnio !== null && enElAnio <= referencia) return enElAnio;
  return fechaExacta(anio - 1, mes, dia);
}

/** Pie «> vX.Y · AAAA-MM-DD · …» (sin el «>»): versión y fecha de la ficha. */
export function leerPie(texto: string): { readonly version: string; readonly fecha: Date } | null {
  const m = PIE.exec(texto.trim());
  if (!m) return null;
  const fecha = leerFechaIso(m[2]!);
  return fecha.ok ? { version: m[1]!, fecha: fecha.valor } : null;
}
