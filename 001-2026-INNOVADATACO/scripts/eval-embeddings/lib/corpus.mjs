import { readdirSync, statSync } from "fs";
import { join, extname, basename } from "path";
import { execFileSync } from "child_process";

/**
 * Carga del corpus (SOLO LECTURA).
 *
 * Los PDFs nunca se copian al repositorio ni se modifican: se extrae su texto en
 * memoria con `pdftotext -layout` (poppler). Si un PDF no trae capa de texto
 * (escaneo sin OCR), se reporta como tal en vez de silenciarlo.
 */

export function listarPdfs(corpusPath) {
  return readdirSync(corpusPath)
    .filter((f) => [".pdf"].includes(extname(f).toLowerCase()))
    .sort()
    .map((f) => join(corpusPath, f));
}

export function extraerTexto(rutaPdf) {
  try {
    // -layout preserva la disposición en columnas de los actos normativos.
    return execFileSync("pdftotext", ["-layout", rutaPdf, "-"], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    return "";
  }
}

/** Normaliza espacios sin destruir los saltos de párrafo. */
export function normalizar(texto) {
  return texto
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Metadatos derivados del propio texto del acto (entidad, tipo, número, año).
 * Heurísticas deliberadamente simples: sirven para etiquetar el reporte, no para
 * alimentar el pipeline de la aplicación.
 */
export function extraerMetadatos(nombreArchivo, texto) {
  const cabecera = texto.slice(0, 2500);

  let entidad = "No identificada";
  if (/SUPERINTENDENCIA DE TRANSPORTE/i.test(cabecera)) entidad = "Superintendencia de Transporte";
  else if (/MINISTERIO DE TRANSPORTE/i.test(cabecera)) entidad = "Ministerio de Transporte";
  else if (/PRESIDENTE DE LA REP[UÚ]BLICA/i.test(cabecera)) entidad = "Presidencia de la República";
  else if (/Funci[oó]n P[uú]blica/i.test(cabecera)) entidad = "Presidencia de la República";

  let tipo = "otro";
  if (/CIRCULAR\s+EXTERNA/i.test(cabecera)) tipo = "circular";
  else if (/RESOLUCI[OÓ]N/i.test(cabecera)) tipo = "resolucion";
  else if (/DECRETO/i.test(cabecera)) tipo = "decreto";
  else if (/ANEXO\s+T[EÉ]CNICO/i.test(cabecera)) tipo = "anexo_tecnico";

  // Número "humano" del acto (el que usa la gente para citarlo).
  const mNumero =
    cabecera.match(/DECRETO\s+(?:N[UÚ]MERO\s+)?(\d{1,5})\s+DE\s+(\d{4})/i) ||
    cabecera.match(/RESOLUCI[OÓ]N\s+(?:N[UÚ]MERO\s+)?(\d{1,6})\s+DE\s+(\d{4})/i);

  // Radicado largo de las circulares externas (p. ej. 20255330000114).
  const mRadicado = cabecera.match(/\b(20\d{12,14})\b/);
  const radicado = mRadicado ? mRadicado[1] : null;

  let numero = mNumero ? mNumero[1] : null;
  // En las circulares el número corto son los últimos dígitos del radicado
  // (20255330000114 -> 114); se conserva sin ceros a la izquierda.
  if (!numero && radicado) numero = String(Number(radicado.slice(-6)));

  const mAnio = cabecera.match(/\b(19|20)\d{2}\b/);
  let anio = mNumero && mNumero[2] ? mNumero[2] : null;
  if (!anio && radicado) anio = radicado.slice(0, 4);
  if (!anio && mAnio) anio = mAnio[0];

  // Fecha completa (dd-mm-aaaa o dd/mm/aaaa) tal como aparece en el encabezado.
  const mFecha = cabecera.match(/\b(\d{2})[-/](\d{2})[-/](\d{4})\b/);
  const fecha = mFecha ? `${mFecha[1]}-${mFecha[2]}-${mFecha[3]}` : null;

  return {
    entidad,
    tipo,
    numero,
    anio,
    radicado,
    fecha,
    archivo: basename(nombreArchivo),
  };
}

export function cargarCorpus(corpusPath) {
  const documentos = [];
  const sinTexto = [];

  for (const ruta of listarPdfs(corpusPath)) {
    const bruto = extraerTexto(ruta);
    const texto = normalizar(bruto);
    const id = basename(ruta, extname(ruta));

    if (texto.length < 200) {
      sinTexto.push({
        id,
        archivo: basename(ruta),
        bytesPdf: statSync(ruta).size,
        caracteresExtraidos: texto.length,
      });
      continue;
    }

    documentos.push({ id, ruta, texto, ...extraerMetadatos(ruta, texto) });
  }

  return { documentos, sinTexto };
}
