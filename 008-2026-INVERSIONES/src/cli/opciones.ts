/**
 * Lectura estricta de las opciones de los CLI de 008. Es lo común que estaba copiado en:
 * - los argumentos de la vía B de los precios, del fondo y de las series (src/precios/argumentos-carga.ts,
 *   src/fondo/argumentos-carga.ts y src/datos-oficiales/series/argumentos.ts);
 * - los de los exportadores de BanRep y de la TRM (src/datos-oficiales/fuentes/banrep-argumentos.ts y exportar-trm.ts).
 * Es pura: no toca la base, el disco ni la red. Prueba propia: tests/unit/cli/opciones.test.ts.
 *
 * `leerOpciones` aplica estas reglas, en este orden:
 * 1. Trampa de npm: sin «--», `npm run <comando> --opcion …` deja la opción en npm_config_<opcion> y el script no la
 *    recibe. Si la variable está y la opción no llegó en argv, se avisa antes de leer nada más. El aviso es un
 *    parámetro: el de BanRep nombra su comando.
 * 2. Por cada par «opción valor»:
 *    - lo que no empieza por «-» es un argumento suelto;
 *    - lo que no está en la lista es una opción desconocida (también `--opcion=valor`, `--` y `-x`);
 *    - una opción ya vista está repetida;
 *    - un valor que falta o que empieza por «-» se rechaza: una opción nunca es una ruta ni una fecha.
 * Los mensajes nunca repiten rutas, fechas ni correos; a lo sumo, el nombre de una opción.
 *
 * `leerConParseArgs` es la otra forma estricta, con `parseArgs` y sus tokens. La usan los decretos, los rendimientos y
 * la constitución del fondo.
 *
 * No se unen aquí, a propósito, porque su contrato es otro:
 * - src/cifrado/argumentos.ts y src/precios/argumentos-depurar.ts: aceptan valores que empiezan por un solo «-» y
 *   repiten la opción desconocida tal cual;
 * - src/lotes/argumentos.ts: solo banderas, con eco acotado;
 * - src/importacion/av/argumentos.ts: códigos fijos y archivos sueltos;
 * - src/plan/importar/argumentos.ts: un único código USO;
 * - src/fondo/argumentos.ts: parseArgs sin tokens.
 * Unirlos cambiaría mensajes o conducta.
 */
import { parseArgs, type ParseArgsOptionsConfig } from "node:util";
import { leerFechaIso } from "../importacion/trii/valores";

/** process.env, o el entorno de una prueba. */
export type Entorno = Readonly<Record<string, string | undefined>>;

/**
 * Uso inválido de un CLI de la vía B o de un exportador: el script sale con 2 y su uso. Se define aquí y
 * src/precios/argumentos-carga.ts la re-exporta, así que hay una sola clase: los scripts deciden la salida 2 con
 * `instanceof`.
 */
export class ErrorArgumentosCarga extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorArgumentosCarga";
  }
}

/** Solo se repite el nombre de una opción con esta forma: nunca una ruta, una fecha, un correo ni caracteres de control. */
const NOMBRE_REPETIBLE = /^--?[a-z][a-z0-9-]{0,30}$/;
const FECHA = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
const DIA_MS = 86_400_000;

/** Dónde deja npm la opción que se quedó: npm_config_<nombre sin «--», con «_» por «-»>. */
export const variableDeNpm = (opcion: string): string => `npm_config_${opcion.slice(2).replaceAll("-", "_")}`;

/** La primera opción, en el orden dado, que npm se quedó: su variable está y la opción no llegó en argv. */
export function tomadaPorNpm<K extends string>(opciones: readonly K[], argv: readonly string[], entorno: Entorno): K | undefined {
  return opciones.find((o) => entorno[variableDeNpm(o)] !== undefined && !argv.includes(o));
}

/** El mensaje de una opción desconocida: su nombre (sin «=valor»), solo si tiene forma de nombre de opción. */
export function mensajeDesconocida(argumento: string): string {
  const nombre = argumento.split("=", 1)[0] ?? "";
  return NOMBRE_REPETIBLE.test(nombre) ? `Opción desconocida: «${nombre}».` : "Opción desconocida.";
}

/** El aviso de la trampa de npm de los comandos de `npm run` (precios, fondo, series y TRM). */
export const avisoNpmRun = (opcion: string): string => `npm se quedó con ${opcion}: escriba «npm run -s <comando> -- ${opcion} …» (con «--»).`;

/**
 * Las opciones con su valor, según las reglas de arriba. `opciones` va de la opción a qué valor lleva (p. ej. «una
 * ruta»), que sale en el mensaje cuando el valor falta. Lanza ErrorArgumentosCarga ante cualquier otra forma.
 */
export function leerOpciones<K extends string>(
  argv: readonly string[],
  opciones: Readonly<Record<K, string>>,
  entorno: Entorno,
  avisoNpm: (opcion: K) => string = avisoNpmRun,
): ReadonlyMap<K, string> {
  const esOpcion = (texto: string): texto is K => Object.hasOwn(opciones, texto);
  const tomada = tomadaPorNpm(Object.keys(opciones).filter(esOpcion), argv, entorno);
  if (tomada) throw new ErrorArgumentosCarga(avisoNpm(tomada));
  const valores = new Map<K, string>();
  for (let i = 0; i < argv.length; i += 2) {
    const opcion = argv[i]!;
    if (!opcion.startsWith("-")) throw new ErrorArgumentosCarga("Argumento suelto: no se admiten argumentos sueltos (cada valor va después de su opción).");
    if (!esOpcion(opcion)) throw new ErrorArgumentosCarga(mensajeDesconocida(opcion));
    if (valores.has(opcion)) throw new ErrorArgumentosCarga(`${opcion} está repetida.`);
    const valor = argv[i + 1];
    if (valor === undefined || valor.startsWith("-")) throw new ErrorArgumentosCarga(`${opcion} necesita ${opciones[opcion]} (no una opción ni algo que empiece por «-»).`);
    valores.set(opcion, valor);
  }
  return valores;
}

/** El valor de una opción obligatoria; si no llegó, «Falta <opción> <tipo>.». */
export function opcionRequerida<K extends string>(valores: ReadonlyMap<K, string>, opcion: K, tipo: string): string {
  const valor = valores.get(opcion);
  if (valor === undefined) throw new ErrorArgumentosCarga(`Falta ${opcion} <${tipo}>.`);
  return valor;
}

/** Una fecha `AAAA-MM-DD` exacta (sin espacios), de negocio en Colombia; undefined si la opción no llegó. */
export function fechaDeOpcion(texto: string | undefined, opcion: string): Date | undefined {
  if (texto === undefined) return undefined;
  const r = FECHA.test(texto) ? leerFechaIso(texto) : null;
  if (!r?.ok) throw new ErrorArgumentosCarga(`${opcion} debe ser una fecha AAAA-MM-DD válida.`);
  return r.valor;
}

/**
 * --desde ≤ --hasta ≤ tope, y a lo sumo `maxDias` entre los dos (el orden se mira primero). Cada exportador trae su
 * tope y su máximo. `textoTope` es cómo se dice el tope en el mensaje: «hoy» en los precios, el fondo y BanRep, y
 * «hoy + N día(s)» en la TRM, que la SFC publica por adelantado.
 */
export function exigirRango(desde: Date, hasta: Date, tope: Date, maxDias: number, textoTope = "hoy"): void {
  if (desde > hasta || hasta > tope) throw new ErrorArgumentosCarga(`Rango inválido: --desde ≤ --hasta ≤ ${textoTope}.`);
  if (hasta.getTime() - desde.getTime() > maxDias * DIA_MS) throw new ErrorArgumentosCarga(`Rango inválido: más de ${maxDias} días (pídalo por tramos).`);
}

/** Las opciones que llegaron más de una vez, una vez cada una y en el orden de su segunda aparición. */
function repetidas(tokens: readonly { readonly kind: string; readonly name?: string }[]): string[] {
  const vistas = new Set<string>();
  const dobles: string[] = [];
  for (const t of tokens) {
    if (t.kind !== "option" || t.name === undefined) continue;
    if (vistas.has(t.name) && !dobles.includes(t.name)) dobles.push(t.name);
    vistas.add(t.name);
  }
  return dobles;
}

function intentar<O extends ParseArgsOptionsConfig>(argv: readonly string[], opciones: O) {
  try {
    return parseArgs({ args: [...argv], strict: true, allowPositionals: false, tokens: true, options: opciones });
  } catch {
    // El mensaje de parseArgs puede repetir lo que se escribió (una ruta o un correo): no se muestra.
    return null;
  }
}

/** Lo que leyó `leerConParseArgs`: los valores, con los tipos de las opciones dadas, y las opciones repetidas. */
export interface LecturaParseArgs<O extends ParseArgsOptionsConfig> {
  readonly valores: NonNullable<ReturnType<typeof intentar<O>>>["values"];
  readonly repetidas: readonly string[];
}

/**
 * `parseArgs` estricto (solo las opciones dadas, sin sueltos) con sus tokens. Devuelve null si no se pudo leer o si vino
 * `--`: después de él, parseArgs deja de leer opciones. `repetidas` dice las opciones que llegaron más de una vez. El
 * valor de cada opción lo valida su módulo (p. ej. `--archivo=-x` sí pasa aquí).
 */
export function leerConParseArgs<O extends ParseArgsOptionsConfig>(argv: readonly string[], opciones: O): LecturaParseArgs<O> | null {
  const r = intentar(argv, opciones);
  if (!r || r.tokens.some((t) => t.kind === "option-terminator")) return null;
  return { valores: r.values, repetidas: repetidas(r.tokens) };
}
