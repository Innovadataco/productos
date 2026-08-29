/**
 * SPEC-053 (US3, módulo Comité): ComiteBandejaService.
 * Bandeja de solicitudes escaladas al comité de validación: pendientes, casos
 * propios, listado por rol, asignación, reasignación y resolución (corrección
 * de categoría + transición de estado + visibilidad/score). Los helpers de
 * dominio (`registrarTransicion`, `actualizarVisibilidadPublica`,
 * `recalcularYGuardarScore`) se reutilizan desde aquí. Acepta tx opcional (D2).
 */
import type { CategoriaConducta, Prisma } from "@prisma/client";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { registrarTransicion, responsableTipoFromRol } from "@/lib/reporte-transiciones";
import { actualizarVisibilidadPublica } from "@/lib/visibility";
import { recalcularYGuardarScore } from "@/lib/scoring";
import { SolicitudComiteRepository } from "../repositories/solicitud-comite";
import { ReporteRepository } from "../repositories/reporte";
import { UsuarioRepository } from "../repositories/usuario";
import { CorreccionAdminRepository } from "../repositories/correccion-admin";
import { ClasificacionIARepository } from "../repositories/clasificacion-ia";
import { EventoMatchRepository } from "../repositories/evento-match";
import { withUnitOfWork } from "../unit-of-work";
import { detectarYRegistrarMatch } from "./evento-match";
import { agregarPatronPorReporte } from "@/lib/colegio/patrones";
import { getParametroSistemaValor } from "@/lib/parametros";
import { construirSla } from "@/lib/comite/sla";
import type { InfoClienteDto } from "../types/operador";
import type { ResolverSolicitudInput } from "../types/comite";

// SPEC-237: SLA default de una revisión de reporte si el parámetro no existe.
const DEFAULT_SLA_HORAS_REVISION = 48;

async function slaHorasRevisionReporte(): Promise<number> {
    const raw = await getParametroSistemaValor("padre.comite.sla_horas_normal");
    const parsed = Number.parseInt(raw ?? String(DEFAULT_SLA_HORAS_REVISION), 10);
    return Number.isFinite(parsed) && parsed >= 1 ? parsed : DEFAULT_SLA_HORAS_REVISION;
}

export class ComiteBandejaService {
    private readonly solicitudes: SolicitudComiteRepository;
    private readonly reportes: ReporteRepository;
    private readonly usuarios: UsuarioRepository;

    constructor(private readonly tx?: Prisma.TransactionClient) {
        this.solicitudes = new SolicitudComiteRepository(tx);
        this.reportes = new ReporteRepository(tx);
        this.usuarios = new UsuarioRepository(tx);
    }

    /** GET /api/admin/comite/pendientes — solicitudes PENDIENTE sin asignar. */
    async listarPendientes(paginacion: { page: number; limit: number }) {
        const skip = (paginacion.page - 1) * paginacion.limit;
        const [solicitudes, total] = await this.solicitudes.findPendientesSinAsignar({
            skip,
            take: paginacion.limit,
        });
        return {
            solicitudes,
            paginacion: {
                page: paginacion.page,
                limit: paginacion.limit,
                total,
                totalPages: Math.ceil(total / paginacion.limit),
            },
        };
    }

    /** GET /api/admin/comite/mias — casos abiertos asignados al miembro autenticado. */
    async listarMias(comiteId: string, paginacion: { page: number; limit: number }) {
        const skip = (paginacion.page - 1) * paginacion.limit;
        const [solicitudes, total] = await this.solicitudes.findAsignadasPorComite(comiteId, {
            skip,
            take: paginacion.limit,
        });
        return {
            solicitudes,
            paginacion: {
                page: paginacion.page,
                limit: paginacion.limit,
                total,
                totalPages: Math.ceil(total / paginacion.limit),
            },
        };
    }

    /** GET /api/admin/comite/solicitudes — listado por rol (admin ve todo; comité, lo suyo + libres). */
    async listarSolicitudes(
        usuario: { id: string; esAdmin: boolean },
        paginacion: { page: number; limit: number }
    ) {
        const skip = (paginacion.page - 1) * paginacion.limit;

        let where: Prisma.SolicitudComiteWhereInput;
        if (usuario.esAdmin) {
            where = {
                estado: { in: ["PENDIENTE", "ASIGNADA", "RESUELTA"] },
            };
        } else {
            where = {
                estado: { in: ["PENDIENTE", "ASIGNADA", "RESUELTA"] },
                OR: [
                    { estado: "PENDIENTE", comiteId: null },
                    { comiteId: usuario.id },
                ],
            };
        }

        // SPEC-139 (F5, ZEUS D-3): etiqueta + orden prioritario en la bandeja
        // actual (NO sección nueva): los casos cuyo identificador tiene un match
        // inter-ciudad van al tope con el distintivo `matchInterCiudad`. El orden
        // es estable: dentro de cada grupo se conserva creadoEn desc.
        const solicitudesTodas = await this.solicitudes.findBandejaCompletaConReporte(where);
        const paresConMatch = await new EventoMatchRepository().findInterCiudadPorPares(
            solicitudesTodas.map((s) => s.reporte)
        );
        const clavesConMatch = new Set(paresConMatch.map((p) => `${p.identificador}|${p.plataformaId}`));
        // SPEC-237 (002-PI-mega-cola): SLA visible por tarea (FR-004). Las
        // revisiones de reporte usan `padre.comite.sla_horas_normal`.
        const slaHoras = await slaHorasRevisionReporte();
        const anotadas = solicitudesTodas.map((s) => {
            const { reporte, ...resto } = s;
            return {
                ...resto,
                matchInterCiudad: clavesConMatch.has(`${reporte.identificador}|${reporte.plataformaId}`),
                sla: construirSla(s.creadoEn, slaHoras),
            };
        });
        anotadas.sort((a, b) => Number(b.matchInterCiudad) - Number(a.matchInterCiudad));

        const total = anotadas.length;
        const solicitudes = anotadas.slice(skip, skip + paginacion.limit);
        return {
            solicitudes,
            paginacion: {
                page: paginacion.page,
                limit: paginacion.limit,
                total,
                totalPages: Math.ceil(total / paginacion.limit),
            },
        };
    }

    /** POST /api/admin/comite/[id]/asignar — asigna la solicitud y el reporte al miembro. */
    async asignar(id: string, comiteId: string, usuarioId: string, info: InfoClienteDto) {
        const solicitud = await this.solicitudes.findByIdConReporte(id);
        if (!solicitud) {
            throw new AppError("Solicitud no encontrada", ERROR_CODES.NOT_FOUND, 404);
        }

        if (solicitud.estado !== "PENDIENTE") {
            throw new AppError("La solicitud ya fue asignada o resuelta", ERROR_CODES.CONFLICT, 409);
        }

        const comite = await this.usuarios.findMiembroComiteActivo(comiteId);
        if (!comite || !comite.perfilOperador?.esComite) {
            throw new AppError("Miembro del comité no encontrado o inactivo", ERROR_CODES.NOT_FOUND, 404);
        }

        await withUnitOfWork(async (tx) => {
            await new SolicitudComiteRepository(tx).actualizar(id, { estado: "ASIGNADA", comiteId });
            await new ReporteRepository(tx).asignarComite(solicitud.reporteId, comiteId);
        }, this.tx);

        await logAudit({
            accion: "OPERADOR_ASIGNADO",
            tipoRecurso: "SolicitudComite",
            recursoId: id,
            usuarioId,
            valorNuevo: JSON.stringify({ comiteId, solicitudId: id }),
            ipAddress: info.ipAddress,
            userAgent: info.userAgent,
        });

        return {
            solicitudId: id,
            numero: solicitud.numero,
            estado: "ASIGNADA",
            comiteId,
        };
    }

    /** POST /api/admin/comite/[id]/reasignar — mueve la solicitud y el reporte a otro miembro. */
    async reasignar(id: string, nuevoComiteId: string, usuarioId: string, info: InfoClienteDto) {
        const solicitud = await this.solicitudes.findByIdConReporte(id);
        if (!solicitud) {
            throw new AppError("Solicitud no encontrada", ERROR_CODES.NOT_FOUND, 404);
        }

        if (solicitud.estado !== "ASIGNADA") {
            throw new AppError("Solo se pueden reasignar solicitudes asignadas", ERROR_CODES.VALIDATION_ERROR, 409);
        }

        const nuevoComite = await this.usuarios.findMiembroComiteActivo(nuevoComiteId);
        if (!nuevoComite || !nuevoComite.perfilOperador?.esComite) {
            throw new AppError("Nuevo miembro del comité no encontrado o inactivo", ERROR_CODES.NOT_FOUND, 404);
        }

        await withUnitOfWork(async (tx) => {
            await new SolicitudComiteRepository(tx).actualizar(id, { comiteId: nuevoComiteId });
            await new ReporteRepository(tx).asignarComite(solicitud.reporteId, nuevoComiteId);
        }, this.tx);

        await logAudit({
            accion: "CASO_REASIGNADO",
            tipoRecurso: "SolicitudComite",
            recursoId: id,
            usuarioId,
            valorAnterior: JSON.stringify({ comiteId: solicitud.comiteId }),
            valorNuevo: JSON.stringify({ comiteId: nuevoComiteId }),
            ipAddress: info.ipAddress,
            userAgent: info.userAgent,
        });

        return {
            solicitudId: id,
            numero: solicitud.numero,
            estado: "ASIGNADA",
            comiteId: nuevoComiteId,
        };
    }

    /** POST /api/admin/comite/[id]/resolver — corrección de categoría + cierre del caso. */
    async resolver(
        id: string,
        input: ResolverSolicitudInput,
        usuario: { id: string; rol: string; esComite: boolean },
        info: InfoClienteDto
    ) {
        const solicitud = await this.solicitudes.findByIdConReporteYClasificacion(id);
        if (!solicitud) {
            throw new AppError("Solicitud no encontrada", ERROR_CODES.NOT_FOUND, 404);
        }

        if (solicitud.estado !== "ASIGNADA") {
            throw new AppError("La solicitud debe estar asignada para resolverse", ERROR_CODES.CONFLICT, 409);
        }

        if (usuario.esComite && solicitud.comiteId !== usuario.id) {
            throw new AppError("Solo el miembro del comité asignado puede resolver", ERROR_CODES.FORBIDDEN, 403);
        }

        const reporte = solicitud.reporte;
        if (!reporte.clasificacion) {
            throw new AppError("El reporte no tiene clasificación", ERROR_CODES.VALIDATION_ERROR, 400);
        }

        const { categoria, resolucion } = input;
        const estadoAnterior = reporte.estado;
        const estadoNuevo = "CORREGIDO";
        const responsableTipo = responsableTipoFromRol(usuario.rol) ?? "ADMIN";
        const clasificacion = reporte.clasificacion;

        await withUnitOfWork(async (tx) => {
            const correccionExistente = await new CorreccionAdminRepository(tx).findByClasificacionId(clasificacion.id);
            if (correccionExistente) {
                throw new AppError("Este reporte ya fue corregido", ERROR_CODES.CONFLICT, 409);
            }
            await new CorreccionAdminRepository(tx).crear({
                clasificacionId: clasificacion.id,
                categoriaOriginal: clasificacion.categoria,
                categoriaCorregida: categoria as CategoriaConducta,
                adminId: usuario.id,
                motivo: resolucion || null,
                confirmada: true,
            });
            await new ClasificacionIARepository(tx).actualizarPorReporteId(reporte.id, {
                categoria: categoria as CategoriaConducta,
                confianza: 1.0,
            });

            await registrarTransicion({
                reporteId: reporte.id,
                estadoAnterior,
                estadoNuevo,
                responsableTipo,
                responsableId: usuario.id,
                motivo: resolucion || "Caso resuelto por comité",
                metadatos: { accion: "CASO_RESUELTO_POR_COMITE", solicitudId: id, numero: solicitud.numero },
                tx,
            });
            await new ReporteRepository(tx).actualizarEstado(reporte.id, { estado: estadoNuevo });
            await new SolicitudComiteRepository(tx).actualizar(id, {
                estado: "RESUELTA",
                resolucion: resolucion || null,
                resueltoEn: new Date(),
            });
        }, this.tx);

        await actualizarVisibilidadPublica(reporte.identificador, reporte.plataformaId);
        const scoreResult = await recalcularYGuardarScore(reporte.identificador, reporte.plataformaId);

        // SPEC-139/142 (ZEUS D-1): la resolución del comité pasa el reporte a
        // APROBADO (CORREGIDO) — dispara match y agregación de patrones.
        // Await + catch: fail-open (nunca rompe la resolución ya persistida).
        await detectarYRegistrarMatch(reporte.id).catch((err) => {
            console.error(`[COMITE] Error registrando match reporte=${reporte.id}:`, err);
        });
        await agregarPatronPorReporte(reporte.id).catch((err) => {
            console.error(`[COMITE] Error agregando patrón institucional reporte=${reporte.id}:`, err);
        });

        await logAudit({
            accion: "CASO_RESUELTO_POR_COMITE",
            tipoRecurso: "SolicitudComite",
            recursoId: id,
            usuarioId: usuario.id,
            valorNuevo: JSON.stringify({ categoria, resolucion: resolucion || null, estadoNuevo }),
            ipAddress: info.ipAddress,
            userAgent: info.userAgent,
        });

        return {
            solicitudId: id,
            numero: solicitud.numero,
            estado: "RESUELTA",
            reporte: {
                id: reporte.id,
                estado: estadoNuevo,
                categoria,
            },
            score: scoreResult.score,
            nivelRiesgo: scoreResult.nivelRiesgo,
        };
    }
}
