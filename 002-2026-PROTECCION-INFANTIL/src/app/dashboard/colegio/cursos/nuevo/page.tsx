import { permanentRedirect } from "next/navigation";

/**
 * SPEC-146 (FR-005): la creación de cursos vive en el wizard unificado —
 * esta ruta queda como redirect permanente (el acceso lo valida el wizard).
 */
export default function NuevoCursoPage() {
    permanentRedirect("/dashboard/colegio/cursos/unificado");
}
