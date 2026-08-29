import type { Prisma } from "@prisma/client";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { whereReporteVigente } from "@/lib/reportes-acceso";
import { UsuarioRepository } from "../repositories/usuario";
import { ReporteRepository } from "../repositories/reporte";
import { SolicitudComiteRepository } from "../repositories/solicitud-comite";
import { AuditLogRepository } from "../repositories/audit-log";
import { contarTamañoColegio } from "../repositories/analytics-colegio-helpers";
import { OperadorMetricasService } from "./operador-metricas";
import type {
    DetalleConsolidadoDto,
    DetallePadreDto,
    DetalleRectorDto,
    DetalleOperadorDto,
    DetalleComiteConvivenciaDto,
    DetalleComiteValidacionDto,
    DetalleAdminDto,
    ReporteMetadatoDto,
    CasoOperadorResumenDto,
    ReasignacionItemDto,
    DecisionComiteItemDto,
    ColegioRectorDetalleDto,
    AccionAdminItemDto,
} from "../types/usuarios-consolidado";
import { fechaIso, ESTADOS_COMITE_ABIERTOS } from "./usuarios-consolidado-helpers";

export class UsuariosConsolidadoDetalleService {
    private readonly db: Prisma.TransactionClient;
    private readonly usuarios: UsuarioRepository;
    private readonly reportes: ReporteRepository;
    private readonly solicitudes: SolicitudComiteRepository;
    private readonly audit: AuditLogRepository;

    constructor(db: Prisma.TransactionClient) {
        this.db = db;
        this.usuarios = new UsuarioRepository(db);
        this.reportes = new ReporteRepository(db);
        this.solicitudes = new SolicitudComiteRepository(db);
        this.audit = new AuditLogRepository(db);
    }

    async detallePorId(id: string): Promise<DetalleConsolidadoDto> {
        const usuario = await this.usuarios.findById(id);
        if (!usuario) {
            throw new AppError("Usuario no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }

        switch (usuario.rol) {
            case "PARENT":
                return this.detallePadre(usuario);
            case "SCHOOL_ADMIN":
                return this.detalleRector(usuario);
            case "OPERADOR":
                return this.detalleOperador(usuario);
            case "COMITE_CONVIVENCIA":
                return this.detalleComiteConvivencia(usuario);
            case "COMITE_VALIDACION":
                return this.detalleComiteValidacion(usuario);
            case "ADMIN":
                return this.detalleAdmin(usuario);
            default:
                throw new AppError("Rol no soportado", ERROR_CODES.VALIDATION_ERROR, 400);
        }
    }

    private async detallePadre(usuario: Prisma.UsuarioGetPayload<{}>): Promise<DetallePadreDto> {
        const [reportes, total] = await this.reportes.findPaginadosConTotal(
            whereReporteVigente({ usuarioId: usuario.id }),
            { skip: 0, take: 1000 }
        );
        const items: ReporteMetadatoDto[] = reportes.map((r) => ({
            id: r.id,
            numeroSeguimiento: r.numeroSeguimiento,
            estado: r.estado,
            creadoEn: r.creadoEn.toISOString(),
            esAnonimo: r.esAnonimo,
            plataforma: r.plataforma ? { nombre: r.plataforma.nombre, clave: r.plataforma.clave } : null,
            clasificacion: r.clasificacion
                ? { categoria: r.clasificacion.categoria, confianza: r.clasificacion.confianza }
                : null,
        }));

        const colegio = await this.db.colegio.findUnique({
            where: { tenantId: usuario.tenantId ?? "__no_existe__" },
            select: { id: true, nombre: true },
        });

        return {
            rol: "PARENT",
            id: usuario.id,
            email: usuario.email,
            nombre: usuario.nombre,
            estado: usuario.estado,
            creadoEn: usuario.creadoEn.toISOString(),
            ultimaSesion: fechaIso(usuario.ultimaSesion),
            reportes: { items, total },
            colegiosAsociados: colegio ? [{ id: colegio.id, nombre: colegio.nombre }] : [],
        };
    }

    private async detalleRector(usuario: Prisma.UsuarioGetPayload<{}>): Promise<DetalleRectorDto> {
        const colegios: ColegioRectorDetalleDto[] = [];
        if (usuario.colegioId && usuario.tenantId) {
            const colegio = await this.db.colegio.findUnique({
                where: { id: usuario.colegioId },
                select: { id: true, nombre: true },
            });
            if (colegio) {
                const [tamaño, reportesTotal, profesores, acudientes, integrantes] = await Promise.all([
                    contarTamañoColegio(colegio.id, this.db),
                    this.reportes.countWhere(whereReporteVigente({ tenantId: usuario.tenantId })),
                    this.db.profesor.count({ where: { colegioId: colegio.id, estado: "activo" } }),
                    this.db.acudienteEstudiante.count({ where: { estudiante: { colegioId: colegio.id } } }),
                    this.db.integranteComite.count({ where: { comite: { comiteColegioId: colegio.id }, estado: "ACTIVO" } }),
                ]);
                colegios.push({
                    id: colegio.id,
                    nombre: colegio.nombre,
                    alumnos: tamaño.alumnos,
                    profesores: tamaño.profesores,
                    cursos: tamaño.cursos,
                    reportesTotal: reportesTotal,
                    integrantesPorRol: {
                        profesores,
                        acudientes,
                        integrantesComite: integrantes,
                    },
                });
            }
        }

        return {
            rol: "SCHOOL_ADMIN",
            id: usuario.id,
            email: usuario.email,
            nombre: usuario.nombre,
            estado: usuario.estado,
            creadoEn: usuario.creadoEn.toISOString(),
            ultimaSesion: fechaIso(usuario.ultimaSesion),
            colegios,
        };
    }

    private async detalleOperador(usuario: Prisma.UsuarioGetPayload<{}>): Promise<DetalleOperadorDto> {
        const metricas = await new OperadorMetricasService().obtenerMetricas(usuario.id);
        const abiertos: CasoOperadorResumenDto[] = metricas.casosAbiertos.map((c) => ({
            id: c.id,
            numeroSeguimiento: c.numeroSeguimiento,
            estado: c.estado,
            categoria: c.categoria,
            plataformaNombre: c.plataformaNombre,
            asignadoEn: c.asignadoEn.toISOString(),
            tiempoDesdeAsignacionMs: c.tiempoDesdeAsignacionMs,
        }));

        const reasignacionesRaw = await this.db.auditLog.findMany({
            where: { accion: "OPERADOR_REASIGNADO", usuarioId: usuario.id, recursoId: { not: null } },
            orderBy: { creadoEn: "desc" },
            take: 20,
            include: { usuario: { select: { id: true, email: true, nombre: true } } },
        });
        const reasignaciones: ReasignacionItemDto[] = reasignacionesRaw.map((a) => ({
            id: a.id,
            reporteId: a.recursoId!,
            actorEmail: a.usuario?.email ?? "—",
            actorNombre: a.usuario?.nombre ?? null,
            creadoEn: a.creadoEn.toISOString(),
        }));

        return {
            rol: "OPERADOR",
            id: usuario.id,
            email: usuario.email,
            nombre: usuario.nombre,
            estado: usuario.estado,
            cupoMaximo: metricas.operador.cupoMaximo,
            casosAbiertos: abiertos,
            totalAbiertos: abiertos.length,
            casosResueltos24h: metricas.casosResueltos24h,
            casosResueltos7d: metricas.casosResueltos7d,
            casosResueltos30d: metricas.casosResueltos30d,
            tiempoMedioResolucionMs: metricas.tiempoMedioResolucionMs,
            tasaEscalamientoComite: metricas.tasaEscalamientoComite,
            reasignacionesRecientes: reasignaciones,
        };
    }

    private async detalleComiteConvivencia(usuario: Prisma.UsuarioGetPayload<{}>): Promise<DetalleComiteConvivenciaDto> {
        const colegioId = usuario.comiteColegioId;
        const [colegio, integrantesActivos, operadores, casosRaw, resueltos, tiempo] = await Promise.all([
            colegioId ? this.db.colegio.findUnique({ where: { id: colegioId }, select: { id: true, nombre: true, tenantId: true } }) : null,
            this.db.integranteComite.count({ where: { comiteId: usuario.id, estado: "ACTIVO" } }),
            colegioId
                ? this.db.usuario.findMany({
                    where: { rol: "OPERADOR", estado: "activo", tenantId: { not: null } },
                    select: { id: true, email: true, nombre: true, tenantId: true },
                })
                : [],
            colegioId
                ? this.db.solicitudComite.findMany({
                    where: { colegioId },
                    orderBy: { creadoEn: "desc" },
                    take: 10,
                    select: { id: true, numero: true, estado: true, creadoEn: true, resueltoEn: true },
                })
                : [],
            colegioId ? this.db.solicitudComite.count({ where: { colegioId, resueltoEn: { not: null } } }) : 0,
            colegioId ? this.tiempoMedioResolucionComiteConvivencia(colegioId) : null,
        ]);

        const operadoresFiltrados = colegio?.tenantId
            ? operadores.filter((op) => op.tenantId === colegio.tenantId)
            : [];

        const casos: DecisionComiteItemDto[] = casosRaw.map((c) => ({
            id: c.id,
            numero: c.numero,
            estado: c.estado,
            creadoEn: c.creadoEn.toISOString(),
            resueltoEn: c.resueltoEn?.toISOString() ?? null,
        }));

        return {
            rol: "COMITE_CONVIVENCIA",
            id: usuario.id,
            email: usuario.email,
            nombre: usuario.nombre,
            estado: usuario.estado,
            colegio: colegio ? { id: colegio.id, nombre: colegio.nombre } : null,
            integrantesActivos,
            operadoresAsignados: operadoresFiltrados.map((op) => ({ id: op.id, nombre: op.nombre, email: op.email })),
            casosEscalados: casos,
            casosEscaladosTotal: casos.length,
            casosResueltos: resueltos,
            tiempoMedioResolucionHoras: tiempo,
        };
    }

    async tiempoMedioResolucionComiteConvivencia(colegioId: string): Promise<number | null> {
        const resueltos = await this.db.solicitudComite.findMany({
            where: { colegioId, resueltoEn: { not: null } },
            select: { creadoEn: true, resueltoEn: true },
        });
        const horas = resueltos
            .filter((r): r is typeof r & { resueltoEn: Date } => r.resueltoEn !== null)
            .map((r) => (r.resueltoEn.getTime() - r.creadoEn.getTime()) / (1000 * 60 * 60));
        return horas.length ? horas.reduce((a, b) => a + b, 0) / horas.length : null;
    }

    private async detalleComiteValidacion(usuario: Prisma.UsuarioGetPayload<{}>): Promise<DetalleComiteValidacionDto> {
        const [enCurso, pendientes, resueltos, ultimas] = await Promise.all([
            this.db.solicitudComite.count({ where: { comiteId: usuario.id, estado: { in: ESTADOS_COMITE_ABIERTOS } } }),
            this.solicitudes.countPorComite(usuario.id, ESTADOS_COMITE_ABIERTOS),
            this.db.solicitudComite.count({ where: { comiteId: usuario.id, resueltoEn: { not: null } } }),
            this.db.solicitudComite.findMany({
                where: { comiteId: usuario.id, resueltoEn: { not: null } },
                orderBy: { resueltoEn: "desc" },
                take: 10,
                select: { id: true, numero: true, estado: true, creadoEn: true, resueltoEn: true },
            }),
        ]);

        const total = enCurso + resueltos;
        const tasaResolucion = total > 0 ? resueltos / total : null;

        return {
            rol: "COMITE_VALIDACION",
            id: usuario.id,
            email: usuario.email,
            nombre: usuario.nombre,
            estado: usuario.estado,
            casosEnCurso: enCurso,
            casosPendientes: pendientes,
            casosResueltos: resueltos,
            ultimasDecisiones: ultimas.map((d) => ({
                id: d.id,
                numero: d.numero,
                estado: d.estado,
                creadoEn: d.creadoEn.toISOString(),
                resueltoEn: d.resueltoEn?.toISOString() ?? null,
            })),
            tasaResolucion,
        };
    }

    private async detalleAdmin(usuario: Prisma.UsuarioGetPayload<{}>): Promise<DetalleAdminDto> {
        const [permisos, acciones] = await Promise.all([
            this.db.permisoModulo.findMany({
                where: { rol: "ADMIN", activo: true },
                include: { modulo: { select: { clave: true, nombre: true } } },
            }),
            this.db.auditLog.findMany({
                where: { usuarioId: usuario.id },
                orderBy: { creadoEn: "desc" },
                take: 20,
                select: { id: true, accion: true, tipoRecurso: true, recursoId: true, creadoEn: true },
            }),
        ]);

        const modulos = permisos
            .map((p) => (p.modulo ? { clave: p.modulo.clave, nombre: p.modulo.nombre } : null))
            .filter((m): m is { clave: string; nombre: string } => m !== null);

        const ultimasAcciones: AccionAdminItemDto[] = acciones.map((a) => ({
            id: a.id,
            accion: a.accion,
            tipoRecurso: a.tipoRecurso,
            recursoId: a.recursoId,
            creadoEn: a.creadoEn.toISOString(),
        }));

        return {
            rol: "ADMIN",
            id: usuario.id,
            email: usuario.email,
            nombre: usuario.nombre,
            estado: usuario.estado,
            creadoEn: usuario.creadoEn.toISOString(),
            ultimaSesion: fechaIso(usuario.ultimaSesion),
            modulosGestionados: modulos,
            ultimasAcciones,
        };
    }
}
