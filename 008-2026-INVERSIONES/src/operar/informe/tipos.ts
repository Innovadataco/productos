/**
 * Tipos del informe para operar (frente operar-informe, hito O1 de la fase E). Dinero en Prisma.Decimal, cantidades
 * en bigint y fechas de negocio (medianoche UTC). La acción y la cantidad de cada regla van como campos propios, tal
 * como están en el plan: el texto lo arma la pantalla, nunca un modelo. Informa; no emite juicios sobre operar.
 */
import type { AccionPlan, CondicionRegla, Prisma, TipoDividendo } from "@prisma/client";
import type { Proximo } from "@/datos-oficiales/decretos/proximos";
import type { CierreLeido, ReglaLeida } from "@/plan/lectura";
import type { CalendarioBvc } from "@/precios/negociacion";
import type { Tablero } from "@/tablero/calculo";

type Decimal = Prisma.Decimal;

/** La versión del plan que rige hoy, con sus reglas (la elige el lector con `vigenteEn`). */
export interface PlanVigente {
  readonly numero: number;
  readonly vigenteDesde: Date;
  readonly reglas: readonly ReglaLeida[];
}

export interface EntradasInforme {
  /** El cálculo del tablero (`calcularTablero`, por `obtenerResumen`): posiciones, pesos, frescura y referencia. */
  readonly tablero: Tablero;
  /** Nemotécnicos con ventas sin asignar: no entran en el tablero. */
  readonly incompletas: readonly string[];
  readonly calendario: CalendarioBvc;
  readonly plan: PlanVigente | null;
  /** El último cierre de cada especie de las reglas (`ultimosCierres`, la fuente de /plan), por id de especie. */
  readonly cierresDeReglas: ReadonlyMap<string, CierreLeido>;
  /** Los próximos ex-dividendos (`leerProximos`): vigentes, no anulados y con fecha ex desde hoy. */
  readonly proximos: readonly Proximo[];
}

export interface CierreDia {
  readonly precio: Decimal;
  readonly fecha: Date;
}

export interface EspecieInforme {
  readonly instrumentoId: string;
  readonly nemotecnico: string;
  readonly cantidad: bigint;
  readonly cierre: (CierreDia & { readonly verificado: boolean }) | null;
  readonly valor: Decimal | null;
  readonly pesoPct: Decimal | null;
  /** Ganancia o pérdida sin vender: valor − costo de lo que queda. */
  readonly sinVender: Decimal | null;
  readonly sinVenderPct: Decimal | null;
  /** El cierre es anterior a la fecha de referencia del tablero. */
  readonly cierreAtrasado: boolean;
}

export interface EstadoInforme {
  /** Las especies vivas, en el orden del tablero (por valor). */
  readonly especies: readonly EspecieInforme[];
  readonly valorAcciones: Decimal;
  readonly sinVender: Decimal;
  readonly especiesSinPrecio: number;
  readonly especiesAtrasadas: number;
  readonly incompletas: readonly string[];
}

/**
 * Cómo está la regla hoy frente a su nivel:
 * - TOCADA, EN_EL_NIVEL y A_DISTANCIA salen de `estadoDelNivel` con un cierre al día;
 * - SIN_CIERRE_AL_DIA: la especie no tiene cierre, el suyo es anterior a la referencia o no hay referencia;
 * - POR_ORDEN: MONTO_ORDEN_BAJO (pesos por orden, no un precio); POSTURA: NINGUNA o LIBRE;
 * - SIN_NIVEL: una regla de cierre sin nivel (la validación del plan no lo deja; se informa en vez de inventar).
 */
export type EstadoRegla =
  | { readonly tipo: "TOCADA"; readonly lado: "BAJO" | "SOBRE"; readonly cierre: CierreDia }
  | { readonly tipo: "EN_EL_NIVEL"; readonly cierre: CierreDia }
  | { readonly tipo: "A_DISTANCIA"; readonly distanciaPct: Decimal; readonly cierre: CierreDia }
  | { readonly tipo: "SIN_CIERRE_AL_DIA"; readonly ultimo: CierreDia | null }
  | { readonly tipo: "POR_ORDEN" }
  | { readonly tipo: "POSTURA" }
  | { readonly tipo: "SIN_NIVEL" };

export type GrupoRegla = "SE_CUMPLE" | "CERCANA" | "RESTO";

export interface ReglaInforme {
  readonly id: string;
  readonly instrumentoId: string | null;
  /** null: regla de portafolio. */
  readonly especie: string | null;
  readonly condicion: CondicionRegla;
  readonly nivel: Decimal | null;
  readonly accion: AccionPlan;
  readonly cantidad: bigint | null;
  readonly plazoHasta: Date | null;
  readonly plazoVencido: boolean;
  readonly detalle: string;
  readonly estado: EstadoRegla;
  readonly grupo: GrupoRegla;
}

export interface ReglasInforme {
  /** null: hoy no rige ninguna versión del plan. */
  readonly version: { readonly numero: number; readonly vigenteDesde: Date } | null;
  readonly seCumplen: readonly ReglaInforme[];
  readonly cercanas: readonly ReglaInforme[];
  readonly resto: readonly ReglaInforme[];
}

export type FechaInforme =
  | {
      readonly tipo: "EX_DIVIDENDO"; readonly fecha: Date; readonly id: string; readonly especie: string | null;
      readonly tipoDividendo: TipoDividendo; readonly cuota: number; readonly valorPorAccion: Decimal; readonly fechaPago: Date;
      /** Acciones de la especie según las órdenes cargadas; negativa si faltan compras. */
      readonly tenencia: bigint;
    }
  | {
      readonly tipo: "PLAZO"; readonly fecha: Date; readonly id: string; readonly especie: string | null;
      readonly accion: AccionPlan; readonly cantidad: bigint | null; readonly condicion: CondicionRegla; readonly nivel: Decimal | null;
    };

export interface Informe {
  readonly hoy: Date;
  /** El último día de la ventana de las fechas (hoy + DIAS_FECHAS). */
  readonly hasta: Date;
  /** La fecha de referencia del tablero: el cierre más reciente entre las especies vivas. */
  readonly referencia: Date | null;
  /** La carga de precios se detuvo: la referencia es anterior a la rueda anterior a hoy. */
  readonly preciosAtrasados: boolean;
  readonly estado: EstadoInforme;
  readonly reglas: ReglasInforme;
  readonly fechas: readonly FechaInforme[];
}
