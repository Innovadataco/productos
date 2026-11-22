/**
 * Lo común de las rutas de escritura del área de edición (fase B, PR-B), fuera del guardián (que va en cada handler,
 * con su forma exacta: tests/unit/auth/escrituras.candado.test.ts):
 * - CSRF: el Origin de la lista (src/auth/origen.ts), antes de mirar la sesión; sin APP_ORIGEN en producción, 503.
 * - Cuerpo: JSON y acotado (se lee en trozos y se corta al pasar el tope, src/auth/cuerpo.ts).
 * - Errores: cada código del dominio con su estado HTTP; el cuerpo lleva un mensaje genérico, el código y los campos,
 *   nunca un valor. Cualquier otro error, 500 genérico; al registro, solo el nombre del error y el código de Prisma
 *   (el mensaje o el `meta` de Prisma pueden traer valores reales).
 * Todas las respuestas, sin caché.
 */
import { Prisma } from "@prisma/client";
import { textoAcotado } from "@/auth/cuerpo";
import { origenValido, origenesPermitidos } from "@/auth/origen";
import { MENSAJE_SOLO_LECTURA, respuestaJson } from "@/auth/respuestas";
import { ErrorPlan, type ErrorCampo } from "../errores";

export const MENSAJE_SOLICITUD = "Solicitud inválida.";
export const MENSAJE_INVALIDO = "Revise los datos marcados.";
export const MENSAJE_CONFLICTO = "Lo que intenta guardar cambió mientras editaba. Vuelva a cargar la página.";
export const MENSAJE_FALLO = "No se pudo guardar. Intente de nuevo.";

/**
 * Los códigos del dominio que no son un 400: el estado cambió mientras se editaba (409) o quien escribe no es el
 * dueño (403; el guardián ya lo frena antes). Todo otro código del dominio es un dato que no cabe: 400.
 */
export const ESTADO_POR_CODIGO: Readonly<Record<string, number>> = {
  PLAN_CAMBIO: 409,
  VIGENCIA_RETROCEDE: 409,
  DECISION_YA_REEMPLAZADA: 409,
  ENLACE_YA_REEMPLAZADO: 409,
  ORDEN_YA_ENLAZADA: 409,
  YA_ENLAZADA_A_ESA_DECISION: 409,
  AUTOR_NO_AUTORIZADO: 403,
};

const MENSAJE_POR_ESTADO: Readonly<Record<number, string>> = { 400: MENSAJE_INVALIDO, 403: MENSAJE_SOLO_LECTURA, 409: MENSAJE_CONFLICTO };

/** El Origin no es de la lista (403) o falta la configuración en producción (503); null si pasa. */
export function origenRechazado(pedido: Request): Response | null {
  let permitidos: readonly string[];
  try {
    permitidos = origenesPermitidos(process.env);
  } catch {
    return respuestaJson({ error: "Configuración incompleta" }, 503);
  }
  return origenValido(pedido.method, pedido.headers, permitidos) ? null : respuestaJson({ error: "Origen no permitido" }, 403);
}

/** El cuerpo como JSON: solo con content-type JSON y hasta `maxBytes`; si no, `{ ok: false }`. */
export async function leerCuerpoJson(pedido: Request, maxBytes: number): Promise<{ readonly ok: true; readonly valor: unknown } | { readonly ok: false }> {
  if (!(pedido.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) return { ok: false };
  const texto = await textoAcotado(pedido, maxBytes);
  if (texto === null) return { ok: false };
  try {
    return { ok: true, valor: JSON.parse(texto) as unknown };
  } catch {
    return { ok: false };
  }
}

export const respuestaSolicitudInvalida = (): Response => respuestaJson({ error: MENSAJE_SOLICITUD }, 400);

export const respuestaInvalida = (campos: readonly ErrorCampo[]): Response =>
  respuestaJson({ error: MENSAJE_INVALIDO, codigo: "DATOS_INVALIDOS", campos }, 400);

export const respuestaCreada = (cuerpo: unknown): Response => respuestaJson(cuerpo, 201);

/** El nombre del error y, si es de Prisma, su código: nunca el mensaje. */
function huella(error: unknown): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) return `${error.name} ${error.code}`;
  return error instanceof Error ? error.name : "desconocido";
}

export function respuestaDeError(error: unknown, contexto: string): Response {
  if (error instanceof ErrorPlan) {
    const estado = ESTADO_POR_CODIGO[error.codigo] ?? 400;
    return respuestaJson({ error: MENSAJE_POR_ESTADO[estado], codigo: error.codigo, campos: error.errores }, estado);
  }
  console.error(`[edicion:${contexto}] no se pudo guardar (${huella(error)})`);
  return respuestaJson({ error: MENSAJE_FALLO }, 500);
}
