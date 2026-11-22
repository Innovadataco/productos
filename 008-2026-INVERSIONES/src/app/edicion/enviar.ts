/**
 * Envío de los formularios del área de edición por `fetch` (un formulario nativo, con `Referrer-Policy: no-referrer`,
 * mandaría `Origin: null` y la ruta lo rechazaría). Traduce la respuesta a lo que muestra el formulario: el cuerpo si
 * salió bien, o un mensaje y los campos con su código. Nunca muestra lo que el servidor no mandó como código: los
 * mensajes salen de textos.ts. Puro (solo `fetch` y `location`): lo usan los formularios de cliente.
 */
import { MENSAJES, mensajeDeError } from "./textos";
import type { CampoConError } from "./tipos";

export type Envio<T> =
  | { readonly tipo: "ok"; readonly datos: T }
  | { readonly tipo: "error"; readonly mensaje: string; readonly campos: readonly CampoConError[] };

const esCampo = (c: unknown): c is CampoConError =>
  typeof c === "object" && c !== null && typeof (c as CampoConError).campo === "string" && typeof (c as CampoConError).codigo === "string";

function camposDe(cuerpo: unknown): readonly CampoConError[] {
  const campos = (cuerpo as { campos?: unknown } | null)?.campos;
  return Array.isArray(campos) ? campos.filter(esCampo) : [];
}

function mensajeDe(estado: number, cuerpo: unknown): string {
  if (estado === 401) return MENSAJES["SESION_VENCIDA"]!;
  if (estado === 429) return MENSAJES["DEMASIADAS"]!;
  const codigo = (cuerpo as { codigo?: unknown } | null)?.codigo;
  if (typeof codigo === "string") return mensajeDeError(codigo);
  // 403 del guardián («Solo lectura») o del Origin: el texto del servidor es genérico y de la lista.
  const error = (cuerpo as { error?: unknown } | null)?.error;
  return estado === 403 && typeof error === "string" ? error : MENSAJES["DESCONOCIDO"]!;
}

export async function enviarJson<T>(ruta: string, cuerpo: unknown): Promise<Envio<T>> {
  try {
    const r = await fetch(ruta, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo), cache: "no-store" });
    const datos = (await r.json().catch(() => null)) as unknown;
    if (r.ok) return { tipo: "ok", datos: datos as T };
    return { tipo: "error", mensaje: mensajeDe(r.status, datos), campos: camposDe(datos) };
  } catch {
    return { tipo: "error", mensaje: MENSAJES["DESCONOCIDO"]!, campos: [] };
  }
}

/** Navega a una ruta propia de la app (la arma el formulario con lo que validó; nunca una que mande el servidor). */
export function irA(ruta: string): void {
  window.location.assign(ruta);
}

/** Un id de la base como lo devuelve la ruta (cuid); si no tiene esa forma, no se navega con él. */
export const idValido = (v: unknown): v is string => typeof v === "string" && /^[a-z0-9-]{1,64}$/.test(v);
