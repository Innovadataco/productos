/**
 * Configuración del servicio inv-008-alertas.
 * - La credencial: solo la del rol inv_alertas en la base inv-008-db, por la red interna. Sin ella el servicio NO se cae: queda EN
 *   ESPERA (SIN_SECRETO); con otra, tampoco (SECRETO_INVALIDO). Las mismas reglas de los servicios de precios y de IA: puerto 5432
 *   o vacío, una base, `connection_limit` 1 o 2 (el rol tiene CONNECTION LIMIT 2) y solo parámetros de una lista (libpq y Prisma
 *   aceptan `host` o `hostaddr` en la consulta, que cambiarían el destino).
 * - Que la conexión SEA de verdad inv_alertas (current_user) lo revisa el bucle al arrancar, con src/alertas/credencial.ts.
 * Ningún motivo repite la URL ni su clave.
 */
export const USUARIO_ALERTAS = "inv_alertas";
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
  motivo: `INV_ALERTAS_DATABASE_URL no es la de ${USUARIO_ALERTAS} en ${HOST_BASE} (${porque}): el servicio queda en espera y no evalúa alertas`,
});

function revisarParametros(parametros: URLSearchParams): Credencial {
  const claves = [...parametros.keys()];
  if (claves.some((c) => !PARAMETROS.has(c)) || new Set(claves).size !== claves.length) return invalida("trae parámetros fuera de la lista");
  if (!CONEXIONES_RE.test(parametros.get("connection_limit") ?? "")) return invalida("connection_limit debe ser 1 o 2");
  return { ok: true };
}

/** Revisa la URL de la base (DATABASE_URL del contenedor) sin devolverla ni repetirla nunca. */
export function revisarCredencialAlertas(url: string | undefined): Credencial {
  if (url === undefined || url.trim() === "") {
    return { ok: false, estado: "SIN_SECRETO", motivo: "sin INV_ALERTAS_DATABASE_URL: el servicio queda en espera y no evalúa alertas" };
  }
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return invalida("no es una URL");
  }
  if (!PROTOCOLOS.has(u.protocol)) return invalida("el protocolo no es postgresql");
  if (u.username !== USUARIO_ALERTAS) return invalida(`el usuario no es ${USUARIO_ALERTAS}`);
  if (u.hostname !== HOST_BASE) return invalida(`la base no es ${HOST_BASE}`);
  if (u.password === "") return invalida("no trae clave");
  if (!PUERTOS.has(u.port)) return invalida("el puerto no es 5432");
  if (!BASE_RE.test(u.pathname)) return invalida("no nombra una base");
  return revisarParametros(u.searchParams);
}
