/**
 * Ítems de navegación mapeados a módulos permisibles (spec 086).
 * Cada ítem de menú = un módulo del catálogo (`src/lib/permisos-catalogo.ts`).
 * El test estructural (`nav-items.test.ts`) garantiza que no haya desfases.
 */
export interface NavItem {
    href: string;
    label: string;
    // SPEC-857: opcional porque los ENCABEZADOS de sección (`encabezado: true`) no cuelgan de
    // un módulo —son separadores visuales, no destinos gateables—. Toda HOJA o GRUPO real
    // sigue llevando `modulo` (el test estructural `nav-items.test.ts` lo exige para los no-encabezado).
    modulo?: string;
    /** Hijos para nodos expandibles (p. ej. "Usuarios" del menú del colegio). */
    children?: NavItem[];
    // SPEC-744 (contrato con Dev 1): clave de ícono y rótulo corto viven en la DATA (fuente
    // única), no en un mapa dentro de cada superficie. `iconKey` alimenta un registro cliente
    // key→componente (una sola fuente de íconos); si falta, el resolver usa `href`. `labelCorto`
    // es para la barra móvil (1 palabra); si falta, se usa `label`.
    iconKey?: string;
    labelCorto?: string;
    // SPEC-857: encabezado de sección NO navegable ni gateable (separador visual del menú de 2
    // niveles). No tiene `modulo` ni hijos; el resolver lo deja pasar sólo si su sección tiene
    // al menos un ítem visible (encabezado huérfano = menú honesto) y la barra móvil lo omite.
    encabezado?: boolean;
}

// SPEC-857 (Diseño ec4910a · v2.2, aprob. Jelkin): el menú del admin se reorganiza en MÓDULOS
// de 2 niveles — grupos colapsables (href "#" + iconKey, como «Usuarios» del colegio) y dos
// ENCABEZADOS de sección no navegables. Reglas que sostienen el candado de menú honesto (SPEC-086):
//   · cada HOJA conserva SU módulo real —el que la PÁGINA gatea en servidor (verificado página por
//     página)— para que el ítem aparezca EXACTAMENTE cuando la página deja entrar. No hay pantallas
//     inventadas (I-299): las 48 rutas existen.
//   · un GRUPO pinta si el admin tiene permiso en ≥1 hijo (lo decide el resolver por HIJOS, no por el
//     módulo del grupo). El `modulo` del grupo es REPRESENTATIVO (primer hijo) —sólo para que el test
//     estructural lo valide contra el catálogo—, NO una compuerta.
//   · los íconos: la clave semántica sube al GRUPO (zero íconos nuevos); los hijos van sin ícono
//     (texto), igual que el patrón «Usuarios» del colegio.
// Los 3 drops (decisión CEO sobre choques): Pagos «Resumen»/«Analítica» y Estadísticas «Clasificación»
// NO entran (label que miente / vista duplicada / tab de Operación). Conteos: Pagos = 9, Estadísticas = 4.
/**
 * SPEC-857: aplana un árbol de NavItem a sus HOJAS reales — desciende a los hijos de cada grupo
 * (href "#") y DESCARTA los encabezados de sección. Las hojas conservan su `modulo`. Lo usan las
 * superficies/generadores que necesitan destinos navegables (no el contenedor "#"): el redirect de
 * `/dashboard/admin` al primer módulo accesible y las fuentes del arch (roles-capacidades, aserción
 * «el menú no miente»).
 */
export function aplanarNavItems(items: NavItem[]): NavItem[] {
    return items.flatMap((it) =>
        it.encabezado ? [] : it.children && it.children.length > 0 ? aplanarNavItems(it.children) : [it],
    );
}

export const ADMIN_NAV_ITEMS: NavItem[] = [
    // SPEC-378: Inicio del administrador — alarma de la casa (primero del nav).
    // Cuando el admin lo tiene, `/dashboard/admin` (raíz) redirige acá.
    { href: "/dashboard/admin/inicio", label: "Inicio", modulo: "inicio_admin" },
    {
        href: "#",
        label: "Reportes",
        iconKey: "reportes", // sube ReportarIcon al grupo (hijos sin ícono)
        modulo: "bandeja_reportes", // representativo (primer hijo); la compuerta es por hijos
        children: [
            // SPEC-404 (I-290): URL propia para la bandeja.
            { href: "/dashboard/admin/bandeja", label: "Bandeja de reportes", labelCorto: "Bandeja", modulo: "bandeja_reportes" },
            { href: "/dashboard/admin/spam", label: "Revisión de spam", modulo: "revision_spam" },
            { href: "/dashboard/admin/anti-abuso", label: "Anti-abuso", modulo: "anti_abuso" },
        ],
    },
    {
        href: "#",
        label: "Comité de Convivencia",
        iconKey: "comite-convivencia",
        modulo: "comite_bandeja",
        children: [
            // SPEC-858: `labelCorto` SOLO para la barra móvil. Al promover este hijo a principal
            // (PRINCIPALES_MOVIL.ADMIN), sin labelCorto mostraba «Bandeja» y colisionaba con la hoja
            // «Bandeja de reportes» (Reportes→Bandeja). En móvil representa al grupo → «Comité». El
            // escritorio sigue mostrando «Bandeja» (usa `label` dentro del grupo «Comité de Convivencia»).
            { href: "/dashboard/admin/comite", label: "Bandeja", labelCorto: "Comité", modulo: "comite_bandeja" },
            { href: "/dashboard/admin/comite/apelaciones", label: "Apelaciones", modulo: "comite_bandeja" },
            // SPEC-235: aprobación de guías de acción por el comité. «Guías por aprobar» desambigua
            // de «Guías de acción» (Configuración), que es la parametrización (artefacto §3).
            { href: "/dashboard/admin/comite/guias-pendientes", label: "Guías por aprobar", modulo: "comite_guias_accion" },
            { href: "/dashboard/admin/comite/gestion", label: "Gestión", modulo: "comite" },
            // SPEC-496: `comite_auditoria` es solo-ADMIN a propósito (separación de funciones).
            { href: "/dashboard/admin/comite/auditoria", label: "Auditoría", modulo: "comite_auditoria" },
        ],
    },
    // ── Sección: el flujo de citas y la red de profesionales ──────────────────────────────
    { href: "#", label: "Citas y profesionales", encabezado: true },
    // SPEC-750/T014: la cola de sesiones del operador.
    { href: "/dashboard/admin/sesiones", label: "Sesiones", labelCorto: "Sesiones", modulo: "sesiones_operador" },
    {
        href: "#",
        label: "Operadores",
        iconKey: "operadores-grupo",
        modulo: "operadores",
        children: [
            { href: "/dashboard/admin/operadores/asignar", label: "Asignar", modulo: "operadores" },
            // La auditoría de operadores la gatea `audit_logs` en servidor (no `operadores`): la hoja
            // lleva SU módulo real (menú honesto). Por eso `audit_logs` sale de SIN_PANTALLA_PROPIA.
            { href: "/dashboard/admin/operadores/auditoria", label: "Auditoría", modulo: "audit_logs" },
            { href: "/dashboard/admin/operadores/gestion", label: "Gestión", modulo: "operadores" },
            { href: "/dashboard/admin/operadores/modelo", label: "Modelo", modulo: "operadores" },
        ],
    },
    // SPEC-832 (T7 de 790): la cola de reubicación de citas. Módulo `operadores` (el que gatea la página).
    { href: "/dashboard/admin/reubicaciones", label: "Reubicaciones", modulo: "operadores" },
    // SPEC-421 (A-75): gestión de cuentas de profesionales (externo, no interno).
    { href: "/dashboard/admin/profesionales/gestion", label: "Profesionales", modulo: "profesionales_admin" },
    // SPEC-435: cuentas VERIFICADOR (molde del operador, sin colegio ni vigencia).
    { href: "/dashboard/admin/verificadores", label: "Verificadores", modulo: "verificadores_admin" },
    {
        // SPEC-408 (A-75 · brief §9): las colas del Verificador — todas gateadas por el mismo
        // módulo `admin_verificacion_profesionales`, así que el grupo las pinta juntas.
        // SPEC-858 (Diseño, decisión CEO): el MÓDULO «Verificación» va ÚLTIMO de la sección «Citas
        // y profesionales», pegado a «Verificadores» (reordenado tras Profesionales/Verificadores).
        href: "#",
        label: "Verificación",
        iconKey: "verificacion-grupo",
        modulo: "admin_verificacion_profesionales",
        children: [
            { href: "/dashboard/admin/verificacion", label: "Solicitudes", modulo: "admin_verificacion_profesionales" },
            { href: "/dashboard/admin/verificacion/incidentes", label: "Incidentes de citas", modulo: "admin_verificacion_profesionales" },
            { href: "/dashboard/admin/verificacion/reportes-no-coinciden", label: "Reportes que no coinciden", modulo: "admin_verificacion_profesionales" },
        ],
    },
    {
        href: "#",
        label: "Motor IA",
        iconKey: "motor-ia",
        modulo: "centro_control_ia",
        children: [
            { href: "/dashboard/admin/ia", label: "Centro de Control IA", modulo: "centro_control_ia" },
            // SPEC-224: panel de reglas configurables del motor (solo ADMIN).
            { href: "/dashboard/admin/analisis/reglas", label: "Reglas", modulo: "analisis_admin" },
            // SPEC-227: historial de sugerencias del motor de reglas (solo ADMIN).
            { href: "/dashboard/admin/analisis/recomendaciones", label: "Sugerencias", modulo: "analisis_recomendaciones" },
            { href: "/dashboard/admin/dataset-entrenamiento", label: "Dataset", modulo: "dataset_entrenamiento" },
        ],
    },
    {
        // SPEC-212 (002-PI-112): el módulo de pagos va en ámbar (acción de dinero) en NavLateral.
        // Los 3 choques CEO: «Resumen» NO (no mapear a /pendientes: label que miente); «Analítica» NO
        // (misma vista que Estadísticas «Dinero vs valor»; sin href propio). 9 hojas, todas `pagos_admin`.
        href: "#",
        label: "Pagos",
        iconKey: "pagos-grupo",
        modulo: "pagos_admin",
        children: [
            { href: "/dashboard/admin/pagos/pendientes", label: "Pendientes", modulo: "pagos_admin" },
            { href: "/dashboard/admin/pagos/mora", label: "Mora", modulo: "pagos_admin" },
            { href: "/dashboard/admin/pagos/reembolsos", label: "Reembolsos", modulo: "pagos_admin" },
            { href: "/dashboard/admin/pagos/bonos", label: "Bonos", modulo: "pagos_admin" },
            { href: "/dashboard/admin/pagos/planes", label: "Planes", modulo: "pagos_admin" },
            { href: "/dashboard/admin/pagos/vencimientos", label: "Vencimientos", modulo: "pagos_admin" },
            { href: "/dashboard/admin/pagos/sin-suscripcion", label: "Sin suscripción", modulo: "pagos_admin" },
            { href: "/dashboard/admin/pagos/citas-por-aprobar", label: "Citas por aprobar", modulo: "pagos_admin" },
            { href: "/dashboard/admin/pagos/citas-vencidas", label: "Citas vencidas", modulo: "pagos_admin" },
        ],
    },
    // ── Sección: el directorio de cuentas y entidades ─────────────────────────────────────
    { href: "#", label: "Directorio", encabezado: true },
    {
        href: "#",
        label: "Usuarios",
        iconKey: "usuarios", // clave ya registrada en ICONOS_NAV (UsuariosIcon)
        modulo: "usuarios_admin",
        children: [
            { href: "/dashboard/admin/usuarios", label: "Todas las cuentas", modulo: "usuarios_admin" },
            { href: "/dashboard/admin/usuarios/admins", label: "Administradores", modulo: "usuarios_admin" },
            // «Cuentas de operador» desambigua del MÓDULO «Operadores» (gestión del flujo), artefacto §3.
            { href: "/dashboard/admin/usuarios/operadores", label: "Cuentas de operador", modulo: "usuarios_admin" },
            { href: "/dashboard/admin/usuarios/rectores", label: "Rectores", modulo: "usuarios_admin" },
            { href: "/dashboard/admin/usuarios/comite-convivencia", label: "Cuentas del comité de convivencia", modulo: "usuarios_admin" },
            { href: "/dashboard/admin/usuarios/comite-validacion", label: "Cuentas del comité de validación", modulo: "usuarios_admin" },
        ],
    },
    { href: "/dashboard/admin/padres", label: "Padres", modulo: "padres" },
    { href: "/dashboard/admin/colegios", label: "Colegios", modulo: "colegios_gestion" },
    {
        // SPEC-744 (aprob. Jelkin): «Estadísticas» —no «Dashboard» (techie)—. 4 hojas (choque CEO:
        // «Clasificación» NO, es un tab-query de Operación). «Dinero vs valor» la gatea `pagos_admin`.
        href: "#",
        label: "Estadísticas",
        iconKey: "estadisticas-grupo",
        modulo: "estadisticas",
        children: [
            { href: "/dashboard/admin/estadisticas/dinero-vs-valor", label: "Dinero vs valor", modulo: "pagos_admin" },
            { href: "/dashboard/admin/estadisticas/motor", label: "Motor", modulo: "estadisticas" },
            // SPEC-858: `labelCorto` SOLO para la barra móvil. Es el principal «Estadísticas»
            // (PRINCIPALES_MOVIL.ADMIN → /operacion); en móvil muestra «Cifras» (el rótulo corto
            // histórico de Estadísticas), no «Operación». El escritorio sigue mostrando «Operación».
            { href: "/dashboard/admin/estadisticas/operacion", label: "Operación", labelCorto: "Cifras", modulo: "estadisticas" },
            // Su página la gatea `estadisticas_salud_motor` (sale de SIN_PANTALLA_PROPIA: ya es hoja).
            { href: "/dashboard/admin/estadisticas/salud-motor", label: "Salud del motor", modulo: "estadisticas_salud_motor" },
        ],
    },
    // SPEC-824: bandeja de peticiones de soporte (PQR + habeas data).
    { href: "/dashboard/admin/soporte/peticiones", label: "Soporte", labelCorto: "Soporte", modulo: "soporte_peticiones" },
    {
        href: "#",
        label: "Configuración",
        iconKey: "configuracion-grupo",
        modulo: "configuracion_sistema",
        children: [
            { href: "/dashboard/admin/configuracion", label: "General", modulo: "configuracion_sistema" },
            // «Guías de acción» = la parametrización (distinta de «Guías por aprobar» del Comité, §3).
            { href: "/dashboard/admin/configuracion/guias-accion", label: "Guías de acción", modulo: "guias_accion_admin" },
        ],
    },
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
    { href: "/dashboard/colegio/estadisticas", label: "Estadísticas", labelCorto: "Cifras", modulo: "colegios_gestion" },
    { href: "/dashboard/colegio/alertas", label: "Alertas", modulo: "colegios_gestion" },
    { href: "/dashboard/colegio/cursos", label: "Cursos", modulo: "colegios_gestion" },
    { href: "/dashboard/colegio/comite/casos", label: "Casos comité", labelCorto: "Casos", modulo: "colegios_comite_bandeja" },
    {
        href: "#",
        label: "Usuarios",
        // SPEC-744: los grupos (href "#") colisionan en la clave de ícono; iconKey semántica
        // para que la barra lateral (IconoNav de Dev-1) pinte su ícono distinto.
        iconKey: "usuarios",
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
    { href: "/dashboard/colegio/comite/casos", label: "Gestión de casos", labelCorto: "Casos", modulo: "colegios_comite_bandeja" },
];

// SPEC-231 (002-PI-131): menú del padre.
// SPEC-285 (002-PI-185, I-135): sin campo `modulo` — el área padre no usa permisos
// granulares por módulo; el proxy controla el acceso por rol (`padre` fue retirado
// del catálogo por 0 usos como candado real).
export interface PadreNavItem {
    href: string;
    label: string;
    /** Hijos para nodos expandibles (SPEC-607: «Reportar» y «Ayuda profesional»). */
    children?: PadreNavItem[];
    // SPEC-744 (ver NavItem): clave de ícono y rótulo corto como DATA de la fuente única.
    iconKey?: string;
    labelCorto?: string;
}
// SPEC-607 (diseño final aprobado · design/expediente-final-mockup.html): menú
// definitivo del padre — 6 entradas, dos con submódulos colapsables (chevron en
// escritorio; la barra móvil aplana los hijos para acceso directo, I-38).
// SPEC-824: +1 entrada «Soporte» (la Puerta de Soporte) — 7 en total. Etiqueta pendiente de Diseño.
//
// Salen del menú (las rutas SIGUEN existiendo):
//  - «Mis reportes» (/mis-reportes): el expediente es el módulo único; el listado
//    plano queda accesible por URL y desde enlaces internos.
//  - «Suscripción» y «Notificaciones» como ítems sueltos: viven dentro de
//    «Mi perfil» (/dashboard/padre/perfil, acordeones); sus rutas viejas
//    redirigen con ancla para no romper enlaces.
export const PADRE_NAV_ITEMS: PadreNavItem[] = [
    { href: "/dashboard/padre", label: "Inicio" },
    { href: "/dashboard/padre/hijos", label: "A quién protejo", labelCorto: "Protejo" }, // SPEC-325
    { href: "/dashboard/padre/circulo-confianza", label: "A quién vigilo" }, // SPEC-325 (antes "Círculo confianza")
    {
        // Nodo expandible (href "#", no navegable — patrón "Usuarios" del colegio).
        // «Reportar» queda también como primer hijo: un clic para la acción crítica.
        href: "#",
        label: "Reportar",
        iconKey: "reportar-grupo", // SPEC-744: ícono distinto del grupo (ver «Usuarios»)
        children: [
            { href: "/dashboard/padre/reportar", label: "Reportar" },
            { href: "/dashboard/padre/expedientes", label: "Mis expedientes" },
        ],
    },
    {
        // SPEC-392 (L3 · brief A-75): el directorio de psicólogos verificados es
        // la entrada; SPEC-545: las citas son el seguimiento — mismo grupo.
        href: "#",
        label: "Ayuda profesional",
        iconKey: "ayuda-profesional", // SPEC-744: ícono distinto del grupo (ver «Usuarios»)
        children: [
            { href: "/dashboard/padre/profesionales", label: "Encontrar psicólogo", labelCorto: "Psicólogos" },
            { href: "/dashboard/padre/citas", label: "Mis citas" },
        ],
    },
    // SPEC-607: ítem ÚNICO de cuenta — una sola página con tres acordeones
    // (Información general · Notificaciones · Suscripción).
    { href: "/dashboard/padre/perfil", label: "Mi perfil" },
    // SPEC-824: la Puerta de Soporte (PQR + «Mis datos personales»). Entra en el menú con la bandeja del
    // operador en el MISMO deploy (una puerta que nadie encuentra es el mismo defecto que no tener puerta).
    // Etiqueta de Diseño: «Pedir ayuda» — verbo paraguas; la especificidad la da el selector de 819. NO
    // «Soporte» (jerga) ni «Mis solicitudes» (prometería una lista de estado que no existe — eso es SPEC-823).
    { href: "/dashboard/padre/soporte", label: "Pedir ayuda" },
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
    // SPEC-732: «Citaciones» se unificó en «Calendario» (un solo ítem, una sola pantalla:
    // publicar franjas + responder solicitudes). La ruta vieja redirige (no 404).
    { href: "/dashboard/profesional/casos", label: "Casos", modulo: "profesional_casos" },
    // SPEC-437 · T013: «Calendario» entra al menú ahora que SPEC-447 (#353)
    // construyó y desplegó `/dashboard/profesional/calendario`. Antes su ítem
    // habría llevado a una pantalla inexistente (candado I-299); hoy existe.
    { href: "/dashboard/profesional/calendario", label: "Calendario", modulo: "profesional_calendario" },
    { href: "/perfil-profesional/completar", label: "Mi ficha", modulo: "profesional_ficha" },
    // SPEC-685 (PR2-bis): «Mi perfil» del habilitado — reúne datos, tarifa, documentos
    // y estado. Mismo módulo que la ficha (`profesional_ficha`).
    { href: "/dashboard/profesional/mi-perfil", label: "Mi perfil", modulo: "profesional_ficha" },
    // SPEC-706: «Verificación» (/perfil-profesional/verificacion) se retiró — el estado del no
    // habilitado es ahora el encabezado de la ficha («Mi ficha»). No hay ítem de menú separado.
];

// SPEC-743/744: la superficie ANÓNIMA (deslogueado) también sale de la fuente única.
// La consulta pública —estadísticas agregadas, sin login— es navegación de primera
// clase del anónimo; quemarla en una superficie fue la regresión 742→743. Vive acá
// para que `navParaRol(null)` la sirva y el candado la cubra como a cualquier rol.
// Sin `modulo`: no hay permisos para el anónimo, el proxy la deja pública.
export const ANONIMO_NAV_ITEMS: PadreNavItem[] = [
    { href: "/dashboard-publico", label: "Estadísticas públicas" },
];

/**
 * SPEC-744 (Diseño b389037 §3, aprob. Jelkin) · los ≤4 destinos PRINCIPALES de la barra
 * móvil por rol, en ORDEN. Es DATA en la fuente única —no una lista a mano dentro de la
 * barra (eso movería el pecado del NavHeader a la barra)—: `navMovilParaRol` la intersecta
 * con la nav gateada del rol y arma {principales, resto}. El resto va al «Más».
 *
 * OJO: NO es «los primeros 4 de la lista». El admin, p. ej., SALTA «Revisión de spam» (que
 * va 3º en ADMIN_NAV_ITEMS) y sube «Estadísticas» — es un subconjunto CURADO por Jelkin. Por
 * eso son hrefs EXPLÍCITOS y en su propio orden. Padre PROMUEVE hojas de grupos (Reportar y
 * Psicólogos, no el «#»). Los roles sin entrada acá (OPERADOR/COMITE_VALIDACION) caen al
 * default: los primeros ≤4 de su nav gateada (para ellos el orden de la lista SÍ es la
 * prioridad, FORMA §3). Es VISIBILIDAD; la nav va gateada por módulo/estado igual.
 */
export const PRINCIPALES_MOVIL: Record<string, string[]> = {
    PARENT: [
        "/dashboard/padre", // Inicio
        "/dashboard/padre/hijos", // A quién protejo
        "/dashboard/padre/reportar", // Reportar (hoja del grupo)
        "/dashboard/padre/profesionales", // Psicólogos (hoja de «Ayuda profesional»)
    ],
    PROFESIONAL: [
        "/dashboard/profesional", // Inicio
        "/dashboard/profesional/casos", // Casos
        "/dashboard/profesional/calendario", // Calendario
        "/dashboard/profesional/mi-perfil", // Mi perfil
    ],
    SCHOOL_ADMIN: [
        "/dashboard/colegio", // Inicio
        "/dashboard/colegio/alertas", // Alertas
        "/dashboard/colegio/comite/casos", // Casos del comité
        "/dashboard/colegio/estadisticas", // Estadísticas
    ],
    ADMIN: [
        "/dashboard/admin/inicio", // Inicio
        "/dashboard/admin/bandeja", // «Bandeja de reportes» (hoja del módulo «Reportes»)
        "/dashboard/admin/comite", // «Bandeja» del módulo «Comité de Convivencia»
        // SPEC-857: la raíz /dashboard/admin/estadisticas dejó de ser destino del menú (Estadísticas
        // pasó a MÓDULO de 4 hojas). El principal móvil «Estadísticas» apunta a su aterrizaje operativo
        // /operacion —mismo gate `estadisticas` que la vieja hoja; SPEC-180 ya redirige ahí—. Default
        // CONFESADO a CEO PI (el radicado pedía este set intacto, pero el drop de la raíz lo invalidó):
        // alternativas = bajar a 3 principales, o apuntar a otra hoja de Estadísticas.
        "/dashboard/admin/estadisticas/operacion",
    ],
    COMITE_CONVIVENCIA: [
        "/dashboard/colegio/comite", // Inicio
        "/dashboard/colegio/comite/estadisticas", // Estadísticas
        "/dashboard/colegio/comite/casos", // Gestión de casos
    ],
};

/** Tabs del Centro de Control IA filtradas por submódulo (null = visible con la raíz). */
export const IA_TABS: Array<{ key: string; label: string; modulo: string | null }> = [
    { key: "documentacion", label: "Documentación", modulo: null },
    { key: "playground", label: "Playground", modulo: "ia_playground" },
    { key: "rubrica", label: "Rúbrica", modulo: "ia_rubrica" },
    { key: "simulacion", label: "Simulación", modulo: "ia_simulaciones" },
    { key: "configuracion", label: "Configuración", modulo: "ia_configuracion" },
];
