/**
 * La historia real del valor antes de «Hoy» (frente proyecciones-pantalla). Puro.
 * - Acciones: la evolución del tablero (src/tablero/evolucion.ts): cantidad de cada día × su último cierre, vivas y
 *   vendidas, la misma serie que cuadra con «Valor en acciones».
 * - Fondo: sus unidades A ESA FECHA (constitución y aportes suman, el retiro resta) × su último valor de unidad hasta
 *   ese día. Sin valor de unidad todavía, no suma: no se inventa.
 * - Un punto por mes: el último día con dato de cada mes, hasta hoy. Sin evolución de acciones, los días son los de
 *   los valores del fondo mientras tiene unidades.
 * No incluye el efectivo, igual que la proyección.
 */
import { cop, fecha } from "@/app/tablero/formato";

export interface PuntoHistoria {
  /** «AAAA-MM-DD». */
  readonly dia: string;
  readonly valor: number;
}

export interface FondoHistoria {
  /** Unidades con signo, por fecha (el retiro, negativo). */
  readonly movimientos: readonly { readonly dia: string; readonly unidades: number }[];
  /** Valores de unidad vigentes, ascendentes. */
  readonly valores: readonly { readonly dia: string; readonly valor: number }[];
}

export interface EntradasHistoria {
  readonly acciones: readonly PuntoHistoria[];
  readonly fondos: readonly FondoHistoria[];
  readonly hoy: string;
  /** El primer día que se lee (los valores del fondo se leen desde aquí): antes no hay historia. */
  readonly desde?: string;
}

/** Unidades que se compensan quedan en un residuo de coma flotante: por debajo de esto, no hay unidades. */
const UNIDADES_MINIMAS = 1e-9;
const sumaUnidades = (f: FondoHistoria, dia: string): number => f.movimientos.reduce((s, m) => (m.dia <= dia ? s + m.unidades : s), 0);
const unidadesEn = (f: FondoHistoria, dia: string): number => {
  const u = sumaUnidades(f, dia);
  return Math.abs(u) < UNIDADES_MINIMAS ? 0 : u;
};

function valorUnidadEn(f: FondoHistoria, dia: string): number | null {
  let ultimo: number | null = null;
  for (const v of f.valores) {
    if (v.dia > dia) break;
    ultimo = v.valor;
  }
  return ultimo;
}

const valorFondoEn = (f: FondoHistoria, dia: string): number => {
  const u = unidadesEn(f, dia);
  const v = valorUnidadEn(f, dia);
  return u === 0 || v === null ? 0 : u * v;
};

/** El último de cada mes, en orden. */
function ultimoPorMes(dias: readonly string[]): string[] {
  const porMes = new Map<string, string>();
  for (const d of [...dias].sort()) porMes.set(d.slice(0, 7), d);
  return [...porMes.values()];
}

export function historiaMensual(e: EntradasHistoria): PuntoHistoria[] {
  const enRango = (d: string) => d <= e.hoy && (e.desde === undefined || d >= e.desde);
  const acciones = new Map(e.acciones.filter((p) => enRango(p.dia)).map((p) => [p.dia, p.valor]));
  const diasFondo = e.fondos.flatMap((f) => f.valores.map((v) => v.dia).filter((d) => enRango(d) && unidadesEn(f, d) > 0));
  const dias = ultimoPorMes(acciones.size > 0 ? [...acciones.keys()] : diasFondo);
  return dias.map((dia) => ({ dia, valor: (acciones.get(dia) ?? 0) + e.fondos.reduce((s, f) => s + valorFondoEn(f, dia), 0) }));
}

/** Diferencia relativa y días de hueco desde los que la historia y el valor de hoy «no empalman». */
const SALTO_RELATIVO = 0.005;
const HUECO_DIAS = 7;
const DIA_MS = 86_400_000;

/**
 * Un texto de hechos cuando la historia no empalma con el valor de hoy: las dos cifras con sus fechas. No adivina la
 * causa: la dice en general (precios o cantidades posteriores, posiciones que el cálculo deja fuera) y remite a los
 * supuestos, que nombran cada posición fija o excluida.
 */
export function notaDeSalto(historia: readonly PuntoHistoria[], hoy: { readonly hoy: string; readonly valorHoy: number }): string | null {
  const ultimo = historia.at(-1);
  if (!ultimo) return null;
  const relativo = ultimo.valor === 0 ? (hoy.valorHoy === 0 ? 0 : 1) : Math.abs(hoy.valorHoy - ultimo.valor) / Math.abs(ultimo.valor);
  const hueco = (Date.parse(`${hoy.hoy}T00:00:00Z`) - Date.parse(`${ultimo.dia}T00:00:00Z`)) / DIA_MS;
  if (relativo <= SALTO_RELATIVO && hueco <= HUECO_DIAS) return null;
  return (
    `La historia llega hasta el ${fecha(ultimo.dia)} (${cop(ultimo.valor)}); la proyección arranca hoy, ${fecha(hoy.hoy)}, con ${cop(hoy.valorHoy)}. ` +
    "La diferencia viene de precios o cantidades posteriores al último dato de la historia, o de posiciones que el cálculo deja fuera o fijas (están en los supuestos)."
  );
}
