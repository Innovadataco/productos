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
    { clave: "operadores", nombre: "Gestión de operadores", categoria: "admin", esCritico: true, orden: 20 },
    { clave: "bandeja_reportes", nombre: "Bandeja de reportes", categoria: "operador", esCritico: true, orden: 30 },
    { clave: "reportes_revision", nombre: "Cola de revisión manual", categoria: "operador", esCritico: true, orden: 40 },
    { clave: "comite", nombre: "Comité de Validación", categoria: "comite", orden: 50 },
    { clave: "comite_bandeja", nombre: "Bandeja del comité", categoria: "comite", orden: 51, padre: "comite" },
    { clave: "comite_auditoria", nombre: "Auditoría del comité", categoria: "comite", orden: 52, padre: "comite" },
    { clave: "colegios", nombre: "Colegios", categoria: "colegio", orden: 60 },
    { clave: "colegios_gestion", nombre: "Gestión del colegio", categoria: "colegio", orden: 61, padre: "colegios" },
    { clave: "colegios_auditoria", nombre: "Auditoría del colegio", categoria: "colegio", orden: 62, padre: "colegios" },
    { clave: "configuracion_sistema", nombre: "Configuración del sistema", categoria: "admin", esCritico: true, orden: 70 },
    { clave: "configuracion_permisos", nombre: "Permisos por rol", categoria: "admin", orden: 71, padre: "configuracion_sistema" },
    { clave: "audit_logs", nombre: "Logs de auditoría", categoria: "admin", esCritico: true, orden: 80 },
    { clave: "estadisticas", nombre: "Estadísticas", categoria: "admin", orden: 90 },
    { clave: "anti_abuso", nombre: "Anti-abuso", categoria: "admin", orden: 100 },
    { clave: "apelaciones", nombre: "Apelaciones", categoria: "admin", orden: 110 },
    { clave: "dataset_entrenamiento", nombre: "Dataset de entrenamiento", categoria: "admin", orden: 120 },
];
