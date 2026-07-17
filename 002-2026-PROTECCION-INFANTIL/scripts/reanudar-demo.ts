#!/usr/bin/env tsx
/**
 * Reanuda el procesamiento de reportes demo con timeout y reintentos.
 * Resetea reportes atascados en PROCESANDO y procesa los PENDIENTES.
 * Uso:
 *   node --env-file=.env --import tsx scripts/reanudar-demo.ts --delay 1000 --timeout 30000
 */
import { PrismaClient, EstadoReporte } from "@prisma/client";

const prisma = new PrismaClient();

const API_BASE = process.env.API_BASE || "http://192.168.2.23:5005";
const WORKER_SECRET = process.env.WORKER_SECRET!;

if (!WORKER_SECRET) {
    console.error("[reanudar-demo] WORKER_SECRET no está definido. Seteá la variable de entorno antes de ejecutar este script.");
    process.exit(1);
}

function parseArgs() {
    const args = process.argv.slice(2);
    let delayMs = 1000;
    let timeoutMs = 30000;
    for (let i = 0; i < args.length; i++) {
        if (args[i] === "--delay" && args[i + 1]) delayMs = parseInt(args[i + 1], 10);
        if (args[i] === "--timeout" && args[i + 1]) timeoutMs = parseInt(args[i + 1], 10);
    }
    return { delayMs, timeoutMs };
}

async function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        return res;
    } finally {
        clearTimeout(timer);
    }
}

async function procesarReporte(reporteId: string, timeoutMs: number, intento = 1): Promise<{ estado: string; clasificacion?: { categoria?: string; confianza?: number }; error?: string }> {
    try {
        const res = await fetchWithTimeout(
            `${API_BASE}/api/reportes/procesar`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-worker-secret": WORKER_SECRET,
                },
                body: JSON.stringify({ reporteId }),
            },
            timeoutMs
        );
        if (!res.ok) {
            const body = await res.text();
            throw new Error(`HTTP ${res.status}: ${body}`);
        }
        return await res.json();
    } catch (err) {
        if (intento < 2) {
            await sleep(2000);
            return procesarReporte(reporteId, timeoutMs, intento + 1);
        }
        return { estado: "ERROR", error: err instanceof Error ? err.message : String(err) };
    }
}

async function main() {
    const { delayMs, timeoutMs } = parseArgs();

    // Resetear reportes demo atascados en PROCESANDO
    const reseteados = await prisma.reporte.updateMany({
        where: { numeroSeguimiento: { startsWith: "RPT-DEMO-" }, estado: "PROCESANDO" },
        data: { estado: "PENDIENTE", processingError: "Reseteado por reanudacion robusta" },
    });
    console.log(`${reseteados.count} reporte(s) en PROCESANDO reseteado(s) a PENDIENTE`);

    // Obtener pendientes
    const pendientes = await prisma.reporte.findMany({
        where: { numeroSeguimiento: { startsWith: "RPT-DEMO-" }, estado: "PENDIENTE" },
        orderBy: { creadoEn: "asc" },
        select: { id: true },
    });

    console.log(`${pendientes.length} reportes pendientes por procesar`);
    if (pendientes.length === 0) {
        await prisma.$disconnect();
        return;
    }

    let ok = 0;
    let error = 0;

    for (let i = 0; i < pendientes.length; i++) {
        const { id } = pendientes[i];
        process.stdout.write(`[${i + 1}/${pendientes.length}] ${id.slice(0, 8)}... `);
        const resultado = await procesarReporte(id, timeoutMs);
        if (resultado.estado === "ERROR") {
            error++;
            console.log(`ERROR: ${resultado.error}`);
        } else {
            ok++;
            const cat = resultado.clasificacion?.categoria || "-";
            const conf = resultado.clasificacion?.confianza?.toFixed(2) || "-";
            console.log(`${resultado.estado} | IA: ${cat} | conf: ${conf}`);
        }
        await sleep(delayMs + Math.random() * 500);
    }

    console.log("\n=== RESUMEN REANUDACION ===");
    console.log(`Procesados OK: ${ok}`);
    console.log(`Errores:       ${error}`);

    await prisma.$disconnect();
}

main().catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
});
