/**
 * Configuración del servicio inv-008-precios (D-018).
 * - La credencial: solo la del rol inv_precios en la base inv-008-db (condición del CEO de PI: el servicio solo tiene
 *   esa credencial, y la base va por la red interna, nunca por la IP del host). Sin ella el servicio NO se cae: queda
 *   en espera (SIN_SECRETO); con otra, tampoco (SECRETO_INVALIDO). Ningún motivo repite la URL ni su clave.
 * - Los argumentos de `--ahora [--desde AAAA-MM-DD]` (carga histórica). El mensaje de error no repite lo que llegó.
 */
import { leerFechaIso } from "../importacion/trii/valores";
import { fechaEnBogota } from "../precios/horario";

export const USUARIO_PRECIOS = "inv_precios";
export const HOST_BASE = "inv-008-db";
const PROTOCOLOS = new Set(["postgresql:", "postgres:"]);

export type EstadoSinCredencial = "SIN_SECRETO" | "SECRETO_INVALIDO";
export type Credencial = { readonly ok: true } | { readonly ok: false; readonly estado: EstadoSinCredencial; readonly motivo: string };

const invalida = (porque: string): Credencial => ({
  ok: false,
  estado: "SECRETO_INVALIDO",
  motivo: `INV_PRECIOS_DATABASE_URL no es la de ${USUARIO_PRECIOS} en ${HOST_BASE} (${porque}): el servicio queda en espera y no trae precios`,
});

/** Revisa la URL de la base (DATABASE_URL del contenedor) sin devolverla ni repetirla nunca. */
export function revisarCredencial(url: string | undefined): Credencial {
  if (url === undefined || url.trim() === "") {
    return { ok: false, estado: "SIN_SECRETO", motivo: "sin INV_PRECIOS_DATABASE_URL: el servicio queda en espera y no trae precios" };
  }
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return invalida("no es una URL");
  }
  if (!PROTOCOLOS.has(u.protocol)) return invalida("el protocolo no es postgresql");
  if (u.username !== USUARIO_PRECIOS) return invalida(`el usuario no es ${USUARIO_PRECIOS}`);
  if (u.hostname !== HOST_BASE) return invalida(`la base no es ${HOST_BASE}`);
  if (u.password === "") return invalida("no trae clave");
  return { ok: true };
}

export type ArgumentosAhora = { readonly ok: true; readonly desde: string | null } | { readonly ok: false; readonly mensaje: string };

const USO_AHORA = "Uso: node servicio-precios.mjs --ahora [--desde AAAA-MM-DD] (la fecha, de hoy o antes)";

/** Lee lo que va después de `--ahora`. `hoy` es el instante actual: la fecha no puede ser futura en Colombia. */
export function leerArgumentosAhora(args: readonly string[], hoy: Date): ArgumentosAhora {
  if (args.length === 0) return { ok: true, desde: null };
  const [opcion, valor, ...resto] = args;
  if (opcion !== "--desde" || valor === undefined || resto.length > 0) return { ok: false, mensaje: `❌ Argumentos inválidos. ${USO_AHORA}` };
  const fecha = leerFechaIso(valor);
  if (!fecha.ok || fecha.valor.getTime() > fechaEnBogota(hoy).getTime()) return { ok: false, mensaje: `❌ Fecha inválida. ${USO_AHORA}` };
  return { ok: true, desde: fecha.valor.toISOString().slice(0, 10) };
}
