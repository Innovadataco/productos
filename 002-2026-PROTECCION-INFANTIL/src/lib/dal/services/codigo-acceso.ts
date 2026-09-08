import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { conActor } from "@/lib/auditoria-lectura/actor";
import {
    generarCodigoAcceso,
    hashCodigoAcceso,
    normalizarCodigoAcceso,
} from "@/lib/acceso-codigo";
import { logAudit } from "@/lib/audit";
import { programar } from "@/lib/notificaciones";
import { logger } from "@/lib/logger";
import { descifrarCampoReporte } from "./descifrar-contenido";
import { CodigoAccesoContenidoRepository } from "../repositories/codigo-acceso";

/**
 * SPEC-584 (Fase 3) · Ciclo de vida del código temporal de acceso externo al texto.
 *
 * Flujo (decisiones 2, 3 y 4 del dueño, 2026-09-07):
 * 1. El PADRE dueño del reporte solicita un código: 8 caracteres sin ambigüedades,
 *    vigencia de 30 min para CANJEAR, un solo código activo por reporte. El código
 *    viaja al padre por correo (canal oficial) y se muestra una sola vez en pantalla.
 * 2. Un profesional (o el mismo padre) autenticado lo CANJEA una sola vez: el canje
 *    abre una sesión de visualización de 15 min y devuelve un token opaco (UUID cuyo
 *    sha-256 es lo único que se persiste). La auditoría queda con AMBOS responsables
 *    (solicitante y canjeador) y el solicitante recibe correo avisando quién canjeó.
 * 3. Con el token se lee el texto: cada lectura revalida la expiración y queda en
 *    `LecturaReporte` como actor EXTERNO.
 *
 * El reporte ANÓNIMO no tiene flujo externo (decisión 6): los tres pasos lo rechazan.
 */

const VIGENCIA_CODIGO_MS = 30 * 60 * 1000;
const VIGENCIA_SESION_MS = 15 * 60 * 1000;

const EVENTO_CODIGO_SOLICITADO = "padre.reporte.acceso_codigo";
const EVENTO_CODIGO_CANJEADO = "padre.reporte.acceso_canjeado";

/** Datos del reporte necesarios para validar titularidad y armar correos. */
interface ReporteParaCodigo {
    id: string;
    esAnonimo: boolean;
    usuarioId: string | null;
    contenidoId: string;
    identificador: string;
}

async function cargarReporteParaCodigo(reporteId: string): Promise<ReporteParaCodigo | null> {
    return prisma.reporte.findUnique({
        where: { id: reporteId },
        select: { id: true, esAnonimo: true, usuarioId: true, contenidoId: true, identificador: true },
    });
}

/** Garantiza titularidad autenticada: solo el dueño no anónimo avanza (decisiones 4 y 6). */
function exigirTitular(reporte: ReporteParaCodigo | null, usuarioId: string): ReporteParaCodigo {
    if (!reporte || reporte.esAnonimo || reporte.usuarioId !== usuarioId) {
        // 404 deliberado (no 403): no revelar la existencia ni titularidad del reporte.
        throw new AppError("Reporte no encontrado", ERROR_CODES.NOT_FOUND, 404);
    }
    return reporte;
}

/**
 * PASO 1 · El padre dueño solicita el código. Devuelve el código en claro (para
 * mostrarlo UNA vez en pantalla) junto a su vigencia; en reposo queda solo el hash.
 */
export async function solicitarCodigoAcceso(params: {
    reporteId: string;
    solicitadoPorId: string;
    ip?: string;
}): Promise<{ codigo: string; vigenteHasta: Date }> {
    const reporte = exigirTitular(await cargarReporteParaCodigo(params.reporteId), params.solicitadoPorId);

    const codigo = generarCodigoAcceso();
    const ahora = new Date();
    const vigenteHasta = new Date(ahora.getTime() + VIGENCIA_CODIGO_MS);

    await prisma.$transaction(async (tx) => {
        // Un solo código activo por reporte (decisión 2): la nueva solicitud
        // expira los anteriores sin canjear.
        await tx.codigoAccesoContenido.updateMany({
            where: { reporteId: reporte.id, canjeadoEn: null, vigenteHasta: { gt: ahora } },
            data: { vigenteHasta: ahora },
        });
        await tx.codigoAccesoContenido.create({
            data: {
                reporteId: reporte.id,
                codigoHash: hashCodigoAcceso(codigo),
                solicitadoPorId: params.solicitadoPorId,
                vigenteHasta,
                ...(params.ip ? { ipSolicitud: params.ip } : {}),
            },
        });
    });

    await logAudit({
        accion: "CODIGO_ACCESO_SOLICITADO",
        tipoRecurso: "Reporte",
        recursoId: reporte.id,
        usuarioId: params.solicitadoPorId,
        ipAddress: params.ip ?? "unknown",
        userAgent: "unknown",
        // El código en claro NUNCA va a la auditoría: solo su hash (rastreable, no usable).
        metadatos: { codigoHash: hashCodigoAcceso(codigo) },
    });

    // Correo con el código (canal oficial). Best-effort con log: el padre ya lo ve en pantalla.
    try {
        const resultado = await programar({
            evento: EVENTO_CODIGO_SOLICITADO,
            sujetoTipo: "Reporte",
            sujetoId: reporte.id,
            destinatarios: [
                {
                    usuarioId: params.solicitadoPorId,
                    rol: "PARENT",
                    variables: {
                        codigo,
                        identificador: reporte.identificador,
                        vigenteMinutos: 30,
                    },
                },
            ],
        });
        if (resultado.programadas === 0) {
            logger.info(`[CodigoAcceso] Sin regla activa para ${EVENTO_CODIGO_SOLICITADO} (reporte=${reporte.id}).`);
        }
    } catch (error) {
        logger.error("[CodigoAcceso] Error encolando el correo con el código:", error);
    }

    return { codigo, vigenteHasta };
}

/**
 * PASO 2 · Profesional (o padre) autenticado canjea el código. Devuelve el token
 * opaco de la sesión de visualización (15 min). Un solo canje: la condición
 * `canjeadoEn: null` en el update hace que una carrera dé 409 a perdedor.
 */
export async function canjearCodigoAcceso(params: {
    codigoCrudo: string;
    canjeadoPor: { id: string; nombre: string | null; rol: string };
    ip?: string;
}): Promise<{ tokenSesion: string; expiraEn: Date; reporteId: string }> {
    const codigo = normalizarCodigoAcceso(params.codigoCrudo);
    if (!/^[A-Z2-9]{6,12}$/.test(codigo)) {
        throw new AppError("Código inválido", ERROR_CODES.VALIDATION_ERROR, 400);
    }

    const registro = await new CodigoAccesoContenidoRepository().findPorCodigoHash(hashCodigoAcceso(codigo));
    // Código inexistente O reporte anónimo (sin flujo externo, decisión 6): mismo 404 genérico.
    if (!registro || registro.reporte.esAnonimo) {
        throw new AppError("Código no válido", ERROR_CODES.NOT_FOUND, 404);
    }

    const ahora = new Date();
    if (registro.vigenteHasta.getTime() <= ahora.getTime()) {
        throw new AppError("El código expiró. Solicite uno nuevo al padre o tutor.", ERROR_CODES.GONE, 410);
    }
    if (registro.canjeadoEn) {
        throw new AppError("El código ya fue usado. Solicite uno nuevo al padre o tutor.", ERROR_CODES.CONFLICT, 409);
    }

    const tokenSesion = randomUUID();
    const expiraEn = new Date(ahora.getTime() + VIGENCIA_SESION_MS);
    const actualizado = await prisma.codigoAccesoContenido.updateMany({
        where: { id: registro.id, canjeadoEn: null },
        data: {
            canjeadoEn: ahora,
            canjeadoPorId: params.canjeadoPor.id,
            sesionExpiraEn: expiraEn,
            sesionTokenHash: hashCodigoAcceso(tokenSesion),
            ...(params.ip ? { ipCanje: params.ip } : {}),
        },
    });
    if (actualizado.count === 0) {
        throw new AppError("El código ya fue usado. Solicite uno nuevo al padre o tutor.", ERROR_CODES.CONFLICT, 409);
    }

    await logAudit({
        accion: "CODIGO_ACCESO_CANJEADO",
        tipoRecurso: "Reporte",
        recursoId: registro.reporteId,
        usuarioId: params.canjeadoPor.id,
        ipAddress: params.ip ?? "unknown",
        userAgent: "unknown",
        metadatos: { codigoAccesoId: registro.id, solicitadoPorId: registro.solicitadoPorId },
    });

    // Decisión 5: el padre solicitante recibe correo avisando QUIÉN canjeó su código.
    try {
        const resultado = await programar({
            evento: EVENTO_CODIGO_CANJEADO,
            sujetoTipo: "Reporte",
            sujetoId: registro.reporteId,
            destinatarios: [
                {
                    usuarioId: registro.solicitadoPorId,
                    rol: "PARENT",
                    variables: {
                        nombreCanjeador: params.canjeadoPor.nombre ?? "Un profesional",
                        rolCanjeador: params.canjeadoPor.rol,
                        identificador: registro.reporte.identificador,
                        fechaCanje: ahora.toLocaleString("es-CO", { timeZone: "America/Bogota" }),
                    },
                },
            ],
        });
        if (resultado.programadas === 0) {
            logger.info(`[CodigoAcceso] Sin regla activa para ${EVENTO_CODIGO_CANJEADO} (reporte=${registro.reporteId}).`);
        }
    } catch (error) {
        logger.error("[CodigoAcceso] Error encolando el aviso de canje al solicitante:", error);
    }

    return { tokenSesion, expiraEn, reporteId: registro.reporteId };
}

/**
 * PASO 3 · Lectura del texto con la sesión. Revalida la expiración en CADA
 * llamada y audita como actor EXTERNO vinculado al código canjeado (decisión 7).
 */
export async function leerTextoConSesion(params: {
    tokenSesion: string;
    ip?: string;
    userAgent?: string;
}): Promise<{ texto: string; expiraEn: Date }> {
    const registro = await new CodigoAccesoContenidoRepository().findPorTokenSesion(
        hashCodigoAcceso(params.tokenSesion)
    );
    const ahora = new Date();
    if (!registro || !registro.sesionExpiraEn || registro.sesionExpiraEn.getTime() <= ahora.getTime()) {
        throw new AppError(
            "La sesión de visualización expiró. Solicite un nuevo código al padre o tutor.",
            ERROR_CODES.GONE,
            410
        );
    }

    const texto = await conActor(
        {
            ...(registro.canjeadoPor?.id ? { usuarioId: registro.canjeadoPor.id } : {}),
            ...(registro.canjeadoPor?.rol ? { rol: registro.canjeadoPor.rol } : {}),
            tipoActor: "EXTERNO",
            codigoAccesoId: registro.id,
            ...(params.ip ? { ip: params.ip } : {}),
            ...(params.userAgent ? { userAgent: params.userAgent } : {}),
        },
        () => descifrarCampoReporte(registro.reporte.contenidoId, "texto")
    );

    return { texto, expiraEn: registro.sesionExpiraEn };
}
