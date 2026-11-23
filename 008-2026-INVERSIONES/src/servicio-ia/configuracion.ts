/**
 * Configuración del servicio inv-008-ia (E6, D-026).
 * - La credencial: solo la del rol inv_ia en la base inv-008-db, por la red interna. Sin ella el servicio NO se cae:
 *   queda EN ESPERA (SIN_SECRETO); con otra, tampoco (SECRETO_INVALIDO). Las mismas reglas del servicio de precios:
 *   puerto 5432 o vacío, una base, `connection_limit` 1 o 2 (el rol tiene CONNECTION LIMIT 2) y solo parámetros de una
 *   lista (libpq y Prisma aceptan `host` o `hostaddr` en la consulta, que cambiarían el destino).
 * - El token de los pedidos a demanda de la app: sin él (o con uno débil) el endpoint interno no se abre.
 * Ningún motivo repite la URL, su clave ni el token.
 */
import { VARIABLE_TOKEN_SERVICIO_IA, tokenServicioValido } from "../ia/config/sonda-servicio";

export const USUARIO_IA = "inv_ia";
export const HOST_BASE = "inv-008-db";
const PROTOCOLOS = new Set(["postgresql:", "postgres:"]);
const PUERTOS = new Set(["", "5432"]);
const PARAMETROS = new Set(["schema", "connection_limit", "connect_timeout", "pool_timeout"]);
const BASE_RE = /^\/[A-Za-z0-9_]+$/;
const CONEXIONES_RE = /^[12]$/;

export type EstadoSinCredencial = "SIN_SECRETO" | "SECRETO_INVALIDO";
export type Credencial = { readonly ok: true } | { readonly ok: false; readonly estado: EstadoSinCredencial; readonly motivo: string };

const invalida = (porque: string): Credencial => ({
  ok: false,
  estado: "SECRETO_INVALIDO",
  motivo: `INV_IA_DATABASE_URL no es la de ${USUARIO_IA} en ${HOST_BASE} (${porque}): el servicio queda en espera y no hace resúmenes`,
});

function revisarParametros(parametros: URLSearchParams): Credencial {
  const claves = [...parametros.keys()];
  if (claves.some((c) => !PARAMETROS.has(c)) || new Set(claves).size !== claves.length) return invalida("trae parámetros fuera de la lista");
  if (!CONEXIONES_RE.test(parametros.get("connection_limit") ?? "")) return invalida("connection_limit debe ser 1 o 2");
  return { ok: true };
}

/** Revisa la URL de la base (DATABASE_URL del contenedor) sin devolverla ni repetirla nunca. */
export function revisarCredencialIa(url: string | undefined): Credencial {
  if (url === undefined || url.trim() === "") {
    return { ok: false, estado: "SIN_SECRETO", motivo: "sin INV_IA_DATABASE_URL: el servicio queda en espera y no hace resúmenes" };
  }
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return invalida("no es una URL");
  }
  if (!PROTOCOLOS.has(u.protocol)) return invalida("el protocolo no es postgresql");
  if (u.username !== USUARIO_IA) return invalida(`el usuario no es ${USUARIO_IA}`);
  if (u.hostname !== HOST_BASE) return invalida(`la base no es ${HOST_BASE}`);
  if (u.password === "") return invalida("no trae clave");
  if (!PUERTOS.has(u.port)) return invalida("el puerto no es 5432");
  if (!BASE_RE.test(u.pathname)) return invalida("no nombra una base");
  return revisarParametros(u.searchParams);
}

export type TokenLeido = { readonly ok: true; readonly token: string } | { readonly ok: false; readonly estado: "SIN_TOKEN" | "TOKEN_INVALIDO"; readonly motivo: string };

/** El token compartido con la app. Sin él no se abre el endpoint; nunca se repite. */
export function leerTokenServicio(valor: string | undefined): TokenLeido {
  if (valor === undefined || valor === "") {
    return { ok: false, estado: "SIN_TOKEN", motivo: `sin ${VARIABLE_TOKEN_SERVICIO_IA}: los pedidos a demanda de la app quedan apagados` };
  }
  if (!tokenServicioValido(valor)) {
    return { ok: false, estado: "TOKEN_INVALIDO", motivo: `${VARIABLE_TOKEN_SERVICIO_IA} no tiene la forma (43 a 128 caracteres de base64url): los pedidos a demanda quedan apagados` };
  }
  return { ok: true, token: valor };
}
