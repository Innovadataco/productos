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
        "/api/health",
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
     * Guardián de vigencia por rol (SPEC-242 · I-141).
     * Roles no listados (ADMIN, OPERADOR, COMITE_VALIDACION) no tienen guardián de
     * vigencia — son internos, no dependen de suscripción.
     */
    vigencia: {
        PARENT: {
            destino: "/dashboard/padre/suscripcion",
            exentas: ["/dashboard/padre/suscripcion", "/api/pagos"],
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
