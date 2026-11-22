/**
 * Argumentos de scripts/exportar-banrep.ts (el Mac del dueño). Puros y estrictos, con las mismas reglas que los demás
 * CLI de la vía B (src/precios/argumentos-carga.ts, src/fondo/argumentos-carga.ts y src/datos-oficiales/series/
 * argumentos.ts, que este frente no toca: de ahí que la forma se repita aquí; unirlas queda para un refactor aparte):
 * - Cada opción lleva su valor en el argumento siguiente, a lo sumo una vez; un valor nunca empieza por «-».
 *   `--opcion=valor`, `--` y los argumentos sueltos no se admiten.
 * - Trampa de npm: sin «--», npm deja la opción en npm_config_<opcion> y el script no la recibe; si la variable está y la
 *   opción no llegó, se dice.
 * - `--serie`: una serie de BanRep del catálogo (TPM o IBR_3M_EA), una por corrida (un --archivo es de un dataflow).
 * - Fechas `AAAA-MM-DD` exactas, de negocio en Colombia; --hasta ≤ hoy y un rango de a lo sumo MAX_DIAS_RANGO_BANREP.
 * Los mensajes nunca repiten rutas, fechas ni el valor de --serie: a lo sumo el nombre de una opción.
 */
import { leerFechaIso } from "../../importacion/trii/valores";
import { ErrorArgumentosCarga } from "../../precios/argumentos-carga";
import type { SerieBanrep } from "./banrep-series";

/**
 * Rango máximo (días): 5 años. La descarga va por años desde --desde y trae el dataflow entero (la IBR, 8 series): 6
 * años caben con holgura en el tope de 4 MiB del lector (estimado con las descargas del 2026-11-21, POR VERIFICAR), y
 * 1831 filas, en el tope del CSV de series.
 */
export const MAX_DIAS_RANGO_BANREP = 1830;
const DIA_MS = 86_400_000;
const FECHA = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
/** Solo se repite el nombre de una opción con esta forma: nunca una ruta ni caracteres de control. */
const NOMBRE_REPETIBLE = /^--?[a-z][a-z0-9-]{0,30}$/;
const OPCIONES = { "--serie": "una serie", "--desde": "una fecha AAAA-MM-DD", "--hasta": "una fecha AAAA-MM-DD", "--archivo": "una ruta" } as const;
type Opcion = keyof typeof OPCIONES;

export const USO_EXPORTAR_BANREP = [
  "Uso: npx tsx scripts/exportar-banrep.ts --serie <TPM|IBR_3M_EA> --desde AAAA-MM-DD [--hasta AAAA-MM-DD] [--archivo <descarga.xml>] > <series.csv.parcial>",
  "  Pide al SDMX público de BanRep la serie (TPM o IBR_3M_EA) y escribe por stdout el CSV de series oficiales que carga",
  "  importar-series (formato en src/datos-oficiales/series/csv-series.ts). Se niega a escribir en una terminal.",
  "  --archivo: el XML que usted bajó en su navegador (si BanRep bloquea el pedido automático); no se pide nada a la red.",
  `  --hasta por defecto: hoy; rango de hasta ${MAX_DIAS_RANGO_BANREP} días.`,
  "  Salida: 0 bien · 3 con avisos (descartes, inicio tardío, serie atrasada o días faltantes) · 2 uso, terminal, TLS apagado o archivo ilegible · 1 BanRep, archivo o CSV fallido.",
].join("\n");

type Entorno = Readonly<Record<string, string | undefined>>;

export interface ArgumentosExportarBanrep {
  readonly serie: SerieBanrep;
  readonly desde: Date;
  readonly hasta: Date;
  /** null: se pide a BanRep por la red. */
  readonly archivo: string | null;
}

const variableDeNpm = (opcion: string): string => `npm_config_${opcion.slice(2).replaceAll("-", "_")}`;

function desconocida(argumento: string): ErrorArgumentosCarga {
  const nombre = argumento.split("=", 1)[0] ?? "";
  return new ErrorArgumentosCarga(NOMBRE_REPETIBLE.test(nombre) ? `Opción desconocida: «${nombre}».` : "Opción desconocida.");
}

const esOpcion = (texto: string): texto is Opcion => Object.hasOwn(OPCIONES, texto);

/** Las opciones con su valor; lanza ante cualquier forma no admitida. */
function leerOpciones(argv: readonly string[], entorno: Entorno): ReadonlyMap<Opcion, string> {
  const tomada = (Object.keys(OPCIONES) as Opcion[]).find((o) => entorno[variableDeNpm(o)] !== undefined && !argv.includes(o));
  if (tomada) throw new ErrorArgumentosCarga(`npm se quedó con ${tomada}: escriba «npx tsx scripts/exportar-banrep.ts ${tomada} …» (con «--» si usa npm).`);
  const valores = new Map<Opcion, string>();
  for (let i = 0; i < argv.length; i += 2) {
    const opcion = argv[i]!;
    if (!opcion.startsWith("-")) throw new ErrorArgumentosCarga("Argumento suelto: no se admiten argumentos sueltos (cada valor va después de su opción).");
    if (!esOpcion(opcion)) throw desconocida(opcion);
    if (valores.has(opcion)) throw new ErrorArgumentosCarga(`${opcion} está repetida.`);
    const valor = argv[i + 1];
    if (valor === undefined || valor.startsWith("-")) throw new ErrorArgumentosCarga(`${opcion} necesita ${OPCIONES[opcion]} (no una opción ni algo que empiece por «-»).`);
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

function requerida(valores: ReadonlyMap<Opcion, string>, opcion: Opcion, tipo: string): string {
  const valor = valores.get(opcion);
  if (valor === undefined) throw new ErrorArgumentosCarga(`Falta ${opcion} <${tipo}>.`);
  return valor;
}

function serieDe(codigo: string, series: readonly SerieBanrep[]): SerieBanrep {
  const serie = series.find((s) => s.codigo === codigo);
  if (!serie) throw new ErrorArgumentosCarga(`--serie debe ser ${series.map((s) => s.codigo).join(" o ")}.`);
  return serie;
}

/**
 * `entorno` es process.env (para detectar las opciones que npm se quedó); `hoy`, la fecha de negocio en Colombia (tope y
 * valor por defecto de --hasta); `series`, las de BanRep del catálogo (seriesBanrep()). Lanza ErrorArgumentosCarga.
 */
export function leerArgumentosExportarBanrep(argv: readonly string[], entorno: Entorno, hoy: Date, series: readonly SerieBanrep[]): ArgumentosExportarBanrep {
  const valores = leerOpciones(argv, entorno);
  const serie = serieDe(requerida(valores, "--serie", series.map((s) => s.codigo).join("|")), series);
  const desde = fecha(requerida(valores, "--desde", "AAAA-MM-DD"), "--desde")!;
  const hasta = fecha(valores.get("--hasta"), "--hasta") ?? hoy;
  if (desde > hasta || hasta > hoy) throw new ErrorArgumentosCarga("Rango inválido: --desde ≤ --hasta ≤ hoy.");
  if (hasta.getTime() - desde.getTime() > MAX_DIAS_RANGO_BANREP * DIA_MS) throw new ErrorArgumentosCarga(`Rango inválido: más de ${MAX_DIAS_RANGO_BANREP} días (pídalo por tramos).`);
  return { serie, desde, hasta, archivo: valores.get("--archivo") ?? null };
}
