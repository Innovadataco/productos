/**
 * SPEC-412 · BORRADOR de lo sembrado — el gemelo reversible del poblador v5.
 *
 *   reporte previo (por defecto — no escribe nada):
 *     node --env-file=.env.test --import tsx scripts/demo/borrar-demo-marcado.ts \
 *       --motivo="revertir la siembra tras el recorrido del comité"
 *   real:
 *     ... --confirm
 *
 * Se llama "marcado" y no "v5" a propósito: borra **todo lo que esté registrado
 * en `demo_marcado`**, venga del poblador v5 o del marcado retroactivo de lo que
 * sembraron v1…v4. Esa es justamente la gracia de tener un marcador de verdad —
 * un solo borrador para toda la siembra, en vez de un `borrar-demo-vN` por
 * generación que hay que recordar correr en orden.
 *
 * Lo que NO hace: mirar prefijos de id, nombres o correos. Solo `demo_marcado`.
 */
import { PrismaClient } from "@prisma/client";
import { parseArgs, requerirMotivo, log } from "./_common";
import { planDeBorrado, ejecutarBorrado } from "./_borrado-marcado";

const prisma = new PrismaClient();

function mostrarPlan(plan: Awaited<ReturnType<typeof planDeBorrado>>): void {
    log("borrar-marcado", `Marcado en demo_marcado: ${plan.totalMarcado} filas.`);
    if (plan.totalMarcado === 0) {
        log("borrar-marcado", "No hay nada marcado. Si esperabas encontrar algo, corre antes marcar-retroactivo.ts.");
        return;
    }

    log("borrar-marcado", "Se borraría, por entidad:");
    for (const m of plan.marcadas) log("borrar-marcado", `  · ${m.entidad}: ${m.cantidad}`);

    if (plan.derivadas.length > 0) {
        log("borrar-marcado", "Y lo que cuelga de eso y no está marcado:");
        for (const d of plan.derivadas) log("borrar-marcado", `  · ${d.entidad}: ${d.cantidad}`);
    }

    log("borrar-marcado", "NO se toca (conteo previo, para comparar después):");
    for (const rl of plan.reales) log("borrar-marcado", `  · ${rl.entidad} real: ${rl.cantidad}`);

    if (plan.intocablesExcluidos.length > 0) {
        log("borrar-marcado", `AVISO: ${plan.intocablesExcluidos.length} INTOCABLE(s) aparecen marcados y se EXCLUYEN del borrado:`);
        for (const i of plan.intocablesExcluidos) log("borrar-marcado", `  · ${i}`);
    }
}

async function ejecutar(motivo: string, confirm: boolean): Promise<void> {
    log("borrar-marcado", `INICIO — dry-run=${!confirm}, motivo="${motivo}"`);

    const plan = await planDeBorrado(prisma);
    mostrarPlan(plan);

    if (!confirm) {
        log("borrar-marcado", "Dry-run: no se borró nada. Pasa --confirm para ejecutar de verdad.");
        return;
    }
    if (plan.totalMarcado === 0) return;

    const res = await ejecutarBorrado(prisma, motivo);
    log("borrar-marcado", "LISTO — borrado por entidad:");
    for (const [entidad, n] of Object.entries(res.borradas)) {
        if (n > 0) log("borrar-marcado", `  · ${entidad}: ${n}`);
    }
    log("borrar-marcado", `Marcas limpiadas de demo_marcado: ${res.marcadasLimpiadas}`);

    // Contraste posterior: lo real tiene que haber quedado igual que en el plan.
    const despues = await planDeBorrado(prisma);
    for (const antes of plan.reales) {
        const ahora = despues.reales.find((x) => x.entidad === antes.entidad);
        const igual = ahora?.cantidad === antes.cantidad;
        log("borrar-marcado", `  ${igual ? "OK" : "REVISAR"} ${antes.entidad} real: ${antes.cantidad} → ${ahora?.cantidad ?? "?"}`);
    }
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv);
    const motivo = requerirMotivo(typeof args.motivo === "string" ? args.motivo : undefined);
    await ejecutar(motivo, args.confirm === true);
}

if (process.argv[1]?.endsWith("borrar-demo-marcado.ts")) {
    main()
        .catch((err: unknown) => {
            console.error("[borrar-marcado] Error:", err instanceof Error ? err.message : err);
            process.exitCode = 1;
        })
        .finally(() => prisma.$disconnect());
}
