/**
 * SPEC-580 (2026-09-07) — deduplicación del catálogo de ciudades.
 *
 * Hallazgo en producción: 37 pares de ciudades activas duplicadas en Colombia
 * (mismo nombreNormalizado + mismo departamentoId) provenientes de dos fuentes
 * (seed viejo 2026-07-27 e import GeoNames 2026-08-01) con nombres que difieren
 * solo en tildes, además del caso Bogotá: «Bogotá  D.C.» (doble espacio) vs
 * «Bogotá». El buscador de ciudades del reporte las mostraba todas.
 *
 * Regla: por grupo (nombreNormalizado con espacios colapsados + departamentoId)
 * se conserva la fila de MAYOR población (nulls last; empate → creadoEn más
 * antiguo) y se desactivan las demás (esActivo = false). NUNCA borra filas:
 * preserva referencias históricas y es reversible.
 *
 * Caso explícito: «Bogotá  D.C.» (doble espacio) se desactiva siempre que
 * exista otra «Bogotá» activa en el mismo departamento — el registro de colegio
 * (SPEC-240) busca el nombre exacto «Bogotá» vía findByNombreYPaisCodigo.
 *
 * Uso:
 *   node --env-file=.env --import tsx scripts/geo/dedup-ciudades.ts            # dry-run
 *   node --env-file=.env --import tsx scripts/geo/dedup-ciudades.ts --confirm  # aplica
 */
import { prisma } from "../../src/lib/prisma";

const APLICAR = process.argv.includes("--confirm");

export interface FilaCiudad {
    id: string;
    nombre: string;
    nombreNormalizado: string;
    departamentoId: string | null;
    poblacion: number | null;
    creadoEn: Date;
}

function normalizarClave(nombreNormalizado: string): string {
    return nombreNormalizado.replace(/\s+/g, " ").trim();
}

/**
 * Regla pura de deduplicación (testeable sin BD): devuelve las filas a
 * desactivar. Conserva mayor población (nulls last; empate → creadoEn más
 * antiguo) por grupo (nombreNormalizado colapsado + departamentoId), más el
 * caso explícito de «Bogotá  D.C.» (doble espacio) cediendo ante «Bogotá».
 */
export function calcularDesactivaciones(filas: FilaCiudad[]): Array<{ id: string; nombre: string; motivo: string }> {
    // Agrupa por (clave normalizada, departamentoId).
    const grupos = new Map<string, FilaCiudad[]>();
    for (const fila of filas) {
        const key = `${normalizarClave(fila.nombreNormalizado)}|${fila.departamentoId ?? "sin-depto"}`;
        const lista = grupos.get(key) ?? [];
        lista.push(fila);
        grupos.set(key, lista);
    }

    const aDesactivar: Array<{ id: string; nombre: string; motivo: string }> = [];

    for (const [key, lista] of grupos) {
        if (lista.length < 2) continue;
        const conservar = [...lista].sort((a, b) => {
            const pa = a.poblacion ?? -1;
            const pb = b.poblacion ?? -1;
            if (pb !== pa) return pb - pa;
            return a.creadoEn.getTime() - b.creadoEn.getTime();
        })[0];
        for (const fila of lista) {
            if (fila.id === conservar.id) continue;
            aDesactivar.push({
                id: fila.id,
                nombre: fila.nombre,
                motivo: `dup de «${conservar.nombre}» [${key}]`,
            });
        }
    }

    // Caso Bogotá: «Bogotá  D.C.» (doble espacio) siempre cede ante «Bogotá».
    const bogotaDc = filas.find(
        (f) => /\s{2,}/.test(f.nombre) && f.nombre.replace(/\s+/g, " ").trim() === "Bogotá D.C.",
    );
    const bogota = filas.find((f) => f.nombre === "Bogotá" && f.departamentoId === bogotaDc?.departamentoId);
    if (bogotaDc && bogota && !aDesactivar.some((d) => d.id === bogotaDc.id)) {
        aDesactivar.push({ id: bogotaDc.id, nombre: bogotaDc.nombre, motivo: "Bogotá con doble espacio — duplicada de «Bogotá»" });
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
            departamentoId: true,
            poblacion: true,
            creadoEn: true,
        },
    });

    const aDesactivar = calcularDesactivaciones(filas);

    console.log(`[dedup-ciudades] ${aDesactivar.length} ciudades duplicadas detectadas (modo ${APLICAR ? "REAL" : "DRY-RUN"}).`);
    for (const d of aDesactivar) {
        console.log(`[dedup-ciudades]   · ${d.nombre} — ${d.motivo}`);
    }

    if (!APLICAR) {
        console.log("[dedup-ciudades] DRY-RUN: no se tocó nada. Re-lanza con --confirm para aplicar.");
        return;
    }
    if (aDesactivar.length === 0) {
        console.log("[dedup-ciudades] Nada que desactivar. Catálogo sano.");
        return;
    }

    const resultado = await prisma.ciudad.updateMany({
        where: { id: { in: aDesactivar.map((d) => d.id) } },
        data: { esActivo: false },
    });
    console.log(`[dedup-ciudades] REALIZADO: ${resultado.count} ciudades desactivadas.`);
}

// Guard: al importarse desde un test no se ejecuta (solo corre vía tsx directo).
const esEjecucionDirecta = typeof process.argv[1] === "string" && process.argv[1].endsWith("dedup-ciudades.ts");
if (esEjecucionDirecta) {
    main()
        .catch((error) => {
            console.error("[dedup-ciudades] Error:", error instanceof Error ? error.message : error);
            process.exitCode = 1;
        })
        .finally(async () => {
            await prisma.$disconnect();
        });
}
