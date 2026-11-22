/**
 * El pedido de una proyección desde el navegador (frente proyecciones-pantalla): POST /api/proyecciones con los cinco
 * controles, sin caché, y la respuesta en los términos de la cola (src/app/proyecciones/cola.ts). Nada se guarda: ni
 * en el navegador ni en la URL.
 */
import type { Respuesta } from "./cola";
import type { Controles } from "./opciones";
import type { VistaProyeccion } from "./vista";

export const RUTA_API = "/api/proyecciones";
const ESTADO_OCUPADO = 429;
const ESTADO_PARAMETROS = 400;

const esVista = (x: unknown): x is { readonly vista: VistaProyeccion } =>
  typeof x === "object" && x !== null && "vista" in x && typeof (x as { vista: unknown }).vista === "object" && (x as { vista: unknown }).vista !== null;

export async function enviarPedido(controles: Controles): Promise<Respuesta> {
  const r = await fetch(RUTA_API, {
    method: "POST", cache: "no-store", credentials: "same-origin",
    headers: { "content-type": "application/json" }, body: JSON.stringify(controles),
  });
  if (r.status === ESTADO_OCUPADO) return { tipo: "OCUPADO", reintentarEnS: Number(r.headers.get("retry-after")) || 1 };
  if (r.status === ESTADO_PARAMETROS) return { tipo: "PARAMETROS" };
  if (!r.ok) return { tipo: "ERROR" };
  const cuerpo: unknown = await r.json().catch(() => null);
  return esVista(cuerpo) ? { tipo: "OK", vista: cuerpo.vista } : { tipo: "ERROR" };
}
