import { cookieDeBorradoPresesion, cookieDeSesion } from "@/auth/cookie";
import { leerCodigo } from "@/auth/cuerpo";
import { confirmarEnrolamiento } from "@/auth/enrolamiento";
import { ipDeSolicitud } from "@/auth/ip";
import { origenValido, origenesPermitidos } from "@/auth/origen";
import { exigirPresesionApi, presesionVencida } from "@/auth/presesion-servidor";
import { MENSAJE_FUERA_DE_PLAZO, MENSAJE_SEGUNDO_PASO, respuestaJson } from "@/auth/respuestas";
import { claveDeSesion } from "@/auth/secreto";
import { firmarToken } from "@/auth/token";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/sesion/totp/enrolar · confirma el enrolamiento del TOTP en el primer ingreso: con la
 * pre-sesión y un código del secreto pendiente, lo activa, da la sesión, borra la pre-sesión y devuelve
 * los 10 códigos de recuperación UNA vez (sin caché; no se vuelven a mostrar). Solo dentro de los 30 min
 * siguientes al enlace o a `--reiniciar-totp` (403 si no). Fallo del código: 401 «Código incorrecto».
 */
export async function POST(pedido: Request): Promise<Response> {
  try {
    const clave = claveDeSesion();
    if (!origenValido(pedido.method, pedido.headers, origenesPermitidos(process.env))) {
      return respuestaJson({ error: "Origen no permitido" }, 403);
    }
    const codigo = await leerCodigo(pedido);
    if (codigo === null) return respuestaJson({ error: "Solicitud inválida" }, 400);
    const pre = await exigirPresesionApi(pedido);
    if (!pre.ok) return pre.respuesta;
    const ahora = new Date();
    const r = await confirmarEnrolamiento(db, { presesion: pre.presesion, codigo, ip: ipDeSolicitud(pedido.headers), ahora });
    if (!r.ok) {
      if (r.motivo === "PRESESION_INVALIDA") return presesionVencida();
      if (r.motivo === "FUERA_DE_PLAZO") return respuestaJson({ error: MENSAJE_FUERA_DE_PLAZO }, 403);
      return respuestaJson({ error: MENSAJE_SEGUNDO_PASO }, 401);
    }
    const token = await firmarToken({ sub: r.usuarioId, sesionVersion: r.sesionVersion }, clave, ahora.getTime());
    return respuestaJson({ ok: true, codigos: r.codigos }, 200, {}, [cookieDeSesion(token), cookieDeBorradoPresesion()]);
  } catch (error) {
    const codigo = (error as { code?: unknown })?.code ?? (error as { codigo?: unknown })?.codigo ?? (error as Error)?.name ?? "desconocido";
    console.error(`[sesion] no se pudo confirmar el enrolamiento (código: ${String(codigo)})`);
    return respuestaJson({ error: "No se pudo activar el segundo factor. Intente de nuevo." }, 503);
  }
}
