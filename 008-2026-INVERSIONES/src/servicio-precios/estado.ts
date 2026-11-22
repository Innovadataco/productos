/**
 * La huella del servicio inv-008-precios para el vigía (PR 4) y el candado de «una corrida a la vez».
 *
 * Dónde: /estado, el volumen `inv-008-precios-estado` (docker-compose.prod.yml): un tmpfs local de 64k del usuario
 * 10008 (0700, nosuid, nodev, noexec). El vigía lo montará en solo lectura (también es 10008). Al ser tmpfs, se
 * vacía cuando ningún contenedor lo usa (pausa, `down`, reinicio del VPS): la falta de archivos es «sin dato desde el
 * arranque», no una alarma. El resultado de cada corrida queda además en el log (json-file).
 *
 * Formato (FORMATO_HUELLA = 1): texto clave=valor, una por línea, en ASCII imprimible, con `formato=1` primero (el
 * vigía es sh de busybox, sin jq). Los instantes van en segundos Unix. Se escribe de forma atómica (temporal y
 * rename en la misma carpeta): nunca se lee uno a medias.
 *   bucle           lo reescribe el bucle cada minuto (también es el healthcheck, con find -mmin -3):
 *                   estado (ESPERANDO | CORRIENDO | SIN_SECRETO | SECRETO_INVALIDO | DETENIDO), arranque, proxima, latido
 *   ultima-corrida  al terminar cada corrida (del bucle o de --ahora):
 *                   modo (bucle | ahora), desde (AAAA-MM-DD o vacío), resultado (OK | AVISO | FALLO), inicio, fin,
 *                   precios y fondo (el código de salida del CLI, o TIEMPO, SENAL_<señal>, NO_ARRANCO, DETENIDO)
 *   corrida.candado mientras hay una corrida: modo, inicio, pid y token. Su dueño lo refresca cada minuto; si pasan
 *                   CANDADO_VIEJO_MS sin refresco (su dueño murió), el siguiente lo rompe. Queda una ventana mínima
 *                   si dos rompen el mismo candado viejo a la vez (solo compiten el bucle y un --ahora).
 */
import { randomBytes } from "node:crypto";
import { readFile, rename, rm, stat, utimes, writeFile } from "node:fs/promises";
import path from "node:path";

export const ESTADO_DIR_POR_DEFECTO = "/estado";
export const ARCHIVO_BUCLE = "bucle";
export const ARCHIVO_ULTIMA = "ultima-corrida";
export const ARCHIVO_CANDADO = "corrida.candado";
export const FORMATO_HUELLA = 1;
/** Sin refresco por más de esto, el candado es de un dueño que murió (se refresca cada minuto). */
export const CANDADO_VIEJO_MS = 3 * 60_000;

export type Campos = Readonly<Record<string, string | number>>;

const CLAVE_RE = /^[a-z][a-z_]*$/;
const VALOR_RE = /^[\x20-\x7e]*$/;
const SOLO_DUENO = 0o600;

/** El texto de la huella. Lanza RangeError ante una clave o un valor que el vigía no podría leer sin ambigüedad. */
export function textoClaveValor(campos: Campos): string {
  const lineas = Object.entries(campos).map(([clave, valor]) => {
    if (!CLAVE_RE.test(clave) || clave === "formato") throw new RangeError(`huella: clave inválida «${clave}»`);
    if (typeof valor === "number" && !Number.isFinite(valor)) throw new RangeError(`huella: «${clave}» no es un número finito`);
    const texto = String(valor);
    if (!VALOR_RE.test(texto)) throw new RangeError(`huella: el valor de «${clave}» no es una línea de ASCII imprimible`);
    return `${clave}=${texto}`;
  });
  return [`formato=${FORMATO_HUELLA}`, ...lineas, ""].join("\n");
}

/** Lee clave=valor (el valor puede traer «=»); ignora las líneas sin «=». */
export function leerClaveValor(texto: string): Record<string, string> {
  const pares = texto
    .split("\n")
    .filter((linea) => linea.includes("="))
    .map((linea) => [linea.slice(0, linea.indexOf("=")), linea.slice(linea.indexOf("=") + 1)] as const);
  return Object.fromEntries(pares);
}

/** Escribe `<dir>/<nombre>` de forma atómica (temporal 600 y rename). Si falla, no deja el temporal. */
export async function escribirAtomico(dir: string, nombre: string, campos: Campos): Promise<void> {
  const texto = textoClaveValor(campos);
  const temporal = path.join(dir, `.${nombre}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`);
  try {
    await writeFile(temporal, texto, { mode: SOLO_DUENO, flag: "wx" });
    await rename(temporal, path.join(dir, nombre));
  } catch (error) {
    await rm(temporal, { force: true }).catch(() => undefined);
    throw error;
  }
}

export interface Candado {
  /** Lo marca vivo (mtime), solo si sigue siendo suyo. */
  readonly refrescar: () => Promise<void>;
  /** Lo borra, solo si sigue siendo suyo. */
  readonly soltar: () => Promise<void>;
}

/** Crea el archivo con O_EXCL: true si lo creó, false si ya existía. Otros errores, hacia arriba. */
async function crearExclusivo(ruta: string, texto: string): Promise<boolean> {
  try {
    await writeFile(ruta, texto, { mode: SOLO_DUENO, flag: "wx" });
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return false;
    throw error;
  }
}

function candadoDe(ruta: string, token: string): Candado {
  const esMio = async (): Promise<boolean> => {
    const texto = await readFile(ruta, "utf8").catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return "";
      throw error;
    });
    return leerClaveValor(texto).token === token;
  };
  return {
    refrescar: async () => {
      if (!(await esMio())) return;
      const ahora = new Date();
      await utimes(ruta, ahora, ahora);
    },
    soltar: async () => {
      if (await esMio()) await rm(ruta, { force: true });
    },
  };
}

/**
 * Toma el candado de la corrida o devuelve null si otra corrida viva lo tiene. Uno sin refresco por más de
 * `viejoMs` (medido con `ahoraMs` contra su mtime) se rompe y se intenta una vez más.
 */
export async function tomarCandado(dir: string, campos: Campos, opciones: { readonly ahoraMs: number; readonly viejoMs: number }): Promise<Candado | null> {
  const ruta = path.join(dir, ARCHIVO_CANDADO);
  const token = randomBytes(16).toString("hex");
  const texto = textoClaveValor({ ...campos, token });
  if (await crearExclusivo(ruta, texto)) return candadoDe(ruta, token);
  // Si ya no está (lo soltó su dueño entre los dos pasos) o no se puede ver, se intenta una vez más: crearExclusivo
  // devuelve los errores reales.
  const info = await stat(ruta).catch(() => null);
  if (info && opciones.ahoraMs - info.mtimeMs <= opciones.viejoMs) return null;
  await rm(ruta, { force: true });
  return (await crearExclusivo(ruta, texto)) ? candadoDe(ruta, token) : null;
}
