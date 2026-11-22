/**
 * Validación del simulador. Dos clases de problema:
 * - lo que escribe el dueño (la operación) vuelve como errores, todos juntos, para mostrarlos;
 * - un estado, una regla, una orden o un «hoy» mal formados son un error de quien llama: lanzan RangeError.
 * Sin punto flotante: todo en Decimal y bigint. Los montos quedan bajo `TOPE_MONTO` y con hasta 6 decimales, para que
 * la caja se calcule exacta con las 20 cifras del Decimal de Prisma. Puro.
 */
import { Prisma, type AccionPlan, type CondicionRegla, type EstadoOrden, type LadoOrden } from "@prisma/client";
import {
  DECIMALES_PRECIO,
  type ContextoSimulacion,
  type ErrorSimulacion,
  type EstadoSimulado,
  type LadoSimulado,
  type OperacionSimulada,
  type OrdenHistorica,
  type PosicionSimulada,
  type ReglaSimulada,
} from "./tipos";

type Decimal = Prisma.Decimal;
type Errores = readonly [ErrorSimulacion, ...ErrorSimulacion[]];

/** Tope exclusivo de la caja, los cierres, los niveles, el precio y el valor de la orden (diez billones de pesos). */
export const TOPE_MONTO = new Prisma.Decimal("10000000000000");
const MS_POR_DIA = 86_400_000;

const LADOS = { COMPRAR: true, VENDER: true } satisfies Record<LadoSimulado, true>;
const ACCIONES = { COMPRAR: true, VENDER: true, NO_ACTUAR: true } satisfies Record<AccionPlan, true>;
/** true = la condición lleva nivel (como `regla_plan_nivel_chk`). */
const CON_NIVEL = { NINGUNA: false, LIBRE: false, CIERRE_BAJO: true, CIERRE_SOBRE: true, MONTO_ORDEN_BAJO: true } satisfies Record<CondicionRegla, boolean>;
const LADOS_ORDEN = { COMPRA: true, VENTA: true } satisfies Record<LadoOrden, true>;
const ESTADOS_ORDEN = { APROBADO: true, CANCELADO: true } satisfies Record<EstadoOrden, true>;

// Propias del objeto: `in` aceptaría claves heredadas como «toString».
const clave = <T extends string>(tabla: Readonly<Record<T, unknown>>, v: unknown): v is T => typeof v === "string" && Object.hasOwn(tabla, v);
const esDecimal = (v: unknown): v is Decimal => Prisma.Decimal.isDecimal(v);
const finito = (v: unknown): v is Decimal => esDecimal(v) && v.isFinite();
const enEscala = (v: Decimal): boolean => v.decimalPlaces() <= DECIMALES_PRECIO && v.abs().lt(TOPE_MONTO);
/** Decimal finito, mayor que 0, con hasta 6 decimales y bajo el tope. */
const montoPositivo = (v: unknown): boolean => finito(v) && v.gt(0) && enEscala(v);
/** Un `Date` válido a medianoche UTC (un NaN no da resto 0). */
const diaValido = (v: unknown): v is Date => v instanceof Date && v.getTime() % MS_POR_DIA === 0;
const idValido = (v: unknown): v is string => typeof v === "string" && v.length > 0;

function exigir(condicion: boolean, mensaje: string): asserts condicion {
  if (!condicion) throw new RangeError(`Simulador: ${mensaje}.`);
}

function validarPosicion(p: PosicionSimulada, vistas: ReadonlySet<string>): void {
  exigir(idValido(p.instrumentoId), "una posición no tiene especie");
  exigir(!vistas.has(p.instrumentoId), `la especie ${p.instrumentoId} está repetida en las posiciones`);
  exigir(typeof p.cantidad === "bigint" && p.cantidad >= 0n, `la cantidad de ${p.instrumentoId} no es un entero de 0 o más`);
  exigir(p.cierre === null || montoPositivo(p.cierre), `el cierre de ${p.instrumentoId} no es un precio válido`);
}

function validarRegla(r: ReglaSimulada): void {
  exigir(clave(CON_NIVEL, r.condicion) && clave(ACCIONES, r.accion), `la regla ${r.id} tiene una condición o una acción desconocida`);
  exigir(r.instrumentoId === null || idValido(r.instrumentoId), `la regla ${r.id} tiene una especie vacía`);
  exigir(CON_NIVEL[r.condicion] ? montoPositivo(r.nivel) : r.nivel === null, `el nivel de la regla ${r.id} no cuadra con su condición`);
  exigir(r.cantidad === null || (typeof r.cantidad === "bigint" && r.cantidad > 0n), `la cantidad de la regla ${r.id} no es un entero mayor que cero`);
  exigir(r.plazoHasta === null || diaValido(r.plazoHasta), `el plazo de la regla ${r.id} no es un día a medianoche UTC`);
}

/** Lanza RangeError si el estado no tiene la forma que garantizan la base y el tablero. */
export function validarEstado(estado: EstadoSimulado): void {
  exigir(finito(estado.caja) && enEscala(estado.caja), "la caja no es un monto válido");
  const vistas = new Set<string>();
  for (const p of estado.posiciones) {
    validarPosicion(p, vistas);
    vistas.add(p.instrumentoId);
  }
  estado.reglas.forEach(validarRegla);
}

/** Lanza RangeError si una orden de la historia no es como las de la base (montos ≥ 0, lado y estado conocidos). */
export function validarOrdenes(ordenes: readonly OrdenHistorica[]): void {
  for (const o of ordenes) {
    exigir(clave(LADOS_ORDEN, o.lado) && clave(ESTADOS_ORDEN, o.estado), "una orden de la historia tiene un lado o un estado desconocido");
    exigir(finito(o.totalInvertido) && !o.totalInvertido.isNeg() && finito(o.comision) && !o.comision.isNeg(), "una orden de la historia tiene un monto negativo o no finito");
  }
}

/** Lanza RangeError si el contexto no es válido: «hoy» a medianoche UTC y órdenes como las de la base. */
export function validarContexto(contexto: ContextoSimulacion): void {
  exigir(diaValido(contexto.hoy), "«hoy» no es un día a medianoche UTC");
  validarOrdenes(contexto.ordenes);
}

function erroresDelPrecio(precio: unknown): ErrorSimulacion[] {
  if (!esDecimal(precio) || precio.isNaN() || !precio.gt(0)) return [{ codigo: "PRECIO_NO_POSITIVO" }];
  return precio.isFinite() && enEscala(precio) ? [] : [{ codigo: "PRECIO_FUERA_DE_ESCALA" }];
}

/** Lado, cantidad y precio: lo que se revisa sin mirar el portafolio. */
function erroresDeLaEntrada(op: OperacionSimulada): ErrorSimulacion[] {
  return [
    ...(clave(LADOS, op.lado) ? [] : [{ codigo: "LADO_INVALIDO" } as const]),
    ...(typeof op.cantidad === "bigint" && op.cantidad > 0n ? [] : [{ codigo: "CANTIDAD_NO_POSITIVA" } as const]),
    ...erroresDelPrecio(op.precioLimite),
  ];
}

/** La lista como tupla no vacía, o null si está vacía (el único molde de tipo del módulo, tras medir el largo). */
function noVacia<T>(xs: readonly T[]): readonly [T, ...T[]] | null {
  return xs.length === 0 ? null : (xs as readonly [T, ...T[]]);
}

export type RevisionOperacion =
  | { readonly ok: true; readonly posicion: PosicionSimulada; readonly valorOrden: Decimal }
  | { readonly ok: false; readonly errores: Errores };

/**
 * Los errores de la operación, todos juntos y en el orden del formulario (especie, lado, cantidad, precio y lo que
 * tiene), o la posición operada y el valor de la orden (cantidad × precio límite).
 */
export function revisarOperacion(op: OperacionSimulada, posiciones: readonly PosicionSimulada[]): RevisionOperacion {
  const posicion = posiciones.find((p) => p.instrumentoId === op.instrumentoId);
  if (posicion === undefined) return { ok: false, errores: [{ codigo: "ESPECIE_DESCONOCIDA" }, ...erroresDeLaEntrada(op)] };
  const pasaLaTenencia = op.lado === "VENDER" && typeof op.cantidad === "bigint" && op.cantidad > posicion.cantidad;
  const tenencia: ErrorSimulacion[] = pasaLaTenencia ? [{ codigo: "VENTA_SUPERA_TENENCIA", tiene: posicion.cantidad, pide: op.cantidad }] : [];
  const errores = noVacia([...erroresDeLaEntrada(op), ...tenencia]);
  if (errores !== null) return { ok: false, errores };
  const valorOrden = op.precioLimite.mul(op.cantidad.toString());
  if (valorOrden.gte(TOPE_MONTO)) return { ok: false, errores: [{ codigo: "ORDEN_FUERA_DE_RANGO" }] };
  return { ok: true, posicion, valorOrden };
}
