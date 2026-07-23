/**
 * Enriquecimiento de fragmentos con metadatos del acto (hipótesis D-027-b).
 *
 * Problema observado en la evaluación del 2026-07-22: entre el 60 % y el 88 % de
 * los fallos de todos los modelos son confusiones entre documentos hermanos
 * (circulares SICOV con el mismo asunto y distinta fecha). La causa probable es
 * que el identificador del acto vive solo en la primera página: los fragmentos
 * del medio del documento no contienen nada que los distinga de los de su
 * hermana.
 *
 * La hipótesis es que anteponer los metadatos a CADA fragmento antes de
 * vectorizar les devuelve esa identidad.
 *
 * Importante para interpretar los resultados: los metadatos usados son los que el
 * sistema real tiene en `DocumentoOficial` (tipo, número, entidad, fecha, título).
 * El título por defecto en la aplicación es el nombre del archivo subido
 * (`documents/route.ts`: `titulo || file.name.replace(/\.pdf$/i, "")`), así que
 * incluirlo no es hacer trampa: es lo que habría en producción. Aun así se ofrece
 * como campo separado para poder medir su efecto por sí solo.
 */

const CAMPOS_VALIDOS = ["tipo", "numero", "anio", "entidad", "fecha", "radicado", "titulo"];

function etiquetaTipo(tipo) {
  switch (tipo) {
    case "circular":
      return "Circular Externa";
    case "resolucion":
      return "Resolución";
    case "decreto":
      return "Decreto";
    case "anexo_tecnico":
      return "Anexo Técnico";
    default:
      return "Documento";
  }
}

/**
 * Construye el prefijo de metadatos de un documento.
 * @param {object} doc      Documento con sus metadatos.
 * @param {string[]} campos Campos a incluir (subconjunto de CAMPOS_VALIDOS).
 */
export function construirPrefijo(doc, campos) {
  const usar = (campos || []).filter((c) => CAMPOS_VALIDOS.includes(c));
  if (!usar.length) return "";

  const partes = [];

  if (usar.includes("tipo") && doc.tipo) {
    const cabeza = [etiquetaTipo(doc.tipo)];
    if (usar.includes("numero") && doc.numero) cabeza.push(doc.numero);
    if (usar.includes("anio") && doc.anio) cabeza.push(`de ${doc.anio}`);
    partes.push(cabeza.join(" "));
  } else if (usar.includes("numero") && doc.numero) {
    partes.push(`Número ${doc.numero}${usar.includes("anio") && doc.anio ? ` de ${doc.anio}` : ""}`);
  }

  if (usar.includes("radicado") && doc.radicado) partes.push(`radicado ${doc.radicado}`);
  if (usar.includes("entidad") && doc.entidad) partes.push(doc.entidad);
  if (usar.includes("fecha") && doc.fecha) partes.push(doc.fecha);
  if (usar.includes("titulo") && doc.id) partes.push(doc.id.replace(/_/g, " "));

  return partes.length ? `[${partes.join(" · ")}]` : "";
}

/** Antepone el prefijo al contenido del fragmento (solo para vectorizar). */
export function enriquecer(contenido, prefijo) {
  return prefijo ? `${prefijo}\n${contenido}` : contenido;
}
