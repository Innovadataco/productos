import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { spamPendientesQuerySchema } from "@/lib/validators";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { esAdminRol, esComiteRol, esOperadorRol } from "@/lib/operadores/permisos";
import { descifrarTextoReporte } from "@/lib/texto-reporte-cifrado";
import { whereReporteVigente } from "@/lib/reportes-acceso";
import { ReporteRepository } from "@/lib/dal/repositories/reporte";
import type { Prisma } from "@prisma/client";

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
        const parsedQuery = spamPendientesQuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
        if (!parsedQuery.success) {
            return NextResponse.json(
                { error: { message: "Parámetros de consulta inválidos", code: ERROR_CODES.VALIDATION_ERROR, details: parsedQuery.error.format() } },
                { status: 400 }
            );
        }

        const { page, pageSize, q, estado, orden, asignadoAMi } = parsedQuery.data;
        const skip = (page - 1) * pageSize;

        // Cola de spam: POSIBLE_SPAM, o REVISION_MANUAL clasificado como SPAM.
        // El filtro `estado` acota a una sola de esas dos ramas (SPEC-181).
        const condiciones: Prisma.ReporteWhereInput[] = [
            estado === "POSIBLE_SPAM"
                ? { estado: "POSIBLE_SPAM" }
                : estado === "REVISION_MANUAL"
                    ? { estado: "REVISION_MANUAL", clasificacion: { categoria: "SPAM" } }
                    : {
                        OR: [
                            { estado: "POSIBLE_SPAM" },
                            { estado: "REVISION_MANUAL", clasificacion: { categoria: "SPAM" } },
                        ],
                    },
        ];
        if (q) {
            // Mismo criterio de búsqueda que la bandeja principal (reportes-revision).
            condiciones.push({
                OR: [
                    { numeroSeguimiento: { contains: q, mode: "insensitive" } },
                    { identificador: { contains: q, mode: "insensitive" } },
                ],
            });
        }

        const where: Prisma.ReporteWhereInput = whereReporteVigente({ AND: condiciones });

        if (asignadoAMi || user.rol === "OPERADOR") {
            where.operadorId = user.id;
        }

        // E-8: las lecturas viven en los repos; la ruta no toca prisma.
        const [reportes, total] = await new ReporteRepository().findBandejaSpam(where, { skip, take: pageSize }, orden);

        return NextResponse.json({
            reportes: reportes.map((r) => ({
                ...r,
                // SPEC-130 (BL-4, O-2): texto descifrado solo en este camino autorizado.
                texto: descifrarTextoReporte(r.texto),
                confianzaSpam: r.clasificacion?.categoria === "SPAM" ? r.clasificacion.confianza : 0,
                asignadoA: r.operador ?? null,
            })),
            pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
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
