/**
 * Argumentos de scripts/importar-valores-fondo.ts (producción, sin red) y scripts/exportar-valores-fondo.ts (el Mac del
 * dueño, con red). Puros y estrictos, con las mismas reglas que los de la vía B de los precios: el lector común de
 * src/cli/opciones.ts.
 * - Cada opción lleva su valor en el argumento siguiente, a lo sumo una vez; un valor nunca empieza por «-».
 *   `--opcion=valor`, `--` y los argumentos sueltos no se admiten.
 * - Trampa de npm: `npm run fondo:exportar --hasta …` sin «--» deja la opción en npm_config_hasta y el script no la
 *   recibe; si la variable está y la opción no llegó, se dice.
 * - Fechas `AAAA-MM-DD` exactas, de negocio en Colombia.
 * Los mensajes nunca repiten rutas ni fechas: a lo sumo el nombre de una opción.
 */
import { exigirRango, fechaDeOpcion, leerOpciones, opcionRequerida, type Entorno } from "../cli/opciones";

/** Rango máximo del exportador: 10 fondos × 1831 días caben en el tope de filas del CSV (csv-valores.ts). */
export const MAX_DIAS_RANGO_FONDO = 1830;

export const USO_IMPORTAR_VALORES_FONDO = [
  "Uso: npm run -s fondo:importar -- --archivo <valores-fondo.csv>",
  "  Importa el CSV de valores de unidad que escribió fondo:exportar (formato en src/fondo/csv-valores.ts) por el mismo",
  "  camino que actualizar-fondo. Valida el archivo entero antes de abrir la base: con un error no guarda nada.",
  "  Salida: 0 bien · 3 con avisos · 2 uso o archivo ilegible · 1 CSV rechazado o error.",
].join("\n");

export const USO_EXPORTAR_VALORES_FONDO = [
  "Uso: npm run -s fondo:exportar -- --fondos <lista.txt> --desde AAAA-MM-DD [--hasta AAAA-MM-DD] > <valores-fondo.csv.parcial>",
  "  Pide a la SFC (datos.gov.co, qhpu-8ixx) los valores de unidad de los fondos de la lista (una línea «<codigo>» o",
  "  «<codigo>,<participacion>»; «#» comenta) y escribe el CSV por stdout.",
  `  --hasta por defecto: hoy; rango de hasta ${MAX_DIAS_RANGO_FONDO} días. «-s» evita que npm escriba su encabezado dentro del CSV.`,
  "  Salida: 0 bien · 3 algún fondo quedó fuera o trajo valores inválidos · 2 uso o lista ilegible · 1 lista inválida, sin valores o error.",
].join("\n");

export interface ArgumentosImportarValoresFondo {
  readonly archivo: string;
}

/** `entorno` es process.env (para detectar las opciones que npm se quedó). */
export function leerArgumentosImportarValoresFondo(argv: readonly string[], entorno: Entorno): ArgumentosImportarValoresFondo {
  const valores = leerOpciones(argv, { "--archivo": "una ruta" }, entorno);
  return { archivo: opcionRequerida(valores, "--archivo", "valores-fondo.csv") };
}

export interface ArgumentosExportarValoresFondo {
  readonly fondos: string;
  readonly desde: Date;
  readonly hasta: Date;
}

/** `hoy` es la fecha de negocio en Colombia: tope y valor por defecto de --hasta. */
export function leerArgumentosExportarValoresFondo(argv: readonly string[], entorno: Entorno, hoy: Date): ArgumentosExportarValoresFondo {
  const valores = leerOpciones(argv, { "--fondos": "una ruta", "--desde": "una fecha AAAA-MM-DD", "--hasta": "una fecha AAAA-MM-DD" }, entorno);
  const fondos = opcionRequerida(valores, "--fondos", "lista.txt");
  const desde = fechaDeOpcion(opcionRequerida(valores, "--desde", "AAAA-MM-DD"), "--desde")!;
  const hasta = fechaDeOpcion(valores.get("--hasta"), "--hasta") ?? hoy;
  exigirRango(desde, hasta, hoy, MAX_DIAS_RANGO_FONDO);
  return { fondos, desde, hasta };
}
