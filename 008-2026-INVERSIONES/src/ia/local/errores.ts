/**
 * Las listas cerradas de la puerta local (Ollama del Mac):
 * - `CODIGOS_ERROR_LOCAL`: una configuración o una opción inválidas son un defecto del código o del despliegue, y
 *   lanzan `ErrorLocal` sin repetir el valor recibido;
 * - `DETALLES_LOCAL`: el `detalle` de cada fallo que vuelve en el resultado, por motivo del contrato. Todos cumplen
 *   `PATRON_DETALLE` (mayúsculas y guion bajo, sin dígitos ni datos del proveedor).
 */
import type { MotivoFalloGenerador } from "../generador";

export const CODIGOS_ERROR_LOCAL = Object.freeze([
  "DESTINO_AUSENTE", "DESTINO_INVALIDO", "DESTINO_FUERA_DE_RANGO", "RUTA_NO_PERMITIDA", "MODELO_NO_APROBADO", "CONFIGURACION_INVALIDA", "LIMITE_INVALIDO",
] as const);
export type CodigoErrorLocal = (typeof CODIGOS_ERROR_LOCAL)[number];

export class ErrorLocal extends Error {
  override readonly name = "ErrorLocal";
  constructor(readonly codigo: CodigoErrorLocal) {
    super(`Puerta local: ${codigo}.`);
  }
}

export const DETALLES_LOCAL = Object.freeze({
  MODELO_NO_DISPONIBLE: Object.freeze([
    "DIGEST_POR_VERIFICAR", "MODELO_NO_ENCONTRADO", "MODELO_AMBIGUO", "DIGEST_NO_COINCIDE", "CONEXION_RECHAZADA", "FALLO_DE_RED", "CONEXION_CORTADA",
  ] as const),
  TIEMPO_AGOTADO: Object.freeze(["LIMITE_DEL_CLIENTE", "LIMITE_EN_ESPERA", "SENAL_ABORTADA"] as const),
  ERROR_PROVEEDOR: Object.freeze([
    "HTTP_REDIRECCION", "HTTP_PROHIBIDO", "HTTP_NO_ENCONTRADO", "HTTP_ERROR_CLIENTE", "HTTP_ERROR_SERVIDOR", "HTTP_ESTADO_INVALIDO",
    "CUERPO_DEMASIADO_GRANDE", "CUERPO_INVALIDO", "MODELO_DISTINTO", "GENERACION_INCOMPLETA", "SALIDA_CORTADA", "RESPUESTA_VACIA",
    "SALIDA_DEMASIADO_LARGA", "FINALIZACION_INESPERADA", "PENSAMIENTO_SIN_JSON", "PEDIDO_INVALIDO", "PEDIDO_NO_CIEGO", "EXCEPCION_INTERNA",
    "CONTEXTO_LLENO",
  ] as const),
} satisfies Partial<Record<MotivoFalloGenerador, readonly string[]>>);

/** Los motivos que puede dar la puerta local (TOPE_MENSUAL y PUERTA_APAGADA no le aplican). */
export type MotivoLocal = keyof typeof DETALLES_LOCAL;
export type DetalleDe<M extends MotivoLocal> = (typeof DETALLES_LOCAL)[M][number];
export type DetalleTiempo = DetalleDe<"TIEMPO_AGOTADO">;

export type FalloLocal = {
  readonly [M in MotivoLocal]: { readonly ok: false; readonly puerta: "local"; readonly motivo: M; readonly detalle: DetalleDe<M> };
}[MotivoLocal];

export function falloLocal<M extends MotivoLocal>(motivo: M, detalle: DetalleDe<M>): FalloLocal {
  return Object.freeze({ ok: false, puerta: "local", motivo, detalle }) as FalloLocal;
}
