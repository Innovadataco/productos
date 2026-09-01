/**
 * SPEC-344 (A-69 · Fase C1) — El camino guiado del colegio: fuente única de
 * los pasos del rol SCHOOL_ADMIN.
 *
 * Espejo del `pasos.ts` del padre (SPEC-339): mismo patrón, cero Prisma,
 * Edge-safe. Vive en un módulo hermano para NO ampliar la unión tipada de
 * `PasoCamino` (invalidaría cookies vivas del padre con más frecuencia) y
 * para mantener "una fuente por dominio". La derivación contra la base de
 * datos vive en `src/lib/dal/services/camino/estado-colegio.ts`.
 *
 * Los 5 pasos vienen del brief A-69 C1 y del mockup aprobado v3 (momento 1):
 *   1. Rector — datos de identidad + convenio institucional (SPEC-343)
 *   2. Plan — freemium 30 días o pagado (escribe Colegio.finServicio, puente D2)
 *   3. Profesores — alta individual + Excel fresco
 *   4. Cursos — 11 grados sembrados + materias con profesor obligatorio (D3)
 *   5. Estudiantes — alta con acudiente (documento opcional aditivo)
 */

/** Los cinco pasos del camino del colegio, en orden. Viaja en la cookie firmada. */
export const PASOS_COLEGIO = ["rector", "plan", "profesores", "cursos", "estudiantes"] as const;

export type PasoColegio = (typeof PASOS_COLEGIO)[number];

/** `null` = el camino del colegio está terminado y los módulos abren. */
export type PasoPendienteColegio = PasoColegio | null;

/** Raíz de las pantallas del camino del colegio. */
export const RAIZ_CAMINO_COLEGIO = "/camino/colegio";

interface DefinicionPasoColegio {
    /** Posición humana: "Paso N de 5". */
    readonly numero: 1 | 2 | 3 | 4 | 5;
    /** Pantalla a la que se envía al rector cuando este paso está pendiente. */
    readonly destino: string;
    /** Título corto del indicador de progreso. */
    readonly titulo: string;
}

export const DEFINICION_PASOS_COLEGIO: Readonly<Record<PasoColegio, DefinicionPasoColegio>> = {
    rector: { numero: 1, destino: `${RAIZ_CAMINO_COLEGIO}/rector`, titulo: "Quién responde" },
    plan: { numero: 2, destino: `${RAIZ_CAMINO_COLEGIO}/plan`, titulo: "Su plan" },
    profesores: { numero: 3, destino: `${RAIZ_CAMINO_COLEGIO}/profesores`, titulo: "Sus profesores" },
    cursos: { numero: 4, destino: `${RAIZ_CAMINO_COLEGIO}/cursos`, titulo: "Cursos y materias" },
    estudiantes: { numero: 5, destino: `${RAIZ_CAMINO_COLEGIO}/estudiantes`, titulo: "Sus estudiantes" },
};

export const TOTAL_PASOS_COLEGIO = PASOS_COLEGIO.length;

/** Pantalla de cierre. No es un paso: es donde aterriza al terminar. */
export const DESTINO_CIERRE_COLEGIO = `${RAIZ_CAMINO_COLEGIO}/listo`;

/** Destino al que el guardián envía al rector con un paso pendiente. */
export function destinoDePasoColegio(paso: PasoColegio): string {
    return DEFINICION_PASOS_COLEGIO[paso].destino;
}

/** Type guard: valida el valor que llega desde la cookie, que es texto sin tipar. */
export function esPasoColegio(valor: unknown): valor is PasoColegio {
    return typeof valor === "string" && (PASOS_COLEGIO as readonly string[]).includes(valor);
}
