/**
 * Interpreta una fila de un CSV de Trii. Los errores llevan número de fila, columna y código,
 * NUNCA el valor (los valores son datos reales del portafolio).
 * `canonico` son los campos que identifican la fila (clave natural): solo lo que Trii no cambia entre
 * exportaciones (nunca estado, comisión ni, en órdenes, cantidades o totales de ejecución).
 */
import { ENCABEZADOS, type TipoTrii } from "./formatos";
import {
  leerCantidad, leerCategoria, leerDecimal, leerFechaHoraTrii, leerFechaIso, leerNemotecnico, type ResultadoValor,
} from "./valores";

export interface ErrorFila {
  readonly fila: number;
  readonly columna: string | null;
  readonly codigo: string;
}

export interface HechoCaja {
  readonly ocurridoEn: Date; readonly fecha: Date; readonly tipo: "DEPOSITO" | "RETIRO";
  readonly estado: "APROBADO" | "RECHAZADO"; readonly monto: string;
}
export interface HechoOrden {
  readonly ejecutadaEn: Date; readonly fechaOperacion: Date; readonly nemotecnico: string; readonly lado: "COMPRA" | "VENTA";
  readonly estado: "APROBADO" | "CANCELADO"; readonly cantidadCompletada: bigint; readonly cantidadSolicitada: bigint | null;
  readonly cantidadPendiente: bigint; readonly precioUnitario: string; readonly totalInvertido: string;
  readonly comision: string; readonly totalEstimado: string;
}
export interface HechoDividendo { readonly fechaPago: Date; readonly nemotecnico: string; readonly montoNeto: string }

export type Registro =
  | { readonly tipo: "TRII_CAJA"; readonly canonico: Readonly<Record<string, string>>; readonly hecho: HechoCaja }
  | { readonly tipo: "TRII_ORDENES"; readonly canonico: Readonly<Record<string, string>>; readonly hecho: HechoOrden }
  | { readonly tipo: "TRII_DIVIDENDOS"; readonly canonico: Readonly<Record<string, string>>; readonly hecho: HechoDividendo };

export type ResultadoFila = { ok: true; registro: Registro } | { ok: false; errores: ErrorFila[] };

const TIPOS_CAJA = { deposito: "DEPOSITO", retiro: "RETIRO" } as const;
const ESTADOS_CAJA = { aprobado: "APROBADO", rechazado: "RECHAZADO" } as const;
const LADOS = { compra: "COMPRA", venta: "VENTA" } as const;
const ESTADOS_ORDEN = { aprobado: "APROBADO", cancelado: "CANCELADO" } as const;

/** Acumula errores por columna y devuelve el valor (o undefined si falló). */
function lector(fila: number, errores: ErrorFila[]) {
  return <T>(columna: string, r: ResultadoValor<T>): T | undefined => {
    if (r.ok) return r.valor;
    errores.push({ fila, columna, codigo: r.codigo });
    return undefined;
  };
}

function interpretarCaja(c: readonly string[], fila: number): ResultadoFila {
  const errores: ErrorFila[] = [];
  const leer = lector(fila, errores);
  const [colF, colT, colE, colV] = ENCABEZADOS.TRII_CAJA;
  const fh = leer(colF!, leerFechaHoraTrii(c[0]!));
  const tipo = leer(colT!, leerCategoria(c[1]!, TIPOS_CAJA));
  const estado = leer(colE!, leerCategoria(c[2]!, ESTADOS_CAJA));
  const monto = leer(colV!, leerDecimal(c[3]!));
  if (errores.length > 0 || !fh || !tipo || !estado || monto === undefined) return { ok: false, errores };
  return {
    ok: true,
    registro: {
      tipo: "TRII_CAJA",
      canonico: { instante: fh.instante.toISOString(), tipo, monto },
      hecho: { ocurridoEn: fh.instante, fecha: fh.fecha, tipo, estado, monto },
    },
  };
}

function interpretarOrden(c: readonly string[], fila: number): ResultadoFila {
  const errores: ErrorFila[] = [];
  const leer = lector(fila, errores);
  const col = ENCABEZADOS.TRII_ORDENES;
  const fh = leer(col[0]!, leerFechaHoraTrii(c[0]!));
  const nemotecnico = leer(col[1]!, leerNemotecnico(c[1]!));
  const lado = leer(col[2]!, leerCategoria(c[2]!, LADOS));
  const estado = leer(col[3]!, leerCategoria(c[3]!, ESTADOS_ORDEN));
  const cant = leer(col[4]!, leerCantidad(c[4]!));
  const pend = leer(col[5]!, leerCantidad(c[5]!));
  const [precio, invertido, comision, estimado] = [6, 7, 8, 9].map((i) => leer(col[i]!, leerDecimal(c[i]!)));
  if (errores.length > 0 || !fh || !nemotecnico || !lado || !estado || !cant || !pend) return { ok: false, errores };
  if (precio === undefined || invertido === undefined || comision === undefined || estimado === undefined) {
    return { ok: false, errores };
  }
  const hecho: HechoOrden = {
    ejecutadaEn: fh.instante, fechaOperacion: fh.fecha, nemotecnico, lado, estado,
    cantidadCompletada: cant.completada, cantidadSolicitada: cant.solicitada, cantidadPendiente: pend.completada,
    precioUnitario: precio, totalInvertido: invertido, comision, totalEstimado: estimado,
  };
  // Clave mínima: lo que no cambia aunque la orden se siga ejecutando entre dos exportaciones.
  // Si cambian cantidades, precio o totales con la misma clave, la importación lo trata como conflicto.
  const canonico = { instante: fh.instante.toISOString(), nemotecnico, lado };
  return { ok: true, registro: { tipo: "TRII_ORDENES", canonico, hecho } };
}

function interpretarDividendo(c: readonly string[], fila: number): ResultadoFila {
  const errores: ErrorFila[] = [];
  const leer = lector(fila, errores);
  const col = ENCABEZADOS.TRII_DIVIDENDOS;
  const fecha = leer(col[0]!, leerFechaIso(c[0]!));
  const nemotecnico = leer(col[1]!, leerNemotecnico(c[1]!));
  const monto = leer(col[3]!, leerDecimal(c[3]!));
  // «Estado» viene vacío en los archivos verificados: no se usa.
  if (errores.length > 0 || !fecha || !nemotecnico || monto === undefined) return { ok: false, errores };
  return {
    ok: true,
    registro: {
      tipo: "TRII_DIVIDENDOS",
      canonico: { fecha: fecha.toISOString().slice(0, 10), nemotecnico, monto },
      hecho: { fechaPago: fecha, nemotecnico, montoNeto: monto },
    },
  };
}

const INTERPRETES: Readonly<Record<TipoTrii, (c: readonly string[], fila: number) => ResultadoFila>> = {
  TRII_CAJA: interpretarCaja,
  TRII_ORDENES: interpretarOrden,
  TRII_DIVIDENDOS: interpretarDividendo,
};

/** `fila` es el número de registro en el archivo contando el encabezado como 1. */
export function interpretarFila(tipo: TipoTrii, celdas: readonly string[], fila: number): ResultadoFila {
  if (celdas.length !== ENCABEZADOS[tipo].length) {
    return { ok: false, errores: [{ fila, columna: null, codigo: "COLUMNAS_INCORRECTAS" }] };
  }
  return INTERPRETES[tipo](celdas, fila);
}
