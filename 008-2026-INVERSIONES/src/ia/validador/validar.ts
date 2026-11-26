/**
 * El validador de la salida de un modelo (fase E). `validarSalida(salidaCruda, paquete)` corre los controles en el orden
 * de `CODIGOS_VALIDADOR`, cierra en fallo y devuelve TODOS los códigos (sin repetir, en ese orden) con sus hallazgos.
 * Solo si no hay ninguno publica el resumen, armado por el código: cada `{Hnn}` con la presentación del paquete
 * construido, el aviso fijo y las cifras usadas. El paquete tiene que ser el mismo objeto que salió de
 * `construirPaquete` (si no, ErrorValidador: es un defecto del código, no del modelo). Nunca lanza por la salida cruda.
 *
 * Los obligatorios del DIARIO que el modelo no cita los escribe el código y se componen con su salida (`obligatorias.ts`).
 *
 * La salida es `salida-v2` (segmentos de texto y refs): `leerSalida` arma el texto con la cita de cada ref; la forma
 * vieja es SALIDA_INVALIDA. La de SIMULACION es `salida-v3` (`{frases, revisar}`, `leerSalidaV3`) y solo ella: validador-v4
 * le agrega PARA_REVISAR, RANGO_CONTRADICE y ATRIBUCION (con ATENCION como RECOMENDACION), con hasta 4 frases y 2 ítems.
 * Los tres tipos de hoy no cambian de conducta.
 *
 * Controles por frase, sobre el texto en NFC: caracteres y forma (CIFRA_SUELTA, IDIOMA, FORMATO), cifras en palabras,
 * citas (HECHO_DESCONOCIDO, HECHO_NO_CITADO), etiquetas y sujeto (ETIQUETA_NO_COINCIDE),
 * marcas (DIRECCION_CONTRADICE), recomendación, predicción, trato e idioma (también el vocabulario cerrado: toda
 * palabra fuera de él rechaza, `vocabulario.ts`); después del render, el largo (LONGITUD), la
 * palabra repetida (FORMATO) y el cotejo de cada número contra el paquete (RENDER_CIFRA). De la salida entera: el número
 * de frases, el largo total y los hechos obligatorios.
 */
import { esIdHecho, type IdHecho, type PaqueteHechos, type TipoResumen } from "../contrato";
import { esPaqueteConstruido } from "../paquete";
import { revisarCaracteres } from "./caracteres";
import { CODIGOS_VALIDADOR, ErrorValidador, LIMITES_SALIDA, LIMITES_SIMULACION, type CodigoValidador } from "./codigos";
import { cotejarCifras } from "./cotejo";
import { revisarEtiquetas } from "./etiquetas";
import { revisarEtiquetasSinCita } from "./etiqueta-sin-cita";
import { esNombre, hechosPorId, type HechosPorId } from "./hechos";
import { leerSalida, type FraseLeida } from "./leer";
import { leerSalidaV3, type SalidaLeidaV3 } from "./leer-v3";
import { revisarParaRevisar } from "./para-revisar";
import { apariciones, revisarRangos } from "./rangos";
import { revisarEtiquetasSimulacion } from "./etiquetas-simulacion";
import { revisarMarcas } from "./marcas";
import { aportaElModelo, componerConObligatorias, escribeElCodigo } from "./obligatorias";
import { coincidenciasEn, posiciones, prepararTexto, type Patron, type TextoPreparado } from "./patron";
import { esNumeroFundido } from "./numeros";
import { palabrasFueraDelVocabulario } from "./vocabulario";
import { PATRONES_CIFRA_EN_PALABRAS, PATRONES_IDIOMA, PATRONES_SIN_DATO } from "./patrones-lengua";
import { PATRONES_ATRIBUCION_SIMULACION } from "./patrones-atribucion";
import { PATRONES_ATENCION, PATRONES_PREDICCION, PATRONES_RECOMENDACION, PATRONES_TRATO } from "./patrones-redaccion";
import { renderizarFrase } from "./render";
import { armarResumen } from "./resumen";
import { atribuir, citasDe, clausulasDe, type Atribucion } from "./texto";
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
 * Las citas del texto (las refs de los segmentos, puestas por el código) contra el paquete. Devuelve las conocidas, en
 * orden. Una frase sin ninguna cita de un dato (solo nombres, o nada) no está respaldada por el paquete: HECHO_NO_CITADO.
 */
function revisarCitas(texto: string, porId: HechosPorId, anotar: Anotar, esItem: boolean): readonly IdHecho[] {
  const citas = citasDe(texto).map((c) => c.id);
  const conocidas = citas.filter((id): id is IdHecho => esIdHecho(id) && porId.has(id));
  if (conocidas.length < citas.length) anotar("HECHO_DESCONOCIDO", "HECHO_DESCONOCIDO.CITA");
  // Un ítem sin punto lo dice PARA_REVISAR.SIN_PUNTO, no esta frase.
  if (!esItem && !conocidas.some((id) => !esNombre(porId.get(id)))) anotar("HECHO_NO_CITADO", "HECHO_NO_CITADO.FRASE_SIN_CITA");
  return conocidas;
}

/** Cómo se lee un texto: una frase del resumen o un ítem de «Para revisar» (más los controles de SIMULACION). */
interface Modo {
  readonly esItem: boolean;
  readonly simulacion: boolean;
}

function analizarFrase(frase: FraseLeida, paquete: PaqueteHechos, porId: HechosPorId, anotar: Anotar, modo: Modo = { esItem: false, simulacion: false }): FraseAnalizada {
  const texto = frase.texto.normalize("NFC");
  for (const h of revisarCaracteres(frase.texto)) anotar(h.codigo, h.patron);
  const conocidas = revisarCitas(texto, porId, anotar, modo.esItem);
  const preparado = prepararTexto(texto);
  const clausulas = clausulasDe(preparado.minusculas);
  const atribucion = atribuir(clausulas, (id) => porId.has(id) && !esNombre(porId.get(id)));
  for (const patron of revisarEtiquetasSinCita(clausulas, paquete)) anotar("ETIQUETA_NO_COINCIDE", patron);
  for (const h of revisarEtiquetas(atribucion, porId, paquete.tipo, new Set(conocidas))) anotar(h.codigo, h.patron);
  // En SIMULACION las palabras de un rango («cerca de su nivel») no son la marca de cercanía: las revisa RANGO_CONTRADICE.
  const deRango = modo.simulacion ? apariciones(preparado) : [];
  const exenta = (posicion: number): boolean => deRango.some((a) => posicion >= a.inicio && posicion < a.fin);
  for (const h of revisarMarcas(preparado, atribucion, porId, exenta)) anotar(h.codigo, h.patron);
  for (const [codigo, patrones] of LISTAS) {
    // En SIMULACION, «mayor que su peso» (un rango) no es el comparativo que pide una dirección: lo revisa RANGO_CONTRADICE.
    if (modo.simulacion && codigo === "DIRECCION_CONTRADICE") {
      for (const p of patrones) if (posiciones(preparado, p).some((pos) => !exenta(pos))) anotar(codigo, p.id);
    } else for (const id of coincidenciasEn(preparado, patrones)) anotar(codigo, id);
  }
  if ((preparado.plegado.match(/\p{L}+/gu) ?? []).some(esNumeroFundido)) anotar("CIFRA_EN_PALABRAS", "CIFRA_EN_PALABRAS.FUNDIDA");
  if (palabrasFueraDelVocabulario(texto, paquete.tipo).length > 0) anotar("IDIOMA", "IDIOMA.VOCABULARIO");
  const renderizado = renderizarFrase(texto, paquete);
  const largo = [...renderizado].length;
  if (largo === 0) anotar("LONGITUD", "LONGITUD.VACIA");
  if (largo > LIMITES_SALIDA.maxLargoFrase) anotar("LONGITUD", "LONGITUD.FRASE");
  if (PALABRA_REPETIDA.test(renderizado)) anotar("FORMATO", "FORMATO.PALABRA_REPETIDA");
  if (!cotejarCifras(renderizado, conocidas, paquete)) anotar("RENDER_CIFRA", "RENDER_CIFRA.COTEJO");
  if (modo.simulacion) revisarDeSimulacion(preparado, atribucion, porId, anotar, exenta, conocidas);
  return { resumen: { texto: renderizado, citados: [...new Set(conocidas)] }, largo };
}

/**
 * Lo que solo se revisa en SIMULACION: la etiqueta sin su hecho (ETIQUETA.SIN_HECHO), el nombre repetido, el rango de cada palabra de rango (RANGO_CONTRADICE) y, al final (después de la cita
 * pegada y de los demás controles), ATRIBUCION (la acción que causa el cambio) y ATENCION (como RECOMENDACION).
 */
function revisarDeSimulacion(preparado: TextoPreparado, atribucion: Atribucion, porId: HechosPorId, anotar: Anotar, exenta: (posicion: number) => boolean, conocidas: readonly IdHecho[]): void {
  // El código pone el nombre una vez por frase: citar el mismo nombre dos veces es un defecto de forma.
  const nombres = conocidas.filter((id) => esNombre(porId.get(id)));
  if (new Set(nombres).size < nombres.length) anotar("FORMATO", "FORMATO.NOMBRE_REPETIDO");
  // Una etiqueta (o su núcleo) solo vale junto al hecho que la lleva.
  for (const patron of revisarEtiquetasSimulacion(preparado, atribucion, porId, exenta)) anotar("ETIQUETA_NO_COINCIDE", patron);
  for (const patron of revisarRangos(preparado, atribucion, porId)) anotar("RANGO_CONTRADICE", patron);
  for (const id of coincidenciasEn(preparado, PATRONES_ATENCION)) anotar("RECOMENDACION", id);
  for (const id of coincidenciasEn(preparado, PATRONES_ATRIBUCION_SIMULACION)) anotar("ATRIBUCION", id);
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
  const simulacion = paquete.tipo === "SIMULACION";
  const leida = simulacion ? leerSalidaV3(salidaCruda) : leerSalida(salidaCruda);
  if (leida === null) return rechazo([{ codigo: "SALIDA_INVALIDA", frase: null, patron: "SALIDA_INVALIDA.LECTURA" }]);
  const itemsLeidos: readonly FraseLeida[] = simulacion ? (leida as SalidaLeidaV3).revisar : [];
  // Cada control anota cada id una sola vez por frase: los hallazgos no se repiten.
  const hallazgos: Hallazgo[] = [];
  const anotarEn = (frase: number | null): Anotar => (codigo, patron) => {
    hallazgos.push({ codigo, frase, patron });
  };
  const porId = hechosPorId(paquete);
  const { minFrases, maxLargoTotal } = LIMITES_SALIDA;
  const maxFrases = simulacion ? LIMITES_SIMULACION.maxFrases : LIMITES_SALIDA.maxFrases;
  // En los tipos cuyos obligatorios escribe el código, la salida se compone con esas frases (`obligatorias.ts`); el modelo
  // tiene que traer al menos una frase propia que aporte (cite un hecho que no sea obligatorio), y el conjunto no pasa del máximo.
  const { frases } = componerConObligatorias(paquete, leida);
  const delCodigoEscribe = escribeElCodigo(paquete.tipo);
  const sinFraseDelModelo = delCodigoEscribe && leida.frases.length < minFrases;
  if (frases.length < minFrases || frases.length > maxFrases || sinFraseDelModelo) anotarEn(null)("LONGITUD", "LONGITUD.FRASES");
  const analizadas = frases.map((frase, i) => analizarFrase(frase, paquete, porId, anotarEn(i), { esItem: false, simulacion }));
  // Los ítems de «Para revisar» (solo SIMULACION): los mismos controles que una frase; su lugar en los hallazgos va después de las frases.
  // Un ítem es nominal, sin punto final: con o sin punto del modelo, el código lo deja puesto para revisar la forma y lo quita al publicar.
  const items = itemsLeidos.map((item, i) => {
    const analizado = analizarFrase({ ...item, texto: item.texto.endsWith(".") ? item.texto : `${item.texto}.` }, paquete, porId, anotarEn(frases.length + i), { esItem: true, simulacion });
    return { ...analizado, resumen: { ...analizado.resumen, texto: analizado.resumen.texto.replace(/\.$/u, "") } };
  });
  if (analizadas.reduce((total, f) => total + f.largo, 0) > maxLargoTotal) anotarEn(null)("LONGITUD", "LONGITUD.TOTAL");
  const citados = new Set([...analizadas, ...items].flatMap((f) => f.resumen.citados));
  if (simulacion) for (const patron of revisarParaRevisar(items.map((f) => f.resumen), paquete, porId, citados)) anotarEn(null)("PARA_REVISAR", patron);
  if (paquete.hechos.some((h) => h.obligatorio && !citados.has(h.id))) anotarEn(null)("HECHO_NO_CITADO", "HECHO_NO_CITADO.OBLIGATORIO");
  // Última: una salida ya rechazada por otra causa conserva sus códigos; la que estaría bien pero no aporta nada, se rechaza.
  if (hallazgos.length === 0 && delCodigoEscribe && !aportaElModelo(paquete, leida)) anotarEn(null)("LONGITUD", "LONGITUD.SIN_APORTE_DEL_MODELO");
  if (hallazgos.length > 0) return rechazo(hallazgos);
  return Object.freeze({ ok: true, resumen: armarResumen(paquete, analizadas.map((f) => f.resumen), items.map((f) => f.resumen)) });
}
