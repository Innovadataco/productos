/**
 * SPEC-442 (I-307) · Reparación hacia atrás: colegios que quedaron con 0 cursos
 * activos (creados antes de SPEC-344 o por un camino que no invocaba la siembra).
 *
 * Idempotente: usa `sembrarSemillaColegio`, que a su vez usa `crearCursosPorDefecto`
 * con `findFirst → create`. Correrlo dos veces NO duplica, ni sobre el colegio
 * que el CEO ya reparó a mano en producción (`sagrado corazon` está en 11).
 *
 * Uso:
 *   node --env-file=<env> --import tsx scripts/spec-442-reparar-colegios-sin-cursos.ts [--dry-run]
 *
 *   --dry-run  · imprime el plan (colegios a reparar) sin escribir.
 *
 * El script NO acepta banderas extra y no toca ninguna otra tabla. Se ejecuta
 * por el CEO (regla: reparaciones en prod vienen como script del PR).
 */
import { prisma } from "@/lib/prisma";
import { sembrarSemillaColegio } from "@/lib/colegio/semilla-colegio";

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
    console.log(`[SPEC-442] Reparación de colegios con 0 cursos activos${DRY_RUN ? " (dry-run)" : ""}.`);

    // Buscamos colegios ACTIVOS con 0 cursos activos. Un colegio inactivo o
    // desactivado no debe pasar por acá; su vida ya terminó.
    const colegios = await prisma.colegio.findMany({
        where: { estado: "activo" },
        select: {
            id: true,
            nombre: true,
            creadoEn: true,
            _count: { select: { cursos: { where: { estado: "activo" } } } },
        },
    });

    const sinCursos = colegios.filter((c) => c._count.cursos === 0);
    console.log(`[SPEC-442] Colegios activos totales: ${colegios.length}.`);
    console.log(`[SPEC-442] Colegios sin cursos activos: ${sinCursos.length}.`);
    if (sinCursos.length === 0) {
        console.log("[SPEC-442] Nada que reparar. (Idempotente: si ya corriste, sale acá.)");
        return;
    }

    for (const c of sinCursos) {
        console.log(`[SPEC-442] · ${c.id} · «${c.nombre}» · creado ${c.creadoEn.toISOString()}`);
        if (DRY_RUN) continue;
        const resumen = await sembrarSemillaColegio(c.id, prisma);
        console.log(`[SPEC-442]   → cursos activos: ${resumen.cursosActivos} · materias: ${resumen.materias} · onboarding creado: ${resumen.onboardingCreado}`);
    }
    console.log(`[SPEC-442] Fin${DRY_RUN ? " (dry-run · no se escribió nada)" : ""}.`);
}

main()
    .catch((err) => {
        console.error("[SPEC-442] Fallo:", err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect().catch(() => undefined);
    });
