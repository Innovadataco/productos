/**
 * SPEC-287 (002-PI-187 · cierra I-25/I-111/I-141) — Fuente única de rutas.
 *
 * Todo consumidor de decisiones de acceso (middleware.ts, src/lib/proxy.ts,
 * tests) lee de aquí. Cero duplicación. Cero listas paralelas.
 *
 * Invariante crítica (verificada por assert al import + por el ratchet estático
 * `guardia-invariante`): por cada `<rol>.destino` de `vigencia`, la misma URL
 * DEBE estar en `<rol>.exentas`. Sin esto, el guardián redirige a una ruta
 * cuya evaluación de vigencia dispara otra vez el mismo guardián → bucle.
 * Ver historial: I-25 → I-111 → I-141 (3 apariciones del mismo defecto).
 */
export const GUARDIAS_ACCESO = {
    /**
     * Rutas alcanzables sin JWT válido. Migrado desde `PUBLIC_ROUTES` de
     * `src/lib/proxy.ts` — sigue siendo la misma lista, solo cambia de casa.
     */
    publicas: [
        "/",
        "/login",
        "/registro",
        "/registro-colegio",
        "/activar",
        "/recuperar",
        "/seguimiento",
        "/reportar",
        "/privacidad",
        "/terminos",
        "/offline",
        "/dashboard-publico",
        "/api/auth",
        "/api/config/parametros/publicos",
        "/api/plataformas",
        "/api/paises",
        "/api/departamentos",
        "/api/ciudades",
        "/api/consulta",
        "/api/reportes",
        "/api/estadisticas-publicas",
        // SPEC-346 (I-234 · recorrido en vivo 340): /api/publico/** es la
        // familia de endpoints diseñados SIN auth (verificar-pdf, guia-accion
        // pública). El portero se saltó de listarlas cuando SPEC-234 introdujo
        // /verificar-pdf, así que la ruta respondía 401 al primer intento —
        // una autoridad con el PDF en la mano no podía verificar sin cuenta,
        // que es exactamente el sentido opuesto del sello.
        "/api/publico",
        // Página de verificación pública del sello del PDF (SPEC-234/340):
        // el pie del PDF imprime <baseUrl>/verificar/<codigo>. Tiene que ser
        // alcanzable sin cuenta o el sello no cumple su función.
        "/verificar",
        "/api/health",
        // SPEC-302 (002-PI-208): señal de monitoreo del motor de notificaciones,
        // mismo trato que /api/health — consumida por curl externo (tabla §6b).
        "/api/monitor/notif",
        // SPEC-017 · SPEC-286: /docs y /api/docs son semi-públicos; el gate real
        // vive en la propia página. /consulta ya no existe (SPEC-286).
        "/docs",
        "/api/docs",
        // SPEC-287: /api/vigencia/refresh corre sin JWT válido puede llamarse
        // solo si el middleware ya validó la sesión. NO se lista aquí; el flujo
        // que lo consume es el propio middleware, por eso queda como ruta
        // autenticada normal.
    ] as const,

    /**
     * Rutas que requieren JWT válido pero NO evaluación de consentimiento/vigencia.
     * Migrado desde `SESION_ROUTES` de `src/lib/proxy.ts`. Incluye:
     *  - `/api/me`: header lee sesión.
     *  - `/cambiar-password` + `/api/auth/cambiar-password`: cambio obligatorio (I-35).
     *  - `/api/auth/logout`: salida (I-35b).
     *  - `/consentimiento` + `/api/consentimiento`: I-111 muro de consentimiento.
     */
    sesion: [
        "/api/me",
        // SPEC-339: rebote que re-sella la cookie del camino. Debe ser ruta de
        // sesión: si evaluara guardianes, rebotaría contra sí misma.
        "/api/sesion/al-dia",
        "/cambiar-password",
        "/api/auth/cambiar-password",
        "/api/auth/logout",
        "/consentimiento",
        "/api/consentimiento",
        "/api/vigencia/refresh",
    ] as const,

    /**
     * Guardián de consentimiento (SPEC-241 · I-111).
     * `destino` es la página del muro; `exentas` son las rutas que el usuario
     * DEBE poder alcanzar aunque no haya firmado (para poder firmar).
     */
    consentimiento: {
        destino: "/consentimiento",
        exentas: ["/consentimiento", "/api/consentimiento"],
    } as const,

    /**
     * Guardián de cambio-de-password obligatorio.
     * Los usuarios con `debeCambiarPassword=true` van al muro.
     */
    cambiarPassword: {
        destino: "/cambiar-password",
        exentas: ["/cambiar-password", "/api/auth/cambiar-password", "/api/auth/logout"],
    } as const,

    /**
     * Guardián del camino guiado del padre (SPEC-339 · A-67).
     *
     * Corre DESPUÉS de consentimiento y ANTES de vigencia. El Paso 1 no tiene
     * pantalla propia: reusa `/consentimiento`, que ya existe y está bien hecha
     * (exige leer hasta el final y las dos casillas). Crear un `/camino/permiso`
     * propio habría chocado de frente con el guardián de consentimiento, que
     * corre antes y manda a su propia pantalla.
     *
     * Las exentas son el candado "el padre nunca queda atrapado" (I-25 · I-35):
     * un guardián que tapa también la salida deja al usuario sin entrar NI salir.
     */
    /**
     * Ruta a la que rebota el guardián cuando la cookie de estado no se puede
     * leer (falla-cerrada del camino). Es ruta de sesión, así que no evalúa
     * guardianes y no puede rebotar contra sí misma.
     */
    caminoRebote: "/api/sesion/al-dia",

    camino: {
        // No hay un destino fijo: depende del paso pendiente (ver `pasos.ts`).
        // El guardián calcula el destino; esta lista es lo que nunca puede tapar.
        exentas: [
            // Las pantallas del propio camino y lo que las alimenta.
            "/camino",
            "/api/camino",
            // Paso 1 · reusa la pantalla de consentimiento que ya existe.
            "/consentimiento",
            "/api/consentimiento",
            // Paso 2 · sus datos.
            "/api/padre/perfil",
            // Paso 3 · sus menores.
            "/api/padre/hijos",
            // Paso 4 · su plan. Incluye prueba gratis, plan pagado y bono: un
            // padre que eligió un plan pagado NO puede quedar encerrado esperando
            // el clic de un administrador.
            "/api/padre/suscripcion",
            "/api/pagos",
            // Salidas y obligaciones que mandan sobre el camino.
            "/login",
            "/api/auth/logout",
            "/cambiar-password",
            "/api/auth/cambiar-password",
            // Re-sellado de la cookie de estado; sin esto el camino no avanza.
            "/api/sesion/al-dia",
            "/api/session/ping",
            "/api/vigencia/refresh",
            // Regla dura de Jelkin: proteger a un menor está por encima del cobro.
            // Reportar no se bloquea nunca, ni por camino ni por vigencia.
            "/reportar",
            "/dashboard/padre/reportar",
            "/mis-reportes",
            "/api/reportes",
        ],
    } as const,

    /**
     * Guardián de vigencia por rol (SPEC-242 · I-141).
     * Roles no listados (ADMIN, OPERADOR, COMITE_VALIDACION) no tienen guardián de
     * vigencia — son internos, no dependen de suscripción.
     */
    vigencia: {
        PARENT: {
            destino: "/dashboard/padre/suscripcion",
            exentas: [
                "/dashboard/padre/suscripcion",
                "/api/pagos",
                // SPEC-339: sin esto, un padre nuevo (SIN_SUSCRIPCION) rebota
                // sin fin entre el guardián del camino y el de vigencia: camino
                // → suscripción → camino. El camino corre ANTES que vigencia.
                "/camino",
                "/api/camino",
                "/api/padre/perfil",
                "/api/padre/hijos",
                "/api/padre/suscripcion",
                "/api/sesion/al-dia",
                // SPEC-339: hasta hoy el menú del padre apuntaba a
                // `/dashboard/padre/reportar`, que NO estaba exento: un padre sin
                // suscripción chocaba contra el muro de cobro al intentar
                // reportar desde su cuenta. Es I-38 otra vez y contradice la
                // regla de Jelkin: proteger a un menor está por encima del cobro.
                "/dashboard/padre/reportar",
                "/mis-reportes",
            ],
        },
        SCHOOL_ADMIN: {
            destino: "/dashboard/colegio/suscripcion",
            exentas: ["/dashboard/colegio/suscripcion", "/api/pagos"],
        },
        COMITE_CONVIVENCIA: {
            destino: "/dashboard/colegio/suscripcion",
            exentas: ["/dashboard/colegio/suscripcion", "/api/pagos"],
        },
    } as const,
} as const;

// ────────────────────────────────────────────────────────────────────────────
// Invariante crítica — assert al import (falla al arranque si mal)
// ────────────────────────────────────────────────────────────────────────────
{
    // consentimiento.destino ∈ consentimiento.exentas
    if (!GUARDIAS_ACCESO.consentimiento.exentas.some((r) => r === GUARDIAS_ACCESO.consentimiento.destino)) {
        throw new Error(
            `[GUARDIAS_ACCESO] Invariante rota: consentimiento.destino "${GUARDIAS_ACCESO.consentimiento.destino}" NO está en exentas.`,
        );
    }
    // cambiarPassword.destino ∈ cambiarPassword.exentas
    if (!GUARDIAS_ACCESO.cambiarPassword.exentas.some((r) => r === GUARDIAS_ACCESO.cambiarPassword.destino)) {
        throw new Error(
            `[GUARDIAS_ACCESO] Invariante rota: cambiarPassword.destino "${GUARDIAS_ACCESO.cambiarPassword.destino}" NO está en exentas.`,
        );
    }
    // vigencia[rol].destino ∈ vigencia[rol].exentas
    for (const [rol, cfg] of Object.entries(GUARDIAS_ACCESO.vigencia)) {
        if (!cfg.exentas.some((r) => r === cfg.destino)) {
            throw new Error(
                `[GUARDIAS_ACCESO] Invariante rota: vigencia.${rol}.destino "${cfg.destino}" NO está en vigencia.${rol}.exentas.`,
            );
        }
    }

    // ── SPEC-339 · INVARIANTE CRUZADA ──────────────────────────────────────
    //
    // La invariante de arriba (destino propio ∈ exentas propias) impide que un
    // guardián se muerda la cola, pero NO impide que DOS guardianes se manden
    // uno al otro. Eso fue exactamente el bucle que encontró Calidad: el camino
    // manda al Paso 1, y el de vigencia —que corre después— manda ese mismo
    // pedido a la pantalla de suscripción, que el camino vuelve a interceptar.
    // Un padre nuevo no entraba nunca.
    //
    // Regla: el destino de un guardián debe estar exento en TODOS los guardianes
    // que corren después de él, en el orden real de `middleware.ts`.
    // Historial de esta familia de defectos: I-25 → I-111 → I-141 → SPEC-339.
    {
        const ORDEN_GUARDIANES = ["consentimiento", "camino", "vigencia"] as const;

        // Destinos que produce cada guardián. El camino no tiene un destino fijo:
        // produce uno por paso (ver `pasos.ts`), y todos cuelgan de `/camino`
        // salvo el Paso 1, que reusa la pantalla de consentimiento.
        const destinosDe: Record<(typeof ORDEN_GUARDIANES)[number], string[]> = {
            consentimiento: [GUARDIAS_ACCESO.consentimiento.destino],
            camino: ["/camino", GUARDIAS_ACCESO.consentimiento.destino],
            vigencia: Object.values(GUARDIAS_ACCESO.vigencia).map((v) => v.destino),
        };

        // Exentas de cada guardián, por rol cuando corresponde.
        const exentasDe = (
            guardian: (typeof ORDEN_GUARDIANES)[number],
        ): readonly string[] => {
            if (guardian === "consentimiento") return GUARDIAS_ACCESO.consentimiento.exentas;
            if (guardian === "camino") return GUARDIAS_ACCESO.camino.exentas;
            // Vigencia solo aplica al padre en lo que respecta al camino.
            return GUARDIAS_ACCESO.vigencia.PARENT.exentas;
        };

        for (let i = 0; i < ORDEN_GUARDIANES.length; i++) {
            const emisor = ORDEN_GUARDIANES[i];
            for (const destino of destinosDe[emisor]) {
                // Solo hacia ADELANTE. Que un guardián ANTERIOR intercepte el
                // destino de uno posterior no es un bucle: es la precedencia
                // correcta (primero firmas el consentimiento, después sigues el
                // camino). El bucle nace cuando el POSTERIOR devuelve el pedido.
                for (let j = i + 1; j < ORDEN_GUARDIANES.length; j++) {
                    const posterior = ORDEN_GUARDIANES[j];
                    // Una ruta pública o "de sesión pura" está exenta de TODOS
                    // los guardianes por construcción: `middleware.ts` retorna
                    // en sus pasos 1 y 3, antes de evaluar cualquier guardián.
                    // Por eso `/consentimiento` no genera bucle hoy pese a no
                    // estar en las exentas de vigencia.
                    const universales = [
                        ...GUARDIAS_ACCESO.publicas,
                        ...GUARDIAS_ACCESO.sesion,
                    ];
                    const exentas = [...exentasDe(posterior), ...universales];
                    const cubierto = exentas.some(
                        (r) => destino === r || destino.startsWith(r + "/"),
                    );
                    if (!cubierto) {
                        throw new Error(
                            `[GUARDIAS_ACCESO] Invariante CRUZADA rota: "${emisor}" redirige a "${destino}", ` +
                                `pero "${posterior}" no lo exime. Un usuario enviado allí rebotaría sin fin. ` +
                                `Agrega "${destino}" a las exentas de "${posterior}".`,
                        );
                    }
                }
            }
        }
    }
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers puros de comparación (matching por segmento, no substring)
// ────────────────────────────────────────────────────────────────────────────

/**
 * `pathname` coincide con `ruta` si son iguales o si `pathname` comienza con
 * `ruta + "/"`. Evita que `/api/pagos-otros` matchee `/api/pagos`.
 */
export function matcheaRuta(pathname: string, ruta: string): boolean {
    return pathname === ruta || pathname.startsWith(ruta + "/");
}

export function esRutaPublica(pathname: string): boolean {
    return GUARDIAS_ACCESO.publicas.some((r) => matcheaRuta(pathname, r));
}

export function esRutaSesion(pathname: string): boolean {
    return GUARDIAS_ACCESO.sesion.some((r) => matcheaRuta(pathname, r));
}

export function esExentaConsentimiento(pathname: string): boolean {
    return GUARDIAS_ACCESO.consentimiento.exentas.some((r) => matcheaRuta(pathname, r));
}

/**
 * SPEC-339: rutas que el guardián del camino NUNCA puede tapar.
 * Es el candado "el padre nunca queda atrapado" (I-25 · I-35).
 */
export function esExentaCamino(pathname: string): boolean {
    return GUARDIAS_ACCESO.camino.exentas.some((r) => matcheaRuta(pathname, r));
}

export function esExentaCambiarPassword(pathname: string): boolean {
    return GUARDIAS_ACCESO.cambiarPassword.exentas.some((r) => matcheaRuta(pathname, r));
}

export type RolConVigencia = keyof typeof GUARDIAS_ACCESO.vigencia;

export function tieneVigencia(rol: string | null | undefined): rol is RolConVigencia {
    return rol != null && rol in GUARDIAS_ACCESO.vigencia;
}

export function esExentaVigencia(pathname: string, rol: RolConVigencia): boolean {
    return GUARDIAS_ACCESO.vigencia[rol].exentas.some((r) => matcheaRuta(pathname, r));
}

export function destinoVigencia(rol: RolConVigencia): string {
    return GUARDIAS_ACCESO.vigencia[rol].destino;
}
