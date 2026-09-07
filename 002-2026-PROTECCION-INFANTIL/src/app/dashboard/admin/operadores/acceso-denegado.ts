/**
 * SPEC-571 (I-353): fallback local de acceso-denegado del módulo "operadores",
 * extraído de `operadores/page.tsx` (I-129) para que TODAS las páginas guardadas
 * del área lo compartan sin duplicar el mapa. NO es la fuente única rol→home
 * (esa vive en `@/lib/auth/home-para-rol`): solo dice a dónde mandar a quien no
 * tiene acceso a ESTE módulo. Solo distingue COMITE_VALIDACION del default admin
 * porque son los únicos roles admin que llegan hasta acá.
 */
export function homeAccesoDenegado(rol: string | null): string {
    if (rol === "COMITE_VALIDACION") return "/dashboard/admin/comite";
    // SPEC-404 (I-290): la bandeja tiene URL propia; `/dashboard/admin` es solo aterrizaje.
    return "/dashboard/admin/bandeja";
}
