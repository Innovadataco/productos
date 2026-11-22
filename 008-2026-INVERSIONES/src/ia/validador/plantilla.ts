/**
 * Plantilla sin IA (nivel 0): el resumen cuando no hay modelo (o su salida se rechazó). Determinista y armada solo con
 * el paquete: la etiqueta del catálogo y la cita de cada hecho obligatorio (si no hay ninguno que no sea un nombre, el
 * primer hecho que no lo es), con el nombre de su especie delante («{S}: etiqueta {H}»), separados por «; » y repartidos
 * en frases dentro de los límites. Sale en el MISMO formato que un modelo y pasa por el MISMO validador
 * (`resumenSinIa`): nada se publica sin él. Si los obligatorios no caben, el validador la rechaza (cierra en fallo).
 */
import type { Hecho, IdHecho, PaqueteHechos, TipoResumen } from "../contrato";
import { esPaqueteConstruido } from "../paquete";
import { ErrorValidador, LIMITES_SALIDA } from "./codigos";
import { cadenaDeSujetos, esNombre, hechosPorId, type HechosPorId } from "./hechos";
import { renderizarFrase } from "./render";
import { citasDe } from "./texto";
import type { ResultadoValidacion } from "./tipos";
import { validarSalida } from "./validar";

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

/**
 * Los obligatorios que no son nombres (si no hay ninguno, el primer hecho que no es un nombre) y los nombres
 * obligatorios sueltos. Un paquete con solo nombres no tiene ningún dato que citar: la plantilla queda sin frases y el
 * validador la rechaza.
 */
function seleccionar(paquete: PaqueteHechos, porId: HechosPorId): Seleccion {
  const noNombres = paquete.hechos.filter((h) => !esNombre(h));
  const obligatorios = noNombres.filter((h) => h.obligatorio);
  const base: readonly Hecho[] = obligatorios.length > 0 ? obligatorios : noNombres.slice(0, 1);
  const raices = new Map(base.map((h) => [h.id, cadenaDeSujetos(h, porId).raiz ?? null]));
  const delante = new Set(raices.values());
  const item = (h: Hecho): Item => ({ raiz: raices.get(h.id) ?? null, texto: `${h.etiqueta} ${cita(h.id)}` });
  return { datos: base.map(item), sueltos: paquete.hechos.filter((h) => esNombre(h) && h.obligatorio && !delante.has(h.id)).map(item) };
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
  const colocarSueltos = (): void => {
    pendientes = pendientes.filter((n) => !frases.some((_, i) => agregar(i, n)));
  };
  for (const dato of datos) {
    if (frases.length > 0 && agregar(frases.length - 1, dato)) continue;
    if (abrir(dato)) colocarSueltos();
  }
  colocarSueltos();
  return frases.map(textoDe);
}

/** La salida cruda de la plantilla, en el formato del esquema («hechos» con las citas de cada frase, sin repetir). */
export function salidaDePlantilla(paquete: PaqueteHechos): string {
  if (!esPaqueteConstruido(paquete)) throw new ErrorValidador("PAQUETE_NO_CONSTRUIDO");
  const textos = repartir(seleccionar(paquete, hechosPorId(paquete)), paquete);
  const frases = textos.map((texto) => ({ hechos: [...new Set(citasDe(texto).map((c) => c.id))], texto }));
  return JSON.stringify({ frases });
}

/** El resumen sin IA: la plantilla, pasada por el mismo validador que la salida de un modelo. */
export function resumenSinIa<T extends TipoResumen>(paquete: PaqueteHechos<T>): ResultadoValidacion<T> {
  return validarSalida(salidaDePlantilla(paquete), paquete);
}
