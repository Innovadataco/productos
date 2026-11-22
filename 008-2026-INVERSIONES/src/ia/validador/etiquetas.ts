/**
 * ETIQUETA_NO_COINCIDE: las palabras que el modelo pone junto a una cita tienen que nombrar ESE dato, y el nombre de
 * especie que la acompaña tiene que ser el de su sujeto.
 *
 * Palabras clave (salen del catálogo en tiempo de ejecución: un cambio aditivo de E1b no las rompe): el texto en
 * minúsculas y sin tildes (la ñ se queda), sin palabras vacías; «no» y «sin» se pegan a la palabra que sigue («no
 * cuadra», «sin vender»); cada palabra pierde una «s» final y queda en sus cinco primeras letras (raíz); las siglas
 * cuentan. Un alias lleva «cerró» a «cierre».
 *
 * Regla: entre las claves del tipo gana la que deja menos palabras clave del alcance sin explicar y, entre esas, la de
 * mayor cobertura de su etiqueta (cuántas de sus palabras clave aparecen); un empate vale. La clave citada tiene que
 * tener cobertura y estar entre las ganadoras. Así la etiqueta tal cual siempre coincide con su clave, y la etiqueta de
 * otra clave nunca (salvo que tengan las mismas palabras clave: lo impide la prueba del catálogo).
 */
import { CATALOGO, CLAVE_NOMBRE_ESPECIE, type ClaveHecho, type EntradaCatalogo } from "../catalogo";
import { TIPOS_RESUMEN, type Hecho, type TipoResumen } from "../contrato";
import type { CodigoValidador } from "./codigos";
import { cadenaDeSujetos, esNombre, type HechosPorId } from "./hechos";
import { plegarTildes } from "./patron";
import type { Atribucion, Token } from "./texto";

export const PALABRAS_VACIAS: readonly string[] = Object.freeze([
  "a", "al", "como", "con", "cual", "de", "del", "desde", "e", "el", "en", "entre", "era", "es", "esa", "esas", "ese", "esos",
  "esta", "estas", "este", "estos", "fue", "fueron", "ha", "han", "hasta", "hay", "la", "las", "le", "les", "lo", "los", "mas",
  "muy", "o", "para", "por", "que", "se", "sobre", "son", "su", "sus", "u", "un", "una", "unas", "unos", "y", "ya",
]);
const VACIAS: ReadonlySet<string> = new Set(PALABRAS_VACIAS);
const NEGACIONES: ReadonlySet<string> = new Set(["no", "sin"]);
const LARGO_RAIZ = 5;
/** Formas de una palabra clave que no comparten su raíz. */
const ALIAS: Readonly<Record<string, string>> = Object.freeze({ cerro: "cierr", cerra: "cierr" });

const plegar = (palabra: string): string => plegarTildes(palabra.toLowerCase());

/** La raíz de una palabra ya plegada: sin la «s» final (si tiene más de tres letras), en sus cinco primeras letras. */
function raiz(plegada: string): string {
  const singular = plegada.length > 3 && plegada.endsWith("s") ? plegada.slice(0, -1) : plegada;
  const corta = singular.slice(0, LARGO_RAIZ);
  return ALIAS[corta] ?? corta;
}

/** Las raíces de una secuencia de palabras, en orden y con repetidas: plegadas, negación pegada y sin palabras vacías. */
export function raicesDe(palabras: readonly string[]): readonly string[] {
  const plegadas = palabras.map(plegar).filter((p) => p.length > 0);
  const raices: string[] = [];
  for (let i = 0; i < plegadas.length; i += 1) {
    const palabra = plegadas[i] as string;
    if (NEGACIONES.has(palabra)) {
      let j = i + 1;
      while (j < plegadas.length && VACIAS.has(plegadas[j] as string)) j += 1;
      if (j < plegadas.length) raices.push(`${palabra}${raiz(plegadas[j] as string)}`);
      i = j;
    } else if (!VACIAS.has(palabra)) raices.push(raiz(palabra));
  }
  return Object.freeze(raices);
}

/** Las palabras clave de una etiqueta, sin repetir, en orden. */
export function palabrasClave(etiqueta: string): readonly string[] {
  return Object.freeze([...new Set(raicesDe(etiqueta.match(/\p{L}+/gu) ?? []))]);
}

interface ClavesDelTipo {
  readonly porClave: ReadonlyMap<string, ReadonlySet<string>>;
  readonly candidatas: readonly string[];
  readonly todas: ReadonlySet<string>;
}

const DEL_TIPO: ReadonlyMap<TipoResumen, ClavesDelTipo> = new Map(TIPOS_RESUMEN.map((tipo) => {
  const entradas = Object.entries(CATALOGO[tipo] as Readonly<Record<string, EntradaCatalogo>>);
  const porClave = new Map(entradas.map(([clave, entrada]) => [clave, new Set(palabrasClave(entrada.etiqueta))]));
  const todas = new Set([...porClave.values()].flatMap((s) => [...s]));
  return [tipo, { porClave, candidatas: [...porClave.keys()].filter((c) => c !== CLAVE_NOMBRE_ESPECIE), todas }];
}));

interface Puntaje {
  readonly sinExplicar: number;
  readonly cubiertas: number;
  readonly total: number;
}

/** ¿`a` es estrictamente mejor que `b`? Menos sin explicar y, si empatan, más cobertura (fracciones exactas). */
const mejor = (a: Puntaje, b: Puntaje): boolean =>
  a.sinExplicar < b.sinExplicar || (a.sinExplicar === b.sinExplicar && a.cubiertas * b.total > b.cubiertas * a.total);

/** ¿Las raíces del alcance nombran la clave citada (ver la regla arriba)? Una clave fuera del catálogo del tipo: no. */
export function claveCoincide(tipo: TipoResumen, clave: ClaveHecho, raices: ReadonlySet<string>): boolean {
  const delTipo = DEL_TIPO.get(tipo);
  const propia = delTipo?.porClave.get(clave);
  if (delTipo === undefined || propia === undefined || clave === CLAVE_NOMBRE_ESPECIE) return false;
  const explicables = [...raices].filter((r) => delTipo.todas.has(r));
  const puntaje = (k: ReadonlySet<string>): Puntaje => {
    const cubiertas = explicables.filter((r) => k.has(r)).length;
    return { sinExplicar: explicables.length - cubiertas, cubiertas, total: k.size };
  };
  const citada = puntaje(propia);
  if (citada.cubiertas === 0) return false;
  return !delTipo.candidatas.some((c) => mejor(puntaje(delTipo.porClave.get(c) as ReadonlySet<string>), citada));
}

export interface HallazgoDeEtiqueta {
  readonly codigo: CodigoValidador;
  readonly patron: string;
}

const ETIQUETA: CodigoValidador = "ETIQUETA_NO_COINCIDE";
const palabrasDe = (tokens: readonly Token[]): readonly string[] => tokens.flatMap((t) => (t.tipo === "PALABRA" ? [t.texto] : []));

/** Las palabras clave de una clave del tipo (la clave sale de un hecho del paquete, que es de ese tipo). */
const palabrasDeLaClave = (tipo: TipoResumen, clave: string): ReadonlySet<string> =>
  (DEL_TIPO.get(tipo) as ClavesDelTipo).porClave.get(clave) as ReadonlySet<string>;

/** Las palabras clave de las otras claves citadas en la cláusula que no explican a esta: se quitan de su alcance. */
function ajenas(clave: string, clavesDeLaClausula: ReadonlySet<string>, tipo: TipoResumen): ReadonlySet<string> {
  const propias = palabrasDeLaClave(tipo, clave);
  return new Set([...clavesDeLaClausula].filter((c) => c !== clave).flatMap((c) => [...palabrasDeLaClave(tipo, c)]).filter((r) => !propias.has(r)));
}

/**
 * ETIQUETA_NO_COINCIDE de una frase: por cada cita que no es un nombre, la cobertura (ETIQUETA.COBERTURA), un nombre
 * que no es de su cadena de sujetos (ETIQUETA.SUJETO_AJENO) y, si su cadena llega a una especie, el nombre de esa
 * especie citado en la misma frase (ETIQUETA.SIN_SUJETO).
 */
export function revisarEtiquetas(atribucion: Atribucion, porId: HechosPorId, tipo: TipoResumen, citadasEnLaFrase: ReadonlySet<string>): readonly HallazgoDeEtiqueta[] {
  const patrones = new Set<string>();
  const hechoDe = (token: Token): Hecho => porId.get((token as Extract<Token, { tipo: "CITA" }>).id) as Hecho;
  const clavesPorClausula = new Map<number, Set<string>>();
  for (const d of atribucion.destinos) {
    const claves = clavesPorClausula.get(d.clausula);
    if (claves === undefined) clavesPorClausula.set(d.clausula, new Set([hechoDe(d.token).clave]));
    else claves.add(hechoDe(d.token).clave);
  }
  for (const destino of atribucion.destinos) {
    const hecho = hechoDe(destino.token);
    const tokens = atribucion.porCita.get(destino.lugar) as readonly Token[];
    const quitar = ajenas(hecho.clave, clavesPorClausula.get(destino.clausula) as ReadonlySet<string>, tipo);
    const raices = new Set(raicesDe(palabrasDe(tokens)).filter((r) => !quitar.has(r)));
    if (!claveCoincide(tipo, hecho.clave, raices)) patrones.add("ETIQUETA.COBERTURA");
    const cadena = cadenaDeSujetos(hecho, porId);
    const nombres = tokens.flatMap((t) => (t.tipo === "CITA" && esNombre(porId.get(t.id)) ? [t.id] : []));
    if (nombres.some((n) => !(cadena.ids as readonly string[]).includes(n))) patrones.add("ETIQUETA.SUJETO_AJENO");
    // Si la cadena llega a una especie, la frase la nombra. Una regla cuyo ancla no cita especie (E1b) no tiene raíz.
    if (cadena.raiz !== undefined && !citadasEnLaFrase.has(cadena.raiz)) patrones.add("ETIQUETA.SIN_SUJETO");
  }
  return Object.freeze([...patrones].map((patron) => Object.freeze({ codigo: ETIQUETA, patron })));
}
