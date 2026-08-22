import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { calcularIpHashSesion, truncarUserAgent } from "@/lib/session-log/ip-hash";
import type { Usuario } from "@prisma/client";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export interface SesionActivaDto {
    id: string;
    usuarioId: string;
    email: string;
    nombre: string | null;
    rol: string;
    iniciadaEn: string;
    ultimaActividadEn: string;
    duracionMin: number;
    ipHash: string;
    ipHashCorto: string;
    userAgent: string | null;
}

export interface ListadoSesionesResult {
    items: SesionActivaDto[];
    pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
    };
}

export class SessionLogService {
    async registrarInicioSesion(
        request: Request,
        usuario: { id: string; rol: Usuario["rol"]; tenantId?: string | null }
    ): Promise<string> {
        const ahora = new Date();
        const sesion = await prisma.sesionLog.create({
            data: {
                usuarioId: usuario.id,
                tenantId: usuario.tenantId ?? null,
                rol: usuario.rol,
                iniciadaEn: ahora,
                ultimaActividadEn: ahora,
                ipHash: calcularIpHashSesion(request),
                userAgent: truncarUserAgent(request.headers.get("user-agent")),
            },
        });
        return sesion.id;
    }

    async pingSesion(sesionLogId: string, usuarioId: string): Promise<boolean> {
        const ahora = new Date();
        const resultado = await prisma.sesionLog.updateMany({
            where: {
                id: sesionLogId,
                usuarioId,
                cerradaEn: null,
            },
            data: {
                ultimaActividadEn: ahora,
            },
        });
        return resultado.count > 0;
    }

    async cerrarPorInactividad(minutosInactividad: number): Promise<number> {
        const limite = new Date(Date.now() - minutosInactividad * 60 * 1000);
        const abiertas = await prisma.sesionLog.findMany({
            where: {
                cerradaEn: null,
                ultimaActividadEn: { lt: limite },
            },
            select: { id: true, iniciadaEn: true },
        });

        if (abiertas.length === 0) return 0;

        const ahora = new Date();
        await prisma.$transaction(
            abiertas.map((s) => {
                const duracionMin = Math.max(0, Math.round((ahora.getTime() - s.iniciadaEn.getTime()) / 60000));
                return prisma.sesionLog.update({
                    where: { id: s.id },
                    data: {
                        cerradaEn: ahora,
                        motivoCierre: "INACTIVIDAD",
                        duracionMin,
                    },
                });
            })
        );

        await logAudit({
            accion: "SESION_CIERRE_INACTIVIDAD",
            tipoRecurso: "SesionLog",
            metadatos: { cerradas: abiertas.length, minutosInactividad },
        });

        return abiertas.length;
    }

    async cerrarForzado(id: string, adminId: string, request?: Request): Promise<void> {
        const sesion = await prisma.sesionLog.findUnique({
            where: { id },
        });
        if (!sesion) {
            throw new Error("Sesión no encontrada");
        }
        if (sesion.cerradaEn !== null) {
            throw new Error("Sesión ya cerrada");
        }

        const ahora = new Date();
        await prisma.sesionLog.update({
            where: { id },
            data: {
                cerradaEn: ahora,
                motivoCierre: "FORZADA",
                duracionMin: Math.max(0, Math.round((ahora.getTime() - sesion.iniciadaEn.getTime()) / 60000)),
            },
        });

        await logAudit({
            accion: "SESION_FORZADA_CIERRE",
            tipoRecurso: "SesionLog",
            recursoId: id,
            usuarioId: adminId,
            ipAddress: request ? obtenerIpCruda(request) : "worker",
            userAgent: request?.headers.get("user-agent") ?? "worker",
            metadatos: { usuarioSesionId: sesion.usuarioId, rol: sesion.rol },
        });
    }

    async listarActivas(page = 1, pageSize = DEFAULT_PAGE_SIZE): Promise<ListadoSesionesResult> {
        const size = Math.min(MAX_PAGE_SIZE, Math.max(1, pageSize));
        const skip = (Math.max(1, page) - 1) * size;

        const [items, total] = await Promise.all([
            prisma.sesionLog.findMany({
                where: { cerradaEn: null },
                orderBy: { ultimaActividadEn: "desc" },
                skip,
                take: size,
                include: {
                    usuario: {
                        select: { id: true, email: true, nombre: true, rol: true },
                    },
                },
            }),
            prisma.sesionLog.count({ where: { cerradaEn: null } }),
        ]);

        const ahora = Date.now();
        const dtos: SesionActivaDto[] = items.map((s) => {
            const duracionMin = Math.max(0, Math.round((ahora - new Date(s.iniciadaEn).getTime()) / 60000));
            return {
                id: s.id,
                usuarioId: s.usuarioId,
                email: s.usuario.email,
                nombre: s.usuario.nombre,
                rol: s.usuario.rol,
                iniciadaEn: s.iniciadaEn.toISOString(),
                ultimaActividadEn: s.ultimaActividadEn.toISOString(),
                duracionMin,
                ipHash: s.ipHash,
                ipHashCorto: s.ipHash.slice(-4),
                userAgent: s.userAgent,
            };
        });

        return {
            items: dtos,
            pagination: {
                page: Math.max(1, page),
                pageSize: size,
                total,
                totalPages: Math.ceil(total / size),
            },
        };
    }

    async estaSesionActiva(sesionLogId: string): Promise<boolean> {
        const sesion = await prisma.sesionLog.findUnique({
            where: { id: sesionLogId },
            select: { cerradaEn: true },
        });
        return sesion !== null && sesion.cerradaEn === null;
    }

    async purgarAntiguas(diasRetencion: number): Promise<number> {
        const limite = new Date(Date.now() - diasRetencion * 24 * 60 * 60 * 1000);
        const resultado = await prisma.sesionLog.deleteMany({
            where: {
                creadoEn: { lt: limite },
            },
        });
        return resultado.count;
    }
}

function obtenerIpCruda(request: Request): string {
    return request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
}
