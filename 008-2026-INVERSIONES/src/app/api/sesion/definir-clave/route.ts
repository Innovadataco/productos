import { definirClave } from "@/auth/acceso";
import { ErrorOcupado, admitirIngreso } from "@/auth/carga";
import { leerNuevaClave } from "@/auth/cuerpo";
import { ipDeSolicitud } from "@/auth/ip";
import { CLAVE_MAX_BYTES, CLAVE_MIN_BYTES } from "@/auth/limites";
import { origenValido, origenesPermitidos } from "@/auth/origen";
import { respuestaJson } from "@/auth/respuestas";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const ENLACE_INVALIDO = "El enlace no es válido o ya venció. Pida uno nuevo.";
const demasiadas = (segundos: number) =>
  respuestaJson({ error: "Demasiadas solicitudes. Espere un momento." }, 429, { "Retry-After": String(segundos) });

/**
 * POST /api/sesion/definir-clave · fija la clave con un enlace de un solo uso (D-014). Ruta pública,
 * protegida por Origin (CSRF), por el mismo tope por IP del ingreso y por el tope global de ingresos. No abre sesión: después se entra
 * por /ingresar con la clave nueva. Un enlace inválido, vencido o usado responde siempre lo mismo.
 */
export async function POST(pedido: Request): Promise<Response> {
  try {
    if (!origenValido(pedido.method, pedido.headers, origenesPermitidos(process.env))) {
      return respuestaJson({ error: "Origen no permitido" }, 403);
    }
    const datos = await leerNuevaClave(pedido);
    if (!datos) return respuestaJson({ error: "Solicitud inválida" }, 400);
    const ahora = new Date();
    const admitido = admitirIngreso(ahora.getTime());
    if (!admitido.permitido) return demasiadas(admitido.reintentarEnS);
    const r = await definirClave(db, { ...datos, ip: ipDeSolicitud(pedido.headers), ahora });
    if (r.ok) return respuestaJson({ ok: true }, 200);
    if (r.motivo === "CLAVE_INVALIDA") {
      return respuestaJson({ error: `La contraseña debe tener entre ${CLAVE_MIN_BYTES} y ${CLAVE_MAX_BYTES} bytes.` }, 400);
    }
    return respuestaJson({ error: ENLACE_INVALIDO }, 401);
  } catch (error) {
    if (error instanceof ErrorOcupado) return demasiadas(1);
    // Solo el código: un error de Prisma puede traer la URL de conexión con la clave.
    const codigo = (error as { code?: unknown })?.code ?? (error as Error)?.name ?? "desconocido";
    console.error(`[sesion] no se pudo definir la clave (código: ${String(codigo)})`);
    return respuestaJson({ error: "No se pudo definir la clave. Intente de nuevo." }, 503);
  }
}
