/**
 * Validación del simulador. Dos clases de problema:
 * - lo que escribe el dueño (la operación) vuelve como errores, todos juntos, para mostrarlos;
 * - un estado, una regla, una orden, una operación que no es un objeto o un «hoy» mal formados son un error de quien
 *   llama: lanzan RangeError (sus mensajes traen ids, nunca montos; la ruta no los reenvía al navegador).
 * Sin punto flotante: todo en Decimal y bigint, y solo instancias de Prisma.Decimal (un objeto falso no pasa).
 * Topes: cantidades bajo `TOPE_CANTIDAD` (se comparan antes de pasarlas a texto) y montos bajo `TOPE_MONTO` con hasta 6
 * decimales; así la caja, el valor de la orden y el de cada especie se calculan exactos con las 20 cifras del Decimal
 * de Prisma (el valor de las acciones y los pesos, con 20 cifras). Puro.
 */
import { Prisma, type AccionPlan, type CondicionRegla, type EstadoOrden, type LadoOrden } from "@prisma/client";
import {
  DECIMALES_PRECIO,
  type CargoTarifa,
  type Comisionista,
  type TarifaSimulada,
  type ContextoSimulacion,
  type ErrorSimulacion,
  type EstadoSimulado,
  type LadoSimulado,
  type NoVacia,
  type OperacionSimulada,
  type OrdenHistorica,
  type PosicionSimulada,
  type ReglaSimulada,
} from "./tipos";

type Decimal = Prisma.Decimal;

/** Tope exclusivo de la caja, los cierres, los niveles, el precio y los valores (diez billones de pesos). */
export const TOPE_MONTO = new Prisma.Decimal("10000000000000");
/** Tope exclusivo de las cantidades (diez billones de acciones). */
export const TOPE_CANTIDAD = 10n ** 13n;
/** Largo máximo de lo escrito en una regla (`regla_plan_detalle_chk`). */
const MAX_DETALLE = 2000;
const MS_POR_DIA = 86_400_000;

const LADOS = { COMPRAR: true, VENDER: true } satisfies Record<LadoSimulado, true>;
const ACCIONES = { COMPRAR: true, VENDER: true, NO_ACTUAR: true } satisfies Record<AccionPlan, true>;
/** true = la condición lleva nivel (como `regla_plan_nivel_chk`). */
const CON_NIVEL = { NINGUNA: false, LIBRE: false, CIERRE_BAJO: true, CIERRE_SOBRE: true, MONTO_ORDEN_BAJO: true } satisfies Record<CondicionRegla, boolean>;
const LADOS_ORDEN = { COMPRA: true, VENTA: true } satisfies Record<LadoOrden, true>;
const COMISIONISTAS_VALIDOS = { TRII: true, AV: true } satisfies Record<Comisionista, true>;
const CIEN = new Prisma.Decimal(100);
/** Decimales de los porcentajes y los montos de la tarifa (la escala de `tarifa_comision`). */
const DECIMALES_TARIFA = 4;
/** Tope exclusivo del mínimo, el fijo y los cargos fijos de una tarifa (cien millones de pesos, como su CHECK). */
export const TOPE_CARGO_TARIFA = new Prisma.Decimal(100_000_000);
/** Otros cargos por tarifa, como mucho (como su CHECK). */
export const MAX_OTROS_CARGOS = 3;
const ESTADOS_ORDEN = { APROBADO: true, CANCELADO: true } satisfies Record<EstadoOrden, true>;

// Propias del objeto: `in` aceptaría claves heredadas como «toString».
const clave = <T extends string>(tabla: Readonly<Record<T, unknown>>, v: unknown): v is T => typeof v === "string" && Object.hasOwn(tabla, v);
/** Solo instancias: `Decimal.isDecimal` acepta un objeto falso con `toStringTag`. */
const esDecimal = (v: unknown): v is Decimal => v instanceof Prisma.Decimal;
const finito = (v: unknown): v is Decimal => esDecimal(v) && v.isFinite();
const enEscala = (v: Decimal): boolean => v.decimalPlaces() <= DECIMALES_PRECIO && v.abs().lt(TOPE_MONTO);
/** Decimal finito, mayor que 0, con hasta 6 decimales y bajo el tope. */
const montoPositivo = (v: unknown): v is Decimal => finito(v) && v.gt(0) && enEscala(v);
/** Un `Date` válido a medianoche UTC (un NaN no da resto 0). */
const diaValido = (v: unknown): v is Date => v instanceof Date && v.getTime() % MS_POR_DIA === 0;
const idValido = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const cantidadEnRango = (v: unknown, minimo: bigint): v is bigint => typeof v === "bigint" && v >= minimo && v < TOPE_CANTIDAD;
const valorEnRango = (cierre: Decimal, cantidad: bigint): boolean => cierre.mul(cantidad.toString()).lt(TOPE_MONTO);

function exigir(condicion: boolean, mensaje: string): asserts condicion {
  if (!condicion) throw new RangeError(`Simulador: ${mensaje}.`);
}

/** La lista como tupla no vacía, o null si está vacía (el único molde de tipo del módulo, tras medir el largo). */
export function noVacia<T>(xs: readonly T[]): NoVacia<T> | null {
  return xs.length === 0 ? null : (xs as NoVacia<T>);
}

function validarPosicion(p: PosicionSimulada, vistas: ReadonlySet<string>): void {
  exigir(idValido(p.instrumentoId), "una posición no tiene especie");
  exigir(!vistas.has(p.instrumentoId), `la especie ${p.instrumentoId} está repetida en las posiciones`);
  exigir(cantidadEnRango(p.cantidad, 0n), `la cantidad de ${p.instrumentoId} no es un entero de 0 o más bajo el tope`);
  if (p.cierre === null) return;
  exigir(typeof p.cierre === "object" && montoPositivo(p.cierre.precio), `el cierre de ${p.instrumentoId} no es un precio válido`);
  exigir(valorEnRango(p.cierre.precio, p.cantidad), `el valor de ${p.instrumentoId} pasa el tope`);
}

function validarRegla(r: ReglaSimulada): void {
  exigir(idValido(r.id), "una regla no tiene id");
  exigir(clave(CON_NIVEL, r.condicion) && clave(ACCIONES, r.accion), `la regla ${r.id} tiene una condición o una acción desconocida`);
  exigir(r.instrumentoId === null || idValido(r.instrumentoId), `la regla ${r.id} tiene una especie vacía`);
  exigir(CON_NIVEL[r.condicion] ? montoPositivo(r.nivel) : r.nivel === null, `el nivel de la regla ${r.id} no cuadra con su condición`);
  exigir(r.cantidad === null || cantidadEnRango(r.cantidad, 1n), `la cantidad de la regla ${r.id} no es un entero mayor que cero bajo el tope`);
  exigir(r.plazoHasta === null || diaValido(r.plazoHasta), `el plazo de la regla ${r.id} no es un día a medianoche UTC`);
  exigir(typeof r.detalle === "string" && r.detalle.length <= MAX_DETALLE, `lo escrito en la regla ${r.id} no es un texto de hasta ${MAX_DETALLE} caracteres`);
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

/** Un porcentaje de 0 a 100 con hasta 4 decimales (la escala de `tarifa_comision.porcentaje`). */
const porcentajeValido = (v: unknown): boolean => finito(v) && !v.isNeg() && v.lte(CIEN) && v.decimalPlaces() <= DECIMALES_TARIFA;
/** Un monto de 0 o más con hasta 4 decimales y bajo el tope de un cargo de la tarifa. */
const cargoValido = (v: unknown): boolean => finito(v) && !v.isNeg() && v.lt(TOPE_CARGO_TARIFA) && v.decimalPlaces() <= DECIMALES_TARIFA;

function validarCargo(c: CargoTarifa, version: number): void {
  exigir(typeof c === "object" && c !== null && typeof c.nombre === "string" && c.nombre.length > 0, `un cargo de la tarifa ${version} no tiene nombre`);
  exigir(c.tipo === "PCT" ? porcentajeValido(c.valor) : c.tipo === "FIJO" && cargoValido(c.valor), `un cargo de la tarifa ${version} no es un porcentaje ni un fijo válido`);
}

function validarTarifa(lado: string, t: TarifaSimulada | undefined): void {
  if (t === undefined) return;
  exigir(typeof t === "object" && t !== null && t.lado === lado, `la tarifa del lado ${lado} no es de ese lado`);
  exigir(typeof t.version === "number" && t.version >= 1 && clave(COMISIONISTAS_VALIDOS, t.comisionista), `la tarifa ${t.version} no tiene versión o comisionista válidos`);
  exigir(porcentajeValido(t.porcentaje) && porcentajeValido(t.ivaPct), `la tarifa ${t.version} tiene un porcentaje fuera de 0 a 100`);
  exigir(cargoValido(t.minimoPorOrden) && cargoValido(t.fijoPorOrden), `la tarifa ${t.version} tiene un mínimo o un fijo fuera de rango`);
  exigir(Array.isArray(t.otrosCargos) && t.otrosCargos.length <= MAX_OTROS_CARGOS, `la tarifa ${t.version} tiene más de ${MAX_OTROS_CARGOS} otros cargos`);
  t.otrosCargos.forEach((c) => validarCargo(c, t.version));
}

/** Lanza RangeError si el contexto no es válido: «hoy» a medianoche UTC, órdenes como las de la base y tarifas bien formadas. */
export function validarContexto(contexto: ContextoSimulacion): void {
  exigir(diaValido(contexto.hoy), "«hoy» no es un día a medianoche UTC");
  validarOrdenes(contexto.ordenes);
  if (contexto.tarifas === undefined) return;
  exigir(typeof contexto.tarifas === "object" && contexto.tarifas !== null, "las tarifas no son un objeto");
  exigir(Object.keys(contexto.tarifas).every((k) => clave(LADOS_ORDEN, k)), "las tarifas traen un lado desconocido");
  validarTarifa("COMPRA", contexto.tarifas.COMPRA);
  validarTarifa("VENTA", contexto.tarifas.VENTA);
}

function erroresDeLaCantidad(cantidad: unknown): ErrorSimulacion[] {
  if (typeof cantidad !== "bigint" || cantidad <= 0n) return [{ codigo: "CANTIDAD_NO_POSITIVA" }];
  return cantidad < TOPE_CANTIDAD ? [] : [{ codigo: "CANTIDAD_FUERA_DE_RANGO" }];
}

function erroresDelPrecio(precio: unknown): ErrorSimulacion[] {
  if (!esDecimal(precio) || precio.isNaN() || !precio.gt(0)) return [{ codigo: "PRECIO_NO_POSITIVO" }];
  return precio.isFinite() && enEscala(precio) ? [] : [{ codigo: "PRECIO_FUERA_DE_ESCALA" }];
}

/** Lado, cantidad y precio: lo que se revisa sin mirar el portafolio. */
function erroresDeLaEntrada(op: OperacionSimulada): ErrorSimulacion[] {
  return [...(clave(LADOS, op.lado) ? [] : [{ codigo: "LADO_INVALIDO" } as const]), ...erroresDeLaCantidad(op.cantidad), ...erroresDelPrecio(op.precioLimite)];
}

export type RevisionOperacion =
  | { readonly ok: true; readonly posicion: PosicionSimulada; readonly valorOrden: Decimal }
  | { readonly ok: false; readonly errores: NoVacia<ErrorSimulacion> };

/** El valor de la orden y el de la posición que deja (al cierre) quedan bajo el tope. */
function cabeEnElTope(op: OperacionSimulada, posicion: PosicionSimulada, valorOrden: Decimal): boolean {
  if (!valorOrden.lt(TOPE_MONTO)) return false;
  const despues = op.lado === "COMPRAR" ? posicion.cantidad + op.cantidad : posicion.cantidad - op.cantidad;
  return posicion.cierre === null || valorEnRango(posicion.cierre.precio, despues);
}

/**
 * Los errores de la operación, todos juntos y en el orden del formulario (especie, lado, cantidad, precio y lo que
 * tiene), o la posición operada y el valor de la orden (cantidad × precio límite). Lanza RangeError si la operación
 * no es un objeto.
 */
export function revisarOperacion(op: OperacionSimulada, posiciones: readonly PosicionSimulada[]): RevisionOperacion {
  exigir(typeof op === "object" && op !== null, "la operación no es un objeto");
  const posicion = posiciones.find((p) => p.instrumentoId === op.instrumentoId);
  if (posicion === undefined) return { ok: false, errores: [{ codigo: "ESPECIE_DESCONOCIDA" }, ...erroresDeLaEntrada(op)] };
  // La tenencia se compara solo con una cantidad válida: un bigint gigante nunca llega al error (ni a su texto).
  const pasaLaTenencia = erroresDeLaCantidad(op.cantidad).length === 0 && op.lado === "VENDER" && op.cantidad > posicion.cantidad;
  const tenencia: ErrorSimulacion[] = pasaLaTenencia ? [{ codigo: "VENTA_SUPERA_TENENCIA", tiene: posicion.cantidad, pide: op.cantidad }] : [];
  const errores = noVacia([...erroresDeLaEntrada(op), ...tenencia]);
  if (errores !== null) return { ok: false, errores };
  const valorOrden = op.precioLimite.mul(op.cantidad.toString());
  if (!cabeEnElTope(op, posicion, valorOrden)) return { ok: false, errores: [{ codigo: "ORDEN_FUERA_DE_RANGO" }] };
  return { ok: true, posicion, valorOrden };
}
