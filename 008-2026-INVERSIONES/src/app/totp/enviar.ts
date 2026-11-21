/**
 * Envío de un código del segundo paso por `fetch` (el POST lleva el Origin real). Traduce la respuesta a lo
 * que muestra cada formulario: el cuerpo si salió bien, «vencida» si hay que volver a ingresar (pre-sesión o
 * sesión que ya no sirve), o el mensaje del servidor (siempre genérico para un código errado).
 */
export type Respuesta<T> =
  | { readonly tipo: "ok"; readonly datos: T }
  | { readonly tipo: "vencida"; readonly mensaje: string }
  | { readonly tipo: "error"; readonly mensaje: string };

const OTRO_ERROR = "No se pudo verificar el código. Intente de nuevo.";
const DEMASIADAS = "Demasiadas solicitudes. Espere un momento e intente de nuevo.";
const SESION_VENCIDA = "La sesión venció. Ingrese de nuevo.";

export async function enviarCodigo<T>(ruta: string, codigo: string): Promise<Respuesta<T>> {
  try {
    const r = await fetch(ruta, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo }),
      cache: "no-store",
    });
    const cuerpo = (await r.json().catch(() => null)) as { error?: unknown; reingresar?: unknown } | null;
    if (r.ok) return { tipo: "ok", datos: cuerpo as T };
    if (r.status === 429) return { tipo: "error", mensaje: DEMASIADAS };
    const mensaje = typeof cuerpo?.error === "string" ? cuerpo.error : OTRO_ERROR;
    if (cuerpo?.reingresar === true) return { tipo: "vencida", mensaje };
    if (r.status === 401 && mensaje === "No autenticado") return { tipo: "vencida", mensaje: SESION_VENCIDA };
    return { tipo: "error", mensaje: r.status === 401 || r.status === 403 ? mensaje : OTRO_ERROR };
  } catch {
    return { tipo: "error", mensaje: OTRO_ERROR };
  }
}
