import { textoAcotado } from "@/auth/cuerpo";
import { origenValido, origenesPermitidos } from "@/auth/origen";
import { respuestaJson } from "@/auth/respuestas";
import { exigirSesionApi } from "@/auth/sesion";
import { db } from "@/lib/db";
import { validarControles } from "@/app/proyecciones/controles";
import { calcularVista, nombreDelError } from "@/app/proyecciones/servidor";
import { conTurno, type MotivoTurno } from "@/app/proyecciones/turno";
import type { ErrorParametro } from "@/proyecciones/tipos";

export const dynamic = "force-dynamic";

/** Cinco controles en JSON caben de sobra en 1 KB. */
const CUERPO_MAX_BYTES = 1024;
const PARAMETROS_NO_VALIDOS = "Parámetros no válidos.";
const NO_SE_PUDO = "No se pudo calcular la proyección. Intente de nuevo.";
const OCUPADO: Readonly<Record<MotivoTurno, string>> = {
  EN_VUELO: "Hay un cálculo en curso. Intente de nuevo en un momento.",
  FRECUENCIA: "Demasiados cálculos seguidos. Intente de nuevo en un momento.",
  OCUPADO: "El servidor está ocupado con otro cálculo. Intente de nuevo en un momento.",
};

const rechazo = (campos?: readonly ErrorParametro[]): Response => respuestaJson(campos ? { error: PARAMETROS_NO_VALIDOS, campos } : { error: PARAMETROS_NO_VALIDOS }, 400);

/** El cuerpo como JSON: solo con content-type JSON y hasta 1 KB (se lee en trozos y se corta); si no, null. */
async function leerJson(pedido: Request): Promise<{ readonly ok: true; readonly valor: unknown } | { readonly ok: false }> {
  if (!(pedido.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) return { ok: false };
  const texto = await textoAcotado(pedido, CUERPO_MAX_BYTES);
  if (texto === null) return { ok: false };
  try {
    return { ok: true, valor: JSON.parse(texto) as unknown };
  } catch {
    return { ok: false };
  }
}

/**
 * POST /api/proyecciones · el simulador de la pantalla de proyecciones (contrato de src/proyecciones/proyectar.ts):
 * Origin de la lista (CSRF) → sesión revalidada contra la base → cuerpo JSON de 1 KB con EXACTAMENTE los cinco
 * controles (trayectorias, semilla y `hoy` los pone el servidor) → turno (uno en vuelo por usuario, frecuencia y un
 * cálculo a la vez en el proceso; 429 con Retry-After) → la vista mínima. Lo que se mueve no se guarda. Siempre
 * `no-store`. Ante un error, un mensaje genérico; al registro, solo el nombre del error (nunca cifras ni nombres).
 */
export async function POST(pedido: Request): Promise<Response> {
  let permitidos: readonly string[];
  try {
    permitidos = origenesPermitidos(process.env);
  } catch {
    return respuestaJson({ error: "Configuración incompleta" }, 503);
  }
  if (!origenValido(pedido.method, pedido.headers, permitidos)) return respuestaJson({ error: "Origen no permitido" }, 403);
  try {
    const sesion = await exigirSesionApi(pedido);
    if (!sesion.ok) return sesion.respuesta;
    const cuerpo = await leerJson(pedido);
    if (!cuerpo.ok) return rechazo();
    const controles = validarControles(cuerpo.valor);
    if (!controles.ok) return controles.errores.some((e) => e.campo === "entrada") ? rechazo() : rechazo(controles.errores);
    const turno = await conTurno(sesion.usuario.id, Date.now(), () => calcularVista(db, controles.valor));
    if (!turno.ok) return respuestaJson({ error: OCUPADO[turno.motivo] }, 429, { "Retry-After": String(turno.reintentarEnS) });
    if (!turno.valor.ok) return rechazo(turno.valor.errores);
    return respuestaJson({ vista: turno.valor.vista }, 200);
  } catch (error) {
    console.error(`[proyecciones] no se pudo calcular (${nombreDelError(error)})`);
    return respuestaJson({ error: NO_SE_PUDO }, 500);
  }
}
