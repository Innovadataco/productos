/**
 * SPEC-053 (US3, módulo Comité, SPEC-110): ComiteApelacionesService.
 * Bandeja de apelaciones del comité de validación, detalle, toma del caso,
 * descarga de evidencia (SOLO comité; descifrado en memoria vía
 * `src/lib/apelacion-storage.ts`, bitácora de acceso + auditoría) y resolución
 * humana motivada (marca de ocultamiento, bajas por REPORTE_FALSO vía
 * `darDeBajaReporte` del DAL y recálculo de visibilidad). Acepta tx opcional (D2).
 */
import type { Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { diasHabilesTranscurridos, estaEnAvisoPrevio, getAvisoPrevioDias } from "@/lib/apelaciones";
import { ApelacionStorageError, leerDocumentoDescifrado, sha256Hex } from "@/lib/apelacion-storage";
import { darDeBajaReporte } from "@/lib/dal/services/reporte-lifecycle";
import { whereReporteVigente } from "@/lib/reportes-acceso";
import { actualizarVisibilidadPublica } from "@/lib/visibility";
import { ApelacionRepository } from "../repositories/apelacion";
import { ReporteRepository } from "../repositories/reporte";
import { IdentificadorReportadoRepository } from "../repositories/identificador-reportado";
import { DocumentoApelacionRepository } from "../repositories/documento-apelacion";
import { withUnitOfWork } from "../unit-of-work";
import type { InfoClienteDto } from "../types/operador";
import type { ResolverApelacionInput } from "../types/comite";

export class ComiteApelacionesService {
    private readonly apelaciones: ApelacionRepository;
    private readonly reportes: ReporteRepository;

    constructor(private readonly tx?: Prisma.TransactionClient) {
        this.apelaciones = new ApelacionRepository(tx);
        this.reportes = new ReporteRepository(tx);
    }

    /** GET /api/admin/comite/apelaciones — bandeja con días hábiles y marca "próximo a vencer". */
    async listarBandeja(filtros: { estado?: "RECIBIDA" | "EN_REVISION" | "ACEPTADA" | "RECHAZADA"; page: number; pageSize: number }) {
        const skip = (filtros.page - 1) * filtros.pageSize;
        const where: Prisma.ApelacionWhereInput = filtros.estado ? { estado: filtros.estado } : {};

        const [apelaciones, total] = await this.apelaciones.findBandejaComite(where, {
            skip,
            take: filtros.pageSize,
        });
        const avisoPrevioDias = await getAvisoPrevioDias();

        const ahora = new Date();
        const items = apelaciones.map((a) => ({
            id: a.id,
            numero: a.numero,
            identificador: a.identificador,
            plataforma: a.plataforma,
            estado: a.estado,
            esRepresentante: a.esRepresentante,
            creadoEn: a.creadoEn,
            plazoRespuestaEn: a.plazoRespuestaEn,
            resueltoEn: a.resueltoEn,
            decision: a.decision,
            apelante: a.usuario,
            comiteAsignado: a.comite,
            diasHabilesTranscurridos: diasHabilesTranscurridos(a.creadoEn, ahora),
            proximoAVencer: estaEnAvisoPrevio({ estado: a.estado, creadoEn: a.creadoEn }, avisoPrevioDias, ahora),
        }));

        return {
            items,
            pagination: { page: filtros.page, pageSize: filtros.pageSize, total, totalPages: Math.ceil(total / filtros.pageSize) },
        };
    }

    /** GET /api/admin/comite/apelaciones/[id] — detalle con documento (metadatos) y reportes. */
    async obtenerDetalle(id: string) {
        const apelacion = await this.apelaciones.findDetalleComite(id);
        if (!apelacion) {
            throw new AppError("Apelación no encontrada", ERROR_CODES.NOT_FOUND, 404);
        }

        // El comité decide bajas: ve los reportes del identificador + plataforma.
        const reportes = await this.reportes.findPorIdentificadorYPlataforma(apelacion.identificador, apelacion.plataformaId);

        const avisoPrevioDias = await getAvisoPrevioDias();
        const ahora = new Date();
        const documento = apelacion.documentos[0] ?? null;

        return {
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
        };
    }

    /** POST /api/admin/comite/apelaciones/[id]/tomar — RECIBIDA → EN_REVISION asignado a sí mismo. */
    async tomar(id: string, usuarioId: string) {
        const apelacion = await this.apelaciones.findEstadoParaTomar(id);
        if (!apelacion) {
            throw new AppError("Apelación no encontrada", ERROR_CODES.NOT_FOUND, 404);
        }
        if (apelacion.estado !== "RECIBIDA") {
            throw new AppError("El caso ya fue tomado o resuelto", ERROR_CODES.CONFLICT, 409);
        }

        const actualizada = await this.apelaciones.tomar(id, usuarioId);

        return { apelacion: actualizada };
    }

    /**
     * GET /api/admin/comite/apelaciones/[id]/documento — evidencia descifrada en
     * memoria (SOLO comité; la guarda de rol vive en la ruta). Registra el
     * acceso (bitácora + auditoría) antes de devolver el PDF.
     */
    async descargarDocumento(id: string, usuarioId: string, info: InfoClienteDto) {
        const apelacion = await this.apelaciones.findConDocumentos(id);
        if (!apelacion) {
            throw new AppError("Apelación no encontrada", ERROR_CODES.NOT_FOUND, 404);
        }

        const documento = apelacion.documentos[0] ?? null;
        if (!documento) {
            throw new AppError("La apelación no tiene documento", ERROR_CODES.NOT_FOUND, 404);
        }
        if (documento.eliminadoEn) {
            throw new AppError("El documento fue purgado por retención", "GONE", 410);
        }

        let pdf: Buffer;
        try {
            pdf = await leerDocumentoDescifrado(documento.rutaArchivo);
        } catch (err) {
            if (err instanceof ApelacionStorageError && err.code === "ARCHIVO_NO_ENCONTRADO") {
                logger.error(`[ComiteApelaciones] Anomalía: documento ${documento.id} sin archivo en disco (apelacion=${apelacion.numero})`);
                throw new AppError("El documento ya no está disponible", "GONE", 410);
            }
            throw err;
        }

        // Integridad: el PDF descifrado debe coincidir con el hash registrado al subirlo.
        if (sha256Hex(pdf) !== documento.hashSha256) {
            logger.error(`[ComiteApelaciones] Integridad inválida en documento ${documento.id} (apelacion=${apelacion.numero})`);
            throw new AppError("Error interno", ERROR_CODES.INTERNAL_ERROR, 500);
        }

        await new DocumentoApelacionRepository(this.tx).registrarAcceso({
            documentoId: documento.id,
            usuarioId,
            ipAddress: info.ipAddress,
            userAgent: info.userAgent,
        });
        await logAudit({
            accion: "APELACION_DOCUMENTO_ACCESO",
            tipoRecurso: "DocumentoApelacion",
            recursoId: documento.id,
            usuarioId,
            valorNuevo: JSON.stringify({ apelacionId: apelacion.id, numero: apelacion.numero }),
            ipAddress: info.ipAddress,
            userAgent: info.userAgent,
        });

        return { pdf, numero: apelacion.numero };
    }

    /**
     * POST /api/admin/comite/apelaciones/[id]/resolver — decisión humana motivada.
     * ACEPTADA: marca de ocultamiento y/o bajas por REPORTE_FALSO + recálculo de
     * visibilidad, todo en UNA tx. RECHAZADA: solo cierra el caso.
     */
    async resolver(
        id: string,
        input: ResolverApelacionInput,
        usuario: { id: string; esComite: boolean },
        info: InfoClienteDto,
        request: Request
    ) {
        const { decision, motivacion, quitarVisibilidad, reportesABajar } = input;

        const apelacion = await this.apelaciones.findParaResolver(id);
        if (!apelacion) {
            throw new AppError("Apelación no encontrada", ERROR_CODES.NOT_FOUND, 404);
        }
        if (apelacion.estado !== "EN_REVISION") {
            throw new AppError("El caso debe estar en revisión para resolverse", ERROR_CODES.CONFLICT, 409);
        }
        if (usuario.esComite && apelacion.comiteId !== usuario.id) {
            throw new AppError("Solo el miembro del comité asignado puede resolver", ERROR_CODES.FORBIDDEN, 403);
        }

        // Validar que cada reporte a bajar pertenece al identificador + plataforma declarados.
        let reportesValidos: { id: string }[] = [];
        if (decision === "ACEPTADA" && reportesABajar.length > 0) {
            reportesValidos = await this.reportes.findIdsWhere(
                whereReporteVigente({
                    id: { in: reportesABajar },
                    identificador: apelacion.identificador,
                    plataformaId: apelacion.plataformaId,
                })
            );
            if (reportesValidos.length !== reportesABajar.length) {
                throw new AppError(
                    "Algún reporte no pertenece al identificador declarado o ya está dado de baja",
                    ERROR_CODES.VALIDATION_ERROR,
                    400
                );
            }
        }

        const ahora = new Date();

        const reportesBajados = await withUnitOfWork(async (tx) => {
            const bajados: string[] = [];

            if (decision === "ACEPTADA") {
                if (quitarVisibilidad) {
                    // Marca del comité; si no hay agregado no hay nada que ocultar (no-op).
                    await new IdentificadorReportadoRepository(tx).marcarOcultoPorComite(
                        apelacion.identificador,
                        apelacion.plataformaId,
                        ahora
                    );
                }
                for (const rep of reportesValidos) {
                    await darDeBajaReporte({
                        reporteId: rep.id,
                        motivo: "REPORTE_FALSO",
                        nota: `Apelación ${apelacion.numero}: reporte declarado falso por el comité`,
                        adminId: usuario.id,
                        request,
                        tx,
                        accionAudit: "REPORT_DEACTIVATE",
                    });
                    bajados.push(rep.id);
                }
                // Recálculo final con la dueña única (efecto inmediato de la marca).
                await actualizarVisibilidadPublica(apelacion.identificador, apelacion.plataformaId, tx);
            }

            await new ApelacionRepository(tx).actualizar(id, {
                estado: decision,
                decision,
                motivacionResolucion: motivacion,
                quitoVisibilidad: decision === "ACEPTADA" && quitarVisibilidad,
                resueltoPorId: usuario.id,
                resueltoEn: ahora,
            });

            await logAudit({
                accion: "APELACION_RESUELTA",
                tipoRecurso: "Apelacion",
                recursoId: id,
                usuarioId: usuario.id,
                valorNuevo: JSON.stringify({
                    numero: apelacion.numero,
                    decision,
                    motivacion,
                    quitarVisibilidad: decision === "ACEPTADA" && quitarVisibilidad,
                    reportesBajados: bajados,
                }),
                ipAddress: info.ipAddress,
                userAgent: info.userAgent,
                tx,
            });

            return bajados;
        }, this.tx);

        return {
            apelacion: {
                id,
                numero: apelacion.numero,
                estado: decision,
                decision,
                quitoVisibilidad: decision === "ACEPTADA" && quitarVisibilidad,
                reportesBajados,
                resueltoEn: ahora,
            },
        };
    }
}
