/**
 * SPEC-265 (002-PI-168) — helpers compartidos para scripts de limpieza.
 * AuditLog usa LOGS_MANTENIMIENTO_PURGA (existente, SPEC-193) con metadatos.tipo
 * como discriminador para respetar el candado "cero migraciones".
 */
import type { PrismaClient, Prisma } from "@prisma/client";

export type TipoPurga = "colegio" | "padre" | "reporte" | "simulacion" | "reset_piloto";

export interface ArgsBase {
    confirm: boolean;
    motivo: string;
}

export function parseArgs(argv: string[]): Record<string, string | boolean> {
    const args: Record<string, string | boolean> = {};
    for (const raw of argv.slice(2)) {
        if (!raw.startsWith("--")) continue;
        const [k, v] = raw.slice(2).split("=");
        if (!k) continue;
        args[k] = v === undefined ? true : v;
    }
    return args;
}

export function requerirMotivo(motivo: string | undefined): string {
    if (!motivo || motivo.length < 20) {
        throw new Error(
            "[limpieza] Falta --motivo=<texto>. Mínimo 20 caracteres. Ejemplo: --motivo=\"limpieza de piloto agosto 2026\""
        );
    }
    return motivo;
}

export async function registrarAuditoria(
    tx: Prisma.TransactionClient,
    tipo: TipoPurga,
    motivo: string,
    filasBorradas: number,
    idsAfectados: string[],
    ejecutadoPorId?: string,
): Promise<void> {
    await tx.auditLog.create({
        data: {
            accion: "LOGS_MANTENIMIENTO_PURGA",
            tipoRecurso: "PurgaData",
            usuarioId: ejecutadoPorId ?? null,
            ipAddress: "script",
            userAgent: `scripts/limpieza/${tipo}`,
            metadatos: {
                tipo,
                motivo,
                filasBorradas,
                idsAfectados,
            } satisfies Prisma.InputJsonValue,
        },
    });
}

export const PRESERVADOS = {
    usuarios: ["soporte@innovadataco.com"],
    // Reportes que NO borra reset-piloto (D-001 §5, evidencia viva I-105/I-100/I-113/I-114/I-121).
    reportesExcluidos: ["RPT-1RR278", "RPT-2JFULR", "RPT-FA1C23"],
    // Tablas que NUNCA se tocan (seed permanente).
    tablas: [
        "ParametroSistema",
        "Plan",
        "notificacion_reglas",
        "notificacion_plantillas",
        "Pais",
        "Departamento",
        "Ciudad",
        "Plataforma",
        "ModuloPermisible",
        "GuiaAccionCategoria",
        "reglas_recomendacion",
        "FuenteReporte",
        "DatasetEntrenamiento",
        "EmbeddingDataset",
        "AuditLog",
    ],
} as const;

export function log(prefix: string, msg: string): void {
    console.log(`[limpieza/${prefix}] ${msg}`);
}

export async function ejecutarCierre(prisma: PrismaClient): Promise<void> {
    await prisma.$disconnect();
}
