/**
 * SPEC-884 (I-364) — corrector de precondición para la compuerta de ciudades
 * duplicadas. Deja el catálogo ACTIVO en el estado que el índice UNIQUE PARCIAL
 * `(paisId, departamentoId, nombreNormalizado) WHERE esActivo` (NULLS NOT
 * DISTINCT) puede aceptar, SIN borrar filas (estilo SPEC-580: desactiva, no
 * borra — reversible, preserva referencias históricas).
 *
 * Tres pasos sobre las ciudades ACTIVAS:
 *   1. RE-NORMALIZAR: `nombreNormalizado := normalizarNombreGeografico(nombre)`
 *      donde difiere (cubre los `nombreNormalizado = ''` legados y cualquier
 *      valor stale — misma lógica que el backfill del import GeoNames).
 *   2. DEDUP por (paisId, departamentoId, norma-re-normalizada): conserva una por
 *      grupo y desactiva las demás. REUSA `calcularDesactivaciones` de SPEC-580
 *      PARTICIONANDO por paisId — dentro de un país su grano (depto, norm) ya es
 *      correcto; la partición evita el latente cross-país de 580 corrido global
 *      (fusionaría p.ej. «Santiago» de CL y DO, ambas depto NULL).
 *
 * El índice NO existe todavía cuando este corrector corre contra prod (secuencia
 * CEO: preflight → corrector si sucio → deploy del índice), así que las updates
 * de re-normalización no chocan contra él.
 *
 * Idempotente: una segunda corrida no re-normaliza (ya coinciden) ni desactiva
 * (ya quedó una por grupo). Atómico POR FILA (nunca un solo $transaction que
 * envenene filas sanas); exit≠0 si falla alguna.
 *
 * Uso:
 *   node --env-file=.env --import tsx scripts/geo/normalizar-y-dedup-ciudades.ts           # dry-run
 *   node --env-file=.env --import tsx scripts/geo/normalizar-y-dedup-ciudades.ts --confirm # aplica
 */
import { prisma } from "../../src/lib/prisma";
import { normalizarNombreGeografico } from "../../src/lib/normalizar";
import { calcularDesactivaciones, type FilaCiudad } from "./dedup-ciudades";

const APLICAR = process.argv.includes("--confirm");

export interface FilaCiudadConPais extends FilaCiudad {
    paisId: string;
}

export interface Renormalizacion {
    id: string;
    nombre: string;
    de: string;
    a: string;
}

/**
 * Filas cuyo `nombreNormalizado` almacenado NO coincide con el canónico derivado
 * del nombre (incluye los vacíos ''). Pura, testeable sin BD.
 */
export function calcularRenormalizaciones(
    filas: Array<{ id: string; nombre: string; nombreNormalizado: string }>,
): Renormalizacion[] {
    const out: Renormalizacion[] = [];
    for (const f of filas) {
        const canonico = normalizarNombreGeografico(f.nombre);
        if (f.nombreNormalizado !== canonico) {
            out.push({ id: f.id, nombre: f.nombre, de: f.nombreNormalizado, a: canonico });
        }
    }
    return out;
}

/**
 * Dedup PAÍS-AWARE: particiona por paisId y aplica la regla de SPEC-580 por país
 * (conserva mayor población, nulls last, empate → creadoEn más antiguo). Las
 * filas que entran deben traer su `nombreNormalizado` YA re-normalizado. Pura.
 */
export function calcularDesactivacionesPorPais(
    filas: FilaCiudadConPais[],
): Array<{ id: string; nombre: string; motivo: string }> {
    const porPais = new Map<string, FilaCiudad[]>();
    for (const f of filas) {
        const lista = porPais.get(f.paisId) ?? [];
        lista.push(f);
        porPais.set(f.paisId, lista);
    }
    const aDesactivar: Array<{ id: string; nombre: string; motivo: string }> = [];
    for (const lista of porPais.values()) {
        aDesactivar.push(...calcularDesactivaciones(lista));
    }
    return aDesactivar;
}

async function main(): Promise<void> {
    const filas = await prisma.ciudad.findMany({
        where: { esActivo: true },
        select: {
            id: true,
            nombre: true,
            nombreNormalizado: true,
            paisId: true,
            departamentoId: true,
            poblacion: true,
            creadoEn: true,
        },
    });

    const renormalizaciones = calcularRenormalizaciones(filas);

    // El dedup opera sobre el norm YA re-normalizado (es lo que verá el índice).
    const filasRenorm: FilaCiudadConPais[] = filas.map((f) => ({
        ...f,
        nombreNormalizado: normalizarNombreGeografico(f.nombre),
    }));
    const aDesactivar = calcularDesactivacionesPorPais(filasRenorm);

    console.log(
        `[normalizar-y-dedup] activas=${filas.length} re-normalizar=${renormalizaciones.length} ` +
            `desactivar=${aDesactivar.length} (modo ${APLICAR ? "REAL" : "DRY-RUN"}).`,
    );
    for (const r of renormalizaciones) {
        console.log(`[normalizar-y-dedup]   renorm · ${r.nombre}: «${r.de}» → «${r.a}»`);
    }
    for (const d of aDesactivar) {
        console.log(`[normalizar-y-dedup]   dedup  · ${d.nombre} — ${d.motivo}`);
    }

    if (!APLICAR) {
        console.log("[normalizar-y-dedup] DRY-RUN: no se tocó nada. Re-lanza con --confirm para aplicar.");
        return;
    }

    let fallos = 0;
    // 1) Re-normalizar primero (deja el norm correcto antes de deduplicar).
    for (const r of renormalizaciones) {
        try {
            await prisma.ciudad.update({ where: { id: r.id }, data: { nombreNormalizado: r.a } });
        } catch (error) {
            fallos++;
            console.error(`[normalizar-y-dedup] FALLO renorm id=${r.id}: ${error instanceof Error ? error.message : error}`);
        }
    }
    // 2) Desactivar las perdedoras (una fila por vez; nunca un lote atómico).
    for (const d of aDesactivar) {
        try {
            await prisma.ciudad.update({ where: { id: d.id }, data: { esActivo: false } });
        } catch (error) {
            fallos++;
            console.error(`[normalizar-y-dedup] FALLO dedup id=${d.id}: ${error instanceof Error ? error.message : error}`);
        }
    }

    console.log(
        `[normalizar-y-dedup] REALIZADO: ${renormalizaciones.length - 0} renorm intentadas, ` +
            `${aDesactivar.length} desactivaciones intentadas, ${fallos} fallos.`,
    );
    if (fallos > 0) process.exitCode = 1;
}

const esEjecucionDirecta =
    typeof process.argv[1] === "string" && process.argv[1].endsWith("normalizar-y-dedup-ciudades.ts");
if (esEjecucionDirecta) {
    main()
        .catch((error) => {
            console.error("[normalizar-y-dedup] Error:", error instanceof Error ? error.message : error);
            process.exitCode = 1;
        })
        .finally(async () => {
            await prisma.$disconnect();
        });
}
