/**
 * Argumentos de scripts/importar-series.ts (producción por la vía B, sin red; o el Mac). Puros y estrictos, con las
 * mismas reglas que los de la vía B de los precios y del fondo (src/precios/argumentos-carga.ts y
 * src/fondo/argumentos-carga.ts, que este frente no toca: de ahí que la forma se repita aquí):
 * - Solo `--archivo <ruta>`, una vez; el valor nunca empieza por «-». `--archivo=ruta`, `--` y los argumentos sueltos no
 *   se admiten.
 * - Trampa de npm: sin «--», npm deja la opción en npm_config_archivo y el script no la recibe; si la variable está y la
 *   opción no llegó, se dice.
 * Los mensajes nunca repiten rutas: a lo sumo el nombre de una opción.
 */
import { ErrorArgumentosCarga } from "../../precios/argumentos-carga";
import { MAX_BYTES_CSV_SERIES, MAX_FILAS_CSV_SERIES, MAX_SERIES_CSV } from "./csv-series";

const OPCION = "--archivo";
const VARIABLE_DE_NPM = "npm_config_archivo";
/** Solo se repite el nombre de una opción con esta forma: nunca una ruta ni caracteres de control. */
const NOMBRE_REPETIBLE = /^--?[a-z][a-z0-9-]{0,30}$/;

export const USO_IMPORTAR_SERIES = [
  "Uso: npx tsx scripts/importar-series.ts --archivo <series.csv>",
  "  Importa el CSV de series oficiales (TRM, TPM, IBR_3M_EA, IPC_INDICE; formato en src/datos-oficiales/series/csv-series.ts)",
  "  por el camino único de escritura. Valida el archivo entero antes de abrir la base: con un error no guarda nada.",
  `  Topes: ${MAX_BYTES_CSV_SERIES} bytes, ${MAX_FILAS_CSV_SERIES} filas y ${MAX_SERIES_CSV} series. Reimportar el mismo CSV no escribe nada.`,
  "  Salida: 0 bien · 3 con avisos · 2 uso o archivo ilegible · 1 CSV rechazado o error.",
].join("\n");

type Entorno = Readonly<Record<string, string | undefined>>;

export interface ArgumentosImportarSeries {
  readonly archivo: string;
}

function desconocida(argumento: string): ErrorArgumentosCarga {
  const nombre = argumento.split("=", 1)[0] ?? "";
  return new ErrorArgumentosCarga(NOMBRE_REPETIBLE.test(nombre) ? `Opción desconocida: «${nombre}».` : "Opción desconocida.");
}

/** `entorno` es process.env (para detectar la opción que npm se quedó). Lanza ErrorArgumentosCarga ante cualquier otra forma. */
export function leerArgumentosImportarSeries(argv: readonly string[], entorno: Entorno): ArgumentosImportarSeries {
  if (entorno[VARIABLE_DE_NPM] !== undefined && !argv.includes(OPCION)) {
    throw new ErrorArgumentosCarga(`npm se quedó con ${OPCION}: escriba «npm run -s <comando> -- ${OPCION} …» (con «--»).`);
  }
  let archivo: string | undefined;
  for (let i = 0; i < argv.length; i += 2) {
    const opcion = argv[i]!;
    if (!opcion.startsWith("-")) throw new ErrorArgumentosCarga("Argumento suelto: no se admiten argumentos sueltos (cada valor va después de su opción).");
    if (opcion !== OPCION) throw desconocida(opcion);
    if (archivo !== undefined) throw new ErrorArgumentosCarga(`${OPCION} está repetida.`);
    const valor = argv[i + 1];
    if (valor === undefined || valor.startsWith("-")) throw new ErrorArgumentosCarga(`${OPCION} necesita una ruta (no una opción ni algo que empiece por «-»).`);
    archivo = valor;
  }
  if (archivo === undefined) throw new ErrorArgumentosCarga(`Falta ${OPCION} <series.csv>.`);
  return { archivo };
}
