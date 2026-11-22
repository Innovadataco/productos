/**
 * Catálogo cerrado de claves de `hechos-v1`, por tipo de resumen. Cada clave trae su etiqueta genérica en español, su
 * unidad y si se refiere a una especie, si admite dirección y si admite cercanía. Es la única fuente de la etiqueta y
 * de la unidad de un hecho: `construirPaquete` las toma de aquí.
 *
 * Reglas (las cuida `tests/unit/ia/catalogo.test.ts`):
 * - las claves son identificadores en mayúsculas SIN dígitos (la vista ciega no lleva dígitos fuera de los ids);
 * - ninguna etiqueta lleva dígitos, cifras en palabras ni nombres de especie; los horizontes son corto, medio y
 *   largo, y el «3 meses» lo pone el código en la presentación del hecho;
 * - el nombre de la especie es un hecho propio (ESPECIE_NOMBRE); los hechos de una especie lo citan en `sujeto`.
 */
import type { TipoResumen, Unidad } from "./contrato";

export const CLAVE_NOMBRE_ESPECIE = "ESPECIE_NOMBRE";
export type ClaveNombreEspecie = typeof CLAVE_NOMBRE_ESPECIE;

export type ClaveDiario =
  | ClaveNombreEspecie
  | "VALOR_ACCIONES" | "GANANCIA_SIN_VENDER" | "GANANCIA_POR_VENTAS" | "DIVIDENDOS_RECIBIDOS" | "COMISIONES_PAGADAS" | "GANANCIA_TOTAL"
  | "VARIACION_DIA_VALOR" | "VARIACION_DIA_PORCENTAJE" | "ESPECIES_SIN_PRECIO" | "ESPECIES_ATRASADAS"
  | "FECHA_CIERRE_RECIENTE" | "FECHA_CIERRE_MAS_ANTIGUO"
  | "CONCILIACION_CUADRA" | "CONCILIACION_PARCIAL" | "CONCILIACION_NO_CUADRA"
  | "TASA_TRM" | "TASA_TPM" | "TASA_IBR" | "VARIACION_ANUAL_IPC"
  | "FONDO_VALOR" | "FONDO_VALOR_UNIDAD" | "FONDO_FECHA_VALOR"
  | "VALOR_ESPECIE" | "PESO_ESPECIE" | "RENTABILIDAD_ESPECIE" | "CIERRE_ESPECIE" | "FECHA_CIERRE_ESPECIE" | "VARIACION_DIA_ESPECIE";

export type ClaveReglas =
  | ClaveNombreEspecie
  | "CIERRE_ESPECIE" | "FECHA_CIERRE_ESPECIE"
  | "REGLA_NIVEL" | "REGLA_TOCADA" | "REGLA_EN_EL_NIVEL" | "REGLA_DISTANCIA" | "REGLA_SIN_CIERRE_AL_DIA"
  | "REGLA_PLAZO" | "REGLA_DIAS_AL_PLAZO"
  | "PROXIMO_EX_DIVIDENDO" | "DIAS_A_EX_DIVIDENDO" | "DIVIDENDO_POR_ACCION" | "DIVIDENDO_FECHA_PAGO" | "DIVIDENDO_BRUTO_ESTIMADO";

export type ClaveEscenarios =
  | ClaveNombreEspecie
  | "VALOR_INICIAL" | "HORIZONTE_CORTO" | "HORIZONTE_MEDIO" | "HORIZONTE_LARGO"
  | "ESCENARIO_BAJO_CORTO" | "ESCENARIO_BAJO_MEDIO" | "ESCENARIO_BAJO_LARGO"
  | "ESCENARIO_CENTRAL_CORTO" | "ESCENARIO_CENTRAL_MEDIO" | "ESCENARIO_CENTRAL_LARGO"
  | "ESCENARIO_ALTO_CORTO" | "ESCENARIO_ALTO_MEDIO" | "ESCENARIO_ALTO_LARGO"
  | "APORTADO_CORTO" | "APORTADO_MEDIO" | "APORTADO_LARGO"
  | "PROBABILIDAD_BAJO_APORTADO" | "CAIDA_MAXIMA_MEDIANA" | "VOLATILIDAD_ANUAL" | "RENDIMIENTO_ANUAL_HISTORICO" | "FRACCION_PROYECTADA"
  | "VENTANA_DESDE" | "VENTANA_HASTA" | "DIAS_HISTORIA_ESPECIE";

export type ClaveHecho = ClaveDiario | ClaveReglas | ClaveEscenarios;

/** Las claves del catálogo de un tipo. */
export type ClaveDe<T extends TipoResumen> = { readonly DIARIO: ClaveDiario; readonly REGLAS: ClaveReglas; readonly ESCENARIOS: ClaveEscenarios }[T];

/** Si un hecho se refiere a una especie (su `sujeto`, el id de un hecho ESPECIE_NOMBRE anterior). */
export type SujetoCatalogo = "EXIGIDO" | "OPCIONAL" | "NINGUNO";

export interface EntradaCatalogo {
  readonly etiqueta: string;
  readonly unidad: Unidad;
  readonly sujeto: SujetoCatalogo;
  /** Si no, la dirección del hecho es NO_APLICA. */
  readonly admiteDireccion: boolean;
  /** Si no, la cercanía del hecho es NO_APLICA. */
  readonly admiteCercania: boolean;
}

export type Catalogo = { readonly [T in TipoResumen]: Readonly<Record<ClaveDe<T>, EntradaCatalogo>> };

export const CATALOGO: Catalogo = Object.freeze({}) as unknown as Catalogo;

export function entradaDeCatalogo(_tipo: TipoResumen, _clave: string): EntradaCatalogo | null {
  throw new Error("SIN_IMPLEMENTAR");
}

export function clavesDe<T extends TipoResumen>(_tipo: T): readonly ClaveDe<T>[] {
  throw new Error("SIN_IMPLEMENTAR");
}
