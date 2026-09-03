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
        // No hay un destino fijo: depende del paso pendiente (ver `pasos.ts` para
        // el padre y `pasos-colegio.ts` para el colegio). El guardián calcula el
        // destino; estas listas son lo que nunca puede tapar según el rol.
        //
        // `exentas` = padre (comportamiento SPEC-339 sin cambios).
        // `exentasColegio` = rector (SPEC-344 · A-69 · C1).
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
        // SPEC-344 (A-69 · C1): exentas del camino guiado del colegio.
        exentasColegio: [
            // Pantallas del propio camino del colegio.
            "/camino/colegio",
            // Paso 1 · rector + convenio.
            "/consentimiento",
            "/api/consentimiento",
            "/api/colegio/rector",
            // Paso 2 · plan (freemium, pagado, bono, referido).
            "/api/colegio/suscripcion",
            "/api/pagos",
            // SPEC-357 (I-254): LA CAJA SIEMPRE ABIERTA. Un colegio que vence a
            // mitad del camino tiene que poder ir a pagar; hasta hoy el guardián
            // del camino le devolvía 307 al paso pendiente y le tapaba la única
            // salida (verificado en vivo por Calidad). Sin esto, el rector solo
            // sale llamando a un administrador.
            "/dashboard/colegio/suscripcion",
            // Paso 3 · profesores. La sección /dashboard/colegio/profesores
            // completa: el paso enlaza "Agregar profesor" (?crear=1) — sin la
            // exención el enlace rebota al propio paso y solo sobrevive la vía
            // Excel (SPEC-355 · ítem 3, cazado en vivo por el CEO).
            "/api/colegio/profesores",
            "/api/colegio/carga-profesores",
            "/dashboard/colegio/profesores",
            // Paso 4 · cursos y materias. La sección /dashboard/colegio/cursos
            // completa: el paso enlaza a la ficha del curso ([id] · materias) y
            // al wizard unificado del paso 5 — sin la exención el enlace rebota
            // al propio paso (auditoría #222 · punto 2).
            "/api/colegio/cursos",
            "/dashboard/colegio/cursos",
            // SPEC-355 · sistémico: la ficha del curso y el wizard unificado
            // (enlazados desde los pasos 4/5) consumen materias e
            // identificadores de profesor — sin esto sus pantallas cargan
            // pero sus datos responden 403 CAMINO_INCOMPLETO.
            "/api/colegio/materias",
            "/api/colegio/identificadores-profesor",
            // Paso 5 · estudiantes.
            "/api/colegio/carga",
            "/api/colegio/alumnos",
            // Auditoría #222 · punto 1: las alertas de menores NUNCA se bloquean
            // por un paso perdido del camino (regla dura de Jelkin: proteger a
            // un menor está por encima de la configuración y del cobro).
            "/dashboard/colegio/alertas",
            "/api/colegio/alertas",
            // Catálogos consumidos por los formularios del camino.
            "/api/colegio/tipos-documento",
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
            "/reportar",
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
                // SPEC-392 (L3 · brief A-75 §1): el directorio de profesionales
                // es abierto — no se esconde detrás del pago. Un padre SIN_SUSCRIPCION
                // debe poder ver la lista, filtrar y abrir un perfil sin toparse
                // con el muro. La suscripción cierra la puerta a *reservar* la cita
                // (L4), no a *conocer* a quién existe.
                "/dashboard/padre/profesionales",
                "/api/padre/profesionales",
            ],
        },
        SCHOOL_ADMIN: {
            destino: "/dashboard/colegio/suscripcion",
            // SPEC-344 (A-69 · C1): sin estas exentas, un rector nuevo sin
            // suscripción rebotaría sin fin entre el guardián del camino y
            // el de vigencia — mismo bug I-25/I-111/I-141 que atajó SPEC-339
            // para el padre. La invariante cruzada de más abajo lo verifica.
            exentas: [
                "/dashboard/colegio/suscripcion",
                "/api/pagos",
                // Rutas del camino del colegio (deben ser accesibles antes de
                // que exista una suscripción vigente).
                "/camino/colegio",
                "/api/colegio/rector",
                "/api/colegio/suscripcion",
                "/api/colegio/profesores",
                "/api/colegio/carga-profesores",
                "/api/colegio/cursos",
                "/api/colegio/carga",
                "/api/colegio/alumnos",
                "/api/colegio/tipos-documento",
                // SPEC-355 · sistémico: datos de la ficha del curso y el wizard.
                "/api/colegio/materias",
                "/api/colegio/identificadores-profesor",
                // Secciones de cursos y profesores completas (ficha [id] ·
                // materias + unificado + "Agregar profesor" del paso 3): el
                // camino las enlaza y corre ANTES de que exista vigencia.
                "/dashboard/colegio/cursos",
                "/dashboard/colegio/profesores",
                // Auditoría #222 · punto 1: alertas de menores por encima del cobro.
                "/dashboard/colegio/alertas",
                "/api/colegio/alertas",
                "/api/sesion/al-dia",
                "/api/session/ping",
                "/api/vigencia/refresh",
                // Regla dura de Jelkin: reportar nunca se bloquea por vigencia.
                "/reportar",
                "/mis-reportes",
                "/api/reportes",
            ],
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

        // Destinos que produce cada guardián, por rol. El camino no tiene un
        // destino fijo: produce uno por paso — PARENT usa `/camino/**` (Paso 1
        // reusa `/consentimiento`) y SCHOOL_ADMIN usa `/camino/colegio/**`
        // (Paso 1 también reusa `/consentimiento`).
        const destinosPorRolCamino: Record<"PARENT" | "SCHOOL_ADMIN", string[]> = {
            PARENT: ["/camino", GUARDIAS_ACCESO.consentimiento.destino],
            SCHOOL_ADMIN: ["/camino/colegio", GUARDIAS_ACCESO.consentimiento.destino],
        };
        const destinosDe: Record<(typeof ORDEN_GUARDIANES)[number], string[]> = {
            consentimiento: [GUARDIAS_ACCESO.consentimiento.destino],
            camino: [
                ...destinosPorRolCamino.PARENT,
                ...destinosPorRolCamino.SCHOOL_ADMIN,
            ],
            vigencia: Object.values(GUARDIAS_ACCESO.vigencia).map((v) => v.destino),
        };

        // Exentas de cada guardián, opcionalmente por rol. Para vigencia, la
        // regla generalizada SPEC-344: por cada rol con `pasoCamino` (PARENT
        // y SCHOOL_ADMIN), los destinos del camino de ESE rol deben estar en
        // `vigencia[rol].exentas` — no basta con verificar solo PARENT.
        const exentasDe = (
            guardian: (typeof ORDEN_GUARDIANES)[number],
            rolCamino?: "PARENT" | "SCHOOL_ADMIN",
        ): readonly string[] => {
            if (guardian === "consentimiento") return GUARDIAS_ACCESO.consentimiento.exentas;
            if (guardian === "camino") {
                return rolCamino === "SCHOOL_ADMIN"
                    ? GUARDIAS_ACCESO.camino.exentasColegio
                    : GUARDIAS_ACCESO.camino.exentas;
            }
            if (rolCamino === "SCHOOL_ADMIN") return GUARDIAS_ACCESO.vigencia.SCHOOL_ADMIN.exentas;
            return GUARDIAS_ACCESO.vigencia.PARENT.exentas;
        };

        for (let i = 0; i < ORDEN_GUARDIANES.length; i++) {
            const emisor = ORDEN_GUARDIANES[i];
            // Enumeración por rol: cada destino se verifica con las exentas del
            // rol correspondiente en el guardián posterior.
            const paresEmisor: Array<[string, "PARENT" | "SCHOOL_ADMIN" | undefined]> =
                emisor === "camino"
                    ? [
                        ...destinosPorRolCamino.PARENT.map(
                            (d) => [d, "PARENT" as const] as [string, "PARENT"],
                        ),
                        ...destinosPorRolCamino.SCHOOL_ADMIN.map(
                            (d) => [d, "SCHOOL_ADMIN" as const] as [string, "SCHOOL_ADMIN"],
                        ),
                    ]
                    : destinosDe[emisor].map((d) => [d, undefined]);

            for (const [destino, rolCamino] of paresEmisor) {
                for (let j = i + 1; j < ORDEN_GUARDIANES.length; j++) {
                    const posterior = ORDEN_GUARDIANES[j];
                    const universales = [
                        ...GUARDIAS_ACCESO.publicas,
                        ...GUARDIAS_ACCESO.sesion,
                    ];
                    const exentas = [...exentasDe(posterior, rolCamino), ...universales];
                    const cubierto = exentas.some(
                        (r) => destino === r || destino.startsWith(r + "/"),
                    );
                    if (!cubierto) {
                        const contexto = rolCamino ? ` (rol=${rolCamino})` : "";
                        throw new Error(
                            `[GUARDIAS_ACCESO] Invariante CRUZADA rota: "${emisor}"${contexto} redirige a "${destino}", ` +
                                `pero "${posterior}" no lo exime. Un usuario enviado allí rebotaría sin fin. ` +
                                `Agrega "${destino}" a las exentas de "${posterior}"${contexto}.`,
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
 * SPEC-339 · SPEC-344: rutas que el guardián del camino NUNCA puede tapar,
 * discriminadas por rol.
 * Es el candado "el usuario nunca queda atrapado" (I-25 · I-35).
 * - `PARENT` (o `undefined`, para compatibilidad con callers legacy):
 *   `camino.exentas` — comportamiento SPEC-339.
 * - `SCHOOL_ADMIN`: `camino.exentasColegio` — SPEC-344 · A-69 · C1.
 */
export function esExentaCamino(pathname: string, rol?: string): boolean {
    const lista =
        rol === "SCHOOL_ADMIN"
            ? GUARDIAS_ACCESO.camino.exentasColegio
            : GUARDIAS_ACCESO.camino.exentas;
    return lista.some((r) => matcheaRuta(pathname, r));
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
