/**
 * SPEC-371 · POBLADOR demo v3 — capa de gestión humana para BI.
 *
 *   dry-run (por defecto — mide y muestra el reparto, no escribe):
 *     node --env-file=.env --import tsx scripts/demo/poblar-demo-v3.ts \
 *       --motivo="poblar demo v3 gestión para BI"
 *   real:  ... --confirm
 *
 * Qué hace, en tres partes:
 *  1) OPERARIOS DEL COLEGIO: toma los N colegios demo con más alertas activas,
 *     usa su comité demo (`demo-u-cvi-NN`, uno por colegio porque
 *     `comiteColegioId` es único) como operario y le asigna una fracción
 *     DESIGUAL de sus alertas activas (≈70 % en total; ≈30 % quedan en la cola).
 *  2) CICLO DE VIDA: por cada reporte demo, la cadena de TransicionReporte que
 *     lleva de PENDIENTE hasta SU estado actual, con tiempos escalonados desde su
 *     `creadoEn` y nunca en el futuro. El `Reporte` NO se toca.
 *  3) COMITÉ: cada alerta demo "escalada" recibe su SolicitudComite (SPEC-168):
 *     unas PENDIENTE, otras RESUELTA — y al resolver, la alerta pasa a
 *     "gestionada", exactamente como hace el flujo real.
 *
 * Candados:
 *  · SOLO filas con marca demo. Cada UPDATE lleva en su `where` la marca del id
 *    Y la del colegio: una alerta real (Jelkin está probando la suya ahora
 *    mismo) no puede calzar. Además se cuenta el estado de las alertas REALES
 *    antes y después y se aborta si cambió.
 *  · Inserción directa: nada de pg-boss, Ollama ni correos.
 *  · Idempotente: ids deterministas `demo3-` + skipDuplicates; las asignaciones
 *    se saltan si ya están puestas.
 *  · Reversible con `borrar-demo-v3`. Sin fechas futuras.
 */
import { PrismaClient, Prisma } from "@prisma/client";
import { rng, parseArgs, requerirMotivo, log, registrarAuditoriaDemo } from "./_common";
import { DEMO3, id3, cadenaParaEstado, fechasEscalonadas, fraccionDe } from "./_common-v3";

const prisma = new PrismaClient();

/** Marcas de las filas del v1 sobre las que se trabaja (nunca se crean aquí). */
const ALERTA_V1 = { startsWith: "demo-al-" } as const;
const COLEGIO_V1 = { startsWith: "demo-c-" } as const;
const COMITE_V1 = "demo-u-cvi-";
const REPORTE_DEMO: Prisma.ReporteWhereInput = {
    OR: [{ id: { startsWith: "demo-r-" } }, { id: { startsWith: "demo2-r-" } }],
};

type Operario = { colegioId: string; usuarioId: string; fraccion: number; activas: string[]; asignar: string[] };

async function fotoAlertasReales() {
    // "Real" = sin marca demo. Se compara antes y después de escribir.
    const where: Prisma.AlertaColegioWhereInput = { NOT: { id: ALERTA_V1 } };
    const [total, asignadas, escaladas] = await Promise.all([
        prisma.alertaColegio.count({ where }),
        prisma.alertaColegio.count({ where: { ...where, asignadoAId: { not: null } } }),
        prisma.alertaColegio.count({ where: { ...where, estado: "escalada" } }),
    ]);
    return { total, asignadas, escaladas };
}

async function planOperarios(r: () => number): Promise<Operario[]> {
    const porColegio = await prisma.alertaColegio.groupBy({
        by: ["colegioId"],
        where: { id: ALERTA_V1, colegioId: COLEGIO_V1, estado: { not: "cerrada" } },
        _count: { _all: true },
        orderBy: { _count: { colegioId: "desc" } },
        take: DEMO3.nOperarios,
    });
    const operarios: Operario[] = [];
    for (const [i, g] of porColegio.entries()) {
        const comite = await prisma.usuario.findFirst({
            where: { id: { startsWith: COMITE_V1 }, comiteColegioId: g.colegioId, rol: "COMITE_CONVIVENCIA" },
            select: { id: true },
        });
        if (!comite) continue; // sin comité demo no hay a quién asignar
        const activas = await prisma.alertaColegio.findMany({
            where: { id: ALERTA_V1, colegioId: g.colegioId, estado: { not: "cerrada" } },
            select: { id: true, asignadoAId: true },
            orderBy: { id: "asc" },
        });
        const fraccion = fraccionDe(i);
        const objetivo = Math.round(activas.length * fraccion);
        // Determinista con la semilla: mismas alertas en cada corrida.
        const mezcla = [...activas].sort(() => r() - 0.5);
        const asignar = mezcla.slice(0, objetivo).filter((a) => a.asignadoAId === null).map((a) => a.id);
        operarios.push({ colegioId: g.colegioId, usuarioId: comite.id, fraccion, activas: activas.map((a) => a.id), asignar });
    }
    return operarios;
}

async function planTransiciones(r: () => number, ahora: Date) {
    // Un reporte demo que YA tenga historia ajena (en prod hay 117 transiciones y
    // no se sabe de quién) se salta: no se le duplica la historia. Las `demo3-`
    // propias no cuentan, para que la corrida siga siendo idempotente.
    const historiaAjena = { transiciones: { some: { NOT: { id: { startsWith: DEMO3.prefix } } } } } as const;
    const conHistoria = await prisma.reporte.count({ where: { ...REPORTE_DEMO, ...historiaAjena } });
    log("poblar-v3", `Reportes demo con historia previa ajena (se saltan, no se duplica): ${conHistoria}`);
    const reportes = await prisma.reporte.findMany({
        where: { ...REPORTE_DEMO, transiciones: { none: { NOT: { id: { startsWith: DEMO3.prefix } } } } },
        select: { id: true, estado: true, creadoEn: true },
    });
    const filas: Prisma.TransicionReporteCreateManyInput[] = [];
    const porEstado = new Map<string, number>();
    for (const rep of reportes) {
        const pasos = cadenaParaEstado(rep.estado, r);
        const fechas = fechasEscalonadas(rep.creadoEn, pasos, ahora);
        pasos.forEach((p, i) => {
            filas.push({
                id: id3.transicion(rep.id, i + 1),
                reporteId: rep.id,
                estadoAnterior: p.estadoAnterior,
                estadoNuevo: p.estadoNuevo,
                responsableTipo: p.responsableTipo,
                responsableId: null,
                motivo: p.motivo,
                creadoEn: fechas[i]!,
            });
            porEstado.set(p.estadoNuevo, (porEstado.get(p.estadoNuevo) ?? 0) + 1);
        });
    }
    return { filas, porEstado, reportes: reportes.length };
}

async function planSolicitudes(r: () => number, ahora: Date) {
    // Solo alertas demo escaladas SIN solicitud (SPEC-168: una por alerta y por reporte).
    const escaladas = await prisma.alertaColegio.findMany({
        where: { id: ALERTA_V1, colegioId: COLEGIO_V1, estado: "escalada", solicitudComite: null },
        select: { id: true, colegioId: true, reporteId: true, creadoEn: true, asignadoAId: true },
        orderBy: { id: "asc" },
    });
    const conSolicitudEnReporte = new Set(
        (await prisma.solicitudComite.findMany({
            where: { reporteId: { in: escaladas.map((a) => a.reporteId) } },
            select: { reporteId: true },
        })).map((s) => s.reporteId)
    );
    const solicitudes: Prisma.SolicitudComiteCreateManyInput[] = [];
    const aGestionada: string[] = [];
    let n = 0;
    for (const a of escaladas) {
        if (conSolicitudEnReporte.has(a.reporteId)) continue; // el reporte ya tiene la suya (unique)
        n += 1;
        const creadoEn = new Date(Math.min(a.creadoEn.getTime() + (2 + r() * 48) * 3_600_000, ahora.getTime()));
        const pendiente = r() < DEMO3.fraccionSolicitudesPendientes;
        const resueltoEn = pendiente
            ? null
            : new Date(Math.min(creadoEn.getTime() + (24 + r() * 240) * 3_600_000, ahora.getTime()));
        solicitudes.push({
            id: id3.solicitud(a.id),
            reporteId: a.reporteId,
            numero: id3.numeroSolicitud(n),
            estado: pendiente ? "PENDIENTE" : "RESUELTA",
            colegioId: a.colegioId,
            alertaColegioId: a.id,
            creadoPorId: a.asignadoAId ?? null,
            motivo: "Escalado al comité de convivencia por la gravedad del caso (demo).",
            resolucion: pendiente ? null : "Caso atendido por el comité: se activó el protocolo y se citó a la familia (demo).",
            creadoEn,
            resueltoEn,
        });
        if (!pendiente) aGestionada.push(a.id);
    }
    return { solicitudes, aGestionada, saltadas: escaladas.length - solicitudes.length };
}

async function ejecutar(motivo: string, confirm: boolean, semilla: number) {
    const ahora = new Date();
    const r = rng(semilla);
    log("poblar-v3", `INICIO — dry-run=${!confirm}, semilla=${semilla}, motivo="${motivo}"`);

    const realesAntes = await fotoAlertasReales();
    const operarios = await planOperarios(r);
    const trans = await planTransiciones(r, ahora);
    const sol = await planSolicitudes(r, ahora);

    // ---- Reporte del plan (lo que pide el CEO: % asignadas, reparto, transiciones por estado)
    const activasTotal = operarios.reduce((s, o) => s + o.activas.length, 0);
    const yaAsignadas = await prisma.alertaColegio.count({
        where: { id: ALERTA_V1, colegioId: { in: operarios.map((o) => o.colegioId) }, asignadoAId: { not: null } },
    });
    const asignarTotal = operarios.reduce((s, o) => s + o.asignar.length, 0);
    const pct = activasTotal ? Math.round(((yaAsignadas + asignarTotal) / activasTotal) * 100) : 0;
    log("poblar-v3", `Operarios (comités demo): ${operarios.length} · alertas activas en sus colegios: ${activasTotal}`);
    for (const o of operarios) {
        log("poblar-v3", `  ${o.usuarioId} (${o.colegioId}) → ${o.asignar.length} de ${o.activas.length} activas (fracción ${o.fraccion})`);
    }
    log("poblar-v3", `Quedarían asignadas ≈${pct} % (${yaAsignadas + asignarTotal}/${activasTotal}); ${activasTotal - yaAsignadas - asignarTotal} sin asignar (cola visible)`);
    log("poblar-v3", `Transiciones: ${trans.filas.length} sobre ${trans.reportes} reportes demo`);
    for (const [estado, n] of [...trans.porEstado].sort((a, b) => b[1] - a[1])) log("poblar-v3", `  → ${estado}: ${n}`);
    const pend = sol.solicitudes.filter((s) => s.estado === "PENDIENTE").length;
    log("poblar-v3", `Solicitudes al comité: ${sol.solicitudes.length} (PENDIENTE ${pend} · RESUELTA ${sol.solicitudes.length - pend}); alertas → gestionada: ${sol.aGestionada.length}; saltadas por unique: ${sol.saltadas}`);
    log("poblar-v3", `Alertas REALES (sin marca) antes: total ${realesAntes.total} · asignadas ${realesAntes.asignadas} · escaladas ${realesAntes.escaladas}`);

    if (!confirm) {
        log("poblar-v3", "Dry-run: no se escribió nada. Pasa --confirm para ejecutar de verdad.");
        return;
    }

    let asignadas = 0;
    for (const o of operarios) {
        if (o.asignar.length === 0) continue;
        // El where lleva LAS DOS marcas: id de alerta demo Y colegio demo.
        const res = await prisma.alertaColegio.updateMany({
            where: { id: { in: o.asignar, startsWith: "demo-al-" }, colegioId: { startsWith: "demo-c-" }, asignadoAId: null },
            data: { asignadoAId: o.usuarioId },
        });
        asignadas += res.count;
    }

    let transCreadas = 0;
    for (let i = 0; i < trans.filas.length; i += 500) {
        const res = await prisma.transicionReporte.createMany({ data: trans.filas.slice(i, i + 500), skipDuplicates: true });
        transCreadas += res.count;
    }

    const solCreadas = (await prisma.solicitudComite.createMany({ data: sol.solicitudes, skipDuplicates: true })).count;
    const gestionadas = sol.aGestionada.length
        ? (await prisma.alertaColegio.updateMany({
            where: { id: { in: sol.aGestionada, startsWith: "demo-al-" }, colegioId: { startsWith: "demo-c-" }, estado: "escalada" },
            data: { estado: "gestionada" },
        })).count
        : 0;

    // ---- Verificación dura: las alertas reales no se movieron ni un milímetro.
    const realesDespues = await fotoAlertasReales();
    if (JSON.stringify(realesAntes) !== JSON.stringify(realesDespues)) {
        throw new Error(`[poblar-v3] ¡Las alertas REALES cambiaron! antes=${JSON.stringify(realesAntes)} después=${JSON.stringify(realesDespues)}`);
    }

    await prisma.$transaction(async (tx) => {
        await registrarAuditoriaDemo(tx, "demo_poblar", motivo, asignadas + transCreadas + solCreadas, {
            version: "v3",
            prefijo: DEMO3.prefix,
            asignadas,
            porOperario: Object.fromEntries(operarios.map((o) => [o.usuarioId, o.asignar.length])),
            transiciones: transCreadas,
            transicionesPorEstado: Object.fromEntries(trans.porEstado),
            solicitudes: solCreadas,
            alertasGestionadas: gestionadas,
            alertasRealesIntactas: realesDespues,
        });
    });

    log("poblar-v3", `LISTO — asignadas ${asignadas} · transiciones ${transCreadas} · solicitudes ${solCreadas} · alertas a gestionada ${gestionadas}. Reales intactas.`);
}

async function main() {
    const args = parseArgs(process.argv);
    const motivo = requerirMotivo(typeof args.motivo === "string" ? args.motivo : undefined);
    const confirm = args.confirm === true;
    const semilla = typeof args.semilla === "string" ? Number.parseInt(args.semilla, 10) : 20260903;
    if (!Number.isFinite(semilla)) throw new Error("[poblar-v3] --semilla debe ser entero.");
    await ejecutar(motivo, confirm, semilla);
}

if (process.argv[1]?.endsWith("poblar-demo-v3.ts")) {
    main()
        .catch((err: unknown) => {
            console.error("[poblar-v3] Error:", err instanceof Error ? err.message : err);
            process.exitCode = 1;
        })
        .finally(() => prisma.$disconnect());
}
