import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import type { Prisma, Reporte, Usuario } from "@prisma/client";

const SALT = process.env.ANTI_ABUSO_SALT || "dev-salt-cambiar-en-produccion";

export interface FuentePesoParams {
    weightAnonymous: number;
    weightAuthenticated: number;
    newAccountFactor: number;
    newAccountDaysThreshold: number;
    burstFactor: number;
    burstWindowHours: number;
    burstMaxReports: number;
    confirmedFactor: number;
    discardedFactor: number;
}

export async function getFuentePesoParams(tx?: Prisma.TransactionClient): Promise<FuentePesoParams> {
    const db = tx ?? prisma;
    const get = async (clave: string, fallback: string) => {
        const p = await db.parametroSistema.findUnique({ where: { clave } });
        return p?.valor ?? fallback;
    };

    return {
        weightAnonymous: parseFloat(await get("scoring.source_weight.anonymous", "0.65")),
        weightAuthenticated: parseFloat(await get("scoring.source_weight.authenticated", "1.0")),
        newAccountFactor: parseFloat(await get("scoring.source_weight.new_account_factor", "0.7")),
        newAccountDaysThreshold: parseInt(await get("scoring.source_weight.new_account_days_threshold", "7"), 10),
        burstFactor: parseFloat(await get("scoring.source_weight.burst_factor", "0.4")),
        burstWindowHours: parseInt(await get("scoring.source_weight.burst_window_hours", "24"), 10),
        burstMaxReports: parseInt(await get("scoring.source_weight.burst_max_reports", "3"), 10),
        confirmedFactor: parseFloat(await get("scoring.source_weight.confirmed_factor", "1.2")),
        discardedFactor: parseFloat(await get("scoring.source_weight.discarded_factor", "0.3")),
    };
}

export function getClientIp(request?: Request): string {
    if (!request) return "unknown";
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0].trim();
    const real = request.headers.get("x-real-ip");
    if (real) return real.trim();
    return "unknown";
}

export function truncarIp(ip: string): string {
    // Para IPv4 conservamos los primeros 3 octetos (/24).
    // Para IPv6 conservamos los primeros 64 bits simplificados.
    if (ip.includes(".")) {
        const parts = ip.split(".");
        if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
    }
    if (ip.includes(":")) {
        const parts = ip.split(":");
        return parts.slice(0, 4).join(":");
    }
    return ip;
}

export function hashConSalt(valor: string): string {
    return createHash("sha256").update(`${SALT}:${valor}`).digest("hex");
}

export function calcularIpHash(ip: string): string {
    return hashConSalt(truncarIp(ip));
}

export function calcularFingerprintServerSide(request?: Request): string {
    const userAgent = request?.headers.get("user-agent") || "unknown";
    const acceptLanguage = request?.headers.get("accept-language") || "unknown";
    const ip = getClientIp(request);
    const raw = `${userAgent}|${acceptLanguage}|${truncarIp(ip)}`;
    return hashConSalt(raw);
}

export async function contarHistorialFuente(
    opts: {
        usuarioId?: string | null;
        ipHash?: string;
        fingerprintHash?: string;
        excluirReporteId?: string;
    },
    tx?: Prisma.TransactionClient
): Promise<{ previos: number; confirmados: number; descartados: number }> {
    const db = tx ?? prisma;
    const whereOR: Prisma.ReporteWhereInput["OR"] = [];
    if (opts.usuarioId) whereOR.push({ usuarioId: opts.usuarioId });
    if (opts.ipHash) whereOR.push({ fuente: { ipHash: opts.ipHash } });
    if (opts.fingerprintHash) whereOR.push({ fuente: { fingerprintHash: opts.fingerprintHash } });

    if (whereOR.length === 0) return { previos: 0, confirmados: 0, descartados: 0 };

    const baseWhere: Prisma.ReporteWhereInput = { OR: whereOR, eliminado: false };
    if (opts.excluirReporteId) baseWhere.id = { not: opts.excluirReporteId };

    const [previos, confirmados, descartados] = await Promise.all([
        db.reporte.count({ where: baseWhere }),
        db.reporte.count({ where: { ...baseWhere, estado: "CORREGIDO" } }),
        db.reporte.count({ where: { ...baseWhere, estado: "POSIBLE_SPAM" } }),
    ]);

    return { previos, confirmados, descartados };
}

export function calcularDiasAntiguedad(usuario?: Pick<Usuario, "creadoEn"> | null): number | undefined {
    if (!usuario?.creadoEn) return undefined;
    return Math.floor((Date.now() - new Date(usuario.creadoEn).getTime()) / (1000 * 60 * 60 * 24));
}

export async function detectarRafagaFuente(
    opts: {
        identificador: string;
        plataformaId: string;
        ipHash?: string;
        fingerprintHash?: string;
        excluirReporteId?: string;
    },
    tx?: Prisma.TransactionClient
): Promise<boolean> {
    const db = tx ?? prisma;
    const params = await getFuentePesoParams(tx);
    const ventanaMs = params.burstWindowHours * 60 * 60 * 1000;
    const desde = new Date(Date.now() - ventanaMs);

    const whereOR: Prisma.ReporteWhereInput["OR"] = [];
    if (opts.ipHash) whereOR.push({ fuente: { ipHash: opts.ipHash } });
    if (opts.fingerprintHash) whereOR.push({ fuente: { fingerprintHash: opts.fingerprintHash } });
    if (whereOR.length === 0) return false;

    const count = await db.reporte.count({
        where: {
            identificador: opts.identificador,
            plataformaId: opts.plataformaId,
            creadoEn: { gte: desde },
            eliminado: false,
            OR: whereOR,
            id: opts.excluirReporteId ? { not: opts.excluirReporteId } : undefined,
        },
    });

    return count >= params.burstMaxReports;
}

export function calcularPesoFuente(
    reporte: Pick<Reporte, "esAnonimo">,
    fuente: {
        cuentaDiasAntiguedad?: number | null;
        reportesPrevios: number;
        reportesConfirmados: number;
        reportesDescartados: number;
        esRafaga: boolean;
    },
    params: FuentePesoParams
): number {
    let peso = reporte.esAnonimo ? params.weightAnonymous : params.weightAuthenticated;

    if (fuente.cuentaDiasAntiguedad !== undefined && fuente.cuentaDiasAntiguedad !== null) {
        if (fuente.cuentaDiasAntiguedad < params.newAccountDaysThreshold) {
            peso *= params.newAccountFactor;
        }
    } else if (!reporte.esAnonimo) {
        // Usuario autenticado sin fecha de creación conocida: conservador.
        peso *= params.newAccountFactor;
    }

    if (fuente.esRafaga) {
        peso *= params.burstFactor;
    }

    if (fuente.reportesConfirmados > 0) {
        peso *= Math.pow(params.confirmedFactor, Math.min(fuente.reportesConfirmados, 3));
    }

    if (fuente.reportesDescartados > 0) {
        peso *= Math.pow(params.discardedFactor, Math.min(fuente.reportesDescartados, 3));
    }

    // Penalización leve por muchos reportes previos sin confirmar ni descartar (posible spammer casual).
    if (fuente.reportesPrevios > 10 && fuente.reportesConfirmados === 0) {
        peso *= 0.9;
    }

    return Math.max(0.1, Math.min(peso, 2.0));
}

export async function crearFuenteReporte(
    reporteId: string,
    opts: {
        request?: Request;
        usuario?: Usuario | null;
        identificador: string;
        plataformaId: string;
    },
    tx?: Prisma.TransactionClient
): Promise<void> {
    const db = tx ?? prisma;
    const ipRaw = getClientIp(opts.request);
    const ipHash = calcularIpHash(ipRaw);
    const fingerprintHash = calcularFingerprintServerSide(opts.request);

    const historial = await contarHistorialFuente(
        { usuarioId: opts.usuario?.id, ipHash, fingerprintHash, excluirReporteId: reporteId },
        tx
    );

    const esRafaga = await detectarRafagaFuente(
        { identificador: opts.identificador, plataformaId: opts.plataformaId, ipHash, fingerprintHash, excluirReporteId: reporteId },
        tx
    );

    const params = await getFuentePesoParams(tx);
    const reporte = await db.reporte.findUniqueOrThrow({ where: { id: reporteId } });

    const peso = calcularPesoFuente(
        reporte,
        {
            cuentaDiasAntiguedad: calcularDiasAntiguedad(opts.usuario),
            reportesPrevios: historial.previos,
            reportesConfirmados: historial.confirmados,
            reportesDescartados: historial.descartados,
            esRafaga,
        },
        params
    );

    await db.fuenteReporte.create({
        data: {
            reporteId,
            ipHash,
            fingerprintHash,
            cuentaDiasAntiguedad: calcularDiasAntiguedad(opts.usuario),
            reportesPrevios: historial.previos,
            reportesConfirmados: historial.confirmados,
            reportesDescartados: historial.descartados,
            pesoAplicado: peso,
        },
    });

    await db.reporte.update({ where: { id: reporteId }, data: { fuenteConfianza: peso } });
}

export async function limpiarFuenteReporteAntiguas(
    dias?: number,
    tx?: Prisma.TransactionClient
): Promise<number> {
    const db = tx ?? prisma;
    const param = await db.parametroSistema.findUnique({ where: { clave: "anti_abuso.retencion_fuente_dias" } });
    const retencionDias = dias ?? parseInt(param?.valor ?? "90", 10);
    const limite = new Date(Date.now() - retencionDias * 24 * 60 * 60 * 1000);

    const result = await db.fuenteReporte.deleteMany({
        where: { creadoEn: { lt: limite } },
    });

    return result.count;
}
