/**
 * Argumentos de scripts/importar-precios.ts (producción, sin red) y scripts/exportar-precios.ts (el Mac del dueño, con
 * red). Puros y estrictos: se leen ANTES de abrir la base o la red, y lo que no se reconoce sale con 2 y el uso. Los
 * lee el lector común de src/cli/opciones.ts, con estas reglas:
 * - Cada opción lleva su valor en el argumento siguiente, a lo sumo una vez; un valor nunca empieza por «-» (una
 *   opción nunca es una ruta ni una fecha). `--opcion=valor`, `--` y los argumentos sueltos no se admiten.
 * - Trampa de npm: `npm run precios:exportar --hasta …` sin «--» deja la
 *   opción en npm_config_hasta y el script no la recibe; si la variable está y la opción no llegó, sale con 2.
 * - Fechas `AAAA-MM-DD` exactas (sin espacios), de negocio en Colombia.
 * Los mensajes nunca repiten rutas ni fechas: a lo sumo el nombre de una opción.
 */
import { exigirRango, fechaDeOpcion, leerOpciones, opcionRequerida, type Entorno } from "../cli/opciones";

/** Una sola clase para todos los CLI de carga: vive en src/cli/opciones.ts y se re-exporta para los scripts y las pruebas. */
export { ErrorArgumentosCarga } from "../cli/opciones";

/** Rango máximo del exportador: 5 años de ruedas por 40 especies caben en el tope de filas del CSV (csv-cierres.ts). */
export const MAX_DIAS_RANGO = 1830;

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

export interface ArgumentosImportarPrecios {
  readonly archivo: string;
}

/** `entorno` es process.env (para detectar las opciones que npm se quedó). */
export function leerArgumentosImportarPrecios(argv: readonly string[], entorno: Entorno): ArgumentosImportarPrecios {
  const valores = leerOpciones(argv, { "--archivo": "una ruta" }, entorno);
  return { archivo: opcionRequerida(valores, "--archivo", "cierres.csv") };
}

export interface ArgumentosExportarPrecios {
  readonly nemos: string;
  readonly desde: Date;
  readonly hasta: Date;
}

/** `hoy` es la fecha de negocio en Colombia: tope y valor por defecto de --hasta. */
export function leerArgumentosExportarPrecios(argv: readonly string[], entorno: Entorno, hoy: Date): ArgumentosExportarPrecios {
  const valores = leerOpciones(argv, { "--nemos": "una ruta", "--desde": "una fecha AAAA-MM-DD", "--hasta": "una fecha AAAA-MM-DD" }, entorno);
  const nemos = opcionRequerida(valores, "--nemos", "lista.txt");
  const desde = fechaDeOpcion(opcionRequerida(valores, "--desde", "AAAA-MM-DD"), "--desde")!;
  const hasta = fechaDeOpcion(valores.get("--hasta"), "--hasta") ?? hoy;
  exigirRango(desde, hasta, hoy, MAX_DIAS_RANGO);
  return { nemos, desde, hasta };
}
