/**
 * Los segmentos de `salida-v2` y el texto de la frase que arma el código con ellos. Un segmento de texto no puede
 * llevar llaves (la cita no se escribe en la prosa: la pone el código) y una referencia tiene la forma de un id.
 * `unirSegmentos` concatena los segmentos con la cita `{Hnn}` en lugar de cada ref y pone el espacio que un modelo
 * suele olvidar entre una palabra y una ref (o entre dos refs); cualquier otra unión queda literal. `segmentosDe` es la
 * operación inversa, para la plantilla sin IA (que parte de un texto con citas).
 */
export type Segmento = { readonly texto: string } | { readonly ref: string };

export const PATRON_REF = /^H[0-9]{2}$/u;
const CITA_EN_TEXTO = /(\{H[0-9]{2}\})/u;
const TERMINA_EN_PALABRA = /[\p{L}}]$/u;
const EMPIEZA_EN_PALABRA = /^[\p{L}{]/u;

export const esRef = (s: Segmento): s is { readonly ref: string } => "ref" in s;

/** Un segmento de texto sin llaves, o una ref con la forma de un id. */
export const segmentoValido = (s: Segmento): boolean => (esRef(s) ? PATRON_REF.test(s.ref) : !/[{}]/u.test(s.texto));

const piezaDe = (s: Segmento): string => (esRef(s) ? `{${s.ref}}` : s.texto);

/**
 * Falta un espacio solo cuando una palabra (o una cita) se pega a otra: el olvido típico de un modelo. Cualquier otra
 * unión (un signo, un símbolo, una puntuación) queda literal, para que el validador la vea tal cual (`-{H01}`, `{H01}%`).
 */
const faltaEspacio = (antes: string, despues: string): boolean => TERMINA_EN_PALABRA.test(antes) && EMPIEZA_EN_PALABRA.test(despues);

export function unirSegmentos(segmentos: readonly Segmento[]): string {
  return segmentos.map(piezaDe).reduce((texto, pieza) => `${texto}${faltaEspacio(texto, pieza) ? " " : ""}${pieza}`, "");
}

/** Los segmentos de un texto con citas `{Hnn}`: cada cita, una ref; lo demás, texto. Sin segmentos vacíos. */
export function segmentosDe(texto: string): readonly Segmento[] {
  return texto.split(CITA_EN_TEXTO).filter((p) => p !== "").map((p): Segmento => (CITA_EN_TEXTO.test(p) ? { ref: p.slice(1, -1) } : { texto: p }));
}
