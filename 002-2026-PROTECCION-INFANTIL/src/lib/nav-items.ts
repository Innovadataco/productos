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
    // SPEC-378: Inicio del administrador — alarma de la casa (primero del nav).
    // Cuando el admin lo tiene, `/dashboard/admin` (raíz) redirige acá.
    { href: "/dashboard/admin/inicio", label: "Inicio", modulo: "inicio_admin" },
    // SPEC-404 (I-290): URL propia para la bandeja. `/dashboard/admin` quedó
    // como aterrizaje que redirige a Inicio o Bandeja según módulo.
    { href: "/dashboard/admin/bandeja", label: "Bandeja de reportes", modulo: "bandeja_reportes" },
    { href: "/dashboard/admin/spam", label: "Revisión de spam", modulo: "revision_spam" },
    { href: "/dashboard/admin/comite", label: "Comité", modulo: "comite_bandeja" },
    { href: "/dashboard/admin/estadisticas", label: "Dashboard", modulo: "estadisticas" },
    { href: "/dashboard/admin/ia", label: "Centro de Control IA", modulo: "centro_control_ia" },
    { href: "/dashboard/admin/operadores", label: "Operadores", modulo: "operadores" },
    // SPEC-435 (Jelkin vivo 04-09): cuentas VERIFICADOR con su user y pass —
    // molde exacto del operador, sin colegio ni vigencia.
    { href: "/dashboard/admin/verificadores", label: "Verificadores", modulo: "verificadores_admin" },
    { href: "/dashboard/admin/usuarios", label: "Usuarios", modulo: "usuarios_admin" },
    { href: "/dashboard/admin/padres", label: "Padres", modulo: "padres" },
    // SPEC-421 (A-75): gestión de cuentas de profesionales (mismo perfil que
    // padres: externo, no interno). Sin crear (padre y psicólogo se registran
    // solos) — el admin restablece contraseña y reenvía enlace de registro.
    { href: "/dashboard/admin/profesionales/gestion", label: "Profesionales", modulo: "profesionales_admin" },
    // SPEC-212 (002-PI-112): panel administrativo de pagos (color ámbar en AdminNav).
    { href: "/dashboard/admin/pagos", label: "Pagos", modulo: "pagos_admin" },
    { href: "/dashboard/admin/colegios", label: "Colegios", modulo: "colegios_gestion" },
    // SPEC-227 (002-PI-128): historial de sugerencias del motor de reglas (solo ADMIN).
    { href: "/dashboard/admin/analisis/recomendaciones", label: "Sugerencias", modulo: "analisis_recomendaciones" },
    // SPEC-224 (002-PI-125): panel de reglas configurables del motor (solo ADMIN).
    { href: "/dashboard/admin/analisis/reglas", label: "Análisis · Reglas", modulo: "analisis_admin" },
    { href: "/dashboard/admin/anti-abuso", label: "Anti-abuso", modulo: "anti_abuso" },
    // SPEC-180: la página Monitoreo worker se retiró del menú (redundante con el
    // tablero operativo de SPEC-171, que cubre worker + BD + 4 señales más).
    // La ruta redirige a /dashboard/admin/estadisticas/operacion.
    { href: "/dashboard/admin/dataset-entrenamiento", label: "Dataset", modulo: "dataset_entrenamiento" },
    { href: "/dashboard/admin/configuracion", label: "Configuración", modulo: "configuracion_sistema" },
    // SPEC-408 (A-75 · brief §9): dos colas del Verificador — solicitudes por
    // revisar (raíz) e incidentes de citas. Ambas están gateadas por el mismo
    // módulo `admin_verificacion_profesionales`, así que el nav las pinta juntas.
    { href: "/dashboard/admin/verificacion", label: "Verificación", modulo: "admin_verificacion_profesionales" },
    { href: "/dashboard/admin/verificacion/incidentes", label: "Incidentes de citas", modulo: "admin_verificacion_profesionales" },
];

export const COMITE_NAV_TABS: NavItem[] = [
    { href: "/dashboard/admin/comite", label: "Bandeja", modulo: "comite_bandeja" },
    { href: "/dashboard/admin/comite/apelaciones", label: "Apelaciones", modulo: "comite_bandeja" },
    { href: "/dashboard/admin/comite/gestion", label: "Gestión", modulo: "comite" },
    // SPEC-235 (002-PI-135): aprobación de guías de acción por el comité.
    { href: "/dashboard/admin/comite/guias-pendientes", label: "Guías", modulo: "comite_guias_accion" },
    // SPEC-496 (decisión CEO): `comite_auditoria` es solo-ADMIN A PROPÓSITO —
    // NO es un olvido. Separación de funciones: el comité VALIDA clasificaciones
    // y quien valida no audita su propia validación (dárselo lo volvería
    // autocontrol). El tab se filtra para COMITE_VALIDACION (ComiteSubNav, D-41)
    // y la página degrada a `SinAccesoModulo`. No agregar `comite_auditoria` a
    // COMITE_VALIDACION en `CLAVES_POR_ROL` creyendo que es un hueco.
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
    // SPEC-211 (002-PI-111): vista de suscripción del rector (módulo Pagos).
    { href: "/dashboard/colegio/suscripcion", label: "Suscripción", modulo: "colegios" },
];

// SPEC-173 (FASE-C): menú reducido del rol COMITE_CONVIVENCIA (solo su bandeja).
export const COMITE_COLEGIO_NAV_ITEMS: NavItem[] = [
    { href: "/dashboard/colegio/comite", label: "Inicio", modulo: "colegios_comite_bandeja" },
    { href: "/dashboard/colegio/comite/estadisticas", label: "Estadísticas", modulo: "colegios_comite_bandeja" },
    { href: "/dashboard/colegio/comite/casos", label: "Gestión de casos", modulo: "colegios_comite_bandeja" },
];

// SPEC-231 (002-PI-131): menú del padre — 7 entradas planas, sin grupos expandibles.
// SPEC-285 (002-PI-185, I-135): sin campo `modulo` — el área padre no usa permisos
// granulares por módulo; el proxy controla el acceso por rol (`padre` fue retirado
// del catálogo por 0 usos como candado real).
export interface PadreNavItem {
    href: string;
    label: string;
}
export const PADRE_NAV_ITEMS: PadreNavItem[] = [
    { href: "/dashboard/padre", label: "Inicio" },
    { href: "/dashboard/padre/expedientes", label: "Mis expedientes" },
    // SPEC-324: acceso directo al listado de reportes individuales del padre.
    // Ruta top-level (fuera del shell /dashboard/padre) reutilizada, no hay página nueva.
    { href: "/mis-reportes", label: "Mis reportes" },
    { href: "/dashboard/padre/reportar", label: "Reportar" },
    // SPEC-392 (L3 · brief A-75): el directorio de psicólogos verificados. Va
    // arriba de "Suscripción" porque es el frente nuevo y el que arma la red;
    // exento del guardián de vigencia (padre sin suscripción también lo ve).
    { href: "/dashboard/padre/profesionales", label: "Encontrar psicólogo" },
    { href: "/dashboard/padre/suscripcion", label: "Suscripción" },
    { href: "/dashboard/padre/hijos", label: "A quién protejo" }, // SPEC-325
    { href: "/dashboard/padre/circulo-confianza", label: "A quién vigilo" }, // SPEC-325 (antes "Círculo confianza")
    { href: "/dashboard/padre/notificaciones", label: "Notificaciones" },
    // SPEC-440 P4 (Jelkin vivo 04-09) · «el perfil del padre no deja editar sus datos».
    // La pantalla existe desde SPEC-334 (formulario completo con los campos del brief
    // A-67 §59: nombres, apellidos, tipo/número documento, teléfono, país, ciudad) pero
    // SPEC-317 la había retirado del menú por hueco temporal. Se reincorpora acá.
    { href: "/dashboard/padre/perfil", label: "Mi perfil" },
];

/**
 * SPEC-424 (I-299) · Lista de navegación del profesional.
 *
 * Antes de este SPEC el rol PROFESIONAL heredaba `PADRE_NAV_ITEMS` porque
 * `esEmpleado` en `NavHeader` no lo cubría — Jelkin veía "Mi panel", "Círculo
 * de Confianza" y "Mis reportes" que son del padre. La pantalla de reportes
 * fallaba con «No pudimos cargar tus reportes» porque `/api/reportes/*`
 * responde vacío para un usuario sin reportes propios.
 *
 * SPEC-425 (Dev 02 · panel L5) trajo `/dashboard/profesional`: entra como
 * primer ítem del menú. Verificación y Mi ficha se quedan como accesos
 * directos hasta que el panel absorba esas dos superficies.
 */
/**
 * SPEC-437 (A-75) · el menú del profesional, con su módulo por ítem.
 *
 * Antes de esta spec era un `PadreNavItem[]` **sin un solo consumidor**:
 * `NavHeader` tenía los dos enlaces quemados aparte y ni siquiera coincidían
 * con esta lista (acá había un «Panel» que el encabezado nunca pintó). Ahora es
 * la fuente ÚNICA de la barra lateral y del desplegable, para que los dos
 * menús no puedan volver a divergir.
 *
 * Cada ítem cuelga de un módulo concedible, igual que los del operador: se
 * conceden y revocan desde el panel de permisos (`CATALOGO_MODULOS`).
 *
 * **Candado del radicado (I-299): acá NO se lista una pantalla que no exista.**
 * «Calendario» (`/dashboard/profesional/calendario`) entra cuando SPEC-447 la
 * construya; su módulo ya está sembrado, que es otra cosa. Un ítem que lleva a
 * una pantalla muerta es la promesa rota que I-299 vino a cerrar.
 */
export const PROFESIONAL_NAV_ITEMS: NavItem[] = [
    { href: "/dashboard/profesional", label: "Inicio", modulo: "profesional_inicio" },
    { href: "/dashboard/profesional/citaciones", label: "Citaciones", modulo: "profesional_citaciones" },
    { href: "/dashboard/profesional/casos", label: "Casos", modulo: "profesional_casos" },
    // SPEC-437 · T013: «Calendario» entra al menú ahora que SPEC-447 (#353)
    // construyó y desplegó `/dashboard/profesional/calendario`. Antes su ítem
    // habría llevado a una pantalla inexistente (candado I-299); hoy existe.
    { href: "/dashboard/profesional/calendario", label: "Calendario", modulo: "profesional_calendario" },
    { href: "/perfil-profesional/completar", label: "Mi ficha", modulo: "profesional_ficha" },
    { href: "/perfil-profesional/verificacion", label: "Verificación", modulo: "profesional_verificacion" },
];

/** Tabs del Centro de Control IA filtradas por submódulo (null = visible con la raíz). */
export const IA_TABS: Array<{ key: string; label: string; modulo: string | null }> = [
    { key: "documentacion", label: "Documentación", modulo: null },
    { key: "playground", label: "Playground", modulo: "ia_playground" },
    { key: "rubrica", label: "Rúbrica", modulo: "ia_rubrica" },
    { key: "simulacion", label: "Simulación", modulo: "ia_simulaciones" },
    { key: "configuracion", label: "Configuración", modulo: "ia_configuracion" },
];
