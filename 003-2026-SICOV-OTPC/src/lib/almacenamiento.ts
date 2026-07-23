import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { requireEnv } from "@/lib/env";
import { AppError, ERROR_CODES } from "@/lib/errors";

/// Interfaz de ALMACENAMIENTO de binarios (D-022 #2): la lógica de negocio solo conoce
/// `guardarArchivo`/`leerArchivo` — migrar a S3/servicio externo reimplementa este módulo sin
/// tocar nada más. Raíz por env `ALMACENAMIENTO_DIR`, FUERA del directorio de la app (su respaldo
/// es requisito del switch-over). Nunca se exponen rutas absolutas.

function raiz(): string {
  return path.resolve(requireEnv("ALMACENAMIENTO_DIR"));
}

export interface ArchivoGuardado {
  documento: string; // nombre físico (uuid + extensión)
  ruta: string; // ruta RELATIVA a la raíz (lo que se persiste en BD)
}

export async function guardarArchivo(
  carpeta: string,
  nombreOriginal: string,
  buffer: Buffer,
): Promise<ArchivoGuardado> {
  const ext = path.extname(nombreOriginal).toLowerCase() || "";
  const documento = `${crypto.randomUUID()}${ext}`;
  const rutaRelativa = path.join(carpeta, documento);
  const absoluta = path.join(raiz(), rutaRelativa);
  await fs.mkdir(path.dirname(absoluta), { recursive: true });
  await fs.writeFile(absoluta, buffer);
  return { documento, ruta: rutaRelativa };
}

export async function leerArchivo(rutaRelativa: string): Promise<Buffer> {
  const base = raiz();
  const absoluta = path.resolve(base, rutaRelativa);
  // Guardia anti path-traversal: la ruta persistida jamás sale de la raíz.
  if (absoluta !== base && !absoluta.startsWith(base + path.sep)) {
    throw new AppError("Ruta de archivo inválida", ERROR_CODES.VALIDATION_ERROR, 400);
  }
  try {
    return await fs.readFile(absoluta);
  } catch {
    throw new AppError("Archivo no encontrado", ERROR_CODES.NOT_FOUND, 404);
  }
}
