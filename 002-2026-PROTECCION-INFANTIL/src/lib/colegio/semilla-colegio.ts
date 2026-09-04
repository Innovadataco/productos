/**
 * SPEC-442 (I-307 · orden CEO 04-09) · Semilla mínima que TODO colegio recién
 * creado necesita para que el camino guiado no lo trabe en el paso 4:
 *
 *  · **Materias por defecto** (SPEC-162 · 12 materias).
 *  · **Cursos por defecto** (SPEC-344 · D-5 · los 11 grados del año lectivo
 *    vigente, o el que reciba el caller).
 *  · **Onboarding** (SPEC-169 · fila única `activo`, paso 1).
 *
 * Antes de este helper había DOS caminos que creaban `Colegio`: el registro
 * público del rector (SPEC-240 · `registro-colegio.ts:311`) sembraba los tres;
 * el alta por administración (`api/admin/colegios/route.ts:265`) sembraba solo
 * materias y onboarding — **no cursos**. «sagrado corazon» quedó con 0
 * cursos por ese camino, la pantalla de paso 4 afirma «Le dejamos los 11 grados»
 * y muestra 0, y no hay salida (I-307).
 *
 * Este archivo es la fuente única. Los tres callers actuales
 * (admin/colegios/route.ts, registro-colegio.ts y scripts/smoke-prod-safe.ts)
 * pasan por acá. **El candado de comportamiento** en
 * `sembrar-semilla.candado.test.ts` mueve el defecto puesto: sacar la
 * llamada al helper de cualquiera de los tres callers deja el flujo en
 * el estado ROJO (paso 4 con 0 cursos).
 *
 * Idempotente:
 *  · `crearCursosPorDefecto` usa `findFirst → create` (ya idempotente).
 *  · `seedMateriasPorDefecto` usa la unique constraint `(colegioId, nombre)`.
 *  · `OnboardingColegio` es fila única por colegio; si ya existe, se omite.
 *
 * Q-3: este módulo NO importa `@/lib/prisma`. El caller inyecta el cliente
 * (o su transacción); coincide con la firma de `seedMateriasPorDefecto`.
 */
import type { DbClient } from "@/lib/dal/unit-of-work";
import { seedMateriasPorDefecto } from "./materias-seed";
import { crearCursosPorDefecto } from "./cursos-seed";

export interface ResultadoSembradoColegio {
    /** Materias activas del colegio tras sembrar. */
    materias: number;
    /** Cursos activos del colegio tras sembrar (11 en el caso normal). */
    cursosActivos: number;
    /** true si se creó `OnboardingColegio` en esta llamada; false si ya existía. */
    onboardingCreado: boolean;
}

export interface OpcionesSembradoColegio {
    /** Año lectivo para los cursos por defecto. Default: año en la zona horaria del proceso. */
    anioLectivo?: string;
    /** Si `false`, no crea `OnboardingColegio` (solo materias + cursos). Default: `true`. */
    incluirOnboarding?: boolean;
}

/**
 * Siembra materias + cursos + onboarding en un colegio recién creado.
 * Devuelve un resumen del estado post-siembra para diagnóstico y tests.
 */
export async function sembrarSemillaColegio(
    colegioId: string,
    cliente: DbClient,
    opciones: OpcionesSembradoColegio = {},
): Promise<ResultadoSembradoColegio> {
    const anioLectivo = opciones.anioLectivo ?? String(new Date().getFullYear());
    const incluirOnboarding = opciones.incluirOnboarding ?? true;

    // 1) Materias por defecto (idempotente por unique(colegioId, nombre)).
    const materias = await seedMateriasPorDefecto(cliente, colegioId);

    // 2) Cursos por defecto — los 11 grados del año lectivo (SPEC-344 D-5).
    //    `crearCursosPorDefecto` ya es idempotente: findFirst → create.
    const cursosActivos = await crearCursosPorDefecto(colegioId, anioLectivo, cliente);

    // 3) Onboarding (fila única). Idempotente: si ya existe, no crea.
    let onboardingCreado = false;
    if (incluirOnboarding) {
        const existente = await cliente.onboardingColegio.findUnique({
            where: { colegioId },
            select: { colegioId: true },
        });
        if (!existente) {
            await cliente.onboardingColegio.create({
                data: {
                    colegioId,
                    estado: "activo",
                    pasoActual: 1,
                },
            });
            onboardingCreado = true;
        }
    }

    return { materias, cursosActivos, onboardingCreado };
}
