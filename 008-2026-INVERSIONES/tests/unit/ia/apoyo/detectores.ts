/**
 * Detectores de fugas escritos APARTE de `src/ia/` (no importan la guarda): si alguien afloja a la vez la proyección y
 * la guarda, estas pruebas siguen mordiendo. Trabajan sobre el JSON que saldría hacia un modelo.
 */
import type { PaqueteHechos } from "@/ia/contrato";

/** Los únicos campos que puede tener la vista, escritos a mano en la prueba (no se leen de `src/`). */
export const CAMPOS_VISTA_PERMITIDOS = Object.freeze(["tipo", "hechos"]);
export const CAMPOS_HECHO_CIEGO_PERMITIDOS = Object.freeze(["id", "clave", "etiqueta", "sujeto", "especie", "direccion", "cercania", "frescura", "calidad", "obligatorio"]);

const IDS = /"H[0-9]{2}"/g;

/** ¿Hay algún dígito (de cualquier sistema) fuera de los ids «"Hnn"»? */
export function hayDigitosFueraDeIds(json: string): boolean {
  return /\p{N}/u.test(json.replace(IDS, '""'));
}

export type Fuga = "valor" | "presentacion" | "fuente" | "fecha" | "hoy" | "aviso" | "version" | "hash" | "ficticia";

/** Lo del paquete que aparece en el JSON (sin distinguir mayúsculas y sin contar los ids). */
export function fugasEn(json: string, paquete: PaqueteHechos): readonly Fuga[] {
  const texto = json.replace(IDS, '""').toLowerCase();
  const aparece = (dato: string): boolean => texto.includes(dato.toLowerCase());
  const fugas = new Set<Fuga>();
  for (const h of paquete.hechos) {
    if (aparece(h.valor)) fugas.add("valor");
    if (aparece(h.presentacion)) fugas.add("presentacion");
    if (aparece(h.fuente)) fugas.add("fuente");
    if (aparece(h.fecha)) fugas.add("fecha");
  }
  if (aparece(paquete.hoy)) fugas.add("hoy");
  if (paquete.avisos.some(aparece)) fugas.add("aviso");
  if (Object.values(paquete.versionesCalculo).some(aparece)) fugas.add("version");
  if (aparece(paquete.hash) || aparece(paquete.version)) fugas.add("hash");
  if (texto.includes("ficticia")) fugas.add("ficticia");
  return [...fugas];
}

/** Los campos de la vista que no están en las listas de arriba. */
export function camposDeMas(vista: unknown): readonly string[] {
  if (typeof vista !== "object" || vista === null) return ["<no es objeto>"];
  const raiz = Object.keys(vista).filter((c) => !CAMPOS_VISTA_PERMITIDOS.includes(c));
  const hechos = (vista as { readonly hechos?: unknown }).hechos;
  const deHechos = Array.isArray(hechos) ? hechos.flatMap((h: object) => Object.keys(h).filter((c) => !CAMPOS_HECHO_CIEGO_PERMITIDOS.includes(c))) : ["<sin hechos>"];
  return [...raiz, ...deHechos];
}
