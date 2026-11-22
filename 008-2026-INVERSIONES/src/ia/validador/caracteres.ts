/**
 * Lista blanca de caracteres y forma de una frase del modelo. Sobre el texto en NFC (si no lo estaba, FORMATO.NO_NFC)
 * solo se admiten las letras del español (a-z, á é í ó ú ü ñ, en mayúscula o minúscula), el espacio, « . , ; : ( ) « » »
 * y las llaves de una cita con forma «{Hnn}». Lo demás se clasifica:
 * - un dígito de cualquier sistema (`\p{N}`: también superíndices, fracciones, romanos): CIFRA_SUELTA.DIGITO;
 * - un símbolo de moneda, «%», «‰» o «‱»: CIFRA_SUELTA.SIMBOLO;
 * - otra letra (cirílica, griega, ligaduras, anchos completos, alfanuméricos matemáticos): IDIOMA.LETRA;
 * - lo demás (invisibles, espacios duros, saltos, signos, guiones, emojis, markdown, HTML): FORMATO.CARACTER.
 * La forma: la cita sin pegar a otra cosa, una sola oración terminada en punto, sin espacios de más, sin mayúsculas en
 * medio de la frase (salvo las siglas del catálogo) y sin palabras de más de `maxLargoPalabra` letras.
 */
import { CATALOGO } from "../catalogo";
import { TIPOS_RESUMEN } from "../contrato";
import { LIMITES_SALIDA, type CodigoValidador } from "./codigos";
import { PATRON_CITA } from "./texto";

export interface HallazgoDeFrase {
  readonly codigo: CodigoValidador;
  readonly patron: string;
}

const PERMITIDO = /^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ .,;:()«»]$/u;
const DIGITO = /^\p{N}$/u;
const SIMBOLO_DE_CIFRA = /^[\p{Sc}%‰‱]$/u;
const LETRA = /^\p{L}$/u;
const PALABRA = /\p{L}+/gu;
const MAYUSCULA = /\p{Lu}/u;
const ANTES_DE_CITA = new Set(["", " ", "(", "«"]);
const PUNTUACION_TRAS_CITA = new Set([".", ",", ";", ":", ")", "»"]);

/** Las siglas de las etiquetas del catálogo (TRM, IPC…): las únicas palabras en mayúscula admitidas en medio de la frase. */
export const SIGLAS: ReadonlySet<string> = new Set(
  TIPOS_RESUMEN.flatMap((tipo) => Object.values(CATALOGO[tipo]).flatMap((e) => e.etiqueta.match(/\p{Lu}{2,}/gu) ?? [])),
);

const hallazgo = (codigo: CodigoValidador, patron: string): HallazgoDeFrase => Object.freeze({ codigo, patron });

function claseDe(caracter: string): HallazgoDeFrase | null {
  if (PERMITIDO.test(caracter)) return null;
  if (caracter === "{" || caracter === "}") return hallazgo("FORMATO", "FORMATO.LLAVE_SUELTA");
  if (DIGITO.test(caracter)) return hallazgo("CIFRA_SUELTA", "CIFRA_SUELTA.DIGITO");
  if (SIMBOLO_DE_CIFRA.test(caracter)) return hallazgo("CIFRA_SUELTA", "CIFRA_SUELTA.SIMBOLO");
  if (LETRA.test(caracter)) return hallazgo("IDIOMA", "IDIOMA.LETRA");
  return hallazgo("FORMATO", "FORMATO.CARACTER");
}

/** Los caracteres fuera de las citas, uno por punto de código. */
function revisarLista(texto: string, citas: readonly (readonly [number, number])[]): HallazgoDeFrase[] {
  const hallados: HallazgoDeFrase[] = [];
  let desde = 0;
  for (const [inicio, fin] of [...citas, [texto.length, texto.length] as const]) {
    for (const caracter of texto.slice(desde, inicio)) {
      const clase = claseDe(caracter);
      if (clase !== null) hallados.push(clase);
    }
    desde = fin;
  }
  return hallados;
}

/** Antes de una cita: el inicio, un espacio, «(» o «« »; después: el fin o un espacio, tras una puntuación opcional. */
function citaPegada(texto: string, [inicio, fin]: readonly [number, number]): boolean {
  if (!ANTES_DE_CITA.has(texto.slice(Math.max(inicio - 1, 0), inicio))) return true;
  let k = fin;
  while (k < texto.length && PUNTUACION_TRAS_CITA.has(texto[k] as string)) k += 1;
  return k < texto.length && texto[k] !== " ";
}

function revisarForma(texto: string, citas: readonly (readonly [number, number])[]): HallazgoDeFrase[] {
  const hallados: HallazgoDeFrase[] = [];
  if (citas.some((c) => citaPegada(texto, c))) hallados.push(hallazgo("FORMATO", "FORMATO.CITA_PEGADA"));
  if (texto !== texto.trim() || texto.includes("  ")) hallados.push(hallazgo("FORMATO", "FORMATO.ESPACIOS"));
  if (!texto.endsWith(".")) hallados.push(hallazgo("FORMATO", "FORMATO.PUNTO_FINAL"));
  if (texto.indexOf(".") !== texto.length - 1 && texto.includes(".")) hallados.push(hallazgo("FORMATO", "FORMATO.PUNTO_INTERNO"));
  const palabras = texto.replace(PATRON_CITA, " ").match(PALABRA) ?? [];
  const mayusculaFuera = palabras.some((p, i) => MAYUSCULA.test(p) && !SIGLAS.has(p) && (i > 0 || MAYUSCULA.test(p.slice(1))));
  if (mayusculaFuera) hallados.push(hallazgo("FORMATO", "FORMATO.MAYUSCULA_INTERNA"));
  if (palabras.some((p) => [...p].length > LIMITES_SALIDA.maxLargoPalabra)) hallados.push(hallazgo("FORMATO", "FORMATO.PALABRA_LARGA"));
  return hallados;
}

/** Los hallazgos de caracteres y de forma de la frase, sin repetir, en orden de detección. */
export function revisarCaracteres(texto: string): readonly HallazgoDeFrase[] {
  const nfc = texto.normalize("NFC");
  const citas = [...nfc.matchAll(PATRON_CITA)].map((m) => [m.index, m.index + m[0].length] as const);
  const hallados = [
    ...(nfc === texto ? [] : [hallazgo("FORMATO", "FORMATO.NO_NFC")]),
    ...revisarLista(nfc, citas),
    ...revisarForma(nfc, citas),
  ];
  const primeros = new Map(hallados.map((h) => [h.patron, h] as const).reverse());
  return Object.freeze(hallados.filter((h) => primeros.get(h.patron) === h));
}
