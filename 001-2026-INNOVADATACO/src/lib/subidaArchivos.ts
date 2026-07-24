/**
 * Validación de archivos subidos (§2.6 y §5.3), compartida por las dos rutas
 * que reciben ficheros (spec 009, auditoría de deuda).
 *
 * Existía **solo** en el expediente de oportunidades (spec 006), que la escribió
 * bien. `POST /api/documents` —la puerta de Base Oficial, la más usada— no
 * validaba **nada**: ni tipo, ni tamaño, ni saneaba el nombre, pese a que §2.6
 * nombra ese archivo como el sitio donde hacerlo.
 *
 * Lo del nombre no era cosmético: el fichero se guardaba como
 * `${Date.now()}_${file.name}` y se escribía con `join(uploadDir, fileName)`.
 * Un nombre con `../` habría escrito **fuera** de `uploads/`.
 */

/** §2.6: tamaño máximo de un archivo subido. */
export const MAX_TAMANO_ARCHIVO = 10 * 1024 * 1024; // 10 MB

/** Extensión en minúsculas, con punto. Cadena vacía si no tiene. */
export function extensionDe(nombre: string): string {
  const i = nombre.lastIndexOf(".");
  return i >= 0 ? nombre.slice(i).toLowerCase() : "";
}

/**
 * Deja el nombre en caracteres inocuos (§5.3).
 *
 * Es lo que corta el paso por directorios: `../../etc/passwd` queda
 * `.._.._etc_passwd`, que no sale de `uploads/`.
 */
export function saneaNombre(nombre: string): string {
  return nombre.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/** Nombre final con el que se guarda: generado, nunca el original directo (§5.3). */
export function nombreDeArchivo(nombre: string, marca: number): string {
  return `${marca}_${saneaNombre(nombre)}`;
}

export type ProblemaArchivo = { error: string; status: number };

/**
 * Valida tipo y tamaño. Devuelve `null` si el archivo es aceptable, o el error y
 * el código con que debe responder la ruta.
 */
export function validaArchivo(
  file: { name: string; size: number },
  extensionesPermitidas: string[],
  mensajeTipo: string,
): ProblemaArchivo | null {
  if (!extensionesPermitidas.includes(extensionDe(file.name))) {
    return { error: mensajeTipo, status: 400 };
  }
  if (file.size > MAX_TAMANO_ARCHIVO) {
    return { error: "El archivo excede el tamaño máximo (10 MB)", status: 413 };
  }
  return null;
}
