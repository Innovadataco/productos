/**
 * Ítems de navegación mapeados a módulos permisibles (spec 086).
 * Cada ítem de menú = un módulo del catálogo (`src/lib/permisos-catalogo.ts`).
 * El test estructural (`nav-items.test.ts`) garantiza que no haya desfases.
 */
export interface NavItem {
    href: string;
    label: string;
    modulo: string;
    /** Hijos para nodos expandibles (p. ej. "Usuarios" del menú del colegio). */
    children?: NavItem[];
}

export const ADMIN_NAV_ITEMS: NavItem[] = [
    { href: "/dashboard/admin", label: "Bandeja de reportes", modulo: "bandeja_reportes" },
    { href: "/dashboard/admin/spam", label: "Revisión de spam", modulo: "revision_spam" },
    { href: "/dashboard/admin/comite", label: "Comité", modulo: "comite_bandeja" },
    { href: "/dashboard/admin/estadisticas", label: "Dashboard", modulo: "estadisticas" },
    { href: "/dashboard/admin/ia", label: "Centro de Control IA", modulo: "centro_control_ia" },
    { href: "/dashboard/admin/operadores", label: "Operadores", modulo: "operadores" },
    { href: "/dashboard/admin/usuarios", label: "Usuarios", modulo: "usuarios_admin" },
    { href: "/dashboard/admin/padres", label: "Padres", modulo: "padres" },
    { href: "/dashboard/admin/colegios", label: "Colegios", modulo: "colegios_gestion" },
    { href: "/dashboard/admin/anti-abuso", label: "Anti-abuso", modulo: "anti_abuso" },
    // SPEC-180: la página Monitoreo worker se retiró del menú (redundante con el
    // tablero operativo de SPEC-171, que cubre worker + BD + 4 señales más).
    // La ruta redirige a /dashboard/admin/estadisticas/operacion.
    { href: "/dashboard/admin/dataset-entrenamiento", label: "Dataset", modulo: "dataset_entrenamiento" },
    { href: "/dashboard/admin/configuracion", label: "Configuración", modulo: "configuracion_sistema" },
];

export const COMITE_NAV_TABS: NavItem[] = [
    { href: "/dashboard/admin/comite", label: "Bandeja", modulo: "comite_bandeja" },
    { href: "/dashboard/admin/comite/apelaciones", label: "Apelaciones", modulo: "comite_bandeja" },
    { href: "/dashboard/admin/comite/gestion", label: "Gestión", modulo: "comite" },
    { href: "/dashboard/admin/comite/auditoria", label: "Auditoría", modulo: "comite_auditoria" },
];

// SPEC-173 (FASE-C): menú del rector — 8 entradas; "Usuarios" es un nodo padre
// expandible (href "#", no navegable) con Profesores e Integrantes del comité.
// Retirados: Onboarding, Materias y Subir lista (quedan accesibles por flujo, no por menú).
export const COLEGIO_NAV_ITEMS: NavItem[] = [
    { href: "/dashboard/colegio", label: "Inicio", modulo: "colegios" },
    { href: "/dashboard/colegio/estadisticas", label: "Estadísticas", modulo: "colegios_gestion" },
    { href: "/dashboard/colegio/alertas", label: "Alertas", modulo: "colegios_gestion" },
    { href: "/dashboard/colegio/cursos", label: "Cursos", modulo: "colegios_gestion" },
    { href: "/dashboard/colegio/comite/casos", label: "Casos comité", modulo: "colegios_comite_bandeja" },
    {
        href: "#",
        label: "Usuarios",
        modulo: "colegios_gestion",
        children: [
            { href: "/dashboard/colegio/profesores", label: "Profesores", modulo: "colegios_gestion" },
            { href: "/dashboard/colegio/comite/integrantes", label: "Comité de convivencia", modulo: "colegios_comite" },
        ],
    },
    { href: "/dashboard/colegio/configuracion", label: "Configuración", modulo: "colegios_gestion" },
    { href: "/dashboard/colegio/auditoria", label: "Auditoría", modulo: "colegios_auditoria" },
];

// SPEC-173 (FASE-C): menú reducido del rol COMITE_CONVIVENCIA (solo su bandeja).
export const COMITE_COLEGIO_NAV_ITEMS: NavItem[] = [
    { href: "/dashboard/colegio/comite", label: "Inicio", modulo: "colegios_comite_bandeja" },
    { href: "/dashboard/colegio/comite/estadisticas", label: "Estadísticas", modulo: "colegios_comite_bandeja" },
    { href: "/dashboard/colegio/comite/casos", label: "Gestión casos", modulo: "colegios_comite_bandeja" },
];

/** Tabs del Centro de Control IA filtradas por submódulo (null = visible con la raíz). */
export const IA_TABS: Array<{ key: string; label: string; modulo: string | null }> = [
    { key: "documentacion", label: "Documentación", modulo: null },
    { key: "playground", label: "Playground", modulo: "ia_playground" },
    { key: "rubrica", label: "Rúbrica", modulo: "ia_rubrica" },
    { key: "simulacion", label: "Simulación", modulo: "ia_simulaciones" },
    { key: "configuracion", label: "Configuración", modulo: "ia_configuracion" },
];
