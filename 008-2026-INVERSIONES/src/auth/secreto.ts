/**
 * Secreto que firma la sesión (D-014). Falla cerrada: sin secreto, o con menos de 32 bytes, no hay
 * sesión en ningún entorno (no existe una variable que apague el login).
 *
 * Contrato con el frente «producción»: en producción el secreto llega en AUTH_SECRET (el `.env` de
 * producción del proyecto). También se admite AUTH_SECRET_FILE (la ruta de un archivo). Si llegan las
 * dos, es un error: no se adivina cuál vale. Con NODE_ENV=production se rechaza además el valor de
 * ejemplo de `.env.example`. Los mensajes nunca llevan el valor del secreto.
 */
import { readFileSync } from "node:fs";
import { SECRETO_MIN_BYTES } from "./limites";

export interface FuenteSecreto {
  readonly AUTH_SECRET?: string;
  readonly AUTH_SECRET_FILE?: string;
  readonly NODE_ENV?: string;
}

/** El valor de ejemplo de `.env.example`: sirve en local, nunca en producción. */
export const SECRETO_DE_EJEMPLO = "ejemplo-de-desarrollo-cambielo-0123456789abcdef";

export class ErrorSecreto extends Error {
  override readonly name = "ErrorSecreto";
}

function desdeArchivo(ruta: string, leerArchivo: (ruta: string) => string): string {
  try {
    // Solo el salto de línea final (los editores y `echo` lo agregan); el resto es el secreto.
    return leerArchivo(ruta).replace(/\r?\n$/, "");
  } catch {
    throw new ErrorSecreto("AUTH_SECRET_FILE no se pudo leer: la sesión no funciona sin secreto.");
  }
}

/** Lee y valida el secreto. Pura: el entorno y la lectura del archivo llegan como argumentos. */
export function leerSecreto(env: FuenteSecreto, leerArchivo: (ruta: string) => string): Uint8Array {
  const ruta = env.AUTH_SECRET_FILE?.trim();
  if (ruta && env.AUTH_SECRET) {
    throw new ErrorSecreto("Llegaron AUTH_SECRET y AUTH_SECRET_FILE a la vez: deje solo uno.");
  }
  const valor = ruta ? desdeArchivo(ruta, leerArchivo) : env.AUTH_SECRET;
  if (!valor) {
    throw new ErrorSecreto("Falta AUTH_SECRET (o AUTH_SECRET_FILE): la sesión no funciona sin secreto.");
  }
  const bytes = new TextEncoder().encode(valor);
  if (bytes.length < SECRETO_MIN_BYTES) {
    throw new ErrorSecreto(`El secreto de la sesión debe tener ${SECRETO_MIN_BYTES} bytes o más.`);
  }
  if (env.NODE_ENV === "production" && valor === SECRETO_DE_EJEMPLO) {
    throw new ErrorSecreto("El secreto de la sesión es el de ejemplo de .env.example: genere uno propio.");
  }
  return bytes;
}

let enMemoria: Uint8Array | null = null;

/**
 * El secreto del proceso. Se lee una vez (rotarlo exige reiniciar, y eso cierra todas las sesiones).
 * Un error no se guarda: cada llamada vuelve a fallar hasta que el secreto exista.
 */
export function claveDeSesion(): Uint8Array {
  if (!enMemoria) {
    enMemoria = leerSecreto(
      { AUTH_SECRET: process.env.AUTH_SECRET, AUTH_SECRET_FILE: process.env.AUTH_SECRET_FILE, NODE_ENV: process.env.NODE_ENV },
      (ruta) => readFileSync(ruta, "utf8"),
    );
  }
  return enMemoria;
}
