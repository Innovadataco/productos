import { leerCodigo } from "@/auth/cuerpo";
import { ipDeSolicitud } from "@/auth/ip";
import { origenValido, origenesPermitidos } from "@/auth/origen";
import { regenerarCodigos } from "@/auth/regenerar";
import { MENSAJE_SEGUNDO_PASO, respuestaJson } from "@/auth/respuestas";
import { exigirSesionApi } from "@/auth/sesion";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/sesion/totp/codigos · genera 10 códigos de recuperación nuevos y anula los anteriores. Exige la
 * sesión completa y un código TOTP vigente de la app (no uno de recuperación). Los códigos se devuelven UNA
 * vez, sin caché. Fallo del código: 401 «Código incorrecto».
 */
export async function POST(pedido: Request): Promise<Response> {
  try {
    if (!origenValido(pedido.method, pedido.headers, origenesPermitidos(process.env))) {
      return respuestaJson({ error: "Origen no permitido" }, 403);
    }
    const sesion = await exigirSesionApi(pedido);
    if (!sesion.ok) return sesion.respuesta;
    const codigo = await leerCodigo(pedido);
    if (codigo === null) return respuestaJson({ error: "Solicitud inválida" }, 400);
    const r = await regenerarCodigos(db, { usuarioId: sesion.usuario.id, codigo, ip: ipDeSolicitud(pedido.headers), ahora: new Date() });
    return r.ok ? respuestaJson({ ok: true, codigos: r.codigos }, 200) : respuestaJson({ error: MENSAJE_SEGUNDO_PASO }, 401);
  } catch (error) {
    const codigo = (error as { code?: unknown })?.code ?? (error as { codigo?: unknown })?.codigo ?? (error as Error)?.name ?? "desconocido";
    console.error(`[sesion] no se pudieron regenerar los códigos (código: ${String(codigo)})`);
    return respuestaJson({ error: "No se pudieron generar los códigos. Intente de nuevo." }, 503);
  }
}
