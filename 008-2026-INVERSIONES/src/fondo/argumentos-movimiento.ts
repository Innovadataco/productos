/**
 * Argumentos de scripts/registrar-movimiento-fondo.ts (frente fondo-movimientos). Puro y estricto: se lee ANTES de
 * abrir la base, así que lo que no se reconoce sale con 2 sin tocar nada.
 *   --email <correo-del-dueño> --fondo <codigo_negocio de la SFC> --fecha AAAA-MM-DD --unidades <n> --monto <n> [--aplicar]
 * - Cada opción, una sola vez (OPCION_REPETIDA con su nombre); nada suelto; una opción nunca es el valor de otra.
 * - Sin --aplicar es ensayo. La fecha no puede ser posterior a hoy en Bogotá.
 * - Los errores dicen campo y código, nunca el valor (son datos reales).
 */
import { leerConParseArgs } from "../cli/opciones";
import { fechaEnBogota } from "../precios/horario";
import { validarConstitucion, type ConstitucionValida, type ErrorCampo } from "./movimiento";

export const USO_MOVIMIENTO = [
  "Uso: npx tsx scripts/registrar-movimiento-fondo.ts --email <correo-del-dueño> --fondo <código del fondo en la SFC> \\",
  "       --fecha AAAA-MM-DD --unidades <n> --monto <n> [--aplicar]",
  "  La constitución del fondo con las unidades y el aporte que dice el extracto del FIC (punto decimal, sin miles).",
  "  Sin --aplicar es ensayo: no escribe. Salida: 0 bien · 1 error de la base · 2 uso · 3 rechazado (no escribió nada).",
].join("\n");

const OPCIONES = {
  email: { type: "string" },
  fondo: { type: "string" },
  fecha: { type: "string" },
  unidades: { type: "string" },
  monto: { type: "string" },
  aplicar: { type: "boolean" },
} as const;

export type ArgumentosMovimiento =
  | { readonly ok: true; readonly aplicar: boolean; readonly datos: ConstitucionValida }
  | { readonly ok: false; readonly errores: ErrorCampo[] };

const INVALIDOS: ArgumentosMovimiento = { ok: false, errores: [{ campo: "argumentos", codigo: "ARGUMENTOS_INVALIDOS" }] };

export function interpretarArgumentosMovimiento(args: readonly string[], ahora: Date): ArgumentosMovimiento {
  // null también con `--`: después de él parseArgs deja de leer opciones (src/cli/opciones.ts).
  const r = leerConParseArgs(args, OPCIONES);
  if (!r) return INVALIDOS;
  // Las repetidas, en el orden de su segunda aparición.
  if (r.repetidas.length > 0) return { ok: false, errores: r.repetidas.map((campo) => ({ campo, codigo: "OPCION_REPETIDA" })) };
  const v = r.valores;
  const datos = validarConstitucion({ email: v.email, fondo: v.fondo, fecha: v.fecha, unidades: v.unidades, monto: v.monto }, fechaEnBogota(ahora));
  return datos.ok ? { ok: true, aplicar: v.aplicar === true, datos: datos.valor } : { ok: false, errores: datos.errores };
}
