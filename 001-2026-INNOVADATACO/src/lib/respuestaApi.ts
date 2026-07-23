/**
 * Lectura defensiva de respuestas de la API (spec 005, FR-005).
 *
 * Motivo: cerrar los `GET` (I-009) hace que cualquier pantalla sin sesión reciba
 * `{ error: "No autenticado" }` donde antes llegaba una lista. Volcar eso al estado
 * y recorrerlo con `.map()` rompe el renderizado — es lo que la tarea T012 de la
 * spec 004 evitó en `projects/page.tsx`.
 *
 * Este helper deja la lista vacía y devuelve un mensaje legible en vez de romper.
 * Nunca lanza: la pantalla decide qué hacer con `error`.
 */

/** Mensaje por defecto según el código de estado, sin filtrar detalle técnico (§0.3). */
function mensajeSegunEstado(status: number): string {
  if (status === 401) return "Sesión no válida: vuelve a iniciar sesión";
  if (status === 403) return "No tienes permisos para ver estos datos";
  return "No se pudieron cargar los datos";
}

/**
 * Devuelve `items` solo si la respuesta fue correcta Y el cuerpo es una lista.
 * En cualquier otro caso: lista vacía y mensaje legible.
 */
export async function listaSegura<T>(
  res: Response,
): Promise<{ items: T[]; error: string | null }> {
  if (!res.ok) {
    return { items: [], error: mensajeSegunEstado(res.status) };
  }

  try {
    const cuerpo: unknown = await res.json();
    if (!Array.isArray(cuerpo)) {
      return { items: [], error: "Respuesta inesperada del servidor" };
    }
    return { items: cuerpo as T[], error: null };
  } catch {
    return { items: [], error: "Respuesta ilegible del servidor" };
  }
}
