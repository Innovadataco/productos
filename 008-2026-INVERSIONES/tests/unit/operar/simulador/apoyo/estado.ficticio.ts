/**
 * Datos INVENTADOS para las pruebas del simulador (especies FICTICIA-*, cifras no redondas, fechas de 2027) y
 * generadores al azar con el PRNG reproducible del motor de proyecciones. Los decimales se arman como texto desde
 * enteros: nunca pasan por punto flotante.
 */
import { Prisma, type EstadoOrden, type LadoOrden } from "@prisma/client";
import type { Prng } from "@/proyecciones/prng";
import type {
  ContextoSimulacion,
  EstadoSimulado,
  OperacionSimulada,
  OrdenHistorica,
  PosicionSimulada,
  ReglaSimulada,
  ResultadoSimulacion,
  Simulacion,
} from "@/operar/simulador/tipos";

export const D = (v: Prisma.Decimal.Value): Prisma.Decimal => new Prisma.Decimal(v);

/** Medianoche UTC del 17 de marzo de 2027 (como `fechaEnBogota`). */
export const HOY = new Date(Date.UTC(2027, 2, 17));
export const dia = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

export const idDe = (nemotecnico: string): string => `id-${nemotecnico.toLowerCase()}`;

export const posicion = (nemotecnico: string, cantidad: bigint, cierre: string | null): PosicionSimulada => ({
  instrumentoId: idDe(nemotecnico),
  nemotecnico,
  cantidad,
  cierre: cierre === null ? null : D(cierre),
});

export const regla = (cambios: Partial<ReglaSimulada> = {}): ReglaSimulada => ({
  id: "regla-ficticia",
  instrumentoId: null,
  condicion: "NINGUNA",
  nivel: null,
  accion: "NO_ACTUAR",
  cantidad: null,
  plazoHasta: null,
  detalle: "texto ficticio del plan",
  ...cambios,
});

export const orden = (lado: LadoOrden, totalInvertido: string, comision: string, estado: EstadoOrden = "APROBADO"): OrdenHistorica => ({
  lado,
  estado,
  totalInvertido: D(totalInvertido),
  comision: D(comision),
});

export const A = "FICTICIA-A";
export const B = "FICTICIA-B";
export const C = "FICTICIA-C";

/** Dos especies vivas con cierre y una que ya vendió (cantidad 0). */
export const ESTADO: EstadoSimulado = {
  posiciones: [posicion(A, 1237n, "4613.27"), posicion(B, 379n, "11.71"), posicion(C, 0n, "823.19")],
  caja: D("37911.47"),
  reglas: [],
};

/** Historia con tasa exacta de 1/16 en las compras y de 1/32 en las ventas. */
export const CONTEXTO: ContextoSimulacion = {
  ordenes: [orden("COMPRA", "1237.6", "77.35"), orden("COMPRA", "4613.12", "288.32"), orden("VENTA", "2711.04", "84.72")],
  hoy: HOY,
};

export const SIN_HISTORIA: ContextoSimulacion = { ordenes: [], hoy: HOY };

export const operacion = (nemotecnico: string, lado: OperacionSimulada["lado"], cantidad: bigint, precio: string): OperacionSimulada => ({
  instrumentoId: idDe(nemotecnico),
  lado,
  cantidad,
  precioLimite: D(precio),
});

/** La simulación de un resultado que debe salir bien (si no, la prueba falla con los errores a la vista). */
export function exito(r: ResultadoSimulacion): Simulacion {
  if (!r.ok) throw new Error(`se esperaba una simulación y salió: ${r.errores.map((e) => e.codigo).join(", ")}`);
  return r.simulacion;
}

/** El estado que deja una simulación: las cantidades de después y la caja de después; el resto, igual. */
export function estadoDespues(estado: EstadoSimulado, s: Simulacion): EstadoSimulado {
  const despues = new Map(s.especies.map((e) => [e.instrumentoId, e.cantidadDespues]));
  return {
    ...estado,
    posiciones: estado.posiciones.map((p) => ({ ...p, cantidad: despues.get(p.instrumentoId) ?? p.cantidad })),
    caja: s.cajaDespues,
  };
}

/** JSON con los bigint y los Decimal como texto (JSON.stringify no acepta bigint). */
export const comoTexto = (v: unknown): string =>
  JSON.stringify(v, (_k, x: unknown) => (typeof x === "bigint" ? `${x}n` : Prisma.Decimal.isDecimal(x) ? `D:${x.toFixed()}` : x));

/** Congela a fondo objetos y arreglos (los Decimal también: sus métodos devuelven otro). */
export function congelar<T>(v: T): T {
  if (v !== null && typeof v === "object" && !(v instanceof Date) && !Object.isFrozen(v)) {
    Object.values(v).forEach(congelar);
    Object.freeze(v);
  }
  return v;
}

// ───────────── Al azar (reproducible) ─────────────

/** Decimal positivo con `decimales` cifras decimales y parte entera en [0, maxEntero), nunca 0. */
export function decimalAlAzar(prng: Prng, maxEntero: number, decimales: number): Prisma.Decimal {
  const entero = prng.enteroMenorQue(maxEntero);
  const fraccion = decimales === 0 ? "" : `.${String(prng.enteroMenorQue(10 ** decimales)).padStart(decimales, "0")}`;
  const v = D(`${entero}${fraccion}`);
  return v.isZero() ? D("0.000001").add(entero + 1) : v;
}

const bigintAlAzar = (prng: Prng, max: number): bigint => BigInt(prng.enteroMenorQue(max));

const CONDICIONES = ["NINGUNA", "CIERRE_BAJO", "CIERRE_SOBRE", "MONTO_ORDEN_BAJO", "LIBRE"] as const;
const ACCIONES = ["COMPRAR", "VENDER", "NO_ACTUAR"] as const;

function reglaAlAzar(prng: Prng, k: number, especies: readonly PosicionSimulada[]): ReglaSimulada {
  const condicion = CONDICIONES[prng.enteroMenorQue(CONDICIONES.length)]!;
  const deEspecie = prng.enteroMenorQue(4) > 0;
  const especie = especies[prng.enteroMenorQue(especies.length)]!;
  const nivel = condicion === "NINGUNA" || condicion === "LIBRE" ? null : decimalAlAzar(prng, condicion === "MONTO_ORDEN_BAJO" ? 4_613_711 : 9_137, 2);
  const plazo = prng.enteroMenorQue(3);
  return regla({
    id: `regla-${k}`,
    instrumentoId: deEspecie ? especie.instrumentoId : null,
    condicion,
    nivel,
    accion: ACCIONES[prng.enteroMenorQue(ACCIONES.length)]!,
    cantidad: prng.enteroMenorQue(2) === 0 ? null : bigintAlAzar(prng, 4_613) + 1n,
    plazoHasta: plazo === 0 ? null : plazo === 1 ? dia("2027-03-16") : dia("2027-11-23"),
    detalle: `regla ficticia ${k}`,
  });
}

function ordenesAlAzar(prng: Prng): OrdenHistorica[] {
  return Array.from({ length: prng.enteroMenorQue(7) }, () =>
    orden(
      prng.enteroMenorQue(2) === 0 ? "COMPRA" : "VENTA",
      decimalAlAzar(prng, 913_711, 4).toFixed(),
      decimalAlAzar(prng, 3_711, 4).toFixed(),
      prng.enteroMenorQue(5) === 0 ? "CANCELADO" : "APROBADO",
    ),
  );
}

export interface CasoAlAzar {
  readonly estado: EstadoSimulado;
  readonly operacion: OperacionSimulada;
  readonly contexto: ContextoSimulacion;
}

/** Un portafolio inventado y una operación VÁLIDA sobre él (la venta nunca pasa la tenencia). */
export function casoAlAzar(prng: Prng, k: number): CasoAlAzar {
  const n = 1 + prng.enteroMenorQue(6);
  const posiciones = Array.from({ length: n }, (_v, i) =>
    posicion(`FICTICIA-${k}-${i}`, prng.enteroMenorQue(4) === 0 ? 0n : bigintAlAzar(prng, 41_137) + 1n, prng.enteroMenorQue(9) === 0 ? null : decimalAlAzar(prng, 9_137, 2).toFixed()),
  );
  const reglas = Array.from({ length: prng.enteroMenorQue(5) }, (_v, j) => reglaAlAzar(prng, j, posiciones));
  const operada = posiciones[prng.enteroMenorQue(n)]!;
  const vende = operada.cantidad > 0n && prng.enteroMenorQue(2) === 0;
  const todo = vende && prng.enteroMenorQue(4) === 0;
  const cantidad = vende ? (todo ? operada.cantidad : 1n + BigInt(prng.enteroMenorQue(Number(operada.cantidad)))) : bigintAlAzar(prng, 3_711) + 1n;
  return {
    estado: { posiciones, caja: decimalAlAzar(prng, 9_137_111, 4), reglas },
    operacion: { instrumentoId: operada.instrumentoId, lado: vende ? "VENDER" : "COMPRAR", cantidad, precioLimite: decimalAlAzar(prng, 9_137, 3) },
    contexto: { ordenes: ordenesAlAzar(prng), hoy: HOY },
  };
}
