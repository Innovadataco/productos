import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";
import EstudiantesPageClient from "./EstudiantesPageClient";

/**
 * SPEC-931 (FORMA Diseño f700b2c2 §3.2) — Usuarios → Estudiantes: el listado del COLEGIO.
 * Guardia de PÁGINA en el servidor (mismo patrón y módulo que Profesores): esconder la entrada
 * del menú NO cierra la pantalla; esto sí. Consulta + acceso al detalle existente
 * (`/dashboard/colegio/alumnos/[id]`); el alta de estudiantes sigue en Cursos.
 */
export default async function EstudiantesPage() {
    const acceso = await verificarAccesoPagina("colegios_gestion");
    if (!acceso.permitido) return <SinAccesoModulo volver="/dashboard/colegio" />;
    return <EstudiantesPageClient />;
}
