/**
 * Lectura del texto de una frase del modelo: sus citas `{Hnn}` con posición, sus palabras, sus cláusulas y a qué cita
 * se refiere cada palabra. Trabaja sobre la forma preparada (`prepararTexto`: minúsculas, mismas posiciones que el
 * plegado), así una aparición de un patrón se atribuye por su posición.
 *
 * - Cláusulas: se cortan en « . ; ! ? » y en las conjunciones « y », « e », « pero », « aunque », « mientras »,
 *   « sino ». La coma no corta («La ganancia total, {H04}, bajó»).
 * - Atribución: cada palabra (y cada cita de un nombre) va a la cita más cercana de su cláusula que no sea un nombre;
 *   en un empate, a las dos. Si la cláusula no tiene ninguna pero cita un nombre, se queda sin atribuir (es una mención
 *   del nombre); si no cita nada, va a la más cercana de la frase; si la frase tampoco tiene, a nadie.
 */
import { esIdHecho, type IdHecho } from "../contrato";

/** Una cita con la forma «{H}» y dos dígitos (el id puede no estar en el paquete, o ser H00). */
export const PATRON_CITA = /\{H[0-9]{2}\}/gu;
const TOKEN = /\{h[0-9]{2}\}|\p{L}+|[.;!?]/gu;
const CONJUNCIONES: ReadonlySet<string> = new Set(["y", "e", "pero", "aunque", "mientras", "sino"]);

export interface Cita {
  /** «H03» (con la forma de una cita; puede no ser un id válido). */
  readonly id: string;
  readonly inicio: number;
  readonly fin: number;
}

/** Las citas con forma «{Hnn}» del texto, en orden. */
export function citasDe(texto: string): readonly Cita[] {
  return [...texto.matchAll(PATRON_CITA)].map((m) => ({ id: m[0].slice(1, -1), inicio: m.index, fin: m.index + m[0].length }));
}

export type Token =
  | { readonly tipo: "PALABRA"; readonly texto: string; readonly inicio: number; readonly fin: number }
  | { readonly tipo: "CITA"; readonly id: string; readonly inicio: number; readonly fin: number };

/** Las palabras y las citas de la forma preparada, agrupadas por cláusula (los cortes y las conjunciones no quedan). */
export function clausulasDe(minusculas: string): readonly (readonly Token[])[] {
  const clausulas: Token[][] = [[]];
  for (const m of minusculas.matchAll(TOKEN)) {
    const texto = m[0];
    const actual = clausulas[clausulas.length - 1] as Token[];
    const fin = m.index + texto.length;
    if (texto.startsWith("{")) actual.push({ tipo: "CITA", id: texto.slice(1, -1).toUpperCase(), inicio: m.index, fin });
    else if (/^[.;!?]$/u.test(texto) || CONJUNCIONES.has(texto)) clausulas.push([]);
    else actual.push({ tipo: "PALABRA", texto, inicio: m.index, fin });
  }
  return clausulas.filter((c) => c.length > 0);
}

/** Un token con su lugar en la frase (para medir la distancia entre palabras y citas). */
export interface Ubicado {
  readonly token: Token;
  readonly lugar: number;
}

/** Los destinos más cercanos (por lugar) al lugar dado; en un empate, todos los empatados. `destinos` va en orden. */
function masCercanos(lugar: number, destinos: readonly Ubicado[]): readonly Ubicado[] {
  let bajo = 0;
  let alto = destinos.length;
  while (bajo < alto) {
    const medio = (bajo + alto) >> 1;
    if ((destinos[medio] as Ubicado).lugar < lugar) bajo = medio + 1;
    else alto = medio;
  }
  const despues = destinos[bajo];
  const antes = destinos[bajo - 1];
  if (antes === undefined) return despues === undefined ? [] : [despues];
  if (despues === undefined) return [antes];
  const da = lugar - antes.lugar;
  const dd = despues.lugar - lugar;
  return da === dd ? [antes, despues] : da < dd ? [antes] : [despues];
}

export interface Atribucion {
  /** Por cada cita que no es un nombre (por su lugar), los tokens que se le atribuyen. */
  readonly porCita: ReadonlyMap<number, readonly Token[]>;
  /** Las citas que no son nombres, en orden, con su lugar y su cláusula. */
  readonly destinos: readonly (Ubicado & { readonly clausula: number })[];
  /** Los tokens que no se pudieron atribuir (la frase no cita ningún hecho que no sea un nombre). */
  readonly sinDestino: readonly Token[];
  /** Los destinos de la palabra que empieza en esa posición de la forma preparada (ninguno si no hay palabra allí). */
  destinosEn(posicion: number): readonly IdHecho[];
}

/**
 * Atribuye cada palabra y cada cita de un nombre a la cita más cercana que no sea un nombre (ver arriba). `esDestino`
 * dice si una cita es un hecho conocido del paquete que no es un nombre.
 */
export function atribuir(clausulas: readonly (readonly Token[])[], esDestino: (id: string) => boolean): Atribucion {
  let lugar = 0;
  const ubicadas = clausulas.map((c) => c.map((token) => ({ token, lugar: lugar++ })));
  const destinos = ubicadas.flatMap((c, i) => c.filter((u) => u.token.tipo === "CITA" && esDestino(u.token.id)).map((u) => ({ ...u, clausula: i })));
  const porCita = new Map<number, Token[]>(destinos.map((d) => [d.lugar, []]));
  const sinDestino: Token[] = [];
  const destinoDe = new Map<number, readonly Ubicado[]>();
  const porClausula = new Map<number, Ubicado[]>();
  for (const d of destinos) {
    const lista = porClausula.get(d.clausula);
    if (lista === undefined) porClausula.set(d.clausula, [d]);
    else lista.push(d);
  }
  ubicadas.forEach((clausula, i) => {
    // Una cláusula con su propia cita (un nombre, p. ej. «nombre de la especie {H01}») se queda con lo suyo; solo una
    // cláusula sin ninguna cita se apoya en las citas de la frase.
    const conCita = clausula.some((u) => u.token.tipo === "CITA");
    const candidatos = porClausula.get(i) ?? (conCita ? [] : destinos);
    for (const u of clausula) {
      if (u.token.tipo === "CITA" && esDestino(u.token.id)) continue;
      const elegidos = masCercanos(u.lugar, candidatos);
      destinoDe.set(u.token.inicio, elegidos);
      if (elegidos.length === 0) sinDestino.push(u.token);
      for (const e of elegidos) porCita.get(e.lugar)?.push(u.token);
    }
  });
  const destinosEn = (posicion: number): readonly IdHecho[] =>
    (destinoDe.get(posicion) ?? []).map((e) => (e.token as Extract<Token, { tipo: "CITA" }>).id).filter(esIdHecho);
  return { porCita, destinos, sinDestino, destinosEn };
}
