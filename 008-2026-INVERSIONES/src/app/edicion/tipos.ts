/**
 * Lo que las páginas del área de edición (fase B, PR-B) le pasan a sus formularios de cliente: ya serializado (fechas
 * «AAAA-MM-DD», nivel y cantidad en es-CO, como los escribe el dueño). Solo tipos: lo importan servidor y cliente.
 */
import type { AccionPlan, CondicionRegla, LadoOrden } from "@prisma/client";

export interface EspecieOpcion {
  readonly id: string;
  readonly nemotecnico: string;
}

/** Una regla en el formulario: lo que el dueño ve y escribe (vacío = sin valor). */
export interface ReglaEditable {
  /** Nulo = regla de portafolio (todas las especies). */
  readonly instrumentoId: string | null;
  readonly condicion: CondicionRegla;
  readonly nivel: string;
  readonly accion: AccionPlan;
  readonly cantidad: string;
  readonly plazoHasta: string;
  readonly detalle: string;
}

export interface VersionResumen {
  readonly numero: number;
  readonly desde: string;
  readonly tipo: "VIGENTE" | "PROGRAMADA" | "HISTORICA";
}

export interface DatosEdicionPlan {
  readonly hoy: string;
  /** La última versión cargada (contra ella se crea la nueva); nula si todavía no hay plan. */
  readonly ultima: VersionResumen | null;
  /** La versión precargada en el formulario. */
  readonly base: VersionResumen | null;
  readonly versiones: readonly VersionResumen[];
  readonly especies: readonly EspecieOpcion[];
  readonly reglas: readonly ReglaEditable[];
  /** Fecha propuesta: hoy, o la de la última versión si empieza después (la vigencia no retrocede). */
  readonly vigenteDesde: string;
}

export interface ReglaCitable {
  readonly id: string;
  readonly instrumentoId: string | null;
  readonly accion: AccionPlan;
  /** «FICTA · Cierre por encima de $ 1.200 → vender». */
  readonly texto: string;
}

export interface VersionConReglas {
  readonly numero: number;
  readonly desde: string;
  readonly reglas: readonly ReglaCitable[];
}

/** Una orden aprobada de Trii sin decisión registrada. */
export interface OrdenOpcion {
  readonly id: string;
  readonly instrumentoId: string;
  readonly fecha: string;
  readonly lado: LadoOrden;
  /** «14-nov-2024 · FICTI · Venta de 20». */
  readonly texto: string;
}

export interface DecisionEditable {
  readonly fechaDecision: string;
  readonly instrumentoId: string;
  readonly accion: AccionPlan;
  readonly cantidad: string;
  readonly reglaId: string;
  readonly excepcion: boolean;
  readonly motivo: string;
  readonly ordenId: string;
}

export type DatosEdicionDecision =
  | { readonly estado: "SIN_PLAN" }
  | { readonly estado: "CORRECCION_INVALIDA" }
  | {
      readonly estado: "LISTO";
      readonly hoy: string;
      readonly especies: readonly EspecieOpcion[];
      readonly versiones: readonly VersionConReglas[];
      readonly ordenes: readonly OrdenOpcion[];
      readonly inicial: DecisionEditable;
      /** La decisión que se corrige; nula en una decisión nueva. */
      readonly corrige: { readonly id: string; readonly fecha: string; readonly especie: string } | null;
    };

export type DatosEdicionEnlace =
  | { readonly estado: "NO_EXISTE" }
  | { readonly estado: "REEMPLAZADA"; readonly corregidaPor: string }
  | { readonly estado: "NO_ACTUAR"; readonly id: string }
  | { readonly estado: "LISTO"; readonly decision: { readonly id: string; readonly texto: string }; readonly ordenes: readonly OrdenOpcion[] };

/** Un error de un campo, como lo devuelve la ruta (solo campo y código). */
export interface CampoConError {
  readonly campo: string;
  readonly codigo: string;
}
