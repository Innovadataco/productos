/**
 * Argumentos de scripts/importar-precios.ts (producción, sin red) y scripts/exportar-precios.ts (el Mac del dueño, con
 * red). Puros y estrictos: se leen ANTES de abrir la base o la red, y lo que no se reconoce sale con 2 y el uso.
 * - Cada opción lleva su valor en el argumento siguiente, a lo sumo una vez; un valor nunca empieza por «-» (una
 *   opción nunca es una ruta ni una fecha). `--opcion=valor`, `--` y los argumentos sueltos no se admiten.
 * - Trampa de npm (la de src/cli/argumentos-importar-trii.ts): `npm run precios:exportar --hasta …` sin «--» deja la
 *   opción en npm_config_hasta y el script no la recibe; si la variable está y la opción no llegó, sale con 2.
 * - Fechas `AAAA-MM-DD` exactas (sin espacios), de negocio en Colombia.
 * Los mensajes nunca repiten rutas ni fechas: a lo sumo el nombre de una opción.
 */
import { leerFechaIso } from "../importacion/trii/valores";

/** Rango máximo del exportador: 5 años de ruedas por 40 especies caben en el tope de filas del CSV (csv-cierres.ts). */
export const MAX_DIAS_RANGO = 1830;
const DIA_MS = 86_400_000;
const FECHA = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
/** Solo se repite el nombre de una opción con esta forma: nunca una ruta ni caracteres de control. */
const NOMBRE_REPETIBLE = /^--?[a-z][a-z0-9-]{0,30}$/;

export const USO_IMPORTAR_PRECIOS = [
  "Uso: npm run -s precios:importar -- --archivo <cierres.csv>",
  "  Importa el CSV de cierres que escribió precios:exportar (formato en src/precios/csv-cierres.ts) por el mismo camino",
  "  que precios:actualizar. Valida el archivo entero antes de abrir la base: con un error no guarda nada.",
  "  Salida: 0 bien · 3 con avisos · 2 uso o archivo ilegible · 1 CSV rechazado o error.",
].join("\n");

export const USO_EXPORTAR_PRECIOS = [
  "Uso: npm run -s precios:exportar -- --nemos <lista.txt> --desde AAAA-MM-DD [--hasta AAAA-MM-DD] > <cierres.csv.parcial>",
  `  Pide a Yahoo los cierres (<NEMO>.CL) de la lista (un nemotécnico por línea; «#» comenta) y escribe el CSV por stdout.`,
  `  --hasta por defecto: hoy; rango de hasta ${MAX_DIAS_RANGO} días. «-s» evita que npm escriba su encabezado dentro del CSV.`,
  "  Salida: 0 bien · 3 alguna especie quedó fuera · 2 uso o lista ilegible · 1 lista inválida, sin cierres o error.",
].join("\n");

export class ErrorArgumentosCarga extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorArgumentosCarga";
  }
}

type Entorno = Readonly<Record<string, string | undefined>>;
/** Opción → qué valor lleva (para el mensaje cuando falta). */
type Opciones = Readonly<Record<string, "una ruta" | "una fecha AAAA-MM-DD">>;

const variableDeNpm = (opcion: string): string => `npm_config_${opcion.slice(2).replaceAll("-", "_")}`;

function desconocida(argumento: string): ErrorArgumentosCarga {
  const nombre = argumento.split("=", 1)[0] ?? "";
  return new ErrorArgumentosCarga(NOMBRE_REPETIBLE.test(nombre) ? `Opción desconocida: «${nombre}».` : "Opción desconocida.");
}

/** Las opciones con su valor; lanza ante cualquier forma no admitida. */
function leerOpciones(argv: readonly string[], opciones: Opciones, entorno: Entorno): ReadonlyMap<string, string> {
  const tomada = Object.keys(opciones).find((o) => entorno[variableDeNpm(o)] !== undefined && !argv.includes(o));
  if (tomada) throw new ErrorArgumentosCarga(`npm se quedó con ${tomada}: escriba «npm run -s <comando> -- ${tomada} …» (con «--»).`);
  const valores = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    const opcion = argv[i]!;
    if (!opcion.startsWith("-")) throw new ErrorArgumentosCarga("Argumento suelto: no se admiten argumentos sueltos (cada valor va después de su opción).");
    const tipo = opciones[opcion];
    if (!Object.hasOwn(opciones, opcion) || tipo === undefined) throw desconocida(opcion);
    if (valores.has(opcion)) throw new ErrorArgumentosCarga(`${opcion} está repetida.`);
    const valor = argv[i + 1];
    if (valor === undefined || valor.startsWith("-")) throw new ErrorArgumentosCarga(`${opcion} necesita ${tipo} (no una opción ni algo que empiece por «-»).`);
    valores.set(opcion, valor);
  }
  return valores;
}

function fecha(texto: string | undefined, opcion: string): Date | undefined {
  if (texto === undefined) return undefined;
  const r = FECHA.test(texto) ? leerFechaIso(texto) : null;
  if (!r?.ok) throw new ErrorArgumentosCarga(`${opcion} debe ser una fecha AAAA-MM-DD válida.`);
  return r.valor;
}

function requerida(valores: ReadonlyMap<string, string>, opcion: string, tipo: string): string {
  const valor = valores.get(opcion);
  if (valor === undefined) throw new ErrorArgumentosCarga(`Falta ${opcion} <${tipo}>.`);
  return valor;
}

export interface ArgumentosImportarPrecios {
  readonly archivo: string;
}

/** `entorno` es process.env (para detectar las opciones que npm se quedó). */
export function leerArgumentosImportarPrecios(argv: readonly string[], entorno: Entorno): ArgumentosImportarPrecios {
  const valores = leerOpciones(argv, { "--archivo": "una ruta" }, entorno);
  return { archivo: requerida(valores, "--archivo", "cierres.csv") };
}

export interface ArgumentosExportarPrecios {
  readonly nemos: string;
  readonly desde: Date;
  readonly hasta: Date;
}

/** `hoy` es la fecha de negocio en Colombia: tope y valor por defecto de --hasta. */
export function leerArgumentosExportarPrecios(argv: readonly string[], entorno: Entorno, hoy: Date): ArgumentosExportarPrecios {
  const valores = leerOpciones(argv, { "--nemos": "una ruta", "--desde": "una fecha AAAA-MM-DD", "--hasta": "una fecha AAAA-MM-DD" }, entorno);
  const nemos = requerida(valores, "--nemos", "lista.txt");
  const desde = fecha(requerida(valores, "--desde", "AAAA-MM-DD"), "--desde")!;
  const hasta = fecha(valores.get("--hasta"), "--hasta") ?? hoy;
  if (desde > hasta || hasta > hoy) throw new ErrorArgumentosCarga("Rango inválido: --desde ≤ --hasta ≤ hoy.");
  if (hasta.getTime() - desde.getTime() > MAX_DIAS_RANGO * DIA_MS) throw new ErrorArgumentosCarga(`Rango inválido: más de ${MAX_DIAS_RANGO} días (pídalo por tramos).`);
  return { nemos, desde, hasta };
}
