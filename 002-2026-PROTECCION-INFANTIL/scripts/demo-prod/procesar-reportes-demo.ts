#!/usr/bin/env tsx
/**
 * Procesa los reportes demo PENDIENTES con el motor real vía API interna del worker.
 * Uso:
 *   node --env-file=.env --import tsx scripts/demo-prod/procesar-reportes-demo.ts [--resumir] [--delay 1000] [--timeout 60000]
 */
import { prisma } from "./lib/prisma";
import { marcarDemo } from "./lib/marcar";
import { CORRIDA } from "./lib/config";

interface ProcesarResponse {
    reporteId?: string;
    estado?: string;
    clasificacion?: { categoria?: string } | null;
    corteGuardaPrevia?: boolean;
}

interface ResultadoReporte {
    reporteId: string;
    ok: boolean;
    estado?: string | undefined;
    categoria?: string | undefined;
    error?: string | undefined;
}

function parseArgs(): { resumir: boolean; delay: number; timeout: number } {
    const args = process.argv.slice(2);
    let resumir = false;
    let delay = 1000;
    let timeout = 60000;
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--resumir") {
            resumir = true;
        } else if (arg === "--delay") {
            const valor = args[i + 1];
            if (valor) {
                delay = Number(valor);
                i++;
            }
        } else if (arg === "--timeout") {
            const valor = args[i + 1];
            if (valor) {
                timeout = Number(valor);
                i++;
            }
        }
    }
    return { resumir, delay, timeout };
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function esProcesarResponse(obj: unknown): obj is ProcesarResponse {
    return typeof obj === "object" && obj !== null;
}

function categoriaDesdeResultado(resultado: ProcesarResponse): string | undefined {
    if (resultado.corteGuardaPrevia) return "OTRO (guarda previa)";
    return resultado.clasificacion?.categoria ?? resultado.estado ?? undefined;
}

async function obtenerReportesPendientesDemo(): Promise<{ id: string; identificador: string; plataformaId: string }[]> {
    const marcados = await prisma.demoMarcado.findMany({
        where: { entidad: "Reporte" },
        select: { entidadId: true },
    });
    const ids = marcados.map((m) => m.entidadId);
    if (ids.length === 0) return [];
    return prisma.reporte.findMany({
        where: { id: { in: ids }, estado: "PENDIENTE" },
        orderBy: { creadoEn: "asc" },
        select: { id: true, identificador: true, plataformaId: true },
    });
}

async function resumirProcesando(): Promise<number> {
    const marcados = await prisma.demoMarcado.findMany({
        where: { entidad: "Reporte" },
        select: { entidadId: true },
    });
    const ids = marcados.map((m) => m.entidadId);
    if (ids.length === 0) return 0;

    const resultado = await prisma.reporte.updateMany({
        where: { id: { in: ids }, estado: "PROCESANDO" },
        data: { estado: "PENDIENTE" },
    });
    return resultado.count;
}

async function marcarDerivados(reporteId: string, identificador: string, plataformaId: string, inicio: Date): Promise<void> {
    const [clasificacion, transiciones, pasos, reintentos, fuente, embedding, alertas, solicitud] = await Promise.all([
        prisma.clasificacionIA.findUnique({ where: { reporteId } }),
        prisma.transicionReporte.findMany({ where: { reporteId } }),
        prisma.pasoProcesamiento.findMany({ where: { reporteId } }),
        prisma.reintentoReporte.findMany({ where: { reporteId } }),
        prisma.fuenteReporte.findUnique({ where: { reporteId } }),
        prisma.embeddingReporte.findUnique({ where: { reporteId } }),
        prisma.alertaColegio.findMany({ where: { reporteId } }),
        prisma.solicitudComite.findUnique({ where: { reporteId } }),
    ]);

    const entidades: { entidad: string; id: string }[] = [];
    if (clasificacion) entidades.push({ entidad: "ClasificacionIA", id: clasificacion.id });
    for (const t of transiciones) entidades.push({ entidad: "TransicionReporte", id: t.id });
    for (const p of pasos) entidades.push({ entidad: "PasoProcesamiento", id: p.id });
    for (const r of reintentos) entidades.push({ entidad: "ReintentoReporte", id: r.id });
    if (fuente) entidades.push({ entidad: "FuenteReporte", id: fuente.id });
    if (embedding) entidades.push({ entidad: "EmbeddingReporte", id: embedding.id });
    for (const a of alertas) entidades.push({ entidad: "AlertaColegio", id: a.id });
    if (solicitud) entidades.push({ entidad: "SolicitudComite", id: solicitud.id });

    const colegiosIds = Array.from(new Set(alertas.map((a) => a.colegioId)));
    const alertaIds = alertas.map((a) => a.id);
    const patronIds = Array.from(new Set(alertas.map((a) => a.patronInstitucionalId).filter((id): id is string => Boolean(id))));

    const [seguimientos, registrosAviso, patrones, identReportado, eventoMatch] = await Promise.all([
        alertaIds.length > 0 ? prisma.seguimientoCaso.findMany({ where: { alertaId: { in: alertaIds } } }) : Promise.resolve([]),
        colegiosIds.length > 0
            ? prisma.registroAvisoColegio.findMany({
                where: { colegioId: { in: colegiosIds }, creadoEn: { gte: inicio } },
            })
            : Promise.resolve([]),
        patronIds.length > 0
            ? prisma.patronInstitucional.findMany({
                where: { id: { in: patronIds }, creadoEn: { gte: inicio } },
            })
            : Promise.resolve([]),
        prisma.identificadorReportado.findFirst({
            where: { identificador, plataformaId, creadoEn: { gte: inicio } },
        }),
        prisma.eventoMatch.findFirst({
            where: { reporteNuevoId: reporteId, creadoEn: { gte: inicio } },
        }),
    ]);

    const seguimientoIds = seguimientos.map((s) => s.id);
    const notas =
        seguimientoIds.length > 0
            ? await prisma.notaSeguimiento.findMany({ where: { seguimientoId: { in: seguimientoIds } } })
            : [];

    for (const s of seguimientos) entidades.push({ entidad: "SeguimientoCaso", id: s.id });
    for (const n of notas) entidades.push({ entidad: "NotaSeguimiento", id: n.id });
    for (const r of registrosAviso) entidades.push({ entidad: "RegistroAvisoColegio", id: r.id });
    for (const p of patrones) entidades.push({ entidad: "PatronInstitucional", id: p.id });
    if (identReportado) entidades.push({ entidad: "IdentificadorReportado", id: identReportado.id });
    if (eventoMatch) entidades.push({ entidad: "EventoMatch", id: eventoMatch.id });

    for (const { entidad, id } of entidades) {
        await marcarDemo(entidad, id, { corrida: CORRIDA, script: "procesar-reportes-demo" });
    }
}

async function main() {
    const { resumir, delay, timeout } = parseArgs();
    const API_BASE = process.env.API_BASE ?? "http://localhost:5005";
    const WORKER_SECRET = process.env.WORKER_SECRET;
    if (!WORKER_SECRET) throw new Error("WORKER_SECRET no está definido");

    if (resumir) {
        const reseteados = await resumirProcesando();
        console.log(`[procesar-reportes-demo] Resumir: ${reseteados} reportes reseteados de PROCESANDO a PENDIENTE`);
    }

    const reportes = await obtenerReportesPendientesDemo();
    if (reportes.length === 0) {
        console.log("[procesar-reportes-demo] No hay reportes demo PENDIENTES para procesar.");
        await prisma.$disconnect();
        return;
    }

    console.log(`[procesar-reportes-demo] Procesando ${reportes.length} reportes demo contra ${API_BASE}`);
    const inicioScript = new Date();
    const resultados: ResultadoReporte[] = [];
    const conteoCategorias: Map<string, number> = new Map();
    let okCount = 0;
    let errorCount = 0;

    for (let i = 0; i < reportes.length; i++) {
        const reporte = reportes[i];
        if (!reporte) continue;
        console.log(`[procesar-reportes-demo] ${i + 1}/${reportes.length} — reporte ${reporte.id}`);

        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeout);
            const response = await fetch(`${API_BASE}/api/reportes/procesar`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Worker-Secret": WORKER_SECRET,
                },
                body: JSON.stringify({ reporteId: reporte.id }),
                signal: controller.signal,
            });
            clearTimeout(timer);

            const raw = (await response.json().catch(() => ({}))) as unknown;
            if (!response.ok || !esProcesarResponse(raw)) {
                const mensaje = typeof raw === "object" && raw !== null && "error" in raw ? JSON.stringify(raw) : `HTTP ${response.status}`;
                throw new Error(mensaje);
            }

            await marcarDerivados(reporte.id, reporte.identificador, reporte.plataformaId, inicioScript);

            const categoria = categoriaDesdeResultado(raw);
            if (categoria) {
                conteoCategorias.set(categoria, (conteoCategorias.get(categoria) ?? 0) + 1);
            }
            resultados.push({ reporteId: reporte.id, ok: true, estado: raw.estado, categoria });
            okCount++;
        } catch (err: unknown) {
            const mensaje = err instanceof Error ? err.message : String(err);
            resultados.push({ reporteId: reporte.id, ok: false, error: mensaje });
            errorCount++;
            console.error(`[procesar-reportes-demo] Error reporte ${reporte.id}: ${mensaje}`);
        }

        if (delay > 0 && i < reportes.length - 1) {
            await sleep(delay);
        }
    }

    console.log("\n[procesar-reportes-demo] Resumen");
    console.log(`  Total:    ${reportes.length}`);
    console.log(`  OK:       ${okCount}`);
    console.log(`  Errores:  ${errorCount}`);
    console.log("  Categorías:");
    for (const [categoria, count] of conteoCategorias.entries()) {
        console.log(`    ${categoria}: ${count}`);
    }

    if (errorCount > 0) {
        const fallidos = resultados.filter((r) => !r.ok).map((r) => r.reporteId);
        console.log(`  Reportes con error: ${fallidos.join(", ")}`);
    }

    await prisma.$disconnect();
}

main().catch(async (e: unknown) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
});
