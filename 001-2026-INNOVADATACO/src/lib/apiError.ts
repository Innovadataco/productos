import { NextResponse } from "next/server";

/**
 * Contrato único de error de las rutas API (spec 002, FR-004/FR-005).
 *
 * Al cliente le llega SOLO `{ error: <mensaje legible> }`. El detalle técnico
 * (mensaje de la excepción, stack) se registra en el log del servidor con el
 * formato de la constitución §2.5: `[Módulo] Acción: resultado — detalle`.
 *
 * Nunca se devuelve `err.message` crudo ni un campo `details` al cliente
 * (constitución §0.3, §2.4).
 */

/**
 * Respuesta única de sesión ausente o inválida (spec 005, FR-009).
 *
 * Mismo cuerpo y mismo código que las rutas protegidas antes de esta spec: el
 * contrato al cliente no cambia. El 401 se devuelve ANTES de tocar la base de
 * datos o hacer cualquier llamada saliente (constitución §5.1).
 */
export function noAutenticado(): NextResponse {
  return NextResponse.json({ error: "No autenticado" }, { status: 401 });
}

/** ¿El error capturado es un error conocido de Prisma con este código? (p. ej. "P2002") */
export function esCodigoPrisma(err: unknown, codigo: string): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === codigo
  );
}

/** Extrae el detalle técnico de un valor capturado, sin asumir que sea Error. */
export function detalleDeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Error desconocido";
}

/**
 * Registra el error y construye la respuesta normalizada.
 *
 * @param modulo         Módulo para el log, p. ej. "Licitaciones".
 * @param accion         Acción para el log, p. ej. "GET lista".
 * @param mensajeCliente Mensaje legible que SÍ puede ver el usuario.
 * @param status         Código HTTP según constitución §2.4.
 * @param err            Excepción capturada (opcional); solo va al log.
 * @param extra          Campos adicionales legítimos de la respuesta
 *                       (p. ej. `latencyMs`, `models: []`). Nunca detalles de error.
 */
export function apiError(
  modulo: string,
  accion: string,
  mensajeCliente: string,
  status: number,
  err?: unknown,
  extra?: Record<string, unknown>,
): NextResponse {
  const detalle = err === undefined ? mensajeCliente : detalleDeError(err);
  console.error(`[${modulo}] ${accion}: error — ${detalle}`);

  return NextResponse.json({ error: mensajeCliente, ...extra }, { status });
}
