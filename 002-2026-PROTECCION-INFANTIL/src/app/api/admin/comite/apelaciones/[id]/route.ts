import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { idSchema } from "@/lib/validators";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { esAdminRol, esComiteRol } from "@/lib/operadores/permisos";
import { diasHabilesTranscurridos, estaEnAvisoPrevio, getAvisoPrevioDias } from "@/lib/apelaciones";

/**
 * SPEC-110 — Detalle de una apelación para el comité de validación.
 *
 * El comité SÍ puede ver el motivo, la acreditación, los metadatos del documento
 * (nombre, tamaño, hash, accesos) y la lista de reportes del identificador (decide
 * bajas). La evidencia en sí solo se descarga por el endpoint .../documento.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth();
        await assertModulo(user, "comite_bandeja");
        if (!esAdminRol(user.rol) && !esComiteRol(user.rol)) {
            return NextResponse.json(
                { error: { message: "Permisos insuficientes", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const rate = await checkRateLimit(request, "admin_read", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const { id: rawId } = await params;
        const parsedId = idSchema.safeParse(rawId);
        if (!parsedId.success) {
            return NextResponse.json(
                { error: { message: "ID inválido", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }
        const id = parsedId.data;

        const apelacion = await prisma.apelacion.findUnique({
            where: { id },
            include: {
                plataforma: { select: { nombre: true, clave: true } },
                usuario: { select: { id: true, nombre: true, email: true } },
                comite: { select: { id: true, nombre: true } },
                resueltoPor: { select: { id: true, nombre: true } },
                documentos: {
                    include: {
                        accesos: {
                            orderBy: { accedidoEn: "desc" },
                            include: { usuario: { select: { id: true, nombre: true, email: true } } },
                        },
                    },
                },
            },
        });
        if (!apelacion) {
            return NextResponse.json(
                { error: { message: "Apelación no encontrada", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        // El comité decide bajas: ve los reportes del identificador + plataforma.
        const reportes = await prisma.reporte.findMany({
            where: { identificador: apelacion.identificador, plataformaId: apelacion.plataformaId },
            orderBy: { creadoEn: "desc" },
            select: {
                id: true,
                estado: true,
                eliminado: true,
                motivoBaja: true,
                creadoEn: true,
                ciudad: true,
                pais: true,
                texto: true,
                clasificacion: { select: { categoria: true, confianza: true } },
            },
        });

        const avisoPrevioDias = await getAvisoPrevioDias();
        const ahora = new Date();
        const documento = apelacion.documentos[0] ?? null;

        return NextResponse.json({
            apelacion: {
                id: apelacion.id,
                numero: apelacion.numero,
                identificador: apelacion.identificador,
                plataforma: apelacion.plataforma,
                motivo: apelacion.motivo,
                esRepresentante: apelacion.esRepresentante,
                acreditacion: apelacion.acreditacion,
                estado: apelacion.estado,
                creadoEn: apelacion.creadoEn,
                plazoRespuestaEn: apelacion.plazoRespuestaEn,
                asignadoEn: apelacion.asignadoEn,
                decision: apelacion.decision,
                motivacionResolucion: apelacion.motivacionResolucion,
                quitoVisibilidad: apelacion.quitoVisibilidad,
                resueltoEn: apelacion.resueltoEn,
                apelante: apelacion.usuario,
                comiteAsignado: apelacion.comite,
                resueltoPor: apelacion.resueltoPor,
                diasHabilesTranscurridos: diasHabilesTranscurridos(apelacion.creadoEn, ahora),
                proximoAVencer: estaEnAvisoPrevio(
                    { estado: apelacion.estado, creadoEn: apelacion.creadoEn },
                    avisoPrevioDias,
                    ahora
                ),
            },
            documento: documento
                ? {
                      id: documento.id,
                      nombreOriginal: documento.nombreOriginal,
                      tamanoBytes: documento.tamanoBytes,
                      hashSha256: documento.hashSha256,
                      mimeType: documento.mimeType,
                      eliminadoEn: documento.eliminadoEn,
                      accesos: documento.accesos.map((acc) => ({
                          id: acc.id,
                          usuario: acc.usuario,
                          accedidoEn: acc.accedidoEn,
                          ipAddress: acc.ipAddress,
                          userAgent: acc.userAgent,
                      })),
                  }
                : null,
            reportes: reportes.map((r) => ({
                id: r.id,
                estado: r.estado,
                eliminado: r.eliminado,
                motivoBaja: r.motivoBaja,
                creadoEn: r.creadoEn,
                ciudad: r.ciudad,
                pais: r.pais,
                texto: r.texto,
                categoria: r.clasificacion?.categoria ?? null,
                confianza: r.clasificacion?.confianza ?? null,
            })),
        });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        const msg = error instanceof Error ? error.message : String(error);
        logger.error("[ComiteApelaciones] Error en detalle:", msg);
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
