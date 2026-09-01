/**
 * SPEC-339 (A-67 · Fase 1) — El camino guiado del padre: fuente única de los pasos.
 *
 * Jelkin (31-08-2026): *"No es una aplicación que tú ingresas y te muestra cinco
 * o seis módulos... esto debe ser muy práctico, cuatro o cinco clic, cuatro o
 * cinco ventanas"*. El padre entra y el sistema lo lleva de la mano hasta que su
 * cuenta está completa; los módulos NO aparecen antes de terminar.
 *
 * ¿Por qué este archivo existe? Porque el orden de los pasos lo necesitan TRES
 * consumidores que no se hablan entre sí:
 *   - `middleware.ts` (Edge), que decide si deja pasar,
 *   - las pantallas de `/camino/**`, que dibujan "Paso N de 4",
 *   - `sesion-estado-emitter.ts`, que sella el paso en la cookie.
 * Tres listas paralelas que se desincronizan es exactamente el defecto que
 * SPEC-287 vino a matar (I-25 → I-111 → I-141). Aquí hay una sola.
 *
 * SIN dependencias de Prisma ni de Node: este módulo lo importa el middleware,
 * que corre en Edge. La derivación contra la base de datos vive en `estado.ts`.
 */

/** Los cuatro pasos, en orden. El valor viaja dentro de la cookie firmada. */
export const PASOS_CAMINO = ["permiso", "datos", "hijos", "plan"] as const;

export type PasoCamino = (typeof PASOS_CAMINO)[number];

/** `null` = el camino está terminado y los módulos abren. */
export type PasoPendiente = PasoCamino | null;

/** Raíz de las pantallas del camino. */
export const RAIZ_CAMINO = "/camino";

interface DefinicionPaso {
    /** Posición humana: "Paso N de 4". */
    readonly numero: 1 | 2 | 3 | 4;
    /** Pantalla a la que se envía al padre cuando este paso está pendiente. */
    readonly destino: string;
    /** Título corto del indicador de progreso. */
    readonly titulo: string;
}

export const DEFINICION_PASOS: Readonly<Record<PasoCamino, DefinicionPaso>> = {
    // El Paso 1 NO tiene pantalla propia: reusa `/consentimiento`, que ya existe
    // y está bien hecha (exige leer hasta el final y las dos casillas). Una
    // pantalla `/camino/permiso` habría chocado con el guardián de
    // consentimiento, que corre antes y manda a la suya (decisión CEO 20:20).
    permiso: { numero: 1, destino: "/consentimiento", titulo: "Permiso" },
    datos: { numero: 2, destino: `${RAIZ_CAMINO}/datos`, titulo: "Tus datos" },
    hijos: { numero: 3, destino: `${RAIZ_CAMINO}/hijos`, titulo: "Tus hijos" },
    plan: { numero: 4, destino: `${RAIZ_CAMINO}/plan`, titulo: "Tu plan" },
};

export const TOTAL_PASOS = PASOS_CAMINO.length;

/** Pantalla de cierre. No es un paso: es donde aterriza al terminar. */
export const DESTINO_CIERRE = `${RAIZ_CAMINO}/listo`;

/** Destino al que el guardián envía al padre con un paso pendiente. */
export function destinoDePaso(paso: PasoCamino): string {
    return DEFINICION_PASOS[paso].destino;
}

/** Type guard: valida el valor que llega desde la cookie, que es texto sin tipar. */
export function esPasoCamino(valor: unknown): valor is PasoCamino {
    return typeof valor === "string" && (PASOS_CAMINO as readonly string[]).includes(valor);
}

/**
 * SPEC-344 (A-69 · C1): registry de destinos por rol. El guardián y el rebote
 * `/api/sesion/al-dia` lo usan para despachar al `/camino/*` correcto según
 * el rol de la sesión. Se importa dinámicamente para conservar Edge-safety
 * en `pasos.ts` (cero Prisma) y para NO forzar al padre a cargar el módulo
 * del colegio.
 */
import {
    esPasoColegio,
    destinoDePasoColegio,
    type PasoColegio,
} from "./pasos-colegio";

export function destinoParaRol(rol: string, paso: string | null): string | null {
    if (paso === null) return null;
    if (rol === "PARENT" && esPasoCamino(paso)) return destinoDePaso(paso);
    if (rol === "SCHOOL_ADMIN" && esPasoColegio(paso)) return destinoDePasoColegio(paso as PasoColegio);
    return null;
}
