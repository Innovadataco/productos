/**
 * SPEC-265 (002-PI-168) — reset total de data de prueba del piloto.
 * SPEC-578 (D-113, 2026-09-07) — modo --purga-total y flag --backup-ya-tomado.
 *
 * Uso:
 *   node --env-file=.env --import tsx scripts/limpieza/reset-piloto.ts \
 *     --motivo="reset piloto agosto 2026" --confirm --backup=/tmp/backup.sql
 *
 * REQUIERE --confirm y exactamente uno de --backup / --backup-ya-tomado.
 * --backup ejecuta pg_dump; --backup-ya-tomado=<ruta> NO genera backup: solo
 * verifica que el archivo exista, pese >1KB y contenga "CREATE TABLE" antes de
 * tocar nada. Son mutuamente excluyentes.
 *
 * Orquesta borrar-colegio + borrar-padre + borrar-reporte + borrar-simulacion.
 *
 * SPEC-412 (BRIEF A-76 §3.3) — modo quirúrgico:
 *   ... --solo-sembrado
 * Con esa bandera NO borra todo: borra **solo lo registrado en `demo_marcado`**
 * y conserva intacto lo real, contándolo antes y después. Sin la bandera, el
 * comportamiento es exactamente el de siempre.
 *
 * SPEC-578 (D-113) — modo purga total:
 *   ... --purga-total
 * Borra TODO lo que la decisión del dueño del producto clasifica como dato de
 * prueba (incluidos los 3 reportes «evidencia viva» RPT-1RR278, RPT-2JFULR y
 * RPT-FA1C23 — D-113 revoca D-001 §5: en producción todo es data de prueba) y
 * preserva siempre la configuración del producto. Regla: preservar = config,
 * borrar = dato de prueba. Ver scripts/limpieza/CLASIFICACION-PURGA.md.
 *
 * PRESERVA SIEMPRE:
 *  - usuario `soporte@innovadataco.com`
 *  - seed/config permanente (ParametroSistema, Plan, notificacion_plantillas,
 *    notificacion_reglas, geo, Plataforma, TipoDocumento, ModuloPermisible y
 *    grants, GuiaAccionCategoria, ReglaRecomendacion, DatasetEntrenamiento,
 *    EmbeddingDataset, AuditLog)
 */
import { execSync } from "node:child_process";
import { openSync, readSync, closeSync, statSync } from "node:fs";
import { prisma } from "../../src/lib/prisma";
import {
    parseArgs,
    requerirMotivo,
    registrarAuditoria,
    log,
    PRESERVA_SIEMPRE,
    validarFlagsResetPiloto,
} from "./_common";
import { borrarColegio } from "./borrar-colegio";
import { borrarPadre } from "./borrar-padre";
import { borrarReporte } from "./borrar-reporte";
import { borrarSimulacion } from "./borrar-simulacion";
import { purgarTodo } from "./purga-total";
import { planDeBorrado, ejecutarBorrado } from "../demo/_borrado-marcado";

interface ResumenReset {
    backupSize: number;
    colegios: string[];
    padres: string[];
    reportesHuerfanos: string[];
    simulaciones: string[];
}

function ejecutarBackup(rutaBackup: string): number {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("[reset-piloto] DATABASE_URL no está definido");
    log("reset-piloto", `Ejecutando pg_dump → ${rutaBackup}`);
    execSync(`pg_dump "${url}" > "${rutaBackup}"`, { stdio: "inherit" });
    const size = statSync(rutaBackup).size;
    if (size < 1024) throw new Error(`[reset-piloto] Backup sospechosamente pequeño: ${size}B`);
    log("reset-piloto", `Backup OK — ${size} bytes`);
    return size;
}

/**
 * SPEC-578 · sanidad mínima de un backup tomado por fuera: existe, pesa >1KB y
 * los primeros 64KB contienen "CREATE TABLE" (pg_dump lo emite al inicio). Se
 * lee solo un buffer acotado: un dump real puede pesar cientos de MB.
 */
function verificarBackupYaTomado(ruta: string): number {
    let size: number;
    try {
        size = statSync(ruta).size;
    } catch {
        throw new Error(`[reset-piloto] --backup-ya-tomado: no existe el archivo: ${ruta}`);
    }
    if (size < 1024) {
        throw new Error(`[reset-piloto] --backup-ya-tomado: archivo sospechosamente pequeño: ${size}B`);
    }
    const fd = openSync(ruta, "r");
    try {
        const buffer = Buffer.alloc(64 * 1024);
        const leidos = readSync(fd, buffer, 0, buffer.length, 0);
        if (!buffer.subarray(0, leidos).toString("utf8").includes("CREATE TABLE")) {
            throw new Error('[reset-piloto] --backup-ya-tomado: el archivo no parece un pg_dump (sin "CREATE TABLE" en los primeros 64KB)');
        }
    } finally {
        closeSync(fd);
    }
    log("reset-piloto", `Backup previo verificado — ${size} bytes`);
    return size;
}

/**
 * SPEC-412 · el reset quirúrgico. Se apoya en `demo_marcado`, no en nombres ni
 * en prefijos de id: un colegio real llamado "Colegio Demo" no corre peligro.
 * Si algo NO marcado cuelga de algo marcado, la transacción falla entera y lo
 * dice — no se borra a ciegas para destrabar.
 */
async function resetSoloSembrado(motivo: string, backupSize: number): Promise<void> {
    const antes = await planDeBorrado(prisma);
    log("reset-piloto", `MODO --solo-sembrado — ${antes.totalMarcado} filas marcadas en demo_marcado.`);
    for (const m of antes.marcadas) log("reset-piloto", `  · ${m.entidad}: ${m.cantidad}`);
    log("reset-piloto", "NO se toca:");
    for (const r of antes.reales) log("reset-piloto", `  · ${r.entidad} real: ${r.cantidad}`);

    if (antes.totalMarcado === 0) {
        log("reset-piloto", "Nada marcado: no hay nada que borrar. Corre antes scripts/demo/marcar-retroactivo.ts.");
        return;
    }

    const res = await ejecutarBorrado(prisma, motivo);
    const total = Object.values(res.borradas).reduce((a, b) => a + b, 0);

    const despues = await planDeBorrado(prisma);
    for (const a of antes.reales) {
        const d = despues.reales.find((x) => x.entidad === a.entidad);
        log("reset-piloto", `  ${d?.cantidad === a.cantidad ? "OK" : "REVISAR"} ${a.entidad} real: ${a.cantidad} → ${d?.cantidad ?? "?"}`);
    }

    await prisma.$transaction(async (tx) => {
        await registrarAuditoria(tx, "reset_piloto", `${motivo} [solo-sembrado]`, total, Object.keys(res.borradas));
    });

    log("reset-piloto", `REALIZADO --solo-sembrado backup=${backupSize}B filas=${total} marcas=${res.marcadasLimpiadas}`);
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv);
    const motivo = requerirMotivo(typeof args.motivo === "string" ? args.motivo : undefined);
    const flags = validarFlagsResetPiloto(args);

    const backupSize = flags.backupYaTomado
        ? verificarBackupYaTomado(flags.backupYaTomado)
        : ejecutarBackup(flags.backup);

    // SPEC-412: modo quirúrgico. Cae SOLO lo que está en `demo_marcado`; lo real
    // se cuenta antes y después y tiene que quedar igual.
    if (flags.soloSembrado) {
        await resetSoloSembrado(motivo, backupSize);
        return;
    }

    // SPEC-578 (D-113): purga total. Borra todo lo clasificado como dato de
    // prueba (incluidos los 3 reportes «evidencia viva») y deja intacta la
    // config; con compuerta de preservados + Reporte=0 al final.
    if (flags.purgaTotal) {
        const resumen = await purgarTodo(prisma, {
            motivo,
            confirm: true,
            emailsPreservados: PRESERVA_SIEMPRE.usuarios,
        });
        log("reset-piloto", `REALIZADO --purga-total backup=${backupSize}B filas=${resumen.filasBorradas} compuerta=OK`);
        return;
    }

    // A-66 (b): pre-borrado global del subárbol identificadores+alertas en orden
    // FK-safe ANTES del loop por colegio. Necesario porque AlertaColegio cruza
    // tenants (alertas.ts:94 buscarActivosPorValor): una alerta del colegio Y puede
    // referenciar un identificador del colegio X, por lo que borrar colegio X sin
    // haber eliminado esa alerta de Y causa FK. El pre-borrado global evita tener
    // que rastrear esa red cross-tenant desde borrar-colegio individualmente.
    log("reset-piloto", "Pre-borrado global: SolicitudComite, AlertaColegio, identificadores, observaciones...");
    await prisma.$transaction(async (tx) => {
        await tx.solicitudComite.deleteMany({});
        await tx.notaSeguimiento.deleteMany({});
        // SPEC-351: InformeCaso sin Cascade — explícito antes del caso.
        await tx.informeCaso.deleteMany({});
        await tx.seguimientoCaso.deleteMany({});
        await tx.alertaColegio.deleteMany({});
        await tx.identificadorProfesor.deleteMany({});
        await tx.identificadorEstudiante.deleteMany({});
        await tx.identificadorAcudiente.deleteMany({});
        await tx.estudianteObservacion.deleteMany({});
        await tx.acudienteEstudiante.deleteMany({});
    });
    log("reset-piloto", "Pre-borrado global completado.");

    const colegios = await prisma.colegio.findMany({ select: { id: true, nombre: true } });
    log("reset-piloto", `Colegios a borrar: ${colegios.length}`);
    for (const c of colegios) {
        await borrarColegio(c.id, motivo, { confirm: true, client: prisma });
    }

    const padres = await prisma.usuario.findMany({
        where: {
            rol: "PARENT",
            email: { notIn: [...PRESERVA_SIEMPRE.usuarios] },
        },
        select: { id: true, email: true },
    });
    log("reset-piloto", `Padres a borrar: ${padres.length}`);
    for (const p of padres) {
        await borrarPadre(p.email, motivo, { confirm: true, client: prisma });
    }

    // SPEC-578 (D-113): la exclusión de «evidencia viva» quedó anulada — los
    // reportes RPT-1RR278/RPT-2JFULR/RPT-FA1C23 también son dato de prueba.
    const reportesHuerfanos = await prisma.reporte.findMany({
        where: {
            tenantId: null,
            usuarioId: null,
        },
        select: { id: true, numeroSeguimiento: true },
    });
    log("reset-piloto", `Reportes huérfanos a borrar: ${reportesHuerfanos.length}`);
    for (const r of reportesHuerfanos) {
        await borrarReporte(r.id, motivo, { confirm: true, client: prisma });
    }

    const simulaciones = await prisma.simulacionRun.findMany({ select: { id: true } });
    log("reset-piloto", `Simulaciones a borrar: ${simulaciones.length}`);
    for (const s of simulaciones) {
        await borrarSimulacion(s.id, motivo, { confirm: true, client: prisma });
    }

    const resumen: ResumenReset = {
        backupSize,
        colegios: colegios.map((c) => c.id),
        padres: padres.map((p) => p.email),
        reportesHuerfanos: reportesHuerfanos.map((r) => r.numeroSeguimiento ?? r.id),
        simulaciones: simulaciones.map((s) => s.id),
    };
    const totalIds =
        resumen.colegios.length +
        resumen.padres.length +
        resumen.reportesHuerfanos.length +
        resumen.simulaciones.length;

    await prisma.$transaction(async (tx) => {
        await registrarAuditoria(
            tx,
            "reset_piloto",
            motivo,
            totalIds,
            [
                ...resumen.colegios,
                ...resumen.padres,
                ...resumen.reportesHuerfanos,
                ...resumen.simulaciones,
            ],
        );
    });

    log("reset-piloto", `REALIZADO backup=${backupSize}B colegios=${resumen.colegios.length} padres=${resumen.padres.length} reportes=${resumen.reportesHuerfanos.length} simulaciones=${resumen.simulaciones.length}`);
}

if (process.argv[1]?.endsWith("reset-piloto.ts")) {
    main()
        .catch((err: unknown) => {
            console.error("[reset-piloto] Error:", err instanceof Error ? err.message : err);
            process.exitCode = 1;
        })
        .finally(() => prisma.$disconnect());
}
