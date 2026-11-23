/**
 * Los segmentos de `salida-v2` y el texto de la frase que arma el código con ellos. Un segmento de texto no puede
 * llevar llaves (la cita no se escribe en la prosa: la pone el código) y una referencia tiene la forma de un id.
 * `unirSegmentos` concatena los segmentos con la cita `{Hnn}` en lugar de cada ref y pone el espacio que un modelo
 * suele olvidar entre una palabra o una coma y una ref (nunca entre dos refs); cualquier otra unión queda literal. `segmentosDe` es la
 * operación inversa, para la plantilla sin IA (que parte de un texto con citas).
 */
export type Segmento = { readonly texto: string } | { readonly ref: string };

export const PATRON_REF = /^H[0-9]{2}$/u;
const CITA_EN_TEXTO = /(\{H[0-9]{2}\})/u;
const PALABRA_ANTES = /[\p{L}\p{M}]$/u;
const PALABRA_DESPUES = /^[\p{L}\p{M}]/u;
const PUNTUACION_ANTES = /[,;:]$/u;

export const esRef = (s: Segmento): s is { readonly ref: string } => "ref" in s;

/** Un segmento de texto sin llaves, o una ref con la forma de un id. */
export const segmentoValido = (s: Segmento): boolean => (esRef(s) ? PATRON_REF.test(s.ref) : !/[{}]/u.test(s.texto));

const piezaDe = (s: Segmento): string => (esRef(s) ? `{${s.ref}}` : s.texto);

/**
 * Falta un espacio solo si UNA de las dos piezas es una ref: una palabra pegada a la ref (antes o después) o una coma,
 * punto y coma o dos puntos pegados a la ref que sigue (el olvido típico de un modelo). Entre dos refs NO se pone (quedan
 * pegadas y `CITA_PEGADA` las rechaza: «{H}{H}» no puede leerse como una sola cifra) ni entre dos textos; cualquier otra
 * unión (un signo, un símbolo) queda literal, para que el validador la vea tal cual (`-{H01}`, `{H01}%`).
 */
function faltaEspacio(antes: string, ref: boolean, despues: string, esRefDespues: boolean): boolean {
  if (ref === esRefDespues) return false;
  if (esRefDespues) return PALABRA_ANTES.test(antes.slice(-1)) || PUNTUACION_ANTES.test(antes.slice(-1));
  return antes.endsWith("}") && PALABRA_DESPUES.test(despues.slice(0, 1));
}

export function unirSegmentos(segmentos: readonly Segmento[]): string {
  let texto = "";
  let anteriorEsRef = false;
  for (const s of segmentos) {
    const pieza = piezaDe(s);
    if (pieza !== "" && texto !== "" && faltaEspacio(texto, anteriorEsRef, pieza, esRef(s))) texto += " ";
    texto += pieza;
    if (pieza !== "") anteriorEsRef = esRef(s);
  }
  return texto;
}

/** Los segmentos de un texto con citas `{Hnn}`: cada cita, una ref; lo demás, texto. Sin segmentos vacíos. */
export function segmentosDe(texto: string): readonly Segmento[] {
  return texto.split(CITA_EN_TEXTO).filter((p) => p !== "").map((p): Segmento => (CITA_EN_TEXTO.test(p) ? { ref: p.slice(1, -1) } : { texto: p }));
}
