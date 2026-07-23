/**
 * Enriquecimiento del texto que se vectoriza (spec 003, FR-026).
 *
 * El texto que se vectoriza deja de ser el que se almacena: el fragmento se
 * envía al modelo de embeddings **precedido de un prefijo de metadatos**
 * (tipo, número, año, entidad, fecha). El `contenido` que se guarda y el que
 * indexa la rama FTS NO llevan prefijo (FR-027).
 *
 * **Apagado por defecto** (D-031): con la config por defecto el prefijo es "" y
 * el texto vectorizado es idéntico al contenido.
 *
 * **Corrige la fuga de etiqueta (FR-028, D-032)**: a diferencia del arnés de
 * evaluación, esta versión de producción NUNCA antepone el id ni el nombre de
 * archivo del documento. Solo campos de negocio explícitos.
 *
 * Puro: sin BD, sin red.
 */

/** Campos de negocio admitidos en el prefijo. `titulo` NO se incluye a propósito
 *  (era el vector de la fuga de etiqueta): el título de producción es de calidad
 *  variable y en el arnés coincidía con la etiqueta. */
export type CampoEnriquecimiento = "tipo" | "numero" | "anio" | "entidad" | "fecha";

export interface ConfigEnriquecimiento {
  aplicar: boolean;
  campos: CampoEnriquecimiento[];
}

/** Datos de negocio del documento que pueden entrar al prefijo. */
export interface MetadatosDocumento {
  tipo?: string | null;
  numero?: string | null;
  anio?: number | string | null;
  entidad?: string | null;
  fecha?: string | null;
}

/** Config por defecto: enriquecimiento APAGADO (D-031). */
export const ENRIQUECIMIENTO_APAGADO: ConfigEnriquecimiento = { aplicar: false, campos: [] };

const ORDEN_CAMPOS: CampoEnriquecimiento[] = ["tipo", "numero", "anio", "entidad", "fecha"];

/**
 * Huella estable de la configuración: identifica el espacio vectorial junto con
 * el modelo (FR-021/FR-026). Determinista: misma config → misma huella, sin
 * depender del orden en que se listen los campos.
 */
export function huellaEnriquecimiento(config: ConfigEnriquecimiento): string {
  if (!config.aplicar || config.campos.length === 0) return "none";
  const campos = ORDEN_CAMPOS.filter((c) => config.campos.includes(c));
  return campos.length ? `campos:${campos.join(",")}` : "none";
}

/** Construye el prefijo de metadatos; "" si el enriquecimiento está apagado. */
export function construirPrefijo(
  doc: MetadatosDocumento,
  config: ConfigEnriquecimiento,
): string {
  if (!config.aplicar) return "";

  const partes: string[] = [];
  for (const campo of ORDEN_CAMPOS) {
    if (!config.campos.includes(campo)) continue;
    const valor = doc[campo];
    if (valor === undefined || valor === null || `${valor}`.trim() === "") continue;
    partes.push(`${valor}`.trim());
  }

  return partes.length ? `[${partes.join(" · ")}]` : "";
}

/**
 * Texto que se envía al modelo de embeddings. Con el prefijo apagado (default)
 * es idéntico al contenido almacenado (SC-021).
 */
export function textoParaVectorizar(contenido: string, prefijo: string): string {
  return prefijo ? `${prefijo}\n${contenido}` : contenido;
}
