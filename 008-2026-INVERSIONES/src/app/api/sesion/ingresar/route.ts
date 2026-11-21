import { ErrorOcupado, admitirIngreso } from "@/auth/carga";
import { cookieDePresesion } from "@/auth/cookie";
import { leerCredenciales } from "@/auth/cuerpo";
import { ingresar } from "@/auth/ingreso";
import { ipDeSolicitud } from "@/auth/ip";
import { origenValido, origenesPermitidos } from "@/auth/origen";
import { firmarPresesion } from "@/auth/presesion";
import { MENSAJE_GENERICO, respuestaJson } from "@/auth/respuestas";
import { claveDeSesion } from "@/auth/secreto";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const demasiadas = (segundos: number) =>
  respuestaJson({ error: "Demasiadas solicitudes. Espere un momento." }, 429, { "Retry-After": String(segundos) });

/**
 * POST /api/sesion/ingresar · primer paso del inicio de sesión (D-014 y TOTP). Ruta pública, protegida
 * por Origin (CSRF), con bloqueo por cuenta y tope por IP, más el tope global de ingresos y el semáforo
 * de bcrypt del proceso (429). Cualquier fallo de credenciales responde lo mismo: 401 genérico.
 * Con la clave correcta NO abre la sesión: da la pre-sesión (`__Host-presesion`, 5 min) y el paso
 * siguiente, «totp» o «enrolar». La sesión la da el segundo paso (/api/sesion/totp o /totp/enrolar).
 */
export async function POST(pedido: Request): Promise<Response> {
  try {
    const clave = claveDeSesion();
    if (!origenValido(pedido.method, pedido.headers, origenesPermitidos(process.env))) {
      return respuestaJson({ error: "Origen no permitido" }, 403);
    }
    const credenciales = await leerCredenciales(pedido);
    if (!credenciales) return respuestaJson({ error: "Solicitud inválida" }, 400);
    const ahora = new Date();
    const admitido = admitirIngreso(ahora.getTime());
    if (!admitido.permitido) return demasiadas(admitido.reintentarEnS);
    const r = await ingresar(db, { ...credenciales, ip: ipDeSolicitud(pedido.headers), ahora });
    if (!r.ok) return respuestaJson({ error: MENSAJE_GENERICO }, 401);
    const token = await firmarPresesion({ sub: r.usuarioId, sesionVersion: r.sesionVersion, jti: r.jti }, clave, ahora.getTime());
    return respuestaJson({ ok: true, paso: r.paso }, 200, {}, [cookieDePresesion(token)]);
  } catch (error) {
    if (error instanceof ErrorOcupado) return demasiadas(1);
    // Solo el código: un error de Prisma puede traer la URL de conexión con la clave.
    const codigo = (error as { code?: unknown })?.code ?? (error as Error)?.name ?? "desconocido";
    console.error(`[sesion] no se pudo iniciar sesión (código: ${String(codigo)})`);
    return respuestaJson({ error: "No se pudo iniciar sesión. Intente de nuevo." }, 503);
  }
}
