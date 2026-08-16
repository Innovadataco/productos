/**
 * Catálogo inicial de módulos permisibles (spec 019).
 * Única fuente: lo usan el seed y los tests (otorgarTodosLosPermisos).
 */
export interface ModuloCatalogo {
    clave: string;
    nombre: string;
    categoria: string;
    esCritico?: boolean;
    orden: number;
    padre?: string;
}

export const CATALOGO_MODULOS: ModuloCatalogo[] = [
    { clave: "centro_control_ia", nombre: "Centro de Control IA", categoria: "admin", esCritico: true, orden: 10 },
    { clave: "ia_playground", nombre: "Playground y modelos", categoria: "admin", orden: 11, padre: "centro_control_ia" },
    { clave: "ia_eval", nombre: "Evaluación del clasificador", categoria: "admin", orden: 12, padre: "centro_control_ia" },
    { clave: "ia_simulaciones", nombre: "Simulaciones", categoria: "admin", orden: 13, padre: "centro_control_ia" },
    { clave: "ia_configuracion", nombre: "Configuración del motor IA", categoria: "admin", orden: 14, padre: "centro_control_ia" },
    { clave: "ia_rubrica", nombre: "Rúbrica de clasificación", categoria: "admin", orden: 15, padre: "centro_control_ia" },
    { clave: "operadores", nombre: "Gestión de operadores", categoria: "admin", esCritico: true, orden: 20 },
    { clave: "padres", nombre: "Gestión de padres", categoria: "admin", esCritico: true, orden: 25 },
    // SPEC-141 (N-1, decisión ZEUS): visibilidad de soporte SOLO LECTURA sobre datos
    // sensibles (círculo de confianza de padres, cursos/alumnos de colegios).
    // Módulo propio — NO reusar padres/colegios_gestion. Default: solo ADMIN.
    { clave: "soporte_lectura", nombre: "Soporte: lectura de datos sensibles", categoria: "admin", esCritico: true, orden: 26 },
    { clave: "bandeja_reportes", nombre: "Bandeja de reportes", categoria: "operador", esCritico: true, orden: 30 },
    { clave: "expediente_revelar_original", nombre: "Revelar texto original", categoria: "operador", esCritico: true, orden: 31, padre: "bandeja_reportes" },
    // SPEC-140 (F2/N-4): generar denuncia formal (PDF por plantilla) y exportar el
    // expediente forense. Default: ADMIN + COMITE_VALIDACION.
    { clave: "denuncia_formal", nombre: "Denuncia formal y expediente forense", categoria: "operador", esCritico: true, orden: 32, padre: "bandeja_reportes" },
    { clave: "revision_spam", nombre: "Revisión de spam", categoria: "operador", orden: 35 },
    { clave: "comite", nombre: "Comité de Validación", categoria: "comite", orden: 50 },
    { clave: "comite_bandeja", nombre: "Bandeja del comité", categoria: "comite", orden: 51, padre: "comite" },
    { clave: "comite_auditoria", nombre: "Auditoría del comité", categoria: "comite", orden: 52, padre: "comite" },
    { clave: "colegios", nombre: "Colegios", categoria: "colegio", orden: 60 },
    { clave: "colegios_gestion", nombre: "Gestión del colegio", categoria: "colegio", orden: 61, padre: "colegios" },
    { clave: "colegios_auditoria", nombre: "Auditoría del colegio", categoria: "colegio", orden: 62, padre: "colegios" },
    // SPEC-168 (Fase F): Comité de Convivencia por colegio.
    { clave: "colegios_comite", nombre: "Comité de Convivencia", categoria: "colegio", orden: 63, padre: "colegios" },
    { clave: "colegios_comite_bandeja", nombre: "Bandeja del comité", categoria: "colegio", orden: 64, padre: "colegios" },
    // SPEC-169 (Fase G): onboarding, cobertura y notificaciones in-app del colegio.
    { clave: "colegios_onboarding", nombre: "Onboarding del colegio", categoria: "colegio", orden: 65, padre: "colegios" },
    { clave: "colegios_notificaciones", nombre: "Notificaciones in-app del colegio", categoria: "colegio", orden: 66, padre: "colegios" },
    { clave: "configuracion_sistema", nombre: "Configuración del sistema", categoria: "admin", esCritico: true, orden: 70 },
    { clave: "configuracion_permisos", nombre: "Permisos por rol", categoria: "admin", orden: 71, padre: "configuracion_sistema" },
    { clave: "audit_logs", nombre: "Logs de auditoría", categoria: "admin", esCritico: true, orden: 80 },
    { clave: "estadisticas", nombre: "Estadísticas", categoria: "admin", orden: 90 },
    { clave: "anti_abuso", nombre: "Anti-abuso", categoria: "admin", orden: 100 },
    { clave: "monitoreo_worker", nombre: "Monitoreo del worker", categoria: "admin", orden: 105 },
    { clave: "dataset_entrenamiento", nombre: "Dataset de entrenamiento", categoria: "admin", orden: 120 },
];
