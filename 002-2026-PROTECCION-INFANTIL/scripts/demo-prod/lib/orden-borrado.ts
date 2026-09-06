/**
 * Orden de borrado de las entidades marcadas en `demo_marcado` (hojas primero,
 * padres después) para que la purga quirúrgica no choque con llaves foráneas.
 *
 * Vive en su propio módulo —y no dentro de `purgar-demo.ts`— porque ese script
 * ejecuta `main()` al importarse: un candado que quisiera importar la lista
 * dispararía la purga. Acá es un dato puro, testeable.
 *
 * SPEC-499: el profesional demo agrega tres entidades. Deben borrarse ANTES de
 * `Usuario` (su perfil cuelga del usuario) y, entre ellas, las hijas del perfil
 * (`FranjaDisponible`, `VerificacionProfesional`) antes que `PerfilProfesional`.
 */
export const ORDEN_BORRADO: string[] = [
    "AuditLog",
    "Reporte",
    // SPEC-516: el identificador visible de PA-16 se crea sin Reporte propio, así
    // que ni la fase reporte-derivada ni la fase 4 lo levantan; se borra por marca.
    "IdentificadorReportado",
    "IdentificadorContacto",
    "ContactoConfianza",
    "AlertaSuscripcion",
    "PerfilOperador",
    "IntegranteComite",
    // SPEC-499 · profesional demo (hijas del perfil primero, luego el perfil).
    "VerificacionProfesional",
    "FranjaDisponible",
    "PerfilProfesional",
    "Estudiante",
    "Curso",
    "Profesor",
    "Usuario",
    "Colegio",
    "Tenant",
];
