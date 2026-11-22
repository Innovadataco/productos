/**
 * Lector del mensaje SDMX-ML 2.1 genérico del Banco de la República (fase C, C2c), para la TPM y la IBR_3M_EA. SOLO lo
 * usa el exportador del Mac (scripts/exportar-banrep.ts): lee con el lector XML acotado (src/lib/xml-acotado.ts), que
 * ni la app ni los importadores alcanzan (tests/unit/lib/lectores-candado.test.ts). Producción lee el CSV canónico.
 * El mismo lector sirve para lo que llega por la red y para el --archivo que el dueño baja en su navegador.
 *
 * La forma que se exige es la observada en las descargas públicas del 2026-11-21 (POR VERIFICAR con la ficha de BanRep),
 * y todo lo que se aparta falla cerrado, con un código fijo que no lleva nada de la respuesta:
 * - Una página HTML en vez del XML (captcha, bloqueo o error del servidor): BANREP_BLOQUEADO (detalle HTML). Se olfatea
 *   antes del lector XML (que rechazaría su DOCTYPE): tras la BOM, espacios, la declaración y comentarios, una etiqueta de
 *   HTML; si el lector XML lo rechaza y el principio trae `<html` o `<!doctype html`, también; y se mira la raíz (un XHTML
 *   o un fragmento HTML bien formados).
 * - Lo que el lector XML rechaza (DTD, entidades, CDATA, topes…): BANREP_XML, con el código del lector como detalle.
 * - Un mensaje de error SDMX: BANREP_ERROR_SDMX (detalle: su `code`, si es numérico).
 * - La raíz GenericData del espacio del mensaje SDMX 2.1, con exactamente una cabecera y un DataSet (BANREP_NO_SDMX); un
 *   pie (Footer) avisa una respuesta parcial: BANREP_TRUNCADO. La cabecera: emisor BANREP, no de prueba, la dimensión de
 *   la observación es TIME_PERIOD (NO_SDMX) y el ID es el dataflow pedido (BANREP_OTRO_DATAFLOW: el --archivo de la otra
 *   serie).
 * - La serie se elige por SUBJECT + UNIT_MEASURE de la SeriesKey (el dataflow de la IBR trae 8; toda serie debe tener
 *   una clave legible: NO_SDMX): ninguna (SERIE_AUSENTE), dos (SERIE_REPETIDA). Solo la elegida (y la nominal de la
 *   guarda) deben tener la forma estricta; una ajena con un hijo de más no estorba. La elegida: diaria, de Colombia y sin
 *   multiplicador (UNIT_MULT = 0, también en cada observación): si no, SERIE_DISTINTA (OBS_INVALIDA en la observación).
 * - Guarda de la unidad (la IBR): si en el mismo mensaje viene la nominal (NR) del mismo plazo, la efectiva anual (ER)
 *   nunca puede ser menor un día que tienen las dos (con tasas positivas, la efectiva supera a la nominal): si lo es, las
 *   unidades vienen cruzadas (BANREP_UNIDAD_DUDOSA). Es una heurística contra errores del origen, no contra un
 *   adversario (que puede omitir la nominal); la semántica de ER, NR y PA queda POR VERIFICAR con la ficha de BanRep. Un
 *   día de la nominal repetido con valores distintos no se compara.
 * - Las observaciones las lee banrep-observaciones.ts. Se compara por espacio de nombres, nunca por el prefijo.
 * Nunca lanza: cualquier otra falla sale como BANREP_ERROR_INTERNO.
 */
import { buscarAtributo, ErrorXml, leerXmlAcotado, type ElementoXml } from "../../lib/xml-acotado";
import { canonizarValor, compararDecimales } from "../series/csv-series";
import { ESTADO_DEFINITIVO, leerObservaciones, type ObsCruda, type ResultadoBanrep } from "./banrep-observaciones";
import { falloBanrep, type FalloBanrep, type SerieBanrep } from "./banrep-series";

export type { ConteosBanrep, LecturaBanrep, ResultadoBanrep } from "./banrep-observaciones";

export const NS_MENSAJE_SDMX = "http://www.sdmx.org/resources/sdmxml/schemas/v2_1/message";
export const NS_GENERICO_SDMX = "http://www.sdmx.org/resources/sdmxml/schemas/v2_1/data/generic";
const NS_FOOTER_SDMX = "http://www.sdmx.org/resources/sdmxml/schemas/v2_1/message/footer";
const NS_XHTML = "http://www.w3.org/1999/xhtml";
const EMISOR = "BANREP";
const DIMENSION_TIEMPO = "TIME_PERIOD";
/** Lo que se exige de la SeriesKey y los atributos de la serie elegida. */
const FRECUENCIA_DIARIA = "D";
const AREA_COLOMBIA = "CO";
const SIN_MULTIPLICADOR = "0";
const UNIDAD_EFECTIVA = "ER";
const UNIDAD_NOMINAL = "NR";
const ETIQUETAS_HTML = ["html", "head", "body", "script", "meta", "title", "noscript", "div", "form", "style", "link"] as const;
const RAICES_HTML: ReadonlySet<string> = new Set(ETIQUETAS_HTML);
/** Cuánto del principio se mira para reconocer una página HTML. */
const OLFATEO_BYTES = 1024;
/** Una etiqueta de HTML (o su DOCTYPE) justo donde se mira. */
const ETIQUETA_HTML = new RegExp(`^<(?:!doctype\\s+html|${ETIQUETAS_HTML.join("|")})(?=[\\s>/])`, "i");
/** Rastro de HTML en un texto que el lector XML rechazó. */
const RASTRO_HTML = /<html(?![\w:.-])|<!doctype\s+html/i;
const ESPACIO = /\s/;
const CODIGO_ERROR_SDMX = /^[0-9]{1,4}$/;
const ESPACIOS_XML = /^[ \t\n]+|[ \t\n]+$/g;

const es = (e: ElementoXml, espacio: string, local: string): boolean => e.espacio === espacio && e.local === local;
const hijosDe = (e: ElementoXml, espacio: string, local: string): readonly ElementoXml[] => e.hijos.filter((h) => es(h, espacio, local));
const limpio = (texto: string): string => texto.replace(ESPACIOS_XML, "");

/** El principio del cuerpo como texto, para olfatear (sin validar: TextDecoder no fatal, que nunca lanza). */
const principio = (bytes: Uint8Array): string => new TextDecoder("utf-8").decode(bytes.subarray(0, OLFATEO_BYTES));

/** Dónde empieza el contenido tras la BOM, los espacios, la declaración `<?xml …?>` y los comentarios (lineal). */
function saltarPrologo(texto: string): number {
  let i = texto.charCodeAt(0) === 0xfeff ? 1 : 0;
  for (;;) {
    while (i < texto.length && ESPACIO.test(texto[i]!)) i += 1;
    const [abre, cierra] = texto.startsWith("<?xml", i) ? ["<?xml", "?>"] : texto.startsWith("<!--", i) ? ["<!--", "-->"] : [null, null];
    const fin = abre === null ? -1 : texto.indexOf(cierra!, i + abre.length);
    if (fin === -1) return i;
    i = fin + cierra!.length;
  }
}

/** ¿Empieza como una página HTML (tras la BOM, espacios, la declaración XML y comentarios)? */
function pareceHtml(texto: string): boolean {
  return ETIQUETA_HTML.test(texto.slice(saltarPrologo(texto)));
}

/** La raíz, o el fallo del lector XML (una página HTML que el lector rechaza es un bloqueo). */
function raizXml(bytes: Uint8Array, texto: string): ElementoXml | FalloBanrep {
  try {
    return leerXmlAcotado(bytes);
  } catch (e) {
    if (!(e instanceof ErrorXml)) throw e;
    return RASTRO_HTML.test(texto) ? falloBanrep("BANREP_BLOQUEADO", "HTML") : falloBanrep("BANREP_XML", e.codigo);
  }
}

/** Los `Value` (id → value) de una SeriesKey o de unos Attributes; null si hay otra cosa, un id repetido o falta algo. */
function valoresDe(e: ElementoXml): ReadonlyMap<string, string> | null {
  const valores = new Map<string, string>();
  for (const h of e.hijos) {
    const [id, valor] = [buscarAtributo(h, "id"), buscarAtributo(h, "value")];
    if (!es(h, NS_GENERICO_SDMX, "Value") || id === undefined || valor === undefined || valores.has(id)) return null;
    valores.set(id, valor);
  }
  return valores;
}

/** Los hijos de `e` repartidos por nombre local del espacio genérico; null si alguno no está en `permitidos`. */
function repartir(e: ElementoXml, permitidos: readonly string[]): ReadonlyMap<string, readonly ElementoXml[]> | null {
  const grupos = new Map<string, ElementoXml[]>(permitidos.map((p) => [p, []]));
  for (const h of e.hijos) {
    const grupo = h.espacio === NS_GENERICO_SDMX ? grupos.get(h.local) : undefined;
    if (!grupo) return null;
    grupo.push(h);
  }
  return grupos;
}

/** Una Obs: exactamente una ObsDimension con value, a lo sumo un ObsValue (con value) y a lo sumo unos Attributes. */
function obsCruda(o: ElementoXml): ObsCruda | null {
  const g = repartir(o, ["ObsDimension", "ObsValue", "Attributes"]);
  const [dimensiones, valores, atributos] = [g?.get("ObsDimension") ?? [], g?.get("ObsValue") ?? [], g?.get("Attributes") ?? []];
  if (!g || dimensiones.length !== 1 || valores.length > 1 || atributos.length > 1) return null;
  const dia = buscarAtributo(dimensiones[0]!, "value");
  const valor = valores.length === 1 ? buscarAtributo(valores[0]!, "value") : null;
  const estados = atributos.length === 1 ? valoresDe(atributos[0]!) : new Map<string, string>();
  if (dia === undefined || valor === undefined || estados === null) return null;
  // Un multiplicador en la observación (distinto de 0) escalaría el valor: no se lee.
  const multiplicador = estados.get("UNIT_MULT");
  if (multiplicador !== undefined && multiplicador !== SIN_MULTIPLICADOR) return null;
  return { dia, valor, estado: estados.get("OBS_STATUS") ?? null };
}

interface SerieXml {
  readonly clave: ReadonlyMap<string, string>;
  readonly atributos: ReadonlyMap<string, string>;
  readonly obs: readonly ElementoXml[];
}

/** Una Series: una SeriesKey (con SUBJECT y UNIT_MEASURE), a lo sumo unos Attributes y sus Obs; null si no. */
function serieXml(s: ElementoXml): SerieXml | null {
  const g = repartir(s, ["SeriesKey", "Attributes", "Obs"]);
  const [claves, atributos] = [g?.get("SeriesKey") ?? [], g?.get("Attributes") ?? []];
  if (!g || claves.length !== 1 || atributos.length > 1) return null;
  const clave = valoresDe(claves[0]!);
  const propios = atributos.length === 1 ? valoresDe(atributos[0]!) : new Map<string, string>();
  if (!clave || !propios || !clave.has("SUBJECT") || !clave.has("UNIT_MEASURE")) return null;
  return { clave, atributos: propios, obs: g.get("Obs") ?? [] };
}

/** Raíz HTML, error SDMX u otra cosa que no es el mensaje genérico de datos. */
function falloDeRaiz(raiz: ElementoXml): FalloBanrep | null {
  if (RAICES_HTML.has(raiz.local.toLowerCase()) && (raiz.espacio === null || raiz.espacio === NS_XHTML)) return falloBanrep("BANREP_BLOQUEADO", "HTML");
  if (es(raiz, NS_MENSAJE_SDMX, "Error")) {
    const code = raiz.hijos.find((h) => es(h, NS_MENSAJE_SDMX, "ErrorMessage"));
    const valor = code ? buscarAtributo(code, "code") : undefined;
    return falloBanrep("BANREP_ERROR_SDMX", valor !== undefined && CODIGO_ERROR_SDMX.test(valor) ? valor : null);
  }
  return es(raiz, NS_MENSAJE_SDMX, "GenericData") ? null : falloBanrep("BANREP_NO_SDMX");
}

/** Exactamente una cabecera y un DataSet; un pie (Footer) es una respuesta parcial. */
function partesDe(raiz: ElementoXml): { readonly cabecera: ElementoXml; readonly datos: ElementoXml } | FalloBanrep {
  if (raiz.hijos.some((h) => h.local === "Footer" && (h.espacio === NS_MENSAJE_SDMX || h.espacio === NS_FOOTER_SDMX))) return falloBanrep("BANREP_TRUNCADO");
  const [cabeceras, datos] = [hijosDe(raiz, NS_MENSAJE_SDMX, "Header"), hijosDe(raiz, NS_MENSAJE_SDMX, "DataSet")];
  if (cabeceras.length !== 1 || datos.length !== 1 || raiz.hijos.length !== 2) return falloBanrep("BANREP_NO_SDMX");
  return { cabecera: cabeceras[0]!, datos: datos[0]! };
}

function falloDeCabecera(cabecera: ElementoXml, serie: SerieBanrep): FalloBanrep | null {
  const uno = (local: string): ElementoXml | null => {
    const xs = hijosDe(cabecera, NS_MENSAJE_SDMX, local);
    return xs.length === 1 ? xs[0]! : null;
  };
  const [id, emisor, estructura, pruebas] = [uno("ID"), uno("Sender"), uno("Structure"), hijosDe(cabecera, NS_MENSAJE_SDMX, "Test")];
  const deVerdad = pruebas.length === 0 || (pruebas.length === 1 && ["false", "0"].includes(limpio(pruebas[0]!.texto)));
  if (!id || !emisor || !estructura || !deVerdad) return falloBanrep("BANREP_NO_SDMX");
  if (buscarAtributo(emisor, "id") !== EMISOR || buscarAtributo(estructura, "dimensionAtObservation") !== DIMENSION_TIEMPO) return falloBanrep("BANREP_NO_SDMX");
  return limpio(id.texto) === serie.dataflow ? null : falloBanrep("BANREP_OTRO_DATAFLOW");
}

/** La clave (SeriesKey) de una Series cualquiera: una sola, legible, con SUBJECT y UNIT_MEASURE; null si no. */
function claveDe(s: ElementoXml): ReadonlyMap<string, string> | null {
  const claves = hijosDe(s, NS_GENERICO_SDMX, "SeriesKey");
  const clave = claves.length === 1 ? valoresDe(claves[0]!) : null;
  return clave && clave.has("SUBJECT") && clave.has("UNIT_MEASURE") ? clave : null;
}

interface Elegida {
  readonly elegida: SerieXml;
  /** La nominal del mismo plazo (para la guarda), si viene una sola y con la forma estricta. */
  readonly nominal: SerieXml | null;
}

/** La serie pedida entre las del DataSet: todas deben ser Series con clave legible; la elegida, con la forma estricta. */
function elegir(datos: ElementoXml, serie: SerieBanrep): Elegida | FalloBanrep {
  if (datos.hijos.some((h) => !es(h, NS_GENERICO_SDMX, "Series"))) return falloBanrep("BANREP_NO_SDMX");
  const claves = datos.hijos.map(claveDe);
  if (claves.some((c) => c === null)) return falloBanrep("BANREP_NO_SDMX");
  const conClave = (unidad: string): readonly ElementoXml[] =>
    datos.hijos.filter((_h, i) => claves[i]!.get("SUBJECT") === serie.sujeto && claves[i]!.get("UNIT_MEASURE") === unidad);
  const candidatas = conClave(serie.unidad);
  if (candidatas.length === 0) return falloBanrep("BANREP_SERIE_AUSENTE");
  if (candidatas.length > 1) return falloBanrep("BANREP_SERIE_REPETIDA");
  const elegida = serieXml(candidatas[0]!);
  if (!elegida) return falloBanrep("BANREP_NO_SDMX");
  const forma = elegida.clave.get("FREQ") === FRECUENCIA_DIARIA && elegida.clave.get("REFERENCE_AREA") === AREA_COLOMBIA && elegida.atributos.get("UNIT_MULT") === SIN_MULTIPLICADOR;
  if (!forma) return falloBanrep("BANREP_SERIE_DISTINTA");
  const nominales = serie.unidad === UNIDAD_EFECTIVA ? conClave(UNIDAD_NOMINAL) : [];
  return { elegida, nominal: nominales.length === 1 ? serieXml(nominales[0]!) : null };
}

/** Los valores definitivos y decimales de una serie, por día; un día repetido con valores distintos queda fuera. */
function definitivosPorDia(s: SerieXml): ReadonlyMap<string, string> {
  const porDia = new Map<string, string | null>();
  for (const o of s.obs) {
    const c = obsCruda(o);
    const valor = c && c.estado === ESTADO_DEFINITIVO && c.valor !== null ? canonizarValor(c.valor) : null;
    if (!c || valor === null) continue;
    const previo = porDia.get(c.dia);
    porDia.set(c.dia, previo === undefined || previo === valor ? valor : null);
  }
  return new Map([...porDia].filter((par): par is [string, string] => par[1] !== null));
}

/** ¿La efectiva (ER) queda por debajo de la nominal (NR) del mismo plazo algún día que tienen las dos? */
function unidadDudosa(e: Elegida): boolean {
  if (!e.nominal) return false;
  const nominal = definitivosPorDia(e.nominal);
  return [...definitivosPorDia(e.elegida)].some(([dia, efectiva]) => {
    const n = nominal.get(dia);
    return n !== undefined && compararDecimales(efectiva, n) < 0;
  });
}

function leer(bytes: Uint8Array, serie: SerieBanrep, desde: Date, hasta: Date): ResultadoBanrep {
  const texto = principio(bytes);
  if (pareceHtml(texto)) return falloBanrep("BANREP_BLOQUEADO", "HTML");
  const raiz = raizXml(bytes, texto);
  if ("ok" in raiz) return raiz;
  const fallo = falloDeRaiz(raiz);
  if (fallo) return fallo;
  const partes = partesDe(raiz);
  if ("ok" in partes) return partes;
  const cabecera = falloDeCabecera(partes.cabecera, serie);
  if (cabecera) return cabecera;
  const e = elegir(partes.datos, serie);
  if ("ok" in e) return e;
  const crudas = e.elegida.obs.map(obsCruda);
  if (crudas.some((c) => c === null)) return falloBanrep("BANREP_OBS_INVALIDA");
  const r = leerObservaciones(crudas as ObsCruda[], serie.catalogo, desde, hasta);
  return r.ok && unidadDudosa(e) ? falloBanrep("BANREP_UNIDAD_DUDOSA") : r;
}

/**
 * Lee el SDMX de `serie` y devuelve sus vigencias en [desde, hasta] con los conteos, o el fallo. Nunca lanza: lo no
 * previsto sale como BANREP_ERROR_INTERNO, sin la causa.
 */
export function leerSdmxBanrep(bytes: Uint8Array, serie: SerieBanrep, desde: Date, hasta: Date): ResultadoBanrep {
  try {
    return leer(bytes, serie, desde, hasta);
  } catch {
    return falloBanrep("BANREP_ERROR_INTERNO");
  }
}
