import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { esAdminRol, esComiteRol, esOperadorRol } from "@/lib/operadores/permisos";
import { descifrarTextoReporte } from "@/lib/texto-reporte-cifrado";
import { whereReporteVigente } from "@/lib/reportes-acceso";
import { ReporteRepository } from "@/lib/dal/repositories/reporte";
import type { Prisma } from "@prisma/client";

const MAX_PAGE_SIZE = 100;

export async function GET(req: Request) {
    try {
        const user = await verifyAuth();
        await assertModulo(user, "revision_spam");
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

        const where: Prisma.ReporteWhereInput = whereReporteVigente({
            OR: [
                { estado: "POSIBLE_SPAM" },
                { estado: "REVISION_MANUAL", clasificacion: { categoria: "SPAM" } },
            ],
        });

        if (asignadoAMi || user.rol === "OPERADOR") {
            where.operadorId = user.id;
        }

        // E-8: las lecturas viven en los repos; la ruta no toca prisma.
        const [reportes, total] = await new ReporteRepository().findBandejaSpam(where, { skip, take: limit });

        return NextResponse.json({
            reportes: reportes.map((r) => ({
                ...r,
                // SPEC-130 (BL-4, O-2): texto descifrado solo en este camino autorizado.
                texto: descifrarTextoReporte(r.texto),
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
