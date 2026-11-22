/**
 * Argumentos de scripts/importar-trii.ts (O1). Puro y estricto: se lee ANTES de abrir la base, así que lo que
 * no se reconoce sale con 2 y el uso sin tocar nada. Receta de src/precios/argumentos-depurar.ts.
 * - `--email <correo>` una vez; su valor pasa por correoDeCli (una opción nunca es el correo).
 * - `--crear-dueno` a lo sumo una vez.
 * - Todo lo que empieza por «-» y no es una de las dos es una opción desconocida (también `--`, `-e` y
 *   `--email=<correo>`). Lo demás son archivos, y hace falta al menos uno.
 * - Trampa de npm: `npm run importar:trii --crear-dueno …` (sin «--») deja la opción en npm_config_crear_dueno
 *   y el script no la recibe. Si la variable está y la opción NO llegó en argv, sale con 2 (decisión G5). Una
 *   `email=` del .npmrc también llega como npm_config_email: con `--email` en argv, no bloquea.
 * Los mensajes nunca repiten correos ni rutas: a lo sumo el nombre de una opción.
 */
import { correoDeCli } from "./correo";
import { mensajeDesconocida, tomadaPorNpm, type Entorno } from "./opciones";

export const USO_IMPORTAR_TRII = [
  "Uso: npm run importar:trii -- --email <correo-del-dueño> [--crear-dueno] <archivo.csv> [<archivo.csv> …]",
  "  Las opciones van después de «--»: sin él, npm se queda con ellas. Un archivo cuyo nombre empiece por «-»",
  "  se escribe con su carpeta delante (./-nombre.csv): si no, se toma como una opción.",
  "  --crear-dueno solo la primera vez, con la base sin dueño. Salida: 0 bien · 1 algún archivo rechazado · 2 uso.",
].join("\n");

export interface ArgumentosImportarTrii {
  readonly email: string;
  readonly archivos: readonly string[];
  readonly crearDueno: boolean;
}

export class ErrorArgumentosImportarTrii extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorArgumentosImportarTrii";
  }
}

const EMAIL = "--email";
const CREAR_DUENO = "--crear-dueno";
type Opcion = typeof EMAIL | typeof CREAR_DUENO;
const OPCIONES: readonly Opcion[] = [EMAIL, CREAR_DUENO];

const esOpcion = (x: string): x is Opcion => (OPCIONES as readonly string[]).includes(x);

/**
 * Lee las opciones; `entorno` es process.env (para detectar las que npm se quedó). La búsqueda de la opción tomada por
 * npm y el mensaje de la desconocida son los comunes (src/cli/opciones.ts); la clase de error y el aviso, los de aquí.
 */
export function leerArgumentosImportarTrii(argv: readonly string[], entorno: Entorno): ArgumentosImportarTrii {
  const tomada = tomadaPorNpm(OPCIONES, argv, entorno);
  if (tomada) throw new ErrorArgumentosImportarTrii(`npm se quedó con ${tomada}: escriba «npm run importar:trii -- --email <correo> …» (con «--»).`);
  let email: string | null = null;
  let crearDueno = false;
  const archivos: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const argumento = argv[i]!;
    if (!argumento.startsWith("-")) {
      archivos.push(argumento);
    } else if (!esOpcion(argumento)) {
      throw new ErrorArgumentosImportarTrii(mensajeDesconocida(argumento));
    } else if (argumento === CREAR_DUENO) {
      if (crearDueno) throw new ErrorArgumentosImportarTrii(`${CREAR_DUENO} está repetida.`);
      crearDueno = true;
    } else {
      if (email !== null) throw new ErrorArgumentosImportarTrii(`${EMAIL} está repetida.`);
      email = correoDeCli(argv[i + 1]);
      if (email === null) throw new ErrorArgumentosImportarTrii(`${EMAIL} necesita un correo válido (no una opción ni algo que empiece por «-»).`);
      i += 1;
    }
  }
  if (email === null) throw new ErrorArgumentosImportarTrii(`Falta ${EMAIL} <correo-del-dueño>.`);
  if (archivos.length === 0) throw new ErrorArgumentosImportarTrii("Falta al menos un archivo .csv.");
  return { email, archivos, crearDueno };
}
