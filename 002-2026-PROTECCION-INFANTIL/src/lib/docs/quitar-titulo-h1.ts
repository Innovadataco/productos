/**
 * SPEC-576 (I-359) · quita el título H1 principal de un markdown cuando la pantalla ya pinta ese título
 * aparte — evita el título DUPLICADO (misma clase que el header duplicado de auditoría, 569/575: dos
 * fuentes pintando el mismo título; se deja una).
 *
 * Solo un `# ...` al INICIO del documento (tras espacios o líneas en blanco). No toca `##`/`###` (que
 * son secciones legítimas del cuerpo) ni nada si el markdown no empieza con H1. Pura, para poder
 * afirmarla sin render.
 */
export function quitarTituloH1(markdown: string): string {
    return markdown.replace(/^\s*#\s+.*(?:\r?\n|$)/, "");
}
