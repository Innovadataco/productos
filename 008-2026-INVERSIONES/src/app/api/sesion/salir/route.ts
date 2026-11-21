import { cookieDeBorrado, cookieDeBorradoPresesion } from "@/auth/cookie";
import { origenValido, origenesPermitidos } from "@/auth/origen";
import { respuestaJson } from "@/auth/respuestas";
import { validarSesionApi } from "@/auth/sesion";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/sesion/salir · cierre de sesión (D-014). «Salir» cierra TODAS las sesiones de la cuenta:
 * sube `sesionVersion`, así un JWT copiado deja de valer (pedido de code-reviewer y security-reviewer).
 * Borra la cookie con sus mismos atributos, haya o no sesión válida, y aunque la base no responda (y la
 * de la pre-sesión, si quedó una de un segundo paso a medias).
 * Desde otro sitio (Origin ajeno) no hace nada.
 */
export async function POST(pedido: Request): Promise<Response> {
  let permitidos: readonly string[];
  try {
    permitidos = origenesPermitidos(process.env);
  } catch {
    return respuestaJson({ error: "Configuración incompleta" }, 503);
  }
  if (!origenValido(pedido.method, pedido.headers, permitidos)) return respuestaJson({ error: "Origen no permitido" }, 403);
  const borrar = [cookieDeBorrado(), cookieDeBorradoPresesion()];
  try {
    const usuario = await validarSesionApi(pedido);
    if (!usuario) return respuestaJson({ error: "No autenticado" }, 401, {}, borrar);
    await db.usuario.update({ where: { id: usuario.id }, data: { sesionVersion: { increment: 1 } } });
    return respuestaJson({ ok: true }, 200, {}, borrar);
  } catch (error) {
    const codigo = (error as { code?: unknown })?.code ?? (error as Error)?.name ?? "desconocido";
    console.error(`[sesion] no se pudo revalidar al salir (código: ${String(codigo)}); la cookie se borra igual`);
    return respuestaJson({ ok: true }, 200, {}, borrar);
  }
}
