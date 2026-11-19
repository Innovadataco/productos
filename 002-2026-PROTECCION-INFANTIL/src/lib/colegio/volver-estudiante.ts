/**
 * SPEC-931 (FORMA Diseño f700b2c2 §3.2) — a dónde vuelve el detalle del estudiante.
 *
 * Con el listado de Usuarios → Estudiantes existiendo, «← Volver» apunta a donde el usuario venía:
 * desde el listado (que enlaza con `?desde=estudiantes`) vuelve al listado; desde el curso (o sin
 * origen declarado), al curso, como siempre.
 */
export const ORIGEN_LISTADO_ESTUDIANTES = "estudiantes";

export function destinoVolverEstudiante(
    desde: string | string[] | undefined,
    estudiante: { cursoId: string } | null | undefined
): { href: string; etiqueta: string } {
    if (desde === ORIGEN_LISTADO_ESTUDIANTES) {
        return { href: "/dashboard/colegio/estudiantes", etiqueta: "← Volver a estudiantes" };
    }
    // Aún sin cargar el estudiante: `/cursos/` (mismo comportamiento que tenía el botón).
    return { href: `/dashboard/colegio/cursos/${estudiante?.cursoId ?? ""}`, etiqueta: "← Volver al curso" };
}
