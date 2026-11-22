/**
 * El validador de la salida de un modelo (fase E). `validarSalida(salidaCruda, paquete)` corre los controles en el orden
 * de `CODIGOS_VALIDADOR`, cierra en fallo y devuelve TODOS los códigos (sin repetir, en ese orden) con sus hallazgos.
 * Solo si no hay ninguno publica el resumen, armado por el código: cada `{Hnn}` con la presentación del paquete
 * construido, el aviso fijo y las cifras usadas. El paquete tiene que ser el mismo objeto que salió de
 * `construirPaquete` (si no, ErrorValidador: es un defecto del código, no del modelo). Nunca lanza por la salida cruda.
 *
 * Controles por frase, sobre el texto en NFC: caracteres y forma (CIFRA_SUELTA, IDIOMA, FORMATO), cifras en palabras,
 * citas y lista de hechos (HECHO_DESCONOCIDO, HECHO_NO_CITADO, FORMATO), etiquetas y sujeto (ETIQUETA_NO_COINCIDE),
 * marcas (DIRECCION_CONTRADICE), recomendación, predicción, trato e idioma (también el vocabulario cerrado: toda
 * palabra fuera de él rechaza, `vocabulario.ts`); después del render, el largo (LONGITUD), la
 * palabra repetida (FORMATO) y el cotejo de cada número contra el paquete (RENDER_CIFRA). De la salida entera: el número
 * de frases, el largo total y los hechos obligatorios.
 */
import { esIdHecho, type IdHecho, type PaqueteHechos, type TipoResumen } from "../contrato";
import { esPaqueteConstruido } from "../paquete";
import { revisarCaracteres } from "./caracteres";
import { CODIGOS_VALIDADOR, ErrorValidador, LIMITES_SALIDA, type CodigoValidador } from "./codigos";
import { cotejarCifras } from "./cotejo";
import { revisarEtiquetas } from "./etiquetas";
import { esNombre, hechosPorId, type HechosPorId } from "./hechos";
import { leerSalida, type FraseLeida } from "./leer";
import { revisarMarcas } from "./marcas";
import { coincidenciasEn, prepararTexto, type Patron } from "./patron";
import { esNumeroFundido } from "./numeros";
import { palabrasFueraDelVocabulario } from "./vocabulario";
import { PATRONES_CIFRA_EN_PALABRAS, PATRONES_IDIOMA, PATRONES_SIN_DATO } from "./patrones-lengua";
import { PATRONES_PREDICCION, PATRONES_RECOMENDACION, PATRONES_TRATO } from "./patrones-redaccion";
import { renderizarFrase } from "./render";
import { armarResumen } from "./resumen";
import { atribuir, citasDe, clausulasDe } from "./texto";
import type { FraseResumen, Hallazgo, ResultadoValidacion } from "./tipos";

const LISTAS: readonly (readonly [CodigoValidador, readonly Patron[]])[] = [
  ["CIFRA_EN_PALABRAS", PATRONES_CIFRA_EN_PALABRAS],
  ["DIRECCION_CONTRADICE", PATRONES_SIN_DATO],
  ["RECOMENDACION", PATRONES_RECOMENDACION],
  ["PREDICCION", PATRONES_PREDICCION],
  ["TRATO", PATRONES_TRATO],
  ["IDIOMA", PATRONES_IDIOMA],
];

/** La misma palabra dos veces seguidas en el texto renderizado («190 días días»). */
const PALABRA_REPETIDA = /(?<![\p{L}\p{N}])(\p{L}+) \1(?![\p{L}\p{N}])/iu;

interface FraseAnalizada {
  readonly resumen: FraseResumen;
  readonly largo: number;
}

type Anotar = (codigo: CodigoValidador, patron: string) => void;

/**
 * Las citas del texto contra el paquete y contra la lista `hechos` de la frase. Devuelve las conocidas, en orden. Una
 * frase sin ninguna cita de un dato (solo nombres, o nada) no está respaldada por el paquete: HECHO_NO_CITADO.
 */
function revisarCitas(frase: FraseLeida, texto: string, porId: HechosPorId, anotar: Anotar): readonly IdHecho[] {
  const citas = citasDe(texto).map((c) => c.id);
  const conocidas = citas.filter((id): id is IdHecho => esIdHecho(id) && porId.has(id));
  if (conocidas.length < citas.length) anotar("HECHO_DESCONOCIDO", "HECHO_DESCONOCIDO.CITA");
  if (frase.hechos.some((id) => !esIdHecho(id) || !porId.has(id))) anotar("HECHO_DESCONOCIDO", "HECHO_DESCONOCIDO.LISTA");
  const enTexto = new Set(citas);
  const lista = new Set(frase.hechos);
  if (lista.size !== frase.hechos.length || lista.size !== enTexto.size || [...lista].some((id) => !enTexto.has(id))) {
    anotar("FORMATO", "FORMATO.LISTA_HECHOS");
  }
  if (!conocidas.some((id) => !esNombre(porId.get(id)))) anotar("HECHO_NO_CITADO", "HECHO_NO_CITADO.FRASE_SIN_CITA");
  return conocidas;
}

function analizarFrase(frase: FraseLeida, paquete: PaqueteHechos, porId: HechosPorId, anotar: Anotar): FraseAnalizada {
  const texto = frase.texto.normalize("NFC");
  for (const h of revisarCaracteres(frase.texto)) anotar(h.codigo, h.patron);
  const conocidas = revisarCitas(frase, texto, porId, anotar);
  const preparado = prepararTexto(texto);
  const atribucion = atribuir(clausulasDe(preparado.minusculas), (id) => porId.has(id) && !esNombre(porId.get(id)));
  for (const h of revisarEtiquetas(atribucion, porId, paquete.tipo, new Set(conocidas))) anotar(h.codigo, h.patron);
  for (const h of revisarMarcas(preparado, atribucion, porId)) anotar(h.codigo, h.patron);
  for (const [codigo, patrones] of LISTAS) for (const id of coincidenciasEn(preparado, patrones)) anotar(codigo, id);
  if ((preparado.plegado.match(/\p{L}+/gu) ?? []).some(esNumeroFundido)) anotar("CIFRA_EN_PALABRAS", "CIFRA_EN_PALABRAS.FUNDIDA");
  if (palabrasFueraDelVocabulario(texto).length > 0) anotar("IDIOMA", "IDIOMA.VOCABULARIO");
  const renderizado = renderizarFrase(texto, paquete);
  const largo = [...renderizado].length;
  if (largo === 0) anotar("LONGITUD", "LONGITUD.VACIA");
  if (largo > LIMITES_SALIDA.maxLargoFrase) anotar("LONGITUD", "LONGITUD.FRASE");
  if (PALABRA_REPETIDA.test(renderizado)) anotar("FORMATO", "FORMATO.PALABRA_REPETIDA");
  if (!cotejarCifras(renderizado, conocidas, paquete)) anotar("RENDER_CIFRA", "RENDER_CIFRA.COTEJO");
  return { resumen: { texto: renderizado, citados: [...new Set(conocidas)] }, largo };
}

/** Solo se llama con al menos un hallazgo: los motivos no quedan vacíos (de ahí la tupla no vacía). */
function rechazo<T extends TipoResumen>(hallazgos: readonly Hallazgo[]): ResultadoValidacion<T> {
  const codigos = CODIGOS_VALIDADOR.filter((c) => hallazgos.some((h) => h.codigo === c));
  return Object.freeze({
    ok: false,
    motivos: Object.freeze(codigos) as unknown as readonly [CodigoValidador, ...CodigoValidador[]],
    hallazgos: Object.freeze(hallazgos.map((h) => Object.freeze({ ...h }))),
  });
}

export function validarSalida<T extends TipoResumen>(salidaCruda: unknown, paquete: PaqueteHechos<T>): ResultadoValidacion<T> {
  if (!esPaqueteConstruido(paquete)) throw new ErrorValidador("PAQUETE_NO_CONSTRUIDO");
  const leida = leerSalida(salidaCruda);
  if (leida === null) return rechazo([{ codigo: "SALIDA_INVALIDA", frase: null, patron: "SALIDA_INVALIDA.LECTURA" }]);
  // Cada control anota cada id una sola vez por frase: los hallazgos no se repiten.
  const hallazgos: Hallazgo[] = [];
  const anotarEn = (frase: number | null): Anotar => (codigo, patron) => {
    hallazgos.push({ codigo, frase, patron });
  };
  const porId = hechosPorId(paquete);
  const { minFrases, maxFrases, maxLargoTotal } = LIMITES_SALIDA;
  if (leida.frases.length < minFrases || leida.frases.length > maxFrases) anotarEn(null)("LONGITUD", "LONGITUD.FRASES");
  const analizadas = leida.frases.map((frase, i) => analizarFrase(frase, paquete, porId, anotarEn(i)));
  if (analizadas.reduce((total, f) => total + f.largo, 0) > maxLargoTotal) anotarEn(null)("LONGITUD", "LONGITUD.TOTAL");
  const citados = new Set(analizadas.flatMap((f) => f.resumen.citados));
  if (paquete.hechos.some((h) => h.obligatorio && !citados.has(h.id))) anotarEn(null)("HECHO_NO_CITADO", "HECHO_NO_CITADO.OBLIGATORIO");
  if (hallazgos.length > 0) return rechazo(hallazgos);
  return Object.freeze({ ok: true, resumen: armarResumen(paquete, analizadas.map((f) => f.resumen)) });
}
