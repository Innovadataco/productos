/**
 * SPEC-884 (I-364) — detector/guardián BLANDO de ciudades duplicadas. Solo
 * LECTURA contra la BD viva; no crea, repara ni borra nada (sanear es el
 * corrector `normalizar-y-dedup-ciudades.ts`). Es el preflight B: dice si el
 * catálogo ACTIVO está listo para el índice UNIQUE PARCIAL
 * `(paisId, departamentoId, nombreNormalizado) WHERE esActivo` NULLS NOT DISTINCT.
 *
 * Reporta, entre las ACTIVAS:
 *   · gruposDup   — grupos (paisId, departamentoId, norm-canónico) con >1 fila:
 *                   lo que el índice rechazaría. Agrupa con la MISMA semántica
 *                   del índice (NULLS NOT DISTINCT → depto NULL se agrupa dentro
 *                   del país) y sobre el norm CANÓNICO (lo que dejará el
 *                   corrector), no el almacenado, para anticipar el estado final.
 *   · nullDeptoDup — subconjunto de gruposDup con departamentoId NULL: el caso que
 *                   el responsable debe mirar (si son municipios legítimamente
 *                   distintos de un mismo país, NULLS NOT DISTINCT los rechazaría
 *                   mal → backfill de depto o NULLS DISTINCT).
 *   · stale       — filas cuyo `nombreNormalizado` almacenado ≠ el canónico.
 *   · vacios      — filas con `nombreNormalizado = ''`.
 *
 * Exit: 0 si limpio (0 dup, 0 stale, 0 vacío); 1 si sucio (precondición no
 * cumplida); 2 error de infraestructura.
 *
 * Uso:
 *   node --env-file=.env --import tsx scripts/geo/detectar-ciudades-duplicadas.ts
 *   node --env-file=.env --import tsx scripts/geo/detectar-ciudades-duplicadas.ts --json
 */
import { prisma } from "../../src/lib/prisma";
import { normalizarNombreGeografico } from "../../src/lib/normalizar";

const SENTINEL_NULL_DEPTO = "∅";

export interface FilaDeteccion {
    id: string;
    nombre: string;
    nombreNormalizado: string;
    paisId: string;
    departamentoId: string | null;
}

export interface GrupoDuplicado {
    paisId: string;
    departamentoId: string | null;
    nombreNormalizado: string;
    ids: string[];
}

export interface AnalisisCiudades {
    activas: number;
    gruposDup: GrupoDuplicado[];
    nullDeptoDup: GrupoDuplicado[];
    stale: Array<{ id: string; nombre: string; de: string; a: string }>;
    vacios: string[];
    limpio: boolean;
}

/** Clave de grupo con la semántica del índice: NULLS NOT DISTINCT dentro del país. */
function claveGrupo(paisId: string, departamentoId: string | null, normCanonico: string): string {
    return `${paisId}|${departamentoId ?? SENTINEL_NULL_DEPTO}|${normCanonico}`;
}

/**
 * Análisis puro (testeable sin BD). Agrupa por el norm CANÓNICO (derivado del
 * nombre), que es lo que el índice verá tras el corrector.
 */
export function analizarCiudades(filas: FilaDeteccion[]): AnalisisCiudades {
    const grupos = new Map<string, GrupoDuplicado>();
    const stale: AnalisisCiudades["stale"] = [];
    const vacios: string[] = [];

    for (const f of filas) {
        const canonico = normalizarNombreGeografico(f.nombre);
        if (f.nombreNormalizado === "") vacios.push(f.id);
        if (f.nombreNormalizado !== canonico) {
            stale.push({ id: f.id, nombre: f.nombre, de: f.nombreNormalizado, a: canonico });
        }
        const clave = claveGrupo(f.paisId, f.departamentoId, canonico);
        const grupo = grupos.get(clave);
        if (grupo) {
            grupo.ids.push(f.id);
        } else {
            grupos.set(clave, {
                paisId: f.paisId,
                departamentoId: f.departamentoId,
                nombreNormalizado: canonico,
                ids: [f.id],
            });
        }
    }

    const gruposDup = [...grupos.values()].filter((g) => g.ids.length > 1);
    const nullDeptoDup = gruposDup.filter((g) => g.departamentoId === null);

    return {
        activas: filas.length,
        gruposDup,
        nullDeptoDup,
        stale,
        vacios,
        limpio: gruposDup.length === 0 && stale.length === 0 && vacios.length === 0,
    };
}

async function main(): Promise<void> {
    const filas = await prisma.ciudad.findMany({
        where: { esActivo: true },
        select: { id: true, nombre: true, nombreNormalizado: true, paisId: true, departamentoId: true },
    });

    const r = analizarCiudades(filas);
    const jsonMode = process.argv.includes("--json");

    if (jsonMode) {
        console.log(
            JSON.stringify({
                activas: r.activas,
                gruposDup: r.gruposDup.length,
                nullDeptoDup: r.nullDeptoDup.length,
                stale: r.stale.length,
                vacios: r.vacios.length,
                limpio: r.limpio,
            }),
        );
    } else {
        console.log(
            `[detectar-ciudades-duplicadas] activas=${r.activas} gruposDup=${r.gruposDup.length} ` +
                `nullDeptoDup=${r.nullDeptoDup.length} stale=${r.stale.length} vacios=${r.vacios.length} ` +
                `→ ${r.limpio ? "LIMPIO" : "SUCIO"}`,
        );
        for (const g of r.gruposDup.slice(0, 50)) {
            console.log(
                `[detectar-ciudades-duplicadas]   dup · pais=${g.paisId} depto=${g.departamentoId ?? "NULL"} ` +
                    `norm="${g.nombreNormalizado}" × ${g.ids.length}`,
            );
        }
        if (r.nullDeptoDup.length > 0) {
            console.warn(
                `[detectar-ciudades-duplicadas] ATENCIÓN: ${r.nullDeptoDup.length} grupos dup con depto NULL — ` +
                    "verificá que no sean municipios legítimos de un mismo país antes del índice.",
            );
        }
    }

    if (!r.limpio) process.exitCode = 1;
}

const esEjecucionDirecta =
    typeof process.argv[1] === "string" && process.argv[1].endsWith("detectar-ciudades-duplicadas.ts");
if (esEjecucionDirecta) {
    const watchdog = setTimeout(() => {
        console.error("[detectar-ciudades-duplicadas] TIMEOUT: el chequeo tardó más de 15s — revisar conectividad a BD");
        process.exit(2);
    }, 15_000);
    watchdog.unref();

    main()
        .then(() => clearTimeout(watchdog))
        .catch((error) => {
            clearTimeout(watchdog);
            console.error("[detectar-ciudades-duplicadas] Error de infraestructura:", error instanceof Error ? error.message : error);
            process.exitCode = 2;
        })
        .finally(async () => {
            await prisma.$disconnect();
        });
}
