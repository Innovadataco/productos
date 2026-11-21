import "server-only";
/**
 * Revalidación de la sesión en cada página y API (D-014). El proxy solo verifica la firma del JWT; aquí
 * se lee la base: la cuenta existe, está activa, tiene clave, es DUENO y su `sesionVersion` es la del
 * token. El rol nunca sale del JWT. (El rol FAMILIA de solo lectura va en otro cambio: hoy no entra.)
 */
import type { PrismaClient } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { NOMBRE_COOKIE, leerToken } from "./cookie";
import { respuestaJson } from "./respuestas";
import { claveDeSesion } from "./secreto";
import { verificarToken } from "./token";

export interface UsuarioSesion {
  readonly id: string;
  readonly email: string;
  readonly rol: "DUENO";
}

export const RUTA_INGRESO = "/ingresar";

export async function validarSesion(
  base: PrismaClient,
  token: string | undefined,
  clave: Uint8Array,
  ahoraMs: number,
): Promise<UsuarioSesion | null> {
  const datos = token ? await verificarToken(token, clave, ahoraMs) : null;
  if (!datos) return null;
  const u = await base.usuario.findUnique({
    where: { id: datos.sub },
    select: { id: true, email: true, rol: true, activo: true, sesionVersion: true, claveHash: true },
  });
  if (!u || !u.activo || u.claveHash === null || u.rol !== "DUENO" || u.sesionVersion !== datos.sesionVersion) return null;
  return { id: u.id, email: u.email, rol: u.rol };
}

/** La sesión de la página actual, o null. Sin secreto lanza (falla cerrada). */
export async function sesionActual(): Promise<UsuarioSesion | null> {
  const token = (await cookies()).get(NOMBRE_COOKIE)?.value;
  return validarSesion(db, token, claveDeSesion(), Date.now());
}

/** Para cada página protegida: sin sesión válida, a /ingresar. */
export async function exigirSesion(): Promise<UsuarioSesion> {
  const usuario = await sesionActual();
  if (!usuario) redirect(RUTA_INGRESO);
  return usuario;
}

/** La sesión de un pedido a la API (lee la cookie del propio pedido), o null. */
export async function validarSesionApi(pedido: Request): Promise<UsuarioSesion | null> {
  return validarSesion(db, leerToken(pedido.headers.get("cookie")), claveDeSesion(), Date.now());
}

/** Para cada API protegida: sin sesión válida, 401 JSON sin caché. */
export async function exigirSesionApi(
  pedido: Request,
): Promise<{ readonly ok: true; readonly usuario: UsuarioSesion } | { readonly ok: false; readonly respuesta: Response }> {
  const usuario = await validarSesionApi(pedido);
  return usuario ? { ok: true, usuario } : { ok: false, respuesta: respuestaJson({ error: "No autenticado" }, 401) };
}
