import "server-only";
/**
 * Revalidación de la sesión en cada página y API (D-014). El proxy solo verifica la firma del JWT; aquí
 * se lee la base: la cuenta existe, está activa, tiene clave, es de un rol con acceso web (DUENO o FAMILIA,
 * src/auth/roles.ts), tiene el TOTP activo y su `sesionVersion` es la del token. El rol nunca sale del JWT.
 * Sin TOTP activo no hay sesión: la sesión solo nace del segundo paso, y reiniciar el TOTP las cierra todas.
 *
 * Guardián del dueño (frente familia-lectura): la FAMILIA entra en SOLO LECTURA. Todo lo que escribe o administra
 * llama `exigirDueno()` (páginas: el familiar recibe 404) o `exigirDuenoApi(pedido)` (API: 403 «Solo lectura»), y
 * tests/unit/auth/escrituras.candado.test.ts lo exige en cada ruta de escritura de src/app, también en las futuras.
 */
import type { PrismaClient } from "@prisma/client";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { NOMBRE_COOKIE, leerToken } from "./cookie";
import { MENSAJE_SOLO_LECTURA, respuestaJson } from "./respuestas";
import { esDueno, tieneAccesoWeb, type RolWeb } from "./roles";
import { claveDeSesion } from "./secreto";
import { verificarToken } from "./token";

export interface UsuarioSesion {
  readonly id: string;
  readonly email: string;
  readonly rol: RolWeb;
}

export type SesionApi = { readonly ok: true; readonly usuario: UsuarioSesion } | { readonly ok: false; readonly respuesta: Response };

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
    select: { id: true, email: true, rol: true, activo: true, sesionVersion: true, claveHash: true, totpActivadoEn: true },
  });
  if (!u || !u.activo || u.claveHash === null || !tieneAccesoWeb(u.rol) || u.totpActivadoEn === null) return null;
  if (u.sesionVersion !== datos.sesionVersion) return null;
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
export async function exigirSesionApi(pedido: Request): Promise<SesionApi> {
  const usuario = await validarSesionApi(pedido);
  return usuario ? { ok: true, usuario } : { ok: false, respuesta: respuestaJson({ error: "No autenticado" }, 401) };
}

/** Para cada página que escribe o administra: sin sesión, a /ingresar; un familiar (solo lectura), 404. */
export async function exigirDueno(): Promise<UsuarioSesion> {
  const usuario = await exigirSesion();
  if (!esDueno(usuario)) notFound();
  return usuario;
}

/** Para cada API que escribe o administra: sin sesión, 401; un familiar (solo lectura), 403 JSON sin caché. */
export async function exigirDuenoApi(pedido: Request): Promise<SesionApi> {
  const sesion = await exigirSesionApi(pedido);
  if (!sesion.ok || esDueno(sesion.usuario)) return sesion;
  return { ok: false, respuesta: respuestaJson({ error: MENSAJE_SOLO_LECTURA }, 403) };
}
