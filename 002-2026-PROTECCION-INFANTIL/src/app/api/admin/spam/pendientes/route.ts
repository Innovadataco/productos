import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { esAdminRol, esComiteRol, esOperadorRol } from "@/lib/operadores/permisos";
import type { Prisma } from "@prisma/client";

const MAX_PAGE_SIZE = 100;

export async function GET(req: Request) {
    try {
        const user = await verifyAuth();
        await assertModulo(user, "anti_abuso");
        if (!esAdminRol(user.rol) && !esOperadorRol(user.rol) && !esComiteRol(user.rol)) {
            return NextResponse.json(
                { error: { message: "Requiere rol OPERADOR, COMITE_VALIDACION o ADMIN", code: ERROR_CODES.FORBIDDEN } },
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
        const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
        const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(url.searchParams.get("limit") || "20")));
        const asignadoAMi = url.searchParams.get("asignadoAMi") === "true";
        const skip = (page - 1) * limit;

        const where: Prisma.ReporteWhereInput = {
            eliminado: false,
            OR: [
                { estado: "POSIBLE_SPAM" },
                { estado: "REVISION_MANUAL", clasificacion: { categoria: "SPAM" } },
            ],
        };

        if (asignadoAMi || user.rol === "OPERADOR") {
            where.operadorId = user.id;
        }

        const [reportes, total] = await Promise.all([
            prisma.reporte.findMany({
                where,
                orderBy: [{ prioridadAlta: "desc" }, { creadoEn: "desc" }],
                skip,
                take: limit,
                select: {
                    id: true,
                    identificador: true,
                    plataforma: { select: { id: true, nombre: true, clave: true } },
                    texto: true,
                    estado: true,
                    creadoEn: true,
                    prioridadAlta: true,
                    operadorId: true,
                    operador: { select: { id: true, nombre: true, email: true } },
                    clasificacion: {
                        select: { categoria: true, confianza: true },
                    },
                },
            }),
            prisma.reporte.count({ where }),
        ]);

        return NextResponse.json({
            reportes: reportes.map((r) => ({
                ...r,
                confianzaSpam: r.clasificacion?.categoria === "SPAM" ? r.clasificacion.confianza : 0,
                asignadoA: r.operador ?? null,
            })),
            paginacion: { page, limit, total, totalPages: Math.ceil(total / limit) },
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
