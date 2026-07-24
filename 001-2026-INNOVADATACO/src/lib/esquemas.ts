/**
 * Esquemas de validación de entrada con Zod (spec 009, FR-008; §5.2).
 *
 * Alcance **acotado a propósito**: solo las rutas que reciben texto libre del
 * usuario, que son donde los límites de §2.6 importan y donde hoy no existían.
 * El resto de rutas conserva su validación manual explícita y queda declarado
 * como pendiente: migrar todo de una vez, de noche y sin revisión, sería
 * cambiar el contrato de media API a ciegas.
 *
 * Regla de uso: el error de Zod **nunca** viaja al cliente. Cada esquema define
 * su propio mensaje legible y la ruta responde con ése (§0.3).
 */
import { z } from "zod";

/** §2.6: query de búsqueda, máx 500 caracteres. */
export const LIMITE_QUERY = 500;

/** §2.6: prompt a IA, máx 16000 caracteres. */
export const LIMITE_PROMPT_IA = 16000;

/**
 * `POST /api/documents/search`.
 *
 * El tope de 500 caracteres lo pedía §2.6 y no estaba implementado: la ruta
 * aceptaba una consulta de cualquier tamaño y la mandaba a embeder.
 */
export const esquemaBusquedaDocumentos = z.object({
  query: z
    .string({ error: "Consulta requerida" })
    .trim()
    .min(1, { error: "Consulta requerida" })
    .max(LIMITE_QUERY, { error: `La consulta no puede superar los ${LIMITE_QUERY} caracteres` }),
  tipo: z.string().optional(),
  entidad: z.string().optional(),
  sector: z.string().optional(),
  fechaDesde: z.string().optional(),
  fechaHasta: z.string().optional(),
});

/**
 * `POST /api/research/analyze`.
 *
 * Exige uno de los dos (documento o texto) y aplica el tope de §2.6 al texto
 * pegado, que tampoco estaba implementado.
 */
export const esquemaAnalisisInvestigacion = z
  .object({
    documentId: z.string().trim().min(1).optional(),
    text: z
      .string()
      .trim()
      .max(LIMITE_PROMPT_IA, {
        error: `El texto no puede superar los ${LIMITE_PROMPT_IA} caracteres`,
      })
      .optional(),
  })
  .refine((datos) => Boolean(datos.documentId) || Boolean(datos.text), {
    error: "documentId o text requerido",
  });

/**
 * Valida y devuelve o bien los datos, o bien el **mensaje legible** del primer
 * problema. Nunca devuelve el error de Zod crudo: eso es detalle técnico (§0.3).
 */
export function validar<T>(
  esquema: z.ZodType<T>,
  datos: unknown,
): { ok: true; datos: T } | { ok: false; mensaje: string } {
  const resultado = esquema.safeParse(datos);
  if (resultado.success) return { ok: true, datos: resultado.data };

  const primero = resultado.error.issues[0];
  return { ok: false, mensaje: primero?.message || "Datos de entrada inválidos" };
}
