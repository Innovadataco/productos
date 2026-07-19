import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { esAdminRol } from "@/lib/operadores/permisos";

const querySchema = z.object({
    fechaDesde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    fechaHasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    operadorId: z.string().uuid().optional(),
    estado: z.enum(["REVISION_MANUAL", "CLASIFICADO", "CORREGIDO", "REPORTE_FALSO"]).optional(),
    categoria: z.string().optional(),
    busqueda: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

function startOfDay(date: Date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

function endOfDay(date: Date) {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
}

export async function GET(req: Request) {
    try {
        const user = await verifyAuth();
        if (!esAdminRol(user.rol)) {
            return NextResponse.json(
                { error: { message: "Permisos insuficientes", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const rate = await checkRateLimit(req, "admin_read", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const url = new URL(req.url);
        const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Parámetros inválidos", code: ERROR_CODES.VALIDATION_ERROR, details: parsed.error.format() } },
                { status: 400 }
            );
        }

        const { fechaDesde, fechaHasta, operadorId, estado, categoria, busqueda, page, pageSize } = parsed.data;

        const hoyInicio = startOfDay(new Date());
        const hoyFin = endOfDay(new Date());
        const rangoInicio = fechaDesde ? startOfDay(new Date(fechaDesde + "T00:00:00")) : startOfDay(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
        const rangoFin = fechaHasta ? endOfDay(new Date(fechaHasta + "T23:59:59")) : hoyFin;

        // --- Indicadores tarjeta ---
        const [sinAsignar, enGestion, atendidosHoyRaw, escaladosPendientes] = await Promise.all([
            prisma.reporte.count({
                where: { estado: "REVISION_MANUAL", operadorId: null, eliminado: false },
            }),
            prisma.reporte.count({
                where: { estado: "REVISION_MANUAL", operadorId: { not: null }, eliminado: false },
            }),
            prisma.auditLog.count({
                where: {
                    accion: { in: ["CASO_CONFIRMADO", "CASO_CORREGIDO", "CASO_DADO_DE_BAJA"] },
                    creadoEn: { gte: hoyInicio, lte: hoyFin },
                },
            }),
            prisma.reporte.count({
                where: { estado: "REVISION_MANUAL", prioridadAlta: true, eliminado: false },
            }),
        ]);

        // --- Tiempo promedio de gestión ---
        const auditCerrados = await prisma.auditLog.findMany({
            where: {
                accion: { in: ["CASO_CONFIRMADO", "CASO_CORREGIDO", "CASO_DADO_DE_BAJA"] },
                creadoEn: { gte: rangoInicio, lte: rangoFin },
                recursoId: { not: null },
            },
            select: { recursoId: true, creadoEn: true },
        });

        const recursoIds = auditCerrados.map((a) => a.recursoId!);
        const auditAsignaciones = await prisma.auditLog.findMany({
            where: {
                accion: "OPERADOR_ASIGNADO",
                recursoId: { in: recursoIds },
            },
            select: { recursoId: true, creadoEn: true },
            orderBy: { creadoEn: "asc" },
        });

        const primeraAsignacionPorRecurso = new Map<string, Date>();
        for (const a of auditAsignaciones) {
            if (!a.recursoId) continue;
            if (!primeraAsignacionPorRecurso.has(a.recursoId)) {
                primeraAsignacionPorRecurso.set(a.recursoId, a.creadoEn);
            }
        }

        let tiempoGestionTotalMs = 0;
        let tiempoGestionCount = 0;
        for (const cierre of auditCerrados) {
            if (!cierre.recursoId) continue;
            const asignacion = primeraAsignacionPorRecurso.get(cierre.recursoId);
            if (asignacion && cierre.creadoEn > asignacion) {
                tiempoGestionTotalMs += cierre.creadoEn.getTime() - asignacion.getTime();
                tiempoGestionCount++;
            }
        }
        const tiempoPromedioGestionMin = tiempoGestionCount > 0 ? Math.round(tiempoGestionTotalMs / tiempoGestionCount / 60000) : 0;

        // --- Casos por día ---
        const casosPorDia = await prisma.auditLog.groupBy({
            by: ["accion"],
            where: {
                accion: { in: ["CASO_CONFIRMADO", "CASO_CORREGIDO", "CASO_DADO_DE_BAJA"] },
                creadoEn: { gte: rangoInicio, lte: rangoFin },
            },
            _count: { accion: true },
        });

        const casosPorDiaRaw = await prisma.$queryRaw<Array<{ dia: string; accion: string; count: bigint }>>`
            SELECT DATE("creadoEn") as dia, accion, COUNT(*) as count
            FROM "AuditLog"
            WHERE accion IN ('CASO_CONFIRMADO','CASO_CORREGIDO','CASO_DADO_DE_BAJA')
              AND "creadoEn" >= ${rangoInicio}
              AND "creadoEn" <= ${rangoFin}
            GROUP BY dia, accion
            ORDER BY dia ASC
        `;

        // --- Distribución por operador ---
        const distribucionOperador = await prisma.auditLog.groupBy({
            by: ["usuarioId"],
            where: {
                accion: { in: ["CASO_CONFIRMADO", "CASO_CORREGIDO", "CASO_DADO_DE_BAJA"] },
                creadoEn: { gte: rangoInicio, lte: rangoFin },
            },
            _count: { usuarioId: true },
        });

        const operadoresIds = distribucionOperador.map((d) => d.usuarioId).filter(Boolean) as string[];
        const operadoresInfo = await prisma.usuario.findMany({
            where: { id: { in: operadoresIds } },
            select: { id: true, email: true, nombre: true },
        });
        const operadorMap = new Map(operadoresInfo.map((o) => [o.id, o]));

        // --- Clasificaciones por categoría ---
        const clasificacionesPorCategoria = await prisma.$queryRaw<Array<{ categoria: string; count: bigint }>>`
            SELECT categoria, COUNT(*) as count
            FROM "ClasificacionIA"
            WHERE "reporteId" IN (
                SELECT "reporteId" FROM "CorreccionAdmin"
            )
            GROUP BY categoria
            ORDER BY count DESC
        `;

        // --- Tasa de escalamiento por operador ---
        const escaladosPorOperador = await prisma.auditLog.groupBy({
            by: ["usuarioId"],
            where: { accion: "CASO_ESCALADO", creadoEn: { gte: rangoInicio, lte: rangoFin } },
            _count: { usuarioId: true },
        });

        // --- Tabla operativa ---
        const whereTabla: Record<string, unknown> = {};
        if (estado) whereTabla.estado = estado;
        if (operadorId) whereTabla.operadorId = operadorId;
        if (categoria) whereTabla.clasificacion = { categoria };
        if (busqueda) {
            whereTabla.OR = [
                { identificador: { contains: busqueda, mode: "insensitive" } },
                { numeroSeguimiento: { contains: busqueda, mode: "insensitive" } },
                { operador: { nombre: { contains: busqueda, mode: "insensitive" } } },
            ];
        }

        const skip = (page - 1) * pageSize;
        const [reportesTabla, totalTabla] = await Promise.all([
            prisma.reporte.findMany({
                where: whereTabla,
                orderBy: [{ prioridadAlta: "desc" }, { creadoEn: "desc" }],
                skip,
                take: pageSize,
                select: {
                    id: true,
                    identificador: true,
                    numeroSeguimiento: true,
                    estado: true,
                    prioridadAlta: true,
                    creadoEn: true,
                    ciudad: true,
                    pais: true,
                    operador: { select: { id: true, email: true, nombre: true } },
                    clasificacion: { select: { categoria: true } },
                },
            }),
            prisma.reporte.count({ where: whereTabla }),
        ]);

        // --- Métricas por operador ---
        const metricasOperador: Record<string, { atendidos: number; confirmados: number; corregidos: number; dadosDeBaja: number; escalados: number; tiempoPromedioMin: number }> = {};
        for (const op of operadoresIds) {
            metricasOperador[op] = { atendidos: 0, confirmados: 0, corregidos: 0, dadosDeBaja: 0, escalados: 0, tiempoPromedioMin: 0 };
        }

        const accionesPorOperador = await prisma.auditLog.findMany({
            where: {
                accion: { in: ["CASO_CONFIRMADO", "CASO_CORREGIDO", "CASO_DADO_DE_BAJA", "CASO_ESCALADO"] },
                creadoEn: { gte: rangoInicio, lte: rangoFin },
                usuarioId: { in: operadoresIds },
            },
            select: { usuarioId: true, accion: true, recursoId: true, creadoEn: true },
        });

        for (const a of accionesPorOperador) {
            if (!a.usuarioId) continue;
            const m = metricasOperador[a.usuarioId];
            if (!m) continue;
            if (a.accion === "CASO_CONFIRMADO") m.confirmados++;
            if (a.accion === "CASO_CORREGIDO") m.corregidos++;
            if (a.accion === "CASO_DADO_DE_BAJA") m.dadosDeBaja++;
            if (a.accion === "CASO_ESCALADO") m.escalados++;
        }

        for (const op of Object.keys(metricasOperador)) {
            const m = metricasOperador[op];
            m.atendidos = m.confirmados + m.corregidos + m.dadosDeBaja;

            const asignacionesOp = await prisma.auditLog.findMany({
                where: { accion: "OPERADOR_ASIGNADO", recursoId: { in: recursoIds }, usuarioId: op },
                select: { recursoId: true, creadoEn: true },
            });
            const asignacionMap = new Map(asignacionesOp.map((a) => [a.recursoId!, a.creadoEn]));
            let totalMs = 0;
            let count = 0;
            for (const cierre of auditCerrados) {
                if (!cierre.recursoId) continue;
                const asignacion = asignacionMap.get(cierre.recursoId);
                if (asignacion && cierre.creadoEn > asignacion) {
                    totalMs += cierre.creadoEn.getTime() - asignacion.getTime();
                    count++;
                }
            }
            m.tiempoPromedioMin = count > 0 ? Math.round(totalMs / count / 60000) : 0;
        }

        return NextResponse.json({
            indicadores: {
                sinAsignar,
                enGestion,
                atendidosHoy: atendidosHoyRaw,
                tiempoPromedioGestionMin,
                escaladosPendientes,
            },
            casosPorDia: casosPorDiaRaw.map((d) => ({ dia: d.dia, accion: d.accion, count: Number(d.count) })),
            resumenCasosPorDia: casosPorDia.map((d) => ({ accion: d.accion, count: d._count.accion })),
            distribucionOperador: distribucionOperador
                .filter((d) => d.usuarioId)
                .map((d) => ({
                    operadorId: d.usuarioId,
                    nombre: operadorMap.get(d.usuarioId!)?.nombre || operadorMap.get(d.usuarioId!)?.email || d.usuarioId,
                    count: d._count.usuarioId,
                })),
            clasificacionesPorCategoria: clasificacionesPorCategoria.map((c) => ({ categoria: c.categoria, count: Number(c.count) })),
            escaladosPorOperador: escaladosPorOperador
                .filter((d) => d.usuarioId)
                .map((d) => ({
                    operadorId: d.usuarioId,
                    nombre: operadorMap.get(d.usuarioId!)?.nombre || operadorMap.get(d.usuarioId!)?.email || d.usuarioId,
                    count: d._count.usuarioId,
                })),
            metricasOperador: Object.entries(metricasOperador).map(([operadorId, m]) => ({
                operadorId,
                nombre: operadorMap.get(operadorId)?.nombre || operadorMap.get(operadorId)?.email || operadorId,
                ...m,
            })),
            tabla: {
                reportes: reportesTabla,
                pagination: { page, pageSize, total: totalTabla, totalPages: Math.ceil(totalTabla / pageSize) },
            },
        });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
