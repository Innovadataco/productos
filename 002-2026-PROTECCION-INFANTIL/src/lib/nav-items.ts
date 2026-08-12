/**
 * Ítems de navegación mapeados a módulos permisibles (spec 086).
 * Cada ítem de menú = un módulo del catálogo (`src/lib/permisos-catalogo.ts`).
 * El test estructural (`nav-items.test.ts`) garantiza que no haya desfases.
 */
export interface NavItem {
    href: string;
    label: string;
    modulo: string;
}

export const ADMIN_NAV_ITEMS: NavItem[] = [
    { href: "/dashboard/admin", label: "Bandeja de reportes", modulo: "bandeja_reportes" },
    { href: "/dashboard/admin/spam", label: "Revisión de spam", modulo: "revision_spam" },
    { href: "/dashboard/admin/comite", label: "Comité", modulo: "comite_bandeja" },
    { href: "/dashboard/admin/estadisticas", label: "Dashboard", modulo: "estadisticas" },
    { href: "/dashboard/admin/ia", label: "Centro de Control IA", modulo: "centro_control_ia" },
    { href: "/dashboard/admin/operadores", label: "Operadores", modulo: "operadores" },
    { href: "/dashboard/admin/padres", label: "Padres", modulo: "padres" },
    { href: "/dashboard/admin/colegios", label: "Colegios", modulo: "colegios_gestion" },
    { href: "/dashboard/admin/anti-abuso", label: "Anti-abuso", modulo: "anti_abuso" },
    { href: "/dashboard/admin/monitoreo/worker", label: "Monitoreo worker", modulo: "monitoreo_worker" },
    { href: "/dashboard/admin/dataset-entrenamiento", label: "Dataset", modulo: "dataset_entrenamiento" },
    { href: "/dashboard/admin/configuracion", label: "Configuración", modulo: "configuracion_sistema" },
];

export const COMITE_NAV_TABS: NavItem[] = [
    { href: "/dashboard/admin/comite", label: "Bandeja", modulo: "comite_bandeja" },
    { href: "/dashboard/admin/comite/apelaciones", label: "Apelaciones", modulo: "comite_bandeja" },
    { href: "/dashboard/admin/comite/gestion", label: "Gestión", modulo: "comite" },
    { href: "/dashboard/admin/comite/auditoria", label: "Auditoría", modulo: "comite_auditoria" },
];

export const COLEGIO_NAV_ITEMS: NavItem[] = [
    { href: "/dashboard/colegio", label: "Inicio", modulo: "colegios" },
    { href: "/dashboard/colegio/cursos", label: "Cursos", modulo: "colegios_gestion" },
    { href: "/dashboard/colegio/profesores", label: "Profesores", modulo: "colegios_gestion" },
    { href: "/dashboard/colegio/materias", label: "Materias", modulo: "colegios_gestion" },
    { href: "/dashboard/colegio/cursos/unificado", label: "Subir lista", modulo: "colegios_gestion" },
    { href: "/dashboard/colegio/alertas", label: "Alertas", modulo: "colegios_gestion" },
    // SPEC-168 (Fase F): gestión del comité (rector) y bandeja de casos (rector/comité).
    { href: "/dashboard/colegio/comite", label: "Comité de Convivencia", modulo: "colegios_comite" },
    { href: "/dashboard/colegio/comite/casos", label: "Casos del comité", modulo: "colegios_comite_bandeja" },
    { href: "/dashboard/colegio/estadisticas", label: "Estadísticas", modulo: "colegios_gestion" },
    { href: "/dashboard/colegio/configuracion", label: "Configuración", modulo: "colegios_gestion" },
    { href: "/dashboard/colegio/auditoria", label: "Auditoría", modulo: "colegios_auditoria" },
];

/** Tabs del Centro de Control IA filtradas por submódulo (null = visible con la raíz). */
export const IA_TABS: Array<{ key: string; label: string; modulo: string | null }> = [
    { key: "documentacion", label: "Documentación", modulo: null },
    { key: "playground", label: "Playground", modulo: "ia_playground" },
    { key: "rubrica", label: "Rúbrica", modulo: "ia_rubrica" },
    { key: "eval", label: "Eval", modulo: "ia_eval" },
    { key: "configuracion", label: "Configuración", modulo: "ia_configuracion" },
];
