import { exigirSesionApi } from "@/auth/sesion";
import { respuestaJson } from "@/auth/respuestas";
import { contarPendientes } from "@/app/alertas/datos";
import { db } from "@/lib/db";
import { MENSAJE_FALLO } from "@/plan/edicion/http";
import { fechaEnBogota } from "@/precios/horario";

export const dynamic = "force-dynamic";

/**
 * GET /api/alertas/pendientes · cuántas alertas de los últimos 7 días nadie marcó como vistas: el contador del menú. Solo lee: lo
 * pueden pedir el dueño y la familia (solo lectura), cada uno con su sesión revalidada contra la base. Sin caché.
 */
export async function GET(pedido: Request): Promise<Response> {
  try {
    const sesion = await exigirSesionApi(pedido);
    if (!sesion.ok) return sesion.respuesta;
    return respuestaJson({ pendientes: await contarPendientes(db, fechaEnBogota(new Date())) }, 200);
  } catch (error) {
    console.error(`[alertas:pendientes] no se pudo leer (${error instanceof Error ? error.name : "desconocido"})`);
    return respuestaJson({ error: MENSAJE_FALLO }, 500);
  }
}
