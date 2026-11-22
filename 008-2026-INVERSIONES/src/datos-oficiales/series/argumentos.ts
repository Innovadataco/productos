/**
 * Argumentos de scripts/importar-series.ts (producción por la vía B, sin red; o el Mac). Puros y estrictos, con las
 * mismas reglas que los de la vía B de los precios y del fondo: el lector común de src/cli/opciones.ts.
 * - Solo `--archivo <ruta>`, una vez; el valor nunca empieza por «-». `--archivo=ruta`, `--` y los argumentos sueltos no
 *   se admiten.
 * - Trampa de npm: sin «--», npm deja la opción en npm_config_archivo y el script no la recibe; si la variable está y la
 *   opción no llegó, se dice.
 * Los mensajes nunca repiten rutas: a lo sumo el nombre de una opción.
 */
import { leerOpciones, opcionRequerida, type Entorno } from "../../cli/opciones";
import { MAX_BYTES_CSV_SERIES, MAX_FILAS_CSV_SERIES, MAX_SERIES_CSV } from "./csv-series";

export const USO_IMPORTAR_SERIES = [
  "Uso: npx tsx scripts/importar-series.ts --archivo <series.csv>",
  "  Importa el CSV de series oficiales (TRM, TPM, IBR_3M_EA, IPC_INDICE; formato en src/datos-oficiales/series/csv-series.ts)",
  "  por el camino único de escritura. Valida el archivo entero antes de abrir la base: con un error no guarda nada.",
  `  Topes: ${MAX_BYTES_CSV_SERIES} bytes, ${MAX_FILAS_CSV_SERIES} filas y ${MAX_SERIES_CSV} series. Reimportar el mismo CSV no escribe nada.`,
  "  Salida: 0 bien · 3 con avisos · 2 uso o archivo ilegible · 1 CSV rechazado o error.",
].join("\n");

export interface ArgumentosImportarSeries {
  readonly archivo: string;
}

/** `entorno` es process.env (para detectar la opción que npm se quedó). Lanza ErrorArgumentosCarga ante cualquier otra forma. */
export function leerArgumentosImportarSeries(argv: readonly string[], entorno: Entorno): ArgumentosImportarSeries {
  const valores = leerOpciones(argv, { "--archivo": "una ruta" }, entorno);
  return { archivo: opcionRequerida(valores, "--archivo", "series.csv") };
}
