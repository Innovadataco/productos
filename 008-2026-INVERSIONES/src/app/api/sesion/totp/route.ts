import { cookieDeBorradoPresesion, cookieDeSesion } from "@/auth/cookie";
import { leerCodigo } from "@/auth/cuerpo";
import { ipDeSolicitud } from "@/auth/ip";
import { origenValido, origenesPermitidos } from "@/auth/origen";
import { exigirPresesionApi, presesionVencida } from "@/auth/presesion-servidor";
import { MENSAJE_SEGUNDO_PASO, respuestaJson } from "@/auth/respuestas";
import { claveDeSesion } from "@/auth/secreto";
import { verificarSegundoPaso } from "@/auth/segundo-paso";
import { firmarToken } from "@/auth/token";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/sesion/totp · segundo paso del ingreso: con la pre-sesión (`__Host-presesion`) y el código de
 * la app o uno de recuperación, da la sesión (`__Host-sesion`) y borra la pre-sesión. Protegida por Origin
 * (CSRF) y por el tope general de las API (proxy); el bloqueo por cuenta y el tope por IP van en la base.
 * Todo fallo del código responde lo mismo: 401 «Código incorrecto». Una pre-sesión que ya no sirve: 401 que
 * pide volver a ingresar. Sin bcrypt: no pasa por el tope global ni por el semáforo del proceso.
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
    const r = await verificarSegundoPaso(db, { presesion: pre.presesion, codigo, ip: ipDeSolicitud(pedido.headers), ahora });
    if (!r.ok) return r.motivo === "PRESESION_INVALIDA" ? presesionVencida() : respuestaJson({ error: MENSAJE_SEGUNDO_PASO }, 401);
    const token = await firmarToken({ sub: r.usuarioId, sesionVersion: r.sesionVersion }, clave, ahora.getTime());
    return respuestaJson({ ok: true, restantes: r.restantes }, 200, {}, [cookieDeSesion(token), cookieDeBorradoPresesion()]);
  } catch (error) {
    // Solo el código: un error de Prisma puede traer la URL de conexión con la clave.
    const codigo = (error as { code?: unknown })?.code ?? (error as { codigo?: unknown })?.codigo ?? (error as Error)?.name ?? "desconocido";
    console.error(`[sesion] no se pudo verificar el segundo paso (código: ${String(codigo)})`);
    return respuestaJson({ error: "No se pudo verificar el código. Intente de nuevo." }, 503);
  }
}
