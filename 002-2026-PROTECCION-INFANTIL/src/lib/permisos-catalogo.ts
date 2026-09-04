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
    // SPEC-378: Inicio del administrador — alarma de la casa. Va primero para
    // que el ADMIN aterrice acá y vea lo que se está rompiendo en silencio.
    { clave: "inicio_admin", nombre: "Inicio del administrador", categoria: "admin", orden: 5 },
    { clave: "centro_control_ia", nombre: "Centro de Control IA", categoria: "admin", esCritico: true, orden: 10 },
    { clave: "ia_playground", nombre: "Playground y modelos", categoria: "admin", orden: 11, padre: "centro_control_ia" },
    { clave: "ia_simulaciones", nombre: "Simulaciones", categoria: "admin", orden: 12, padre: "centro_control_ia" },
    { clave: "ia_configuracion", nombre: "Configuración del motor IA", categoria: "admin", orden: 14, padre: "centro_control_ia" },
    { clave: "ia_rubrica", nombre: "Rúbrica de clasificación", categoria: "admin", orden: 15, padre: "centro_control_ia" },
    { clave: "operadores", nombre: "Gestión de operadores", categoria: "admin", esCritico: true, orden: 20 },
    { clave: "padres", nombre: "Gestión de padres", categoria: "admin", esCritico: true, orden: 25 },
    // SPEC-194 (002-PI-088): vista unificada de usuarios por rol (Padres default).
    { clave: "usuarios_admin", nombre: "Usuarios", categoria: "admin", esCritico: true, orden: 27 },
    // SPEC-141 (N-1, decisión ZEUS): visibilidad de soporte SOLO LECTURA sobre datos
    // sensibles (círculo de confianza de padres, cursos/alumnos de colegios).
    // Módulo propio — NO reusar padres/colegios_gestion. Default: solo ADMIN.
    { clave: "soporte_lectura", nombre: "Soporte: lectura de datos sensibles", categoria: "admin", esCritico: true, orden: 26 },
    { clave: "bandeja_reportes", nombre: "Bandeja de reportes", categoria: "operador", esCritico: true, orden: 30 },
    { clave: "expediente_revelar_original", nombre: "Revelar texto original", categoria: "operador", esCritico: true, orden: 31 },
    // SPEC-140 (F2/N-4): generar denuncia formal (PDF por plantilla) y exportar el
    // expediente forense. Default: ADMIN + COMITE_VALIDACION.
    { clave: "denuncia_formal", nombre: "Denuncia formal y expediente forense", categoria: "operador", esCritico: true, orden: 32, padre: "bandeja_reportes" },
    { clave: "revision_spam", nombre: "Revisión de spam", categoria: "operador", orden: 35 },
    { clave: "comite", nombre: "Comité de Validación", categoria: "comite", orden: 50 },
    { clave: "comite_bandeja", nombre: "Bandeja del comité", categoria: "comite", orden: 51, padre: "comite" },
    { clave: "comite_auditoria", nombre: "Auditoría del comité", categoria: "comite", orden: 52, padre: "comite" },
    // SPEC-235 (002-PI-135): aprobación de guías de acción por el comité.
    { clave: "comite_guias_accion", nombre: "Guías de acción", categoria: "comite", orden: 53, padre: "comite" },
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
    // SPEC-235 (002-PI-135): guías de acción parametrizables (admin).
    { clave: "guias_accion_admin", nombre: "Guías de acción", categoria: "admin", orden: 72, padre: "configuracion_sistema" },
    // SPEC-202 (002-PI-099): panel admin del motor de notificaciones (sub-tab de configuración).
    { clave: "configuracion_notificaciones", nombre: "Notificaciones", categoria: "admin", orden: 73, padre: "configuracion_sistema" },
    { clave: "pagos_admin", nombre: "Pagos", categoria: "admin", esCritico: true, orden: 75 },
    // SPEC-224 (002-PI-125): panel de reglas configurables del motor de recomendaciones
    // (edita SQL y promueve a EJECUTA — capacidad crítica con permiso propio y revocable).
    { clave: "analisis_admin", nombre: "Análisis · Reglas", categoria: "admin", esCritico: true, orden: 76 },
    { clave: "audit_logs", nombre: "Logs de auditoría", categoria: "admin", esCritico: true, orden: 80 },
    { clave: "estadisticas", nombre: "Estadísticas", categoria: "admin", orden: 90 },
    // SPEC-194 (002-PI-088): analítica agregada de colegios (sub-tab de estadísticas/operacion).
    { clave: "analytics_colegios", nombre: "Analítica de colegios", categoria: "admin", orden: 91, padre: "estadisticas" },
    // SPEC-206 (002-PI-120): instrumentación de sesiones activas.
    { clave: "sesiones_admin", nombre: "Sesiones activas", categoria: "admin", orden: 92, padre: "estadisticas" },
    // SPEC-202 (002-PI-099): dashboard de salud del motor de notificaciones (sub-tab de estadísticas).
    { clave: "estadisticas_salud_motor", nombre: "Salud del motor", categoria: "admin", orden: 93, padre: "estadisticas" },
    // SPEC-227 (002-PI-128): historial de sugerencias del motor de reglas + métricas de tuning.
    // Primer nivel: al implementar no existía un módulo padre `analisis` en el catálogo.
    { clave: "analisis_recomendaciones", nombre: "Análisis · Historial de sugerencias", categoria: "admin", orden: 94 },
    { clave: "anti_abuso", nombre: "Anti-abuso", categoria: "admin", orden: 100 },
    { clave: "monitoreo_worker", nombre: "Monitoreo del worker", categoria: "admin", orden: 105 },
    { clave: "dataset_entrenamiento", nombre: "Dataset de entrenamiento", categoria: "admin", orden: 120 },
    // SPEC-389 (Red de Profesionales · L2 · brief A-75): cola donde IDC verifica al
    // psicólogo y le da/niega el sello (Ley 1918/2018 + 2375/2024). El resultado de
    // antecedentes es información RESERVADA por ley — este módulo controla quién puede
    // abrir la ficha y ver `checklist`/`autorizacionArchivoUrl`. Separación de poderes
    // (criterio I-274): quien verifica NO es quien publica el perfil.
    // Default: SOLO rol ADMIN (mismo criterio que `sistema_admin`, `comite_guias_accion`).
    // SPEC-408 (A-75 · brief §9): un SOLO módulo cubre ambas colas del
    // Verificador (solicitudes por revisar + incidentes de citas). Un
    // Verificador, una persona, un trabajo — dos módulos duplicaban la
    // superficie de falla en BD viva (lección I-278).
    { clave: "admin_verificacion_profesionales", nombre: "Verificación de profesionales", categoria: "admin", esCritico: true, orden: 130 },
    // SPEC-421 (A-75): el admin crea/desactiva/reactiva cuentas de profesionales
    // igual que a los operadores — SIN modelo de asignación (a un psicólogo lo
    // elige el padre, no el sistema). Perfil, tarifa y documentos los sigue
    // cargando el propio profesional (SPEC-391 · veredicto Jelkin 20:3x).
    // Default: SOLO ADMIN por el `modulosSeed.map(...)` del seed.
    { clave: "profesionales_admin", nombre: "Gestión de profesionales", categoria: "admin", esCritico: true, orden: 132 },
    // SPEC-291 (002-PI-191): acciones admin sobre servicios docker (start/stop/restart).
    // Default: SOLO rol ADMIN (por `ADMIN: modulosSeed.map(...)` en seed-modulos-grants.ts).
    // NUNCA otorgar a OPERADOR/COMITE/SCHOOL_ADMIN sin auditoría explícita de CEO.
    { clave: "sistema_admin", nombre: "Administración del sistema (servicios docker)", categoria: "admin", esCritico: true, orden: 200 },
];
