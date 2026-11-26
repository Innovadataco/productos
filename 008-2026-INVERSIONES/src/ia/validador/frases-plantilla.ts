/**
 * Las frases de la plantilla (puras, sin pasar por el validador): la etiqueta del catálogo y la cita de cada hecho dado,
 * con el nombre de su especie delante («{S}: etiqueta {H}»), separados por «; » y repartidos en frases dentro de los
 * límites. Las usan la plantilla sin IA (`plantilla.ts`) y la composición de los obligatorios del DIARIO
 * (`obligatorias.ts`): viven aparte para que el validador no dependa de quien lo llama.
 */
import type { Hecho, IdHecho, PaqueteHechos } from "../contrato";
import { esPaqueteConstruido } from "../paquete";
import { ErrorValidador, LIMITES_SALIDA } from "./codigos";
import { cadenaDeSujetos, esNombre, hechosPorId, type HechosPorId } from "./hechos";
import { renderizarFrase } from "./render";

interface Item {
  /** El nombre de la especie que va delante, o null si el dato es del portafolio (o si el ítem es el nombre mismo). */
  readonly raiz: IdHecho | null;
  readonly texto: string;
}

interface Seleccion {
  /** Los datos que se citan, en el orden del paquete. */
  readonly datos: readonly Item[];
  /** Los nombres obligatorios que no van ya delante de un dato: nunca abren una frase (una frase cita un dato). */
  readonly sueltos: readonly Item[];
}

interface FraseEnArmado {
  readonly partes: readonly string[];
  /** La especie de la última parte: la siguiente de la misma especie no repite el nombre. */
  readonly raiz: IdHecho | null;
}

const cita = (id: IdHecho): string => `{${id}}`;

/** La selección de los hechos dados: los datos (no nombres) que se citan y los nombres que quedan sueltos. */
function seleccionDe(porId: HechosPorId, datos: readonly Hecho[], nombres: readonly Hecho[]): Seleccion {
  const raices = new Map(datos.map((h) => [h.id, cadenaDeSujetos(h, porId).raiz ?? null]));
  const delante = new Set(raices.values());
  const item = (h: Hecho): Item => ({ raiz: raices.get(h.id) ?? null, texto: `${h.etiqueta} ${cita(h.id)}` });
  return { datos: datos.map(item), sueltos: nombres.filter((h) => !delante.has(h.id)).map(item) };
}

/**
 * Los obligatorios que no son nombres (si no hay ninguno, el primer hecho que no es un nombre) y los nombres
 * obligatorios sueltos. Un paquete con solo nombres no tiene ningún dato que citar: la plantilla queda sin frases y el
 * validador la rechaza.
 */
function seleccionar(paquete: PaqueteHechos, porId: HechosPorId): Seleccion {
  const noNombres = paquete.hechos.filter((h) => !esNombre(h));
  const obligatorios = noNombres.filter((h) => h.obligatorio);
  const base: readonly Hecho[] = obligatorios.length > 0 ? obligatorios : noNombres.slice(0, 1);
  return seleccionDe(porId, base, paquete.hechos.filter((h) => esNombre(h) && h.obligatorio));
}

const mayusculaInicial = (texto: string): string => texto.charAt(0).toLocaleUpperCase("es-CO") + texto.slice(1);
const textoDe = (frase: FraseEnArmado): string => `${mayusculaInicial(frase.partes.join(""))}.`;
const VACIA: FraseEnArmado = Object.freeze({ partes: Object.freeze([]), raiz: null });

/** La frase con el ítem al final: «; » entre ítems y el nombre de la especie delante cuando cambia. */
function conItem(frase: FraseEnArmado, item: Item): FraseEnArmado {
  const delante = item.raiz === null ? "" : `${cita(item.raiz)}: `;
  const separador = frase.partes.length === 0 ? "" : "; ";
  const misma = frase.partes.length > 0 && item.raiz !== null && item.raiz === frase.raiz;
  return { partes: [...frase.partes, `${separador}${misma ? "" : delante}${item.texto}`], raiz: item.raiz };
}

/**
 * Reparte los datos en frases, en orden (en la última frase o en una nueva), y pone cada nombre suelto en la primera
 * frase donde quepa, apenas hay una: sin pasar los límites (medidos con las presentaciones puestas).
 */
function repartir({ datos, sueltos }: Seleccion, paquete: PaqueteHechos): readonly string[] {
  const largo = (frase: FraseEnArmado): number => [...renderizarFrase(textoDe(frase), paquete)].length;
  const { maxFrases, maxLargoFrase, maxLargoTotal } = LIMITES_SALIDA;
  let frases: readonly FraseEnArmado[] = [];
  let total = 0;
  let pendientes: readonly Item[] = sueltos;
  const agregar = (i: number, item: Item): boolean => {
    const ampliada = conItem(frases[i] as FraseEnArmado, item);
    const conAmpliada = total - largo(frases[i] as FraseEnArmado) + largo(ampliada);
    if (largo(ampliada) > maxLargoFrase || conAmpliada > maxLargoTotal) return false;
    frases = frases.map((f, j) => (j === i ? ampliada : f));
    total = conAmpliada;
    return true;
  };
  const abrir = (item: Item): boolean => {
    const nueva = conItem(VACIA, item);
    if (frases.length >= maxFrases || total + largo(nueva) > maxLargoTotal) return false;
    frases = [...frases, nueva];
    total += largo(nueva);
    return true;
  };
  /** Pone cada nombre pendiente en la primera frase donde quepa; los que no caben siguen pendientes. */
  const colocarSueltos = (): void => {
    const quedan: Item[] = [];
    for (const nombre of pendientes) {
      let puesto = false;
      for (let i = 0; i < frases.length && !puesto; i += 1) puesto = agregar(i, nombre);
      if (!puesto) quedan.push(nombre);
    }
    pendientes = quedan;
  };
  for (const dato of datos) {
    if (frases.length > 0 && agregar(frases.length - 1, dato)) continue;
    if (abrir(dato)) colocarSueltos();
  }
  colocarSueltos();
  return frases.map(textoDe);
}


/** Las frases (con citas `{Hnn}`) de la plantilla sin IA: los obligatorios del paquete, o el primer dato si no hay. */
export function frasesDeLaPlantilla(paquete: PaqueteHechos): readonly string[] {
  if (!esPaqueteConstruido(paquete)) throw new ErrorValidador("PAQUETE_NO_CONSTRUIDO");
  return repartir(seleccionar(paquete, hechosPorId(paquete)), paquete);
}

/**
 * Las frases (con citas `{Hnn}`) que escribe el código para los hechos dados, en el orden del paquete: cada dato con su
 * etiqueta y el nombre de su especie delante, y los nombres dados que no van delante de un dato, dentro de una frase.
 * Dentro de los límites de la salida; lo que no cabe se queda sin escribir. Sin datos, no hay frases.
 */
export function frasesDePlantilla(paquete: PaqueteHechos, hechos: readonly Hecho[]): readonly string[] {
  if (!esPaqueteConstruido(paquete)) throw new ErrorValidador("PAQUETE_NO_CONSTRUIDO");
  const dados = new Set(hechos.map((h) => h.id));
  const delPaquete = paquete.hechos.filter((h) => dados.has(h.id));
  return repartir(seleccionDe(hechosPorId(paquete), delPaquete.filter((h) => !esNombre(h)), delPaquete.filter(esNombre)), paquete);
}
