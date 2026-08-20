/**
 * SPEC-184 (002-PI-079): servicio de BlockList.
 * Orquesta el repositorio DAL y la auditoría.
 */
import { BlockListRepository } from "@/lib/dal/repositories/block-list";
import { logAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";

export type DuracionBloqueo = "24h" | "7d" | "permanente";

function calcularExpiraEn(duracion: DuracionBloqueo): Date | null {
    if (duracion === "permanente") return null;
    const horas = duracion === "24h" ? 24 : 7 * 24;
    return new Date(Date.now() + horas * 60 * 60 * 1000);
}

export async function estaIpBloqueada(ipHash: string): Promise<boolean> {
    try {
        const repo = new BlockListRepository();
        const bloqueo = await repo.findVigenteByIpHash(ipHash);
        return bloqueo !== null;
    } catch (error) {
        logger.error("[BlockList] Error consultando bloqueo:", error);
        // Fail-open: si no podemos consultar, no bloqueamos todo el tráfico.
        return false;
    }
}

export async function bloquearIp(params: {
    ipHash: string;
    motivo: string;
    duracion: DuracionBloqueo;
    creadoPorId: string;
    request?: Request;
}) {
    const repo = new BlockListRepository();

    // Eliminar bloqueo previo si existe (la tabla exige ipHash único).
    const previo = await repo.findByIpHash(params.ipHash);
    if (previo) {
        await repo.eliminar(previo.id);
    }

    const bloqueo = await repo.crear({
        ipHash: params.ipHash,
        motivo: params.motivo,
        expiraEn: calcularExpiraEn(params.duracion),
        creadoPorId: params.creadoPorId,
    });

    const ipAddress = params.request?.headers.get("x-forwarded-for") || params.request?.headers.get("x-real-ip") || "unknown";
    const userAgent = params.request?.headers.get("user-agent") || "unknown";
    await logAudit({
        accion: "IP_BLOQUEADA",
        tipoRecurso: "BlockList",
        recursoId: bloqueo.id,
        usuarioId: params.creadoPorId,
        valorNuevo: JSON.stringify({
            ipHash: params.ipHash,
            duracion: params.duracion,
            motivo: params.motivo,
            expiraEn: bloqueo.expiraEn,
        }),
        ipAddress,
        userAgent,
    });

    return bloqueo;
}

export async function desbloquearIp(params: {
    id: string;
    creadoPorId: string;
    request?: Request;
}) {
    const repo = new BlockListRepository();
    const bloqueo = await repo.findById(params.id);
    if (!bloqueo) return null;

    await repo.eliminar(bloqueo.id);

    const ipAddress = params.request?.headers.get("x-forwarded-for") || params.request?.headers.get("x-real-ip") || "unknown";
    const userAgent = params.request?.headers.get("user-agent") || "unknown";
    await logAudit({
        accion: "IP_DESBLOQUEADA",
        tipoRecurso: "BlockList",
        recursoId: bloqueo.id,
        usuarioId: params.creadoPorId,
        valorAnterior: JSON.stringify({ ipHash: bloqueo.ipHash, motivo: bloqueo.motivo }),
        ipAddress,
        userAgent,
    });

    return bloqueo;
}

export async function listarBloqueosVigentes(paginacion: { skip: number; take: number }) {
    const repo = new BlockListRepository();
    return repo.findPaginadosVigentes(paginacion);
}
