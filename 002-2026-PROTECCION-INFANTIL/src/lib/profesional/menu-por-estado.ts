/**
 * SPEC-691 · El menú del profesional según su estado — «la compuerta».
 *
 * Jelkin (paso 6): antes de verificar «no se le debe permitir nada más: ni
 * disponibilidades, ni casos, ni tarifa. Solo [perfil y documentos].» Hoy el menú
 * del profesional se pinta por MÓDULO igual para todos; un recién registrado —sin
 * que nadie revise su tarjeta— llega a los flujos de casos de menores. Es de
 * SEGURIDAD, no de estética (MAPA §0). SPEC-690 cierra la API; esto cierra el menú
 * para que no queden entradas que existen y no hacen nada (I-411 otra vez).
 *
 * Se condiciona a `habilitado` que sirve `GET /api/me` (SPEC-690), NO a `estado`
 * crudo ni al catálogo de módulos. Ajuste medido por el CEO: el worker de vigencia
 * marca VENCIDO en su corrida, no al instante de vencer — entre medio el perfil dice
 * `ACTIVO` pero `habilitado=false`. Si se mapeara por estado, ese profesional vería
 * el menú operativo y todo le daría 403. Por eso: **operativo solo si `habilitado`.**
 * Fail-closed: sin dato (cargando, o antes de que 690 publique el campo) → portero.
 *
 * Las entradas se DERIVAN de `PROFESIONAL_NAV_ITEMS` (mismo href y módulo) para que
 * el candado de pantallas vivas (SPEC-437 · I-299) siga cubriendo que ninguna lleva
 * a una pantalla inexistente; solo se ajusta el rótulo al del mockup aprobado
 * (13-09, Gestión `2e6d1b0`): «Mi ficha»/«Mi estado» de portero, «Mi perfil» de
 * verificado. No hay rutas nuevas: autorización, documentos y tarifa son secciones
 * de esas pantallas, no entradas de menú.
 */
import { PROFESIONAL_NAV_ITEMS, type NavItem } from "@/lib/nav-items";

/** Lo que el menú necesita del profesional; el resto del contrato no le incumbe. */
export type EstadoProfesionalSesion = { habilitado: boolean } | null | undefined;

const HREF_INICIO = "/dashboard/profesional";
const HREF_CASOS = "/dashboard/profesional/casos";
const HREF_CALENDARIO = "/dashboard/profesional/calendario";
const HREF_FICHA = "/perfil-profesional/completar";
const HREF_MI_PERFIL = "/dashboard/profesional/mi-perfil";

/** Toma el ítem base de PROFESIONAL_NAV_ITEMS (href + módulo) y le fija el rótulo del estado. */
function entrada(href: string, label: string): NavItem {
    const base = PROFESIONAL_NAV_ITEMS.find((i) => i.href === href);
    if (!base) {
        // Estructural: si alguien renombra un href en nav-items, esto grita en vez
        // de servir una entrada a una pantalla que ya no está en la lista viva.
        throw new Error(`[menu-por-estado] «${href}» no está en PROFESIONAL_NAV_ITEMS`);
    }
    return { ...base, label };
}

/** Verificado (habilitado): se abre la casa — inicio, citaciones, casos, calendario, mi perfil. */
function menuVerificado(): NavItem[] {
    return [
        entrada(HREF_INICIO, "Inicio"),
        // SPEC-732: «Citaciones» se unificó en «Calendario» (una sola entrada, una sola pantalla).
        entrada(HREF_CASOS, "Casos"),
        entrada(HREF_CALENDARIO, "Calendario"),
        // SPEC-685 (PR2-bis): «Mi perfil» del habilitado es su propia pantalla
        // (datos + tarifa + documentos + estado), ya no la ficha de completar.
        entrada(HREF_MI_PERFIL, "Mi perfil"),
    ];
}

/** Portero (no habilitado, cualquier estado): SOLO su ficha. Nada operativo.
 *  SPEC-706: «Mi estado» (/perfil-profesional/verificacion) se retiró — su contenido es ahora el
 *  encabezado de la ficha. El no habilitado no elige entre dos pantallas que eran lo mismo. */
function menuPortero(): NavItem[] {
    return [entrada(HREF_FICHA, "Mi ficha")];
}

/**
 * Las entradas del menú del profesional para el estado de sesión dado.
 * `habilitado` verdadero → menú verificado; cualquier otra cosa (incluye ausente
 * y cargando) → portero. La copia de cada menú es exacta, no un superconjunto.
 */
export function entradasProfesional(pro: EstadoProfesionalSesion): NavItem[] {
    return pro?.habilitado ? menuVerificado() : menuPortero();
}
