import { createHash, randomBytes } from "crypto";
import { prisma } from "./prisma";
import { getParametroSistema } from "./parametros";
import { getSmsProvider, generarCodigoOtp, hashCodigo } from "./sms";
import { darDeBajaReporte } from "./reporte-lifecycle";
import { logAudit } from "./audit";
import { MotivoBajaReporte, EstadoApelacion } from "@prisma/client";
import type { Prisma } from "@prisma/client";

const DEFAULT_PAUSA_DIAS = 7;

function hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
}

function generateToken(): string {
    return randomBytes(32).toString("hex");
}

export async function getApelacionPausaDias(tx?: Prisma.TransactionClient): Promise<number> {
    const db = tx ?? prisma;
    const param = await getParametroSistema("anti_abuso.apelacion_pausa_dias", db);
    const value = parseInt(param?.valor ?? String(DEFAULT_PAUSA_DIAS), 10);
    return Number.isNaN(value) ? DEFAULT_PAUSA_DIAS : value;
}

export interface CrearApelacionInput {
    identificador: string;
    plataformaId: string;
    motivoSolicitud: string;
    evidenciaUrl?: string | null;
    tipoVerificacion: "SMS" | "NICK";
    contacto?: string | null;
    request?: Request;
}

export async function crearApelacion(input: CrearApelacionInput, tx?: Prisma.TransactionClient) {
    const db = tx ?? prisma;
    const {
        identificador,
        plataformaId,
        motivoSolicitud,
        evidenciaUrl,
        tipoVerificacion,
        contacto,
        request,
    } = input;

    // Verificar que no haya apelación activa y que el derecho esté vigente
    const existente = await db.apelacionIdentificador.findFirst({
        where: {
            identificador,
            plataformaId,
            estado: { in: [EstadoApelacion.RECIBIDA, EstadoApelacion.EN_REVISION] },
        },
    });
    if (existente) {
        throw new Error("APELACION_ACTIVA_EXISTENTE");
    }

    const ultimaRechazada = await db.apelacionIdentificador.findFirst({
        where: { identificador, plataformaId, estado: EstadoApelacion.RECHAZADA },
        orderBy: { actualizadoEn: "desc" },
    });
    if (ultimaRechazada && !ultimaRechazada.derechoApelar) {
        throw new Error("DERECHO_APELAR_BLOQUEADO");
    }

    // Pausa de visibilidad solo en la primera apelación
    const yaApelo = await db.apelacionIdentificador.count({ where: { identificador, plataformaId } });
    let pausaHasta: Date | null = null;
    if (yaApelo === 0) {
        const dias = await getApelacionPausaDias(tx);
        pausaHasta = new Date(Date.now() + dias * 24 * 60 * 60 * 1000);
    }

    const token = generateToken();
    const tokenHash = hashToken(token);

    let smsCodigoHash: string | null = null;
    let smsEnviado = false;

    if (tipoVerificacion === "SMS" && contacto) {
        const codigo = generarCodigoOtp();
        smsCodigoHash = hashCodigo(codigo);
        const provider = getSmsProvider();
        await provider.sendSms(contacto, `Tu código de verificación para apelar en Protección Infantil es: ${codigo}`);
        smsEnviado = true;
    }

    const apelacion = await db.apelacionIdentificador.create({
        data: {
            identificador,
            plataformaId,
            tokenAcceso: tokenHash,
            estado: EstadoApelacion.RECIBIDA,
            motivoSolicitud,
            evidenciaUrl: evidenciaUrl ?? null,
            tipoVerificacion,
            contacto: contacto ?? null,
            smsCodigoHash,
            pausaHasta,
        },
    });

    // Pausar visibilidad pública del identificador si aplica
    if (pausaHasta) {
        await db.identificadorReportado.updateMany({
            where: { identificador, plataformaId },
            data: { esVisiblePublicamente: false },
        });
    }

    const { ipAddress, userAgent } = extractClientInfo(request);
    await logAudit({
        accion: "APELACION_CREADA",
        tipoRecurso: "ApelacionIdentificador",
        recursoId: apelacion.id,
        valorNuevo: JSON.stringify({ identificador, plataformaId, estado: apelacion.estado, tipoVerificacion }),
        ipAddress,
        userAgent,
    });

    return { apelacion, token, smsEnviado };
}

export async function verificarOtpApelacion(token: string, codigo: string) {
    const tokenHash = hashToken(token);
    const apelacion = await prisma.apelacionIdentificador.findUnique({
        where: { tokenAcceso: tokenHash },
    });
    if (!apelacion || !apelacion.smsCodigoHash) {
        throw new Error("TOKEN_INVALIDO");
    }
    if (apelacion.smsVerificado) {
        throw new Error("YA_VERIFICADO");
    }

    await prisma.apelacionIdentificador.update({
        where: { id: apelacion.id },
        data: { smsIntentos: { increment: 1 } },
    });

    if (apelacion.smsIntentos >= 5) {
        throw new Error("DEMASIADOS_INTENTOS");
    }

    if (hashCodigo(codigo) !== apelacion.smsCodigoHash) {
        throw new Error("CODIGO_INVALIDO");
    }

    await prisma.apelacionIdentificador.update({
        where: { id: apelacion.id },
        data: { smsVerificado: true },
    });

    return { verificado: true };
}

export async function getApelacionByToken(token: string) {
    const tokenHash = hashToken(token);
    return prisma.apelacionIdentificador.findUnique({
        where: { tokenAcceso: tokenHash },
        include: { plataforma: true },
    });
}

export interface ResolverApelacionInput {
    apelacionId: string;
    adminId: string;
    accion: "ACEPTAR" | "RECHAZAR";
    respuestaAdmin: string;
    reportesSeleccionados?: string[];
    request?: Request;
}

export async function resolverApelacion(input: ResolverApelacionInput) {
    const { apelacionId, adminId, accion, respuestaAdmin, reportesSeleccionados, request } = input;

    await prisma.$transaction(async (tx) => {
        const apelacion = await tx.apelacionIdentificador.findUnique({ where: { id: apelacionId } });
        if (!apelacion) throw new Error("APELACION_NO_ENCONTRADA");
        if (apelacion.estado !== EstadoApelacion.RECIBIDA && apelacion.estado !== EstadoApelacion.EN_REVISION) {
            throw new Error("APELACION_NO_RESOLUBLE");
        }

        const nuevoEstado = accion === "ACEPTAR" ? EstadoApelacion.ACEPTADA : EstadoApelacion.RECHAZADA;

        await tx.apelacionIdentificador.update({
            where: { id: apelacionId },
            data: {
                estado: nuevoEstado,
                respuestaAdmin,
                adminId,
                visibilidadRestaurada: true,
                derechoApelar: accion === "RECHAZAR" ? false : undefined,
            },
        });

        // Restaurar visibilidad pública del identificador (el recálculo posterior la ajustará si aplica)
        await tx.identificadorReportado.updateMany({
            where: { identificador: apelacion.identificador, plataformaId: apelacion.plataformaId },
            data: { esVisiblePublicamente: true },
        });

        // Si acepta, dar de baja los reportes seleccionados como REPORTE_FALSO dentro de la misma transacción
        if (accion === "ACEPTAR" && reportesSeleccionados && reportesSeleccionados.length > 0) {
            for (const reporteId of reportesSeleccionados) {
                await darDeBajaReporte({
                    reporteId,
                    motivo: MotivoBajaReporte.REPORTE_FALSO,
                    nota: `Baja por apelación aceptada ${apelacionId}`,
                    adminId,
                    request,
                    tx,
                });
            }
        }

        const { ipAddress, userAgent } = extractClientInfo(request);
        await logAudit({
            accion: "APELACION_RESUELTA",
            tipoRecurso: "ApelacionIdentificador",
            recursoId: apelacionId,
            usuarioId: adminId,
            valorAnterior: JSON.stringify({ estado: apelacion.estado }),
            valorNuevo: JSON.stringify({ estado: nuevoEstado, accion }),
            ipAddress,
            userAgent,
        });
    });

    return { ok: true };
}

export async function rehabilitarDerechoApelacion(
    apelacionId: string,
    adminId: string,
    nota: string,
    request?: Request
) {
    const apelacion = await prisma.apelacionIdentificador.findUnique({ where: { id: apelacionId } });
    if (!apelacion) throw new Error("APELACION_NO_ENCONTRADA");

    await prisma.apelacionIdentificador.update({
        where: { id: apelacionId },
        data: { derechoApelar: true, notaRehabilitacion: nota },
    });

    const { ipAddress, userAgent } = extractClientInfo(request);
    await logAudit({
        accion: "APELACION_REHABILITADA",
        tipoRecurso: "ApelacionIdentificador",
        recursoId: apelacionId,
        usuarioId: adminId,
        valorNuevo: JSON.stringify({ nota }),
        ipAddress,
        userAgent,
    });

    return { ok: true };
}

export async function vencerApelacionesPendientes() {
    const ahora = new Date();
    const vencidas = await prisma.apelacionIdentificador.findMany({
        where: {
            estado: { in: [EstadoApelacion.RECIBIDA, EstadoApelacion.EN_REVISION] },
            pausaHasta: { lt: ahora },
            visibilidadRestaurada: false,
        },
    });

    for (const apelacion of vencidas) {
        await prisma.$transaction(async (tx) => {
            await tx.apelacionIdentificador.update({
                where: { id: apelacion.id },
                data: { estado: EstadoApelacion.VENCIDA, visibilidadRestaurada: true },
            });

            await tx.identificadorReportado.updateMany({
                where: { identificador: apelacion.identificador, plataformaId: apelacion.plataformaId },
                data: { esVisiblePublicamente: true },
            });

            await logAudit({
                accion: "APELACION_VENCIDA",
                tipoRecurso: "ApelacionIdentificador",
                recursoId: apelacion.id,
                valorNuevo: JSON.stringify({ estado: EstadoApelacion.VENCIDA }),
                ipAddress: "system",
                userAgent: "job-apelaciones-vencimiento",
            });
        });
    }

    return { vencidas: vencidas.length };
}

function extractClientInfo(request?: Request) {
    return {
        ipAddress: request?.headers.get("x-forwarded-for") || request?.headers.get("x-real-ip") || "unknown",
        userAgent: request?.headers.get("user-agent") || "unknown",
    };
}
