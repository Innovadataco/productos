/** Esqueleto (rojo). */
import type { EntradaPaquete, IdHecho, PaqueteHechos, TipoResumen } from "./contrato";
export const CODIGOS_ERROR_PAQUETE = Object.freeze([
  "FORMA_INVALIDA", "CAMPO_DESCONOCIDO", "CAMPO_FALTANTE", "CLAVE_PROHIBIDA", "TIPO_INVALIDO", "HOY_INVALIDO",
  "VERSIONES_CALCULO_INVALIDAS", "AVISOS_INVALIDOS", "SIN_HECHOS", "DEMASIADOS_HECHOS", "ID_NO_CONSECUTIVO",
  "CLAVE_FUERA_DE_CATALOGO", "SUJETO_FALTANTE", "SUJETO_NO_PERMITIDO", "SUJETO_INEXISTENTE", "SUJETO_NO_ES_ESPECIE",
  "VALOR_NO_DECIMAL", "VALOR_NO_FECHA", "VALOR_NO_ENTERO", "VALOR_NEGATIVO", "NOMBRE_INVALIDO", "ESPECIE_REPETIDA",
  "PRESENTACION_INVALIDA", "FUENTE_INVALIDA", "FECHA_INVALIDA", "FECHA_FUTURA", "CALIDAD_INVALIDA", "DIRECCION_INVALIDA",
  "CERCANIA_INVALIDA", "FRESCURA_INVALIDA", "DIRECCION_NO_APLICA", "CERCANIA_NO_APLICA", "OBLIGATORIO_INVALIDO",
] as const);
export type CodigoErrorPaquete = (typeof CODIGOS_ERROR_PAQUETE)[number];

export class ErrorPaquete extends Error {
  override readonly name = "ErrorPaquete";
  constructor(
    readonly codigo: CodigoErrorPaquete,
    readonly hecho: IdHecho | null = null,
    readonly campo: string | null = null,
  ) {
    super(`Paquete de hechos rechazado: ${codigo}${hecho ? ` en ${hecho}` : ""}${campo ? ` (campo ${campo})` : ""}.`);
  }
}

export function idDeHecho(_posicion: number): IdHecho { throw new Error("SIN_IMPLEMENTAR"); }
export function construirPaquete<T extends TipoResumen>(_entrada: EntradaPaquete<T>): PaqueteHechos<T> { throw new Error("SIN_IMPLEMENTAR"); }
