// Portafolios INVENTADOS para el motor de análisis: series sintéticas en código, ids FICTICIA-*, fechas de 2019 a 2021
// y números raros. Nada sale de una base. No es una prueba.
import { Prisma } from "@prisma/client";
import type { EntradasAnalisis } from "@/analisis/tipos";
import type { EstadoResultado, HorizonteDias, ResultadoHorizonte, Veredicto } from "@/plan/resultado";
import type { ResultadoDecision } from "@/plan/resultados-lote";
import type { AccionEntrada, Cierre, EntradasProyeccion, FondoEntrada } from "@/proyecciones/tipos";
import { calcularTablero, type EntradaEspecie } from "@/tablero/calculo";
import { accion, dia, diasHabiles, FESTIVOS_FICTICIOS, iso, sumar } from "../../proyecciones/ficticio";

export { accion, dia, diasHabiles, FESTIVOS_FICTICIOS, iso, sumar };

export const D = (v: Prisma.Decimal.Value): Prisma.Decimal => new Prisma.Decimal(v);

/** Retornos diarios inventados (una semana), exactos al multiplicarlos por 2 o por −1. */
export const RETORNOS_BASE: readonly number[] = [0.0123, -0.0071, 0.0237, -0.0189, 0.0042];

/** n retornos: RETORNOS_BASE repetidos y escalados por `escala`. */
export const retornosRepetidos = (n: number, escala = 1): number[] => Array.from({ length: n }, (_, j) => RETORNOS_BASE[j % RETORNOS_BASE.length]! * escala);

/** Cierres desde retornos diarios: el primero es `inicial` y cada siguiente, el anterior × (1 + r). */
export function serieDeRetornos(dias: readonly Date[], inicial: number, retornos: readonly number[]): Cierre[] {
  if (retornos.length < dias.length - 1) throw new Error("faltan retornos para la serie");
  let precio = inicial;
  return dias.map((d, j) => {
    if (j > 0) precio *= 1 + retornos[j - 1]!;
    return { dia: d, precio };
  });
}

/** Cierres de precios dados, día por día. */
export const serieDePrecios = (dias: readonly Date[], precios: readonly number[]): Cierre[] => precios.map((precio, j) => ({ dia: dias[j]!, precio }));

export interface EspecieFicticia {
  readonly id: string;
  readonly cantidad: number;
  readonly cierres: readonly Cierre[];
  readonly extra?: Partial<AccionEntrada>;
  /** El cierre del tablero; por defecto, el último de la serie. null: el tablero no tiene cierre. */
  readonly cierreTablero?: { readonly precio: Prisma.Decimal; readonly fecha: Date } | null;
  /** Solo en el tablero: la historia de Yahoo no la trae. */
  readonly soloTablero?: boolean;
}

export function entradaTablero(e: EspecieFicticia): EntradaEspecie {
  const ultimo = e.cierres.at(-1);
  const cierre = e.cierreTablero === undefined ? (ultimo ? { precio: D(ultimo.precio), fecha: ultimo.dia } : null) : e.cierreTablero;
  return {
    instrumentoId: e.id, nemotecnico: e.id.replace("FICTICIA-", "FICT"), cantidad: BigInt(e.cantidad), costoVivo: D("4613.27"),
    cierre: cierre ? { ...cierre, verificado: false } : null, realizada: D(0), dividendos: D(0), comisiones: D(0), lotesVivos: 1, serie: [],
  };
}

/** Una especie sin cantidad viva en el tablero (para las reglas que la citan). */
export const cerrada = (id: string, cierre: { readonly precio: Prisma.Decimal; readonly fecha: Date } | null): EntradaEspecie => ({
  ...entradaTablero({ id, cantidad: 0, cierres: [], cierreTablero: cierre }),
});

export interface OpcionesPortafolio {
  readonly hoy?: Date;
  readonly decisiones?: readonly ResultadoDecision[];
  readonly cerradas?: readonly EntradaEspecie[];
  readonly fondos?: readonly FondoEntrada[];
  readonly historia?: Partial<EntradasProyeccion>;
}

const DIA_MS = 86_400_000;

/** Las tres entradas del motor armadas con la MISMA serie: los pesos del tablero y la historia cuadran. */
export function portafolio(especies: readonly EspecieFicticia[], o: OpcionesPortafolio = {}): EntradasAnalisis {
  const ultimos = especies.flatMap((e) => e.cierres.map((c) => c.dia.getTime()));
  const hoy = o.hoy ?? (ultimos.length > 0 ? new Date(Math.max(...ultimos) + DIA_MS) : dia("2021-12-01"));
  const posiciones = [...especies.filter((e) => !e.soloTablero).map((e) => accion(e.id, e.cantidad, e.cierres, e.extra)), ...(o.fondos ?? [])];
  const historia: EntradasProyeccion = { hoy, posiciones, escisiones: [], cierresDestino: {}, noHabiles: FESTIVOS_FICTICIOS, incompletas: [], ...o.historia };
  return { hoy, historia, tablero: calcularTablero([...especies.map(entradaTablero), ...(o.cerradas ?? [])]), decisiones: o.decisiones ?? [] };
}

export interface OpcionesHorizonte {
  readonly estado?: EstadoResultado;
  readonly veredicto?: Veredicto | null;
  readonly pesos?: string | null;
  /** Fechas objetivo de sus tramos (AAAA-MM-DD). */
  readonly objetivos?: readonly string[];
  readonly escision?: boolean;
  readonly incluyeDividendos?: boolean;
  readonly verificado?: boolean;
}

/** Un resultado de horizonte como el de src/plan/resultado.ts, armado a mano. */
export function horizonte(h: HorizonteDias, o: OpcionesHorizonte = {}): ResultadoHorizonte {
  const estado = o.estado ?? "CALCULADO";
  const objetivos = estado === "SIN_ORDEN" ? [] : (o.objetivos ?? ["2021-03-17"]);
  const pesos = o.pesos === undefined ? "5246.37" : o.pesos;
  return {
    horizonteDias: h,
    estado,
    resultadoPrecio: pesos === null ? null : D(pesos),
    dividendosPesos: null,
    resultadoPesos: pesos === null ? null : D(pesos),
    veredicto: o.veredicto === undefined ? "FUNCIONO" : o.veredicto,
    verificado: o.verificado ?? true,
    incluyeDividendos: o.incluyeDividendos ?? true,
    motivoSinDividendos: null,
    escisionEnVentana: o.escision ?? false,
    tramos: objetivos.map((f) => ({
      ordenId: null, fechaBase: sumar(dia(f), -h), fechaObjetivo: dia(f), estado: estado === "CALCULADO" ? "CALCULADO" : "PENDIENTE",
      precioBase: null, precioObjetivo: null, resultadoPrecio: null, dividendos: null,
    })),
    versionCalculo: "plan-resultado-v2",
  };
}

export const decision = (decisionId: string, d30: ResultadoHorizonte, d90: ResultadoHorizonte): ResultadoDecision => ({ decisionId, d30, d90 });
