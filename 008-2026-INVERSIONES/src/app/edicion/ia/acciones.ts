/**
 * «Identificar modelos» y «Probar» desde el navegador (E8): POST /api/ia/ollama con SOLO la acción (el servidor usa el
 * destino guardado; nada del formulario viaja). Traduce la respuesta a lo que muestra el panel: el resultado
 * estructurado (también el 503 de «Ollama inalcanzable», como en PI) o un código de la conexión. Nunca muestra lo que el
 * servidor no mandó como estado o código. Puro (solo `fetch`): lo usa el componente de cliente.
 */
import type { ModeloIdentificadoVista, PruebaVista } from "./tipos-ia";

export type ResultadoIdentificarVista =
  | { readonly estado: "OK"; readonly modelos: readonly ModeloIdentificadoVista[] }
  | { readonly estado: "SIN_DESTINO" | "PENDIENTE" }
  | { readonly estado: "INALCANZABLE" | "ERROR"; readonly detalle: string };

export type ResultadoProbarVista =
  | { readonly estado: "OK" | "FALLO"; readonly pruebas: readonly PruebaVista[] }
  | { readonly estado: "SIN_DESTINO" | "SIN_MODELO" | "PENDIENTE" }
  | { readonly estado: "INALCANZABLE" | "ERROR"; readonly detalle: string };

export type AccionOllama = "identificar" | "probar";

export type RespuestaOllama =
  | { readonly tipo: "identificar"; readonly resultado: ResultadoIdentificarVista }
  | { readonly tipo: "probar"; readonly resultado: ResultadoProbarVista }
  | { readonly tipo: "error"; readonly codigo: "DEMASIADAS" | "SESION_VENCIDA" | "AUTOR_INEXISTENTE" | "DESCONOCIDO" };

const ESTADOS = new Set(["OK", "FALLO", "SIN_DESTINO", "SIN_MODELO", "PENDIENTE", "INALCANZABLE", "ERROR"]);
const CON_RESULTADO = new Set([200, 502, 503]);

const error = (codigo: Extract<RespuestaOllama, { tipo: "error" }>["codigo"]): RespuestaOllama => ({ tipo: "error", codigo });

function codigoDeEstado(estado: number): Extract<RespuestaOllama, { tipo: "error" }>["codigo"] {
  if (estado === 429) return "DEMASIADAS";
  if (estado === 401) return "SESION_VENCIDA";
  return estado === 403 ? "AUTOR_INEXISTENTE" : "DESCONOCIDO";
}

export async function pedirOllama(accion: AccionOllama): Promise<RespuestaOllama> {
  try {
    const r = await fetch("/api/ia/ollama", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion }), cache: "no-store" });
    if (!CON_RESULTADO.has(r.status)) return error(codigoDeEstado(r.status));
    const cuerpo = (await r.json().catch(() => null)) as { resultado?: { estado?: unknown; modelos?: unknown; pruebas?: unknown } } | null;
    const resultado = cuerpo?.resultado;
    if (typeof resultado !== "object" || resultado === null || !ESTADOS.has(String(resultado.estado))) return error("DESCONOCIDO");
    // Un OK o un FALLO traen su lista: sin ella, no se pinta nada a medias.
    const lista = accion === "identificar" ? resultado.modelos : resultado.pruebas;
    if ((resultado.estado === "OK" || resultado.estado === "FALLO") && !Array.isArray(lista)) return error("DESCONOCIDO");
    return accion === "identificar"
      ? { tipo: "identificar", resultado: resultado as ResultadoIdentificarVista }
      : { tipo: "probar", resultado: resultado as ResultadoProbarVista };
  } catch {
    return error("DESCONOCIDO");
  }
}
