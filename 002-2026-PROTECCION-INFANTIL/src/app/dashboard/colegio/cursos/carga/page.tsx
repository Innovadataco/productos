import { permanentRedirect } from "next/navigation";

/**
 * SPEC-146 (FR-005): subir la lista en Excel vive en la sección 2 del wizard
 * unificado — redirect permanente en modo Excel (el acceso lo valida el wizard).
 */
export default function CargaMasivaPage() {
    permanentRedirect("/dashboard/colegio/cursos/unificado?modo=excel");
}
