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
import type { ResultadoValidacion } from "./tipos";
import { validarSalida } from "./validar";

interface Item {
  /** El nombre de la especie que va delante, o null si el dato es del portafolio. */
  readonly raiz: IdHecho | null;
  readonly texto: string;
}

interface FraseEnArmado {
  readonly partes: readonly string[];
  /** La especie de la última parte: la siguiente de la misma especie no repite el nombre. */
  readonly raiz: IdHecho | null;
}

const cita = (id: IdHecho): string => `{${id}}`;

/**
 * Los obligatorios que no son nombres (si no hay ninguno, el primer hecho que no es un nombre), más los nombres
 * obligatorios que no van ya delante de un dato; si el paquete solo tiene nombres, el primero. En el orden del paquete.
 */
function seleccionar(paquete: PaqueteHechos, porId: HechosPorId): readonly Item[] {
  const noNombres = paquete.hechos.filter((h) => !esNombre(h));
  const obligatorios = noNombres.filter((h) => h.obligatorio);
  const base: readonly Hecho[] = obligatorios.length > 0 ? obligatorios : noNombres.slice(0, 1);
  const raices = new Map(base.map((h) => [h.id, cadenaDeSujetos(h, porId).raiz ?? null]));
  const delante = new Set(raices.values());
  const nombres = paquete.hechos.filter((h) => esNombre(h));
  const sueltos = nombres.filter((h) => h.obligatorio && !delante.has(h.id));
  const elegidos = new Set([...base, ...(base.length === 0 && sueltos.length === 0 ? nombres.slice(0, 1) : sueltos)].map((h) => h.id));
  return paquete.hechos.filter((h) => elegidos.has(h.id)).map((h) => ({ raiz: raices.get(h.id) ?? null, texto: `${h.etiqueta} ${cita(h.id)}` }));
}

const mayusculaInicial = (texto: string): string => texto.charAt(0).toLocaleUpperCase("es-CO") + texto.slice(1);
const textoDe = (frase: FraseEnArmado): string => `${mayusculaInicial(frase.partes.join(""))}.`;

/** La frase con el ítem al final: «; » entre ítems y el nombre de la especie delante cuando cambia. */
function conItem(frase: FraseEnArmado, item: Item): FraseEnArmado {
  const delante = item.raiz === null ? "" : `${cita(item.raiz)}: `;
  const separador = frase.partes.length === 0 ? "" : "; ";
  const misma = frase.partes.length > 0 && item.raiz !== null && item.raiz === frase.raiz;
  return { partes: [...frase.partes, `${separador}${misma ? "" : delante}${item.texto}`], raiz: item.raiz };
}

/** Reparte los ítems en frases, en orden, sin pasar los límites (medidos con las presentaciones puestas). */
function repartir(items: readonly Item[], paquete: PaqueteHechos): readonly string[] {
  const largo = (frase: FraseEnArmado): number => [...renderizarFrase(textoDe(frase), paquete)].length;
  const { maxFrases, maxLargoFrase, maxLargoTotal } = LIMITES_SALIDA;
  let frases: readonly FraseEnArmado[] = [];
  let total = 0;
  for (const item of items) {
    const actual = frases.at(-1);
    const ampliada = actual === undefined ? undefined : conItem(actual, item);
    if (actual !== undefined && ampliada !== undefined && largo(ampliada) <= maxLargoFrase) {
      const conAmpliada = total - largo(actual) + largo(ampliada);
      if (conAmpliada <= maxLargoTotal) {
        frases = [...frases.slice(0, -1), ampliada];
        total = conAmpliada;
      }
      continue;
    }
    const nueva = conItem({ partes: [], raiz: null }, item);
    if (frases.length >= maxFrases || total + largo(nueva) > maxLargoTotal) continue;
    frases = [...frases, nueva];
    total += largo(nueva);
  }
  return frases.map(textoDe);
}

/** La salida cruda de la plantilla, en el formato del esquema («hechos» con las citas de cada frase, sin repetir). */
export function salidaDePlantilla(paquete: PaqueteHechos): string {
  if (!esPaqueteConstruido(paquete)) throw new ErrorValidador("PAQUETE_NO_CONSTRUIDO");
  const textos = repartir(seleccionar(paquete, hechosPorId(paquete)), paquete);
  const frases = textos.map((texto) => ({ hechos: [...new Set([...texto.matchAll(/\{(H[0-9]{2})\}/gu)].map((m) => m[1] as string))], texto }));
  return JSON.stringify({ frases });
}

/** El resumen sin IA: la plantilla, pasada por el mismo validador que la salida de un modelo. */
export function resumenSinIa<T extends TipoResumen>(paquete: PaqueteHechos<T>): ResultadoValidacion<T> {
  return validarSalida(salidaDePlantilla(paquete), paquete);
}
