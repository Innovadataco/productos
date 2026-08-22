/**
 * SPEC-205 (002-PI-102): servicio consolidado de usuarios por rol.
 * Fuente única de KPI y listados; reutiliza OperadorService.panelAsignacion()
 * para garantizar cero divergencia con /operadores/asignar.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { whereReporteVigente } from "@/lib/reportes-acceso";
import { UsuarioRepository } from "../repositories/usuario";
import { ReporteRepository } from "../repositories/reporte";
import { SolicitudComiteRepository } from "../repositories/solicitud-comite";
import { AuditLogRepository } from "../repositories/audit-log";
import { contarTamañoColegio } from "../repositories/analytics-colegio-helpers";
import { OperadorService } from "./operadores";
import { OperadorMetricasService } from "./operador-metricas";
import { UsuariosConsolidadoDetalleService } from "./usuarios-consolidado-detalle";
import { fechaIso, inicioVentana, ESTADOS_COMITE_ABIERTOS, ACCIONES_CIERRE_OPERADOR } from "./usuarios-consolidado-helpers";
import type {
    RolUsuariosListado,
    KpiRolCard,
    AlertaDashboard,
    PaginacionDto,
    UsuarioListItemDto,
    PadreListItemDto,
    RectorListItemDto,
    OperadorListItemConsolidadoDto,
    ComiteConvivenciaListItemDto,
    ComiteValidacionListItemDto,
    AdminListItemDto,
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

const ROLES_KPI = [
    { key: "padres" as const, label: "Padres", rol: "PARENT" as const },
    { key: "rectores" as const, label: "Rectores", rol: "SCHOOL_ADMIN" as const },
    { key: "operadores" as const, label: "Operadores", rol: "OPERADOR" as const },
    { key: "comite" as const, label: "Comité", roles: ["COMITE_VALIDACION", "COMITE_CONVIVENCIA"] as const },
    { key: "admins" as const, label: "Admins", rol: "ADMIN" as const },
] as const;

export class UsuariosConsolidadoService {
    private readonly db: Prisma.TransactionClient;
    private readonly usuarios: UsuarioRepository;
    private readonly reportes: ReporteRepository;
    private readonly solicitudes: SolicitudComiteRepository;
    private readonly audit: AuditLogRepository;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
        this.usuarios = new UsuarioRepository(tx);
        this.reportes = new ReporteRepository(tx);
        this.solicitudes = new SolicitudComiteRepository(tx);
        this.audit = new AuditLogRepository(tx);
    }

    /** KPI consolidado: un solo groupBy alimenta las 5 tarjetas. */
    async resumenPorRol(): Promise<KpiRolCard[]> {
        const agregados = await this.db.usuario.groupBy({
            by: ["rol", "estado"],
            _count: { _all: true },
        });

        const conteo = new Map<string, Map<string, number>>();
        for (const row of agregados) {
            if (!conteo.has(row.rol)) conteo.set(row.rol, new Map());
            conteo.get(row.rol)!.set(row.estado, row._count._all);
        }

        function totalEstado(rol: string, estado: string): number {
            return conteo.get(rol)?.get(estado) ?? 0;
        }

        function totalRol(rol: string): number {
            return Array.from(conteo.get(rol)?.values() ?? []).reduce((a, b) => a + b, 0);
        }

        function totalRoles(roles: readonly string[]): number {
            return roles.reduce((acc, rol) => acc + totalRol(rol), 0);
        }

        return ROLES_KPI.map((cfg) => {
            const roles = "roles" in cfg ? cfg.roles : [cfg.rol];
            const total = totalRoles(roles);
            const activos = roles.reduce((acc, rol) => acc + totalEstado(rol, "activo"), 0);
            const inactivos = roles.reduce((acc, rol) => acc + totalEstado(rol, "inactivo"), 0);
            const bloqueados = roles.reduce((acc, rol) => acc + totalEstado(rol, "bloqueado"), 0);
            const alerta =
                cfg.key === "operadores"
                    ? false // se calcula en alertasDashboard
                    : cfg.key === "comite"
                        ? false // se calcula en alertasDashboard
                        : false;
            return {
                key: cfg.key,
                label: cfg.label,
                total,
                activos,
                inactivos,
                bloqueados,
                alerta,
            };
        });
    }

    /** Alertas derivadas del estado operativo. */
    async alertasDashboard(): Promise<AlertaDashboard[]> {
        const alertas: AlertaDashboard[] = [];

        const [panel, comitesConMiembros, colegiosActivos] = await Promise.all([
            new OperadorService().panelAsignacion(),
            this.db.integranteComite.groupBy({
                by: ["comiteId"],
                where: { estado: "ACTIVO" },
                _count: { _all: true },
            }),
            this.db.colegio.findMany({
                where: { estado: "activo" },
                select: { id: true, nombre: true, admin: { select: { id: true, estado: true } } },
            }),
        ]);

        const sobrecargados = panel.operadores.filter((op) => op.casosAbiertos >= op.cupoMaximo && op.cupoMaximo > 0);
        if (sobrecargados.length > 0) {
            alertas.push({
                tipo: "operadores_sobrecargados",
                mensaje: `${sobrecargados.length} operador(es) están al cupo máximo de casos`,
                severidad: "danger",
            });
        }

        const comitesConIntegrantes = new Set(comitesConMiembros.map((c) => c.comiteId));
        const comitesSinMiembros = await this.db.usuario.count({
            where: { rol: "COMITE_CONVIVENCIA", comiteColegioId: { not: null }, id: { notIn: Array.from(comitesConIntegrantes) } },
        });
        if (comitesSinMiembros > 0) {
            alertas.push({
                tipo: "comite_sin_miembros",
                mensaje: `${comitesSinMiembros} comité(s) de convivencia sin integrantes activos`,
                severidad: "warning",
            });
        }

        const colegiosSinRector = colegiosActivos.filter((c) => !c.admin || c.admin.estado !== "activo");
        if (colegiosSinRector.length > 0) {
            alertas.push({
                tipo: "colegio_sin_rector",
                mensaje: `${colegiosSinRector.length} colegio(s) activo(s) sin rector activo`,
                severidad: "warning",
            });
        }

        return alertas;
    }

    /** Listado paginado según rol, con la misma forma { items, pagination }. */
    async listarPorRol(
        rol: RolUsuariosListado,
        filtros: { q?: string | undefined; estado?: "activo" | "inactivo" | "bloqueado" | undefined; conReportes?: boolean | undefined },
        paginacion: { page: number; pageSize: number }
    ): Promise<{ items: UsuarioListItemDto[]; pagination: PaginacionDto }> {
        switch (rol) {
            case "PARENT":
                return this.listarPadres(filtros, paginacion);
            case "SCHOOL_ADMIN":
                return this.listarRectores(filtros, paginacion);
            case "OPERADOR":
                return this.listarOperadores(filtros, paginacion);
            case "COMITE_CONVIVENCIA":
                return this.listarComiteConvivencia(filtros, paginacion);
            case "COMITE_VALIDACION":
                return this.listarComiteValidacion(filtros, paginacion);
            case "ADMIN":
                return this.listarAdmins(filtros, paginacion);
            default:
                throw new AppError("Rol no soportado", ERROR_CODES.VALIDATION_ERROR, 400);
        }
    }

    private async listarPadres(
        filtros: { q?: string | undefined; estado?: "activo" | "inactivo" | "bloqueado" | undefined; conReportes?: boolean | undefined },
        paginacion: { page: number; pageSize: number }
    ): Promise<{ items: UsuarioListItemDto[]; pagination: PaginacionDto }> {
        const where = this.whereBaseRol("PARENT", filtros);
        if (filtros.conReportes === true) {
            where.reportes = { some: { eliminado: false } };
        } else if (filtros.conReportes === false) {
            where.reportes = { none: { eliminado: false } };
        }
        const [usuarios, total] = await this.usuarios.findUsuariosAdminPaginados(where, {
            skip: (paginacion.page - 1) * paginacion.pageSize,
            take: paginacion.pageSize,
        });

        const ids = usuarios.map((u) => u.id);
        const [conteosTotales, conteos30d] = await Promise.all([
            ids.length ? this.reportes.contarPorUsuarios(whereReporteVigente({ usuarioId: { in: ids } })) : [],
            ids.length
                ? this.reportes.contarPorUsuarios(
                    whereReporteVigente({ usuarioId: { in: ids }, creadoEn: { gte: inicioVentana(30) } })
                )
                : [],
        ]);
        const totalPorUsuario = new Map(conteosTotales.map((c) => [c.usuarioId, c._count._all]));
        const treintaPorUsuario = new Map(conteos30d.map((c) => [c.usuarioId, c._count._all]));

        const items: PadreListItemDto[] = usuarios.map((u) => ({
            id: u.id,
            email: u.email,
            nombre: u.nombre,
            estado: u.estado,
            reportesEnviados: totalPorUsuario.get(u.id) ?? 0,
            reportesUltimos30Dias: treintaPorUsuario.get(u.id) ?? 0,
            colegiosAsociados: u.colegio ? [{ id: u.colegio.id, nombre: u.colegio.nombre }] : [],
            creadoEn: u.creadoEn.toISOString(),
            ultimaSesion: fechaIso(u.ultimaSesion),
        }));

        return {
            items: items.map((i) => ({ rol: "PARENT", ...i })),
            pagination: this.paginacion(paginacion, total),
        };
    }

    private async listarRectores(
        filtros: { q?: string | undefined; estado?: "activo" | "inactivo" | "bloqueado" | undefined },
        paginacion: { page: number; pageSize: number }
    ): Promise<{ items: UsuarioListItemDto[]; pagination: PaginacionDto }> {
        const where = this.whereBaseRol("SCHOOL_ADMIN", filtros);
        const [usuarios, total] = await this.usuarios.findUsuariosAdminPaginados(where, {
            skip: (paginacion.page - 1) * paginacion.pageSize,
            take: paginacion.pageSize,
        });

        const items = await Promise.all(
            usuarios.map(async (u): Promise<RectorListItemDto> => {
                const colegioId = u.colegio?.id;
                const tenantId = u.tenantId;
                const [tamaño, reportesTotal] = await Promise.all([
                    colegioId ? contarTamañoColegio(colegioId, this.db) : { alumnos: 0, profesores: 0, cursos: 0, materias: 0 },
                    tenantId ? this.reportes.countWhere(whereReporteVigente({ tenantId })) : 0,
                ]);
                return {
                    id: u.id,
                    email: u.email,
                    nombre: u.nombre,
                    estado: u.estado,
                    colegio: u.colegio ? { id: u.colegio.id, nombre: u.colegio.nombre } : null,
                    alumnos: tamaño.alumnos,
                    profesores: tamaño.profesores,
                    cursos: tamaño.cursos,
                    reportesColegio: reportesTotal,
                    ultimaSesion: fechaIso(u.ultimaSesion),
                };
            })
        );

        return {
            items: items.map((i) => ({ rol: "SCHOOL_ADMIN", ...i })),
            pagination: this.paginacion(paginacion, total),
        };
    }

    private async listarOperadores(
        filtros: { q?: string | undefined; estado?: "activo" | "inactivo" | "bloqueado" | undefined },
        paginacion: { page: number; pageSize: number }
    ): Promise<{ items: UsuarioListItemDto[]; pagination: PaginacionDto }> {
        const panel = await new OperadorService().panelAsignacion();
        let operadores = panel.operadores;

        if (filtros.q) {
            const q = filtros.q.toLowerCase();
            operadores = operadores.filter(
                (op) => op.email.toLowerCase().includes(q) || (op.nombre?.toLowerCase().includes(q) ?? false)
            );
        }

        // El panel ya filtra activos; si se pidiera otro estado se debería extender la fuente.
        // Por ahora el estado siempre refleja la cuenta real del panel.
        const estados = await this.db.usuario.findMany({
            where: { id: { in: operadores.map((op) => op.id) } },
            select: { id: true, estado: true },
        });
        const estadoPorId = new Map(estados.map((e) => [e.id, e.estado]));

        const total = operadores.length;
        const pageSize = paginacion.pageSize;
        const page = paginacion.page;
        const start = (page - 1) * pageSize;
        const paginated = operadores.slice(start, start + pageSize);

        const items: OperadorListItemConsolidadoDto[] = paginated.map((op) => ({
            id: op.id,
            email: op.email,
            nombre: op.nombre,
            estado: estadoPorId.get(op.id) ?? "activo",
            cupoMaximo: op.cupoMaximo,
            casosAbiertos: op.casosAbiertos,
            // Deuda técnica SPEC-205: calcular por lotes con AuditLog/Reporte para evitar N+1.
            enProceso: 0,
            cerrados30Dias: 0,
            tiempoMedioResolucionMs: null,
        }));

        return {
            items: items.map((i) => ({ rol: "OPERADOR", ...i })),
            pagination: this.paginacion(paginacion, total),
        };
    }

    private async listarComiteConvivencia(
        filtros: { q?: string | undefined; estado?: "activo" | "inactivo" | "bloqueado" | undefined },
        paginacion: { page: number; pageSize: number }
    ): Promise<{ items: UsuarioListItemDto[]; pagination: PaginacionDto }> {
        const where = this.whereBaseRol("COMITE_CONVIVENCIA", filtros);
        const [usuarios, total] = await this.usuarios.findUsuariosAdminPaginados(where, {
            skip: (paginacion.page - 1) * paginacion.pageSize,
            take: paginacion.pageSize,
        });

        const items = await Promise.all(
            usuarios.map(async (u): Promise<ComiteConvivenciaListItemDto> => {
                const colegioId = u.comiteColegioId;
                const colegioRel = u.comiteConvivenciaColegio;
                const [integrantesActivos, abiertos, resueltos, tiempo] = await Promise.all([
                    this.db.integranteComite.count({ where: { comiteId: u.id, estado: "ACTIVO" } }),
                    colegioId
                        ? this.db.solicitudComite.count({ where: { colegioId, estado: { in: ESTADOS_COMITE_ABIERTOS } } })
                        : 0,
                    colegioId ? this.db.solicitudComite.count({ where: { colegioId, resueltoEn: { not: null } } }) : 0,
                    colegioId ? new UsuariosConsolidadoDetalleService(this.db).tiempoMedioResolucionComiteConvivencia(colegioId) : null,
                ]);
                return {
                    id: u.id,
                    email: u.email,
                    nombre: u.nombre,
                    estado: u.estado,
                    colegio: colegioRel ? { id: colegioRel.id, nombre: colegioRel.nombre } : null,
                    integrantesActivos,
                    casosEscaladosAbiertos: abiertos,
                    casosEscaladosResueltos: resueltos,
                    tiempoMedioResolucionHoras: tiempo,
                };
            })
        );

        return {
            items: items.map((i) => ({ rol: "COMITE_CONVIVENCIA", ...i })),
            pagination: this.paginacion(paginacion, total),
        };
    }

    private async listarComiteValidacion(
        filtros: { q?: string | undefined; estado?: "activo" | "inactivo" | "bloqueado" | undefined },
        paginacion: { page: number; pageSize: number }
    ): Promise<{ items: UsuarioListItemDto[]; pagination: PaginacionDto }> {
        const where = this.whereBaseRol("COMITE_VALIDACION", filtros);
        const [usuarios, total] = await this.usuarios.findUsuariosAdminPaginados(where, {
            skip: (paginacion.page - 1) * paginacion.pageSize,
            take: paginacion.pageSize,
        });

        const items = await Promise.all(
            usuarios.map(async (u): Promise<ComiteValidacionListItemDto> => {
                const [pendientes, resueltos, totalAsignados, ultimas] = await Promise.all([
                    this.solicitudes.countPorComite(u.id, ESTADOS_COMITE_ABIERTOS),
                    this.db.solicitudComite.count({ where: { comiteId: u.id, resueltoEn: { not: null } } }),
                    this.solicitudes.countPorComite(u.id),
                    this.db.solicitudComite.findMany({
                        where: { comiteId: u.id, resueltoEn: { not: null } },
                        orderBy: { resueltoEn: "desc" },
                        take: 3,
                        select: { id: true, numero: true, estado: true, creadoEn: true, resueltoEn: true },
                    }),
                ]);
                return {
                    id: u.id,
                    email: u.email,
                    nombre: u.nombre,
                    estado: u.estado,
                    casosEscaladosPlataforma: totalAsignados,
                    casosPendientes: pendientes,
                    casosResueltos: resueltos,
                    ultimasDecisiones: ultimas.map((d) => ({
                        id: d.id,
                        numero: d.numero,
                        estado: d.estado,
                        creadoEn: d.creadoEn.toISOString(),
                        resueltoEn: d.resueltoEn?.toISOString() ?? null,
                    })),
                };
            })
        );

        return {
            items: items.map((i) => ({ rol: "COMITE_VALIDACION", ...i })),
            pagination: this.paginacion(paginacion, total),
        };
    }

    private async listarAdmins(
        filtros: { q?: string | undefined; estado?: "activo" | "inactivo" | "bloqueado" | undefined },
        paginacion: { page: number; pageSize: number }
    ): Promise<{ items: UsuarioListItemDto[]; pagination: PaginacionDto }> {
        const where = this.whereBaseRol("ADMIN", filtros);
        const [usuarios, total] = await this.usuarios.findUsuariosAdminPaginados(where, {
            skip: (paginacion.page - 1) * paginacion.pageSize,
            take: paginacion.pageSize,
        });

        const permisos = await this.db.permisoModulo.findMany({
            where: { rol: "ADMIN", activo: true },
            include: { modulo: { select: { clave: true, nombre: true } } },
        });
        const modulos = permisos
            .map((p) => (p.modulo ? { clave: p.modulo.clave, nombre: p.modulo.nombre } : null))
            .filter((m): m is { clave: string; nombre: string } => m !== null);

        const items: AdminListItemDto[] = usuarios.map((u) => ({
            id: u.id,
            email: u.email,
            nombre: u.nombre,
            estado: u.estado,
            modulosGestionados: modulos,
            ultimaSesion: fechaIso(u.ultimaSesion),
        }));

        return {
            items: items.map((i) => ({ rol: "ADMIN", ...i })),
            pagination: this.paginacion(paginacion, total),
        };
    }

    private whereBaseRol(
        rol: RolUsuariosListado,
        filtros: { q?: string | undefined; estado?: "activo" | "inactivo" | "bloqueado" | undefined }
    ): Prisma.UsuarioWhereInput {
        const where: Prisma.UsuarioWhereInput = { rol };
        if (filtros.estado) where.estado = filtros.estado;
        if (filtros.q) {
            where.OR = [
                { email: { contains: filtros.q, mode: "insensitive" } },
                { nombre: { contains: filtros.q, mode: "insensitive" } },
            ];
        }
        return where;
    }

    private paginacion(paginacion: { page: number; pageSize: number }, total: number): PaginacionDto {
        return {
            page: paginacion.page,
            pageSize: paginacion.pageSize,
            total,
            totalPages: Math.ceil(total / paginacion.pageSize),
        };
    }

    /** Detalle cruzado por rol. */
    async detallePorId(id: string): Promise<DetalleConsolidadoDto> {
        return new UsuariosConsolidadoDetalleService(this.db).detallePorId(id);
    }
}
