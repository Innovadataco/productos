/**
 * Vistas de las pantallas del plan y del diario (fase B, corte 3), ya serializadas: fechas «AAAA-MM-DD», cifras en
 * texto decimal exacto. El formato (pesos, fechas en palabras) va en los componentes y en `textos.ts`.
 */
import type { AccionPlan, CondicionRegla, LadoOrden } from "@prisma/client";
import type { MotivoSinDividendos } from "@/plan/dividendos";
import type { EstadoResultado, Veredicto } from "@/plan/resultado";
import type { Procedencia } from "../_comun/fecha-dato/tipos";

export type CierreVista =
  | { readonly estado: "NO_APLICA" }
  | { readonly estado: "SIN_CIERRE" }
  | { readonly estado: "SIN_LOTES" }
  | { readonly estado: "AL_DIA"; readonly ultimo: string; readonly precio: string; readonly verificado: boolean }
  | { readonly estado: "SIN_NEGOCIACION"; readonly desde: string; readonly ultimo: string; readonly precio: string; readonly verificado: boolean }
  | { readonly estado: "SIN_CALENDARIO"; readonly ultimo: string; readonly anio: number; readonly precio: string; readonly verificado: boolean };

export type NivelVista =
  | { readonly estado: "SIN_NIVEL" }
  | { readonly estado: "SIN_CIERRE_AL_DIA" }
  | { readonly estado: "TOCADA"; readonly lado: "BAJO" | "SOBRE" }
  | { readonly estado: "EN_EL_NIVEL" }
  | { readonly estado: "A_DISTANCIA"; readonly distanciaPct: string };

export interface ResultadoVista {
  readonly estado: EstadoResultado;
  readonly resultadoPesos: string | null;
  readonly resultadoPrecio: string | null;
  readonly dividendosPesos: string | null;
  readonly veredicto: Veredicto | null;
  readonly verificado: boolean;
  readonly incluyeDividendos: boolean;
  readonly motivoSinDividendos: MotivoSinDividendos | null;
  readonly escisionEnVentana: boolean;
  /** La fecha objetivo más lejana de sus tramos (para «pendiente hasta»). */
  readonly fechaObjetivo: string | null;
  /** La ventana donde falta el cierre (el primer tramo sin precio). */
  readonly sinPrecioDesde: string | null;
  readonly sinPrecioHasta: string | null;
}

export interface ConteoVista {
  readonly funciono: number;
  readonly noFunciono: number;
  readonly neutro: number;
  readonly sinVeredicto: number;
  readonly pendiente: number;
  readonly sinPrecio: number;
  readonly sinOrden: number;
}

// ─── /plan ───
export interface VersionVista {
  readonly numero: number;
  readonly desde: string;
  readonly motivo: string;
  readonly tipo: "VIGENTE" | "HISTORICA" | "PROGRAMADA";
  /** Es la que se está viendo. */
  readonly actual: boolean;
}

export interface ReglaVista {
  readonly id: string;
  /** null: regla de portafolio. */
  readonly especie: string | null;
  readonly condicion: CondicionRegla;
  readonly nivel: string | null;
  readonly accion: AccionPlan;
  readonly cantidad: string | null;
  readonly plazo: string | null;
  readonly plazoVencido: boolean;
  readonly detalle: string;
  readonly decisiones: number;
  /** null en una versión que no rige hoy (sin cierres ni distancia). */
  readonly cierre: CierreVista | null;
  readonly frente: NivelVista | null;
  /** De dónde y de cuándo es su último cierre (frente fecha-hora-datos); null sin cierre o en una versión que no rige. */
  readonly procedencia: Procedencia | null;
}

export interface VistaPlan {
  readonly version: VersionVista;
  readonly aprobadaEl: string;
  readonly reglas: readonly ReglaVista[];
  readonly conCierres: boolean;
  readonly referencia: string | null;
  readonly preciosAtrasados: boolean;
  /** Alguna especie está «sin negociación» (va la nota al pie). */
  readonly hayInferencia: boolean;
  readonly programada: VersionVista | null;
}

export type DatosPlan =
  | { readonly estado: "SIN_PLAN" }
  | { readonly estado: "VERSION_INVALIDA"; readonly versiones: readonly VersionVista[] }
  | { readonly estado: "VERSION"; readonly vista: VistaPlan; readonly versiones: readonly VersionVista[] };

// ─── /decisiones ───
export interface ReglaCitadaVista {
  readonly id: string;
  readonly version: number;
  readonly condicion: CondicionRegla;
  readonly nivel: string | null;
  readonly accion: AccionPlan;
}

export interface DecisionVista {
  readonly id: string;
  readonly fecha: string;
  readonly especie: string;
  readonly accion: AccionPlan;
  readonly excepcion: boolean;
  readonly cantidad: string | null;
  readonly regla: ReglaCitadaVista | null;
  readonly motivo: string;
  readonly ordenes: number;
  readonly corrige: { readonly id: string; readonly fecha: string } | null;
  readonly corregidaPor: { readonly id: string; readonly fecha: string } | null;
  /** null si fue reemplazada (no se mide). */
  readonly d30: ResultadoVista | null;
  readonly d90: ResultadoVista | null;
}

export interface OrdenVista {
  readonly id: string;
  readonly fecha: string;
  readonly especie: string;
  readonly lado: LadoOrden;
  readonly cantidad: string;
  readonly filaNo: number;
  /** Día en Colombia en que se cargó el archivo. */
  readonly cargadaEl: string;
}

export interface VistaDiario {
  readonly decisiones: readonly DecisionVista[];
  readonly truncado: boolean;
  readonly resumen: { readonly d30: ConteoVista; readonly d90: ConteoVista };
  readonly inicioPlan: string | null;
  readonly sinDecision: readonly OrdenVista[];
  readonly anteriores: readonly OrdenVista[];
  readonly filtro: { readonly especie: string | null; readonly version: number } | null;
  readonly filtroInvalido: boolean;
}

// ─── /decisiones/[id] ───
export interface DividendoVista {
  readonly fechaPago: string;
  readonly montoNeto: string;
  readonly tenencia: string;
  readonly porAccion: string;
  readonly atribuido: string;
}

export interface TramoVista {
  readonly desde: string;
  readonly hasta: string;
  readonly estado: "CALCULADO" | "PENDIENTE" | "SIN_PRECIO";
  readonly precioBase: { readonly precio: string; readonly fecha: string } | null;
  readonly precioObjetivo: { readonly precio: string; readonly fecha: string } | null;
  readonly resultadoPrecio: string | null;
  /** Con el signo de la acción (vender resta). */
  readonly dividendos: { readonly medible: true; readonly total: string; readonly usados: readonly DividendoVista[] } | { readonly medible: false; readonly motivo: MotivoSinDividendos } | null;
}

export interface HorizonteVista {
  readonly dias: 30 | 90;
  readonly resultado: ResultadoVista;
  readonly tramos: readonly TramoVista[];
}

export interface OrdenEnlazadaVista {
  readonly id: string;
  readonly fecha: string;
  readonly lado: LadoOrden;
  readonly cantidad: string;
  readonly totalEstimado: string;
  readonly filaNo: number;
  readonly cargadaEl: string;
}

export interface EnlaceVista {
  readonly id: string;
  readonly creadoEl: string;
  readonly vigente: boolean;
  readonly motivo: string | null;
}

export interface VistaDecision {
  readonly decision: DecisionVista;
  readonly version: { readonly numero: number; readonly desde: string };
  /** «AAAA-MM-DD HH:MM» en Colombia. */
  readonly registradaEl: string;
  readonly ordenes: readonly OrdenEnlazadaVista[];
  readonly enlaces: readonly EnlaceVista[];
  /** null si fue reemplazada. */
  readonly horizontes: readonly HorizonteVista[] | null;
}

export type DatosDecision = { readonly estado: "NO_EXISTE" } | { readonly estado: "DECISION"; readonly vista: VistaDecision };
