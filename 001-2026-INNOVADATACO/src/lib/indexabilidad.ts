/**
 * ¿Se puede encontrar este documento si alguien lo busca? (spec 013, FR-002)
 *
 * Base Oficial existe para que una búsqueda encuentre la norma aplicable. Un
 * documento sin fragmentos **no se puede encontrar nunca**, pero en el listado
 * se veía igual que los demás: el usuario creía tenerlo y no lo tenía.
 *
 * La respuesta se **deriva** de un hecho ya almacenado —tener o no fragmentos—
 * y no de un campo que alguien deba acordarse de actualizar (RZ-2). Un campo
 * guardado se desincroniza el día que se borra un chunk; un cálculo, no.
 *
 * Ojo con `status`: **no** sirve para esto. Hoy `needs_review` agrupa "no se
 * pudo leer el PDF", "se leyó pero no había modelo de IA" y "falló la
 * vectorización". En la BD viva hay un documento con 68 fragmentos —
 * perfectamente buscable — en `needs_review`. Un estado que vale para todo no
 * informa de nada.
 */

/** Lo mínimo que hace falta saber de un documento para decidir. */
export interface DocumentoIndexable {
  status: string;
  contenidoTexto?: string | null;
  processingError?: string | null;
  /** Número de fragmentos indexados. */
  chunks: number;
}

export interface Indexabilidad {
  /** `true` solo si la búsqueda puede encontrarlo hoy. */
  buscable: boolean;
  /** `true` mientras el pipeline aún trabaja: no está roto, está en camino (FR-004). */
  enProceso: boolean;
  /** Motivo en lenguaje llano cuando no es buscable. `null` si lo es. */
  motivo: string | null;
}

/** Estados en los que el pipeline todavía puede producir fragmentos. */
const ESTADOS_EN_CURSO = ["pending", "queued", "processing"];

export function evaluarIndexabilidad(doc: DocumentoIndexable): Indexabilidad {
  if (doc.chunks > 0) {
    return { buscable: true, enProceso: false, motivo: null };
  }

  // Todavía no es un fallo: el pipeline está trabajando (FR-004).
  if (ESTADOS_EN_CURSO.includes(doc.status)) {
    return { buscable: false, enProceso: true, motivo: null };
  }

  // Sin texto extraído: el PDF no se pudo leer. Es el caso de los `Timeout` y
  // los `Invalid XRef stream header`, y también el de un escaneo sin capa de
  // texto — que se marca aquí, pero se resuelve en SPEC-010 (OCR).
  if (!doc.contenidoTexto || doc.contenidoTexto.trim() === "") {
    return {
      buscable: false,
      enProceso: false,
      motivo: "No se pudo leer el texto del PDF, así que no aparecerá en las búsquedas.",
    };
  }

  // Hay texto pero no llegó a indexarse: el fallo está después de la lectura.
  return {
    buscable: false,
    enProceso: false,
    motivo: "El texto se leyó, pero no llegó a indexarse: todavía no aparecerá en las búsquedas.",
  };
}
