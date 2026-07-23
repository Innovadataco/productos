/**
 * Troceado de documentos para el pipeline RAG (spec 003, US1).
 *
 * Estrategia **estructural** (default, medida por el barrido `43bbe1a0` — D-029):
 * corta por las marcas propias del acto normativo (CONSIDERANDO, RESUELVE,
 * DECRETA, ARTÍCULO, numerales de anexo). Si un bloque excede el máximo, hace
 * fallback a corte por tamaño respetando párrafo > frase > espacio, sin partir
 * palabras.
 *
 * Los tres parámetros son configurables (§0.7); sus defaults salen de `ragConfig`,
 * no de aquí. `estructural` y `1800` están medidos; el **solape 200 NO** (D-029).
 *
 * Puro: sin BD, sin red, sin dependencias. Portado del chunker validado en
 * `scripts/eval-embeddings/lib/chunk.mjs`, del que salieron las cifras del barrido.
 */

export type EstrategiaTroceado = "estructural" | "tamano";

export interface OpcionesTroceado {
  strategy?: EstrategiaTroceado;
  maxChars?: number;
  overlapChars?: number;
  minChars?: number;
}

export interface Fragmento {
  orden: number;
  contenido: string;
}

const MARCAS: RegExp[] = [
  /^\s*CONSIDERANDO\b/im,
  /^\s*RESUELVE\b/im,
  /^\s*DECRETA\b/im,
  /^\s*ACUERDA\b/im,
  /^\s*ART[IÍ]CULO\s+\d+/im,
  /^\s*ARTICULO\s+\d+/im,
  /^\s*PAR[AÁ]GRAFO\b/im,
  /^\s*CAP[IÍ]TULO\s+[IVXLC\d]+/im,
  /^\s*T[IÍ]TULO\s+[IVXLC\d]+/im,
  /^\s*ANEXO\b/im,
  /^\s*\d+(\.\d+)*\.?\s+[A-ZÁÉÍÓÚÑ]{4,}/m, // numerales de anexo técnico: "3.1. ALTERNATIVA..."
];

function cortarPorMarcas(texto: string): string[] {
  const lineas = texto.split("\n");
  const bloques: string[] = [];
  let actual: string[] = [];

  for (const linea of lineas) {
    const esMarca = MARCAS.some((re) => re.test(linea));
    if (esMarca && actual.join("\n").trim().length > 0) {
      bloques.push(actual.join("\n").trim());
      actual = [linea];
    } else {
      actual.push(linea);
    }
  }
  if (actual.join("\n").trim().length > 0) bloques.push(actual.join("\n").trim());
  return bloques.filter(Boolean);
}

/** Corta respetando párrafo > frase > espacio; nunca parte una palabra. */
function cortarPorTamano(texto: string, maxChars: number, overlapChars: number): string[] {
  const trozos: string[] = [];
  let inicio = 0;

  while (inicio < texto.length) {
    let fin = Math.min(inicio + maxChars, texto.length);

    if (fin < texto.length) {
      const ventana = texto.slice(inicio, fin);
      const corteParrafo = ventana.lastIndexOf("\n\n");
      const corteFrase = Math.max(
        ventana.lastIndexOf(". "),
        ventana.lastIndexOf(".\n"),
        ventana.lastIndexOf("; "),
      );
      const corteEspacio = ventana.lastIndexOf(" ");

      const minAceptable = maxChars * 0.5;
      if (corteParrafo > minAceptable) fin = inicio + corteParrafo;
      else if (corteFrase > minAceptable) fin = inicio + corteFrase + 1;
      else if (corteEspacio > minAceptable) fin = inicio + corteEspacio;
    }

    const trozo = texto.slice(inicio, fin).trim();
    if (trozo) trozos.push(trozo);

    if (fin >= texto.length) break;
    inicio = Math.max(fin - overlapChars, inicio + 1);
  }

  return trozos;
}

/**
 * Trocea el texto en fragmentos ordenados (orden desde 0, sin huecos).
 * Texto vacío o solo espacios → `[]` (documento sin contenido indexable).
 */
export function trocear(texto: string, opciones: OpcionesTroceado = {}): Fragmento[] {
  const { strategy = "estructural", maxChars = 1800, overlapChars = 200, minChars = 120 } =
    opciones;

  const limpio = (texto || "").trim();
  if (!limpio) return [];

  const bloques = strategy === "estructural" ? cortarPorMarcas(limpio) : [limpio];

  const fragmentos: string[] = [];
  for (const bloque of bloques) {
    if (bloque.length <= maxChars) fragmentos.push(bloque);
    else fragmentos.push(...cortarPorTamano(bloque, maxChars, overlapChars));
  }

  // Fusiona fragmentos demasiado cortos (encabezados sueltos) con el anterior.
  const fusionados: string[] = [];
  for (const frag of fragmentos) {
    if (fusionados.length && frag.length < minChars) {
      const previo = fusionados[fusionados.length - 1];
      if (previo.length + frag.length <= maxChars * 1.2) {
        fusionados[fusionados.length - 1] = `${previo}\n${frag}`;
        continue;
      }
    }
    fusionados.push(frag);
  }

  return fusionados.map((contenido, orden) => ({ orden, contenido }));
}
