/**
 * Tipos del simulador «¿y si…?» (O2): una operación que el dueño escribe y sus efectos sobre su portafolio, con sus
 * propios datos. Puro: sin base, sin red y sin reloj (el día de hoy llega en el contexto). Dinero en Prisma.Decimal y
 * cantidades en bigint. Muestra efectos (pesos, caja, comisión estimada y reglas del plan), nunca un juicio.
 *
 * Valoración: las acciones se valoran a su último cierre (como el tablero) y la orden mueve la caja a su precio
 * límite. Por eso una compra a un precio distinto del cierre cambia el patrimonio en (cierre − precio) × cantidad,
 * menos la comisión.
 */
import type { AccionPlan, CondicionRegla, EstadoOrden, LadoOrden, Prisma } from "@prisma/client";
import type { EstadoNivel } from "@/plan/niveles";

type Decimal = Prisma.Decimal;

/** El lado de la operación, con las palabras del plan. */
export type LadoSimulado = Extract<AccionPlan, "COMPRAR" | "VENDER">;

/** Decimales del precio límite y de los cierres: la escala de `orden.precioUnitario` y `precio_cierre.precio`. */
export const DECIMALES_PRECIO = 6;
/** Decimales de la comisión estimada: la escala de `orden.comision` (redondeo mitad hacia arriba). */
export const DECIMALES_COMISION = 4;
/**
 * Los pesos no se redondean (la misma cuenta del tablero). Cada uno arrastra un error menor que 10⁻¹⁸ y cada suma
 * otro menor que 10⁻¹⁷, así que la suma de n pesos queda a menos de n × 10⁻¹⁶ puntos de 100.
 */
export const TOLERANCIA_PESOS_POR_ESPECIE = "1e-16";

export interface PosicionSimulada {
  readonly instrumentoId: string;
  readonly nemotecnico: string;
  /** Acciones de hoy; 0 si ya no tiene (se puede simular comprarla otra vez). */
  readonly cantidad: bigint;
  /** Último cierre guardado; null si no hay (la especie queda fuera de los pesos). */
  readonly cierre: Decimal | null;
}

/** Una fila del plan vigente, con los campos de `regla_plan` (los de `leerReglas` encajan tal cual). */
export interface ReglaSimulada {
  readonly id: string;
  /** null = regla de portafolio. */
  readonly instrumentoId: string | null;
  readonly condicion: CondicionRegla;
  /** Precio de cierre o pesos por orden, según la condición; null en NINGUNA y LIBRE. */
  readonly nivel: Decimal | null;
  readonly accion: AccionPlan;
  readonly cantidad: bigint | null;
  /** Último día en que rige (medianoche UTC, como `@db.Date`); null = sin plazo. */
  readonly plazoHasta: Date | null;
  /** Lo que el dueño escribió en su plan. */
  readonly detalle: string;
}

export interface EstadoSimulado {
  readonly posiciones: readonly PosicionSimulada[];
  /** Caja disponible registrada; puede estar atrasada (por eso pasarla es un aviso y no un error). */
  readonly caja: Decimal;
  readonly reglas: readonly ReglaSimulada[];
}

export interface OperacionSimulada {
  readonly instrumentoId: string;
  readonly lado: LadoSimulado;
  readonly cantidad: bigint;
  readonly precioLimite: Decimal;
}

/** Una orden de la historia (los campos de `orden` que pide la comisión). */
export interface OrdenHistorica {
  readonly lado: LadoOrden;
  readonly estado: EstadoOrden;
  /** Sin comisión. */
  readonly totalInvertido: Decimal;
  readonly comision: Decimal;
}

export interface ContextoSimulacion {
  readonly ordenes: readonly OrdenHistorica[];
  /** El día de hoy en Colombia a medianoche UTC (`fechaEnBogota`): las reglas con el plazo vencido no rigen. */
  readonly hoy: Date;
}

export interface EfectoEspecie {
  readonly instrumentoId: string;
  readonly nemotecnico: string;
  readonly cantidadAntes: bigint;
  readonly cantidadDespues: bigint;
  /** cantidad × cierre; 0 sin acciones; null con acciones y sin cierre. */
  readonly valorAntes: Decimal | null;
  readonly valorDespues: Decimal | null;
  /** valor / valor de las acciones × 100, sin redondear; null sin valor o si el valor de las acciones es 0. */
  readonly pesoAntesPct: Decimal | null;
  readonly pesoDespuesPct: Decimal | null;
}

/** Lo que dice la historia de órdenes de un lado: Σ comisión / Σ valor sin comisión. */
export type TasaComision =
  | {
      readonly estado: "ESTIMABLE";
      readonly sumaComisiones: Decimal;
      readonly sumaValor: Decimal;
      /** sumaComisiones / sumaValor, sin redondear (para mostrarla). */
      readonly tasa: Decimal;
      readonly ordenesBase: number;
    }
  | { readonly estado: "SIN_HISTORIA" };

export type ComisionEstimada =
  | { readonly estado: "ESTIMADA"; readonly valor: Decimal; readonly tasa: Decimal; readonly ordenesBase: number }
  | { readonly estado: "SIN_HISTORIA" };

/** El precio de la orden frente al nivel de una regla de cierre, cuando queda del lado que la toca. */
export type FrenteAlNivel = Extract<EstadoNivel, { readonly estado: "TOCADA" | "EN_EL_NIVEL" }>;

export type Afectacion =
  | { readonly tipo: "MONTO_ORDEN_BAJO"; readonly montoMinimo: Decimal }
  | { readonly tipo: "PRECIO_DEL_LADO_DEL_NIVEL"; readonly frente: FrenteAlNivel }
  | { readonly tipo: "OTRA_ACCION"; readonly accionDelPlan: AccionPlan };

export interface ReglaAfectada {
  readonly regla: ReglaSimulada;
  readonly afectaciones: readonly [Afectacion, ...Afectacion[]];
}

export interface EspecieNombrada {
  readonly instrumentoId: string;
  readonly nemotecnico: string;
}

export type AvisoSimulacion =
  | { readonly codigo: "COMPRA_SUPERA_CAJA"; readonly caja: Decimal; readonly necesario: Decimal; readonly conComision: boolean }
  | { readonly codigo: "ESPECIES_SIN_CIERRE"; readonly especies: readonly [EspecieNombrada, ...EspecieNombrada[]] };

export type ErrorSimulacion =
  | { readonly codigo: "LADO_INVALIDO" }
  | { readonly codigo: "CANTIDAD_NO_POSITIVA" }
  | { readonly codigo: "PRECIO_NO_POSITIVO" }
  | { readonly codigo: "PRECIO_FUERA_DE_ESCALA" }
  | { readonly codigo: "ESPECIE_DESCONOCIDA" }
  | { readonly codigo: "VENTA_SUPERA_TENENCIA"; readonly tiene: bigint; readonly pide: bigint }
  | { readonly codigo: "ORDEN_FUERA_DE_RANGO" };

export interface Simulacion {
  /** Las especies con acciones antes o después, en el orden del estado. */
  readonly especies: readonly EfectoEspecie[];
  readonly valorAccionesAntes: Decimal;
  readonly valorAccionesDespues: Decimal;
  readonly cajaAntes: Decimal;
  /** Compra: caja − valor − comisión; venta: caja + valor − comisión. Sin historia, sin comisión. */
  readonly cajaDespues: Decimal;
  /** cantidad × precio límite, sin comisión. */
  readonly valorOrden: Decimal;
  readonly comision: ComisionEstimada;
  /** Las reglas que rigen hoy y que la orden toca, en el orden del plan. */
  readonly reglasAfectadas: readonly ReglaAfectada[];
  readonly avisos: readonly AvisoSimulacion[];
}

export type ResultadoSimulacion =
  | { readonly ok: true; readonly simulacion: Simulacion }
  | { readonly ok: false; readonly errores: readonly [ErrorSimulacion, ...ErrorSimulacion[]] };
