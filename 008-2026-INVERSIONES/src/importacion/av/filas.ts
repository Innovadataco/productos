/**
 * Filas de la certificación de A&V → cifras validadas (PR-B). Reglas:
 * - cada celda pasa por su lector (valores.ts); el error lleva página, fila, columna y código, nunca el texto;
 * - en un lote, cantidad × precio debe dar el valor de mercado (con medio centavo por acción de redondeo):
 *   así se detectan columnas corridas o un número mal leído;
 * - el crudo que se guarda (cifrado) va en lista blanca: nunca el nombre del titular ni la cuenta;
 * - una sola fila de efectivo y un fondo por NIT.
 * Se juntan todos los errores: una fila inválida rechaza el archivo entero.
 */
import { Prisma } from "@prisma/client";
import { ESCALA_PRECIO, leerNemotecnico } from "../trii/valores";
import { SECCIONES, type FilaTabla, type Seccion } from "./tabla";
import { leerCantidadAcciones, leerDigitos, leerMontoCop, leerNit } from "./valores";

export type Crudo = Readonly<Record<string, string>>;

export interface ErrorFilaAv {
  readonly pagina: number;
  readonly fila: number;
  readonly columna: string | null;
  readonly codigo: string;
}

interface Ubicacion {
  readonly pagina: number;
  /** Número de fila del documento (el de la trazabilidad y de `FilaDeCarga.filaNo`). */
  readonly numero: number;
  readonly crudo: Crudo;
}

export interface LoteCertificado extends Ubicacion {
  readonly nemo: string;
  readonly cantidad: bigint;
  readonly precio: string;
  readonly valor: string;
}

export interface FondoCertificado extends Ubicacion {
  readonly descripcion: string;
  readonly nit: string;
  readonly encargo: string;
  readonly saldo: string;
}

export interface EfectivoCertificado extends Ubicacion {
  readonly saldo: string;
}

export interface CertificacionLeida {
  readonly lotes: readonly LoteCertificado[];
  readonly fondos: readonly FondoCertificado[];
  readonly efectivo: EfectivoCertificado;
}

export type ResultadoFilas = { readonly ok: true; readonly valor: CertificacionLeida } | { readonly ok: false; readonly errores: ErrorFilaAv[] };

const MAX_DESCRIPCION = 200;
const MEDIO_CENTAVO = new Prisma.Decimal("0.005");
const UN_CENTAVO = new Prisma.Decimal("0.01");

type Lector<T> = (texto: string) => { ok: true; valor: T } | { ok: false; codigo: string };

/** Lee las celdas de una fila con un lector por columna; junta los errores. */
function celdas(fila: FilaTabla, lectores: readonly Lector<unknown>[], errores: ErrorFilaAv[]): unknown[] | null {
  const columnas = SECCIONES[fila.seccion].columnas;
  const valores = lectores.map((leer, i) => {
    const r = leer(fila.celdas[i] ?? "");
    if (r.ok) return r.valor;
    errores.push({ pagina: fila.pagina, fila: fila.numero, columna: columnas[i]!, codigo: r.codigo });
    return undefined;
  });
  return valores.some((v) => v === undefined) ? null : valores;
}

/** El crudo en lista blanca: la sección, la página y solo las columnas indicadas. */
function crudo(fila: FilaTabla, indices: readonly number[]): Crudo {
  const columnas = SECCIONES[fila.seccion].columnas;
  return Object.fromEntries([["seccion", SECCIONES[fila.seccion].titulo], ["pagina", String(fila.pagina)], ...indices.map((i) => [columnas[i]!, fila.celdas[i]!])]);
}

const descripcion: Lector<string> = (t) => {
  const v = t.trim();
  return v.length > 0 && v.length <= MAX_DESCRIPCION ? { ok: true, valor: v } : { ok: false, codigo: "DESCRIPCION_FORMATO" };
};
const precio: Lector<string> = (t) => leerMontoCop(t, { escala: ESCALA_PRECIO });

function lote(fila: FilaTabla, errores: ErrorFilaAv[]): LoteCertificado | null {
  const v = celdas(fila, [leerNemotecnico, leerCantidadAcciones, precio, (t) => leerMontoCop(t)], errores);
  if (!v) return null;
  const [nemo, cantidad, p, valor] = v as [string, bigint, string, string];
  const diferencia = new Prisma.Decimal(p).mul(cantidad.toString()).sub(valor).abs();
  if (diferencia.gt(MEDIO_CENTAVO.mul(cantidad.toString()).add(UN_CENTAVO))) {
    errores.push({ pagina: fila.pagina, fila: fila.numero, columna: SECCIONES.RENTA_VARIABLE.columnas[3]!, codigo: "VALOR_INCOHERENTE" });
    return null;
  }
  return { nemo, cantidad, precio: p, valor, pagina: fila.pagina, numero: fila.numero, crudo: crudo(fila, [0, 1, 2, 3]) };
}

function fondo(fila: FilaTabla, errores: ErrorFilaAv[]): FondoCertificado | null {
  const v = celdas(fila, [descripcion, leerNit, (t) => leerDigitos(t, "ENCARGO_FORMATO"), (t) => leerMontoCop(t)], errores);
  if (!v) return null;
  const [d, nit, encargo, saldo] = v as [string, string, string, string];
  return { descripcion: d, nit, encargo, saldo, pagina: fila.pagina, numero: fila.numero, crudo: crudo(fila, [0, 1, 2, 3]) };
}

/** El nombre del titular no se lee (no se usa ni se guarda); la cuenta se valida y se descarta. */
function efectivo(fila: FilaTabla, errores: ErrorFilaAv[]): EfectivoCertificado | null {
  const v = celdas(fila, [() => ({ ok: true, valor: "" }), (t) => leerDigitos(t, "CUENTA_FORMATO"), (t) => leerMontoCop(t, { negativo: true })], errores);
  if (!v) return null;
  return { saldo: v[2] as string, pagina: fila.pagina, numero: fila.numero, crudo: crudo(fila, [2]) };
}

const de = (filas: readonly FilaTabla[], s: Seccion) => filas.filter((f) => f.seccion === s);

function fondosSinRepetir(fondos: readonly FondoCertificado[], errores: ErrorFilaAv[]): FondoCertificado[] {
  const vistos = new Set<string>();
  return fondos.filter((f) => {
    if (!vistos.has(f.nit)) return vistos.add(f.nit);
    errores.push({ pagina: f.pagina, fila: f.numero, columna: SECCIONES.FONDOS.columnas[1]!, codigo: "FONDO_DUPLICADO" });
    return false;
  });
}

export function interpretarFilas(filas: readonly FilaTabla[]): ResultadoFilas {
  const errores: ErrorFilaAv[] = [];
  const lotes = de(filas, "RENTA_VARIABLE").map((f) => lote(f, errores));
  const fondos = fondosSinRepetir(de(filas, "FONDOS").flatMap((f) => fondo(f, errores) ?? []), errores);
  const deEfectivo = de(filas, "EFECTIVO");
  if (deEfectivo.length === 0) errores.push({ pagina: 0, fila: 0, columna: null, codigo: "EFECTIVO_FALTANTE" });
  for (const f of deEfectivo.slice(1)) errores.push({ pagina: f.pagina, fila: f.numero, columna: null, codigo: "VARIAS_CUENTAS" });
  const caja = deEfectivo[0] ? efectivo(deEfectivo[0], errores) : null;
  if (errores.length > 0 || caja === null || lotes.some((l) => l === null)) return { ok: false, errores };
  return { ok: true, valor: { lotes: lotes as LoteCertificado[], fondos, efectivo: caja } };
}
