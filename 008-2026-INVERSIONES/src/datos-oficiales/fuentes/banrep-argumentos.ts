/**
 * Argumentos de scripts/exportar-banrep.ts (el Mac del dueño). Puros y estrictos, con las mismas reglas que los demás
 * CLI de la vía B: el lector común de src/cli/opciones.ts. Lo propio es el aviso de npm, que nombra este comando (se
 * corre con `npx tsx`, no con `npm run`). Las reglas:
 * - Cada opción lleva su valor en el argumento siguiente, a lo sumo una vez; un valor nunca empieza por «-».
 *   `--opcion=valor`, `--` y los argumentos sueltos no se admiten.
 * - Trampa de npm: sin «--», npm deja la opción en npm_config_<opcion> y el script no la recibe; si la variable está y la
 *   opción no llegó, se dice.
 * - `--serie`: una serie de BanRep del catálogo (TPM o IBR_3M_EA), una por corrida (un --archivo es de un dataflow).
 * - Fechas `AAAA-MM-DD` exactas, de negocio en Colombia; --hasta ≤ hoy y un rango de a lo sumo MAX_DIAS_RANGO_BANREP.
 * Los mensajes nunca repiten rutas, fechas ni el valor de --serie: a lo sumo el nombre de una opción.
 */
import { ErrorArgumentosCarga, exigirRango, fechaDeOpcion, leerOpciones, opcionRequerida, type Entorno } from "../../cli/opciones";
import type { SerieBanrep } from "./banrep-series";

/**
 * Rango máximo (días): 5 años. La descarga va por años desde --desde y trae el dataflow entero (la IBR, 8 series): 6
 * años caben con holgura en el tope de 4 MiB del lector (estimado con las descargas del 2026-11-21, POR VERIFICAR), y
 * 1831 filas, en el tope del CSV de series.
 */
export const MAX_DIAS_RANGO_BANREP = 1830;
const OPCIONES = { "--serie": "una serie", "--desde": "una fecha AAAA-MM-DD", "--hasta": "una fecha AAAA-MM-DD", "--archivo": "una ruta" } as const;

export const USO_EXPORTAR_BANREP = [
  "Uso: npx tsx scripts/exportar-banrep.ts --serie <TPM|IBR_3M_EA> --desde AAAA-MM-DD [--hasta AAAA-MM-DD] [--archivo <descarga.xml>] > <series.csv.parcial>",
  "  Pide al SDMX público de BanRep la serie (TPM o IBR_3M_EA) y escribe por stdout el CSV de series oficiales que carga",
  "  importar-series (formato en src/datos-oficiales/series/csv-series.ts). Se niega a escribir en una terminal.",
  "  --archivo: el XML que usted bajó en su navegador (si BanRep bloquea el pedido automático); no se pide nada a la red.",
  `  --hasta por defecto: hoy; rango de hasta ${MAX_DIAS_RANGO_BANREP} días.`,
  "  Salida: 0 bien · 3 con avisos (descartes, inicio tardío, serie atrasada o días faltantes) · 2 uso, terminal, TLS apagado o archivo ilegible · 1 BanRep, archivo o CSV fallido.",
].join("\n");

export interface ArgumentosExportarBanrep {
  readonly serie: SerieBanrep;
  readonly desde: Date;
  readonly hasta: Date;
  /** null: se pide a BanRep por la red. */
  readonly archivo: string | null;
}

const avisoNpmBanrep = (opcion: string): string => `npm se quedó con ${opcion}: escriba «npx tsx scripts/exportar-banrep.ts ${opcion} …» (con «--» si usa npm).`;

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
  const valores = leerOpciones(argv, OPCIONES, entorno, avisoNpmBanrep);
  const serie = serieDe(opcionRequerida(valores, "--serie", series.map((s) => s.codigo).join("|")), series);
  const desde = fechaDeOpcion(opcionRequerida(valores, "--desde", "AAAA-MM-DD"), "--desde")!;
  const hasta = fechaDeOpcion(valores.get("--hasta"), "--hasta") ?? hoy;
  exigirRango(desde, hasta, hoy, MAX_DIAS_RANGO_BANREP);
  return { serie, desde, hasta, archivo: valores.get("--archivo") ?? null };
}
