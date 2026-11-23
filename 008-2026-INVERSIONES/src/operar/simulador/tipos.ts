/**
 * Tipos del simulador «¿y si…?» (O2): una operación que el dueño escribe y sus efectos sobre su portafolio, con sus
 * propios datos. Puro: sin base, sin red y sin reloj (el día de hoy llega en el contexto). Dinero en Prisma.Decimal y
 * cantidades en bigint. Muestra efectos (pesos, caja, comisión estimada y reglas del plan), nunca un juicio.
 *
 * Valoración: las acciones se valoran a su último cierre (como el tablero) y la orden mueve la caja a su precio
 * límite. Por eso una compra a un precio distinto del cierre cambia el patrimonio en (cierre − precio) × cantidad,
 * menos la comisión.
 *
 * Las entradas encajan sin mapeo con lo que ya se lee: las filas del tablero (`[...tablero.filas,
 * ...tablero.cerradas]`) son posiciones, `leerReglas` da las reglas y un `select` de `orden` da la historia.
 */
import type { AccionPlan, CondicionRegla, EstadoOrden, LadoOrden, Prisma } from "@prisma/client";
import type { EstadoNivel } from "@/plan/niveles";

type Decimal = Prisma.Decimal;

/** Una lista con al menos un elemento. */
export type NoVacia<T> = readonly [T, ...T[]];

/** El lado de la operación, con las palabras del plan. */
export type LadoSimulado = Extract<AccionPlan, "COMPRAR" | "VENDER">;

/** Decimales del precio límite, los cierres, los niveles y la caja: la escala de `orden.precioUnitario`. */
export const DECIMALES_PRECIO = 6;
/** Decimales de la comisión estimada: la escala de `orden.comision` (redondeo mitad hacia arriba). */
export const DECIMALES_COMISION = 4;
/**
 * Los pesos no se redondean (la misma cuenta del tablero). Cada uno arrastra un error menor que 10⁻¹⁸ y cada suma
 * otro menor que 10⁻¹⁷, así que la suma de n pesos queda a menos de n × 10⁻¹⁶ puntos de 100.
 */
export const TOLERANCIA_PESOS_POR_ESPECIE = "1e-16";

export interface EspecieNombrada {
  readonly instrumentoId: string;
  readonly nemotecnico: string;
}

export interface PosicionSimulada extends EspecieNombrada {
  /** Acciones de hoy; 0 si ya no tiene (se puede simular comprarla otra vez). */
  readonly cantidad: bigint;
  /** Último cierre guardado (basta su precio: la forma de `FilaTablero.cierre`); null si no hay. */
  readonly cierre: { readonly precio: Decimal } | null;
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
  /** Lo que el dueño escribió en su plan (hasta 2000 caracteres, como `regla_plan_detalle_chk`). */
  readonly detalle: string;
}

export interface EstadoSimulado {
  /** Todas las especies que se pueden simular: las vivas y las ya vendidas (cantidad 0). Una que no está es desconocida. */
  readonly posiciones: readonly PosicionSimulada[];
  /** Caja disponible registrada; puede estar atrasada (por eso pasarla es un aviso y no un error). */
  readonly caja: Decimal;
  readonly reglas: readonly ReglaSimulada[];
}

/**
 * Lo que el dueño escribe. Llega de un formulario: quien conecte la pantalla convierte el texto a bigint y Decimal (con
 * un tope de largo antes de convertir) y el motor revisa igual, en ejecución, lado, cantidad y precio.
 */
export interface OperacionSimulada {
  readonly instrumentoId: string;
  readonly lado: LadoSimulado;
  readonly cantidad: bigint;
  readonly precioLimite: Decimal;
}

/** Una orden de la historia (los campos de `orden` que pide la comisión). */
export interface OrdenHistorica {
  /** Día de la operación (medianoche UTC, como `orden.fechaOperacion`): el control de la tarifa cuenta desde que rige. */
  readonly fecha: Date;
  readonly lado: LadoOrden;
  readonly estado: EstadoOrden;
  /** Sin comisión. */
  readonly totalInvertido: Decimal;
  readonly comision: Decimal;
}

/** Las casas de bolsa de la tarifa (O5): Trii y Acciones & Valores. */
export const COMISIONISTAS = ["TRII", "AV"] as const;
export type Comisionista = (typeof COMISIONISTAS)[number];

/** Un cargo además de la comisión: un porcentaje del valor de la orden o un fijo en pesos (sin IVA). */
export interface CargoTarifa {
  readonly nombre: string;
  readonly tipo: "PCT" | "FIJO";
  readonly valor: Decimal;
}

/**
 * La tarifa vigente de un comisionista para un lado (O5, `tarifa_comision`), tal como la cargó el dueño. La comisión:
 * max(valor × porcentaje / 100, mínimo) + fijo; el IVA (%) sobre esa comisión; los otros cargos aparte.
 */
export interface TarifaSimulada {
  readonly version: number;
  readonly comisionista: Comisionista;
  readonly lado: LadoOrden;
  readonly porcentaje: Decimal;
  readonly minimoPorOrden: Decimal;
  readonly fijoPorOrden: Decimal;
  readonly ivaPct: Decimal;
  readonly otrosCargos: readonly CargoTarifa[];
  /** Medianoche UTC, como `@db.Date`. */
  readonly vigenteDesde: Date;
}

/** Las tarifas vigentes de un comisionista, por lado; sin la de un lado, la comisión de ese lado sale de la historia. */
export type TarifasVigentes = Readonly<Partial<Record<LadoOrden, TarifaSimulada>>>;

export interface ContextoSimulacion {
  readonly ordenes: readonly OrdenHistorica[];
  /** El día de hoy en Colombia a medianoche UTC (`fechaEnBogota`): las reglas con el plazo vencido no rigen. */
  readonly hoy: Date;
  /** Opcional (O5): la tarifa real vigente; con la de ese lado, la comisión sale de ella y no de la historia. */
  readonly tarifas?: TarifasVigentes;
}

/**
 * Cómo se valora una tenencia: sin cierre (con acciones y sin precio: no tiene valor ni peso) o valorada (cantidad ×
 * cierre, 0 sin acciones) con su peso sobre el valor de las acciones, sin redondear; el peso es null solo si ese valor
 * es 0.
 */
export type Valoracion =
  | { readonly estado: "SIN_CIERRE" }
  | { readonly estado: "VALORADA"; readonly valor: Decimal; readonly pesoPct: Decimal | null };

export interface Tenencia {
  readonly cantidad: bigint;
  readonly valoracion: Valoracion;
}

export interface EfectoEspecie extends EspecieNombrada {
  readonly antes: Tenencia;
  readonly despues: Tenencia;
}

/** Lo que dice la historia de órdenes de un lado: la suma de sus comisiones y la de sus valores sin comisión. */
export type TasaComision =
  | { readonly estado: "ESTIMABLE"; readonly lado: LadoOrden; readonly sumaComisiones: Decimal; readonly sumaValor: Decimal; readonly ordenesBase: number }
  | { readonly estado: "SIN_HISTORIA" };

/**
 * La comisión de la orden: con la tarifa vigente (TARIFA, con la tarifa que se usó), estimada con la historia (lleva el
 * lado y cuántas órdenes de ese lado contó) o sin historia (no se estima).
 */
export type ComisionEstimada =
  | { readonly estado: "TARIFA"; readonly lado: LadoOrden; readonly valor: Decimal; readonly tarifa: TarifaSimulada }
  | { readonly estado: "ESTIMADA"; readonly lado: LadoOrden; readonly valor: Decimal; readonly ordenesBase: number }
  | { readonly estado: "SIN_HISTORIA" };

/** El precio de la orden frente al nivel de una regla de cierre, cuando queda del lado que la toca. */
export type FrenteAlNivel = Extract<EstadoNivel, { estado: "TOCADA" | "EN_EL_NIVEL" }>;

/** Lo que toca la orden en una regla. Los datos (nivel, acción, cantidad) se leen de la regla: no se copian. */
export type Afectacion =
  | { readonly tipo: "MONTO_ORDEN_BAJO" }
  | { readonly tipo: "PRECIO_DEL_LADO_DEL_NIVEL"; readonly frente: FrenteAlNivel }
  | { readonly tipo: "OTRA_ACCION" };

export interface ReglaAfectada {
  readonly regla: ReglaSimulada;
  readonly afectaciones: NoVacia<Afectacion>;
}

export type AvisoSimulacion =
  | { readonly codigo: "COMPRA_SUPERA_CAJA"; readonly caja: Decimal; readonly necesario: Decimal; readonly conComision: boolean }
  | { readonly codigo: "ESPECIES_SIN_CIERRE"; readonly especies: NoVacia<EspecieNombrada> };

export type ErrorSimulacion =
  | { readonly codigo: "LADO_INVALIDO" }
  | { readonly codigo: "CANTIDAD_NO_POSITIVA" }
  | { readonly codigo: "CANTIDAD_FUERA_DE_RANGO" }
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
  /** Compra: caja − valor − comisión; venta: caja + valor − comisión. Sin tarifa ni historia, sin comisión. */
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
  | { readonly ok: false; readonly errores: NoVacia<ErrorSimulacion> };
