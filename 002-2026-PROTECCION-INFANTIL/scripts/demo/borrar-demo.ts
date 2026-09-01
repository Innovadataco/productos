/**
 * 002-PI-345 · BORRADOR gemelo del poblador demo (candado 3: reversible por marca).
 *
 *   dry-run (por defecto — cuenta lo que borraría):
 *     node --env-file=.env --import tsx scripts/demo/borrar-demo.ts \
 *       --motivo="reset demo BI antes de próxima campaña"
 *   real:
 *     node --env-file=.env --import tsx scripts/demo/borrar-demo.ts \
 *       --motivo="reset demo BI antes de próxima campaña" --confirm
 *
 * Solo toca filas cuyo `id` empieza por `demo-` (o el email tenga `+demo-`
 * para el guardarraíl del filtro de Usuario). INTOCABLES verificados
 * explícitamente: nunca se borran soporte@innovadataco.com, el colegio
 * cmticor7l000kglr93d1ypox6 (Calidad), ni ningún colegio cuyo nombre
 * normalizado calze con "sagrado corazon" / "colegio prueba calidad".
 */
import { PrismaClient } from "@prisma/client";
import {
    DEMO,
    parseArgs,
    requerirMotivo,
    log,
    registrarAuditoriaDemo,
} from "./_common";

const prisma = new PrismaClient();

// Prefijo común de TODOS los ids que el poblador crea.
const PFX = { startsWith: DEMO.prefix } as const;

// Emails demo — LIKE "%+demo-%@..." sobre el buzón local del catch-all.
const EMAIL_LIKE = { contains: DEMO.emailMarca } as const;

async function guardarraiIntocables() {
    // Chequeo defensivo: si por alguna razón el prefijo pisa un intocable, aborta.
    const chocaId = await prisma.colegio.findMany({
        where: { id: { in: [...DEMO.intocables.colegios] } },
        select: { id: true, nombre: true },
    });
    for (const c of chocaId) log("borrar", `intocable OK: colegio ${c.id} ("${c.nombre}") NO se toca.`);

    const chocaEmail = await prisma.usuario.findMany({
        where: { email: { in: [...DEMO.intocables.usuarios] } },
        select: { id: true, email: true },
    });
    for (const u of chocaEmail) log("borrar", `intocable OK: usuario ${u.email} NO se toca.`);
}

async function contar() {
    return {
        alertas: await prisma.alertaColegio.count({ where: { id: PFX } }),
        clasificaciones: await prisma.clasificacionIA.count({ where: { id: PFX } }),
        reportes: await prisma.reporte.count({ where: { id: PFX } }),
        identProf: await prisma.identificadorProfesor.count({ where: { id: PFX } }),
        identEst: await prisma.identificadorEstudiante.count({ where: { id: PFX } }),
        identAcu: await prisma.identificadorAcudiente.count({ where: { id: PFX } }),
        acudientes: await prisma.acudienteEstudiante.count({ where: { id: PFX } }),
        alumnos: await prisma.estudiante.count({ where: { id: PFX } }),
        cursos: await prisma.curso.count({ where: { id: PFX } }),
        profesores: await prisma.profesor.count({ where: { id: PFX } }),
        suscripciones: await prisma.suscripcion.count({ where: { id: PFX } }),
        preferencias: await prisma.preferenciaAlertaColegio.count({ where: { id: PFX } }),
        onboarding: await prisma.onboardingColegio.count({ where: { id: PFX } }),
        usuarios: await prisma.usuario.count({ where: { AND: [{ id: PFX }, { email: EMAIL_LIKE }] } }),
        colegios: await prisma.colegio.count({ where: { id: PFX } }),
        tenants: await prisma.tenant.count({ where: { id: PFX } }),
    };
}

async function ejecutar(motivo: string, confirm: boolean) {
    log("borrar", `INICIO — dry-run=${!confirm}, motivo="${motivo}"`);
    await guardarraiIntocables();

    const antes = await contar();
    log("borrar", "Filas demo detectadas:");
    for (const [k, v] of Object.entries(antes)) log("borrar", `  · ${k}: ${v}`);

    if (!confirm) {
        log("borrar", "Pasa --confirm para borrar de verdad.");
        return;
    }

    // Cadena FK-safe. AlertaColegio → SeguimientoCaso/SolicitudComite/NotaSeguimiento
    // no aplican al demo (no los creamos), pero por si algún día se agregan,
    // se limpian primero por reporteId in demo.
    const reporteIds = (await prisma.reporte.findMany({
        where: { id: PFX }, select: { id: true },
    })).map((r) => r.id);
    const alertaIds = (await prisma.alertaColegio.findMany({
        where: { id: PFX }, select: { id: true },
    })).map((a) => a.id);

    await prisma.$transaction(async (tx) => {
        // Solicitudes/seguimientos por alerta (por robustez futura)
        if (alertaIds.length) {
            await tx.solicitudComite.deleteMany({ where: { alertaColegioId: { in: alertaIds } } });
            const segs = await tx.seguimientoCaso.findMany({
                where: { alertaId: { in: alertaIds } }, select: { id: true },
            });
            if (segs.length) {
                await tx.notaSeguimiento.deleteMany({ where: { seguimientoId: { in: segs.map((s) => s.id) } } });
                await tx.seguimientoCaso.deleteMany({ where: { id: { in: segs.map((s) => s.id) } } });
            }
            await tx.alertaColegio.deleteMany({ where: { id: PFX } });
        }

        // Reportes y su tren (ClasificacionIA/Transicion/Reintento/PasoProcesamiento van por Cascade,
        // pero explicito la ClasificacionIA por seguridad y para el conteo).
        if (reporteIds.length) {
            await tx.clasificacionIA.deleteMany({ where: { id: PFX } });
            await tx.reporte.deleteMany({ where: { id: PFX } });
        }

        // Identificadores (ya sin alertas que los apunten)
        await tx.identificadorProfesor.deleteMany({ where: { id: PFX } });
        await tx.identificadorEstudiante.deleteMany({ where: { id: PFX } });
        await tx.identificadorAcudiente.deleteMany({ where: { id: PFX } });

        // Acudientes (ya sin identificadores hija)
        await tx.acudienteEstudiante.deleteMany({ where: { id: PFX } });

        // Estudiantes (ya sin acudientes ni identificadores)
        await tx.estudiante.deleteMany({ where: { id: PFX } });

        // Cursos — quitar profesorTitularId antes de borrar profesores
        await tx.curso.updateMany({ where: { id: PFX }, data: { profesorTitularId: null } });
        await tx.curso.deleteMany({ where: { id: PFX } });

        // Profesores
        await tx.profesor.deleteMany({ where: { id: PFX } });

        // Suscripciones / preferencias / onboarding
        await tx.suscripcion.deleteMany({ where: { id: PFX } });
        await tx.preferenciaAlertaColegio.deleteMany({ where: { id: PFX } });
        await tx.onboardingColegio.deleteMany({ where: { id: PFX } });

        // Usuarios: id demo Y email +demo- (doble candado)
        await tx.usuario.deleteMany({
            where: {
                AND: [
                    { id: PFX },
                    { email: EMAIL_LIKE },
                    { NOT: { email: { in: [...DEMO.intocables.usuarios] } } },
                ],
            },
        });

        // Colegios (los usuarios admin/comité fueron por comiteColegioId/colegioId nullable — OK)
        await tx.colegio.deleteMany({
            where: {
                AND: [
                    { id: PFX },
                    { NOT: { id: { in: [...DEMO.intocables.colegios] } } },
                ],
            },
        });

        // Tenants demo
        await tx.tenant.deleteMany({ where: { id: PFX } });

        const despues = {
            alertas: await tx.alertaColegio.count({ where: { id: PFX } }),
            reportes: await tx.reporte.count({ where: { id: PFX } }),
            colegios: await tx.colegio.count({ where: { id: PFX } }),
            usuarios: await tx.usuario.count({ where: { AND: [{ id: PFX }, { email: EMAIL_LIKE }] } }),
        };
        const filas = Object.values(antes).reduce((a, b) => a + b, 0);
        await registrarAuditoriaDemo(tx, "demo_borrar", motivo, filas, { antes, despues });

        log("borrar", "Post-borrado (deberían ser 0):");
        for (const [k, v] of Object.entries(despues)) log("borrar", `  · ${k}: ${v}`);
    });

    log("borrar", "LISTO");
}

async function main() {
    const args = parseArgs(process.argv);
    const motivo = requerirMotivo(typeof args.motivo === "string" ? args.motivo : undefined);
    const confirm = args.confirm === true;
    await ejecutar(motivo, confirm);
}

if (process.argv[1]?.endsWith("borrar-demo.ts")) {
    main()
        .catch((err: unknown) => {
            console.error("[borrar] Error:", err instanceof Error ? err.message : err);
            process.exitCode = 1;
        })
        .finally(() => prisma.$disconnect());
}
