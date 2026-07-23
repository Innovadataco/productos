import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { withValidation } from "@/lib/validation";
import { operadorIdParamsSchema } from "@/lib/schemas";
import { RolUsuario } from "@prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

export async function PATCH(request: Request, context: RouteContext) {
    try {
        const user = await verifyAuth(RolUsuario.ADMIN);
        await assertModulo(user, "ia_eval");
        const { id } = withValidation.params(operadorIdParamsSchema)(await context.params);

        const rate = await checkRateLimit(request, "admin_write", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas peticiones", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const caso = await prisma.casoEval.findUnique({ where: { id } });
        if (!caso) {
            throw new AppError("Caso no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }
        if (!caso.activo) {
            throw new AppError("El caso ya está desactivado", ERROR_CODES.CONFLICT, 409);
        }

        const nextVersion = await prisma.casoEval
            .findMany({ orderBy: { fixtureVersion: "desc" }, take: 1 })
            .then((rows) => (rows[0]?.fixtureVersion ?? 0) + 1);

        const actualizado = await prisma.casoEval.update({
            where: { id },
            data: { activo: false, fixtureVersion: nextVersion },
        });

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "EVAL_CASE_DISABLE",
            tipoRecurso: "CasoEval",
            recursoId: id,
            usuarioId: user.id,
            valorAnterior: JSON.stringify({ activo: true, fixtureVersion: caso.fixtureVersion }),
            valorNuevo: JSON.stringify({ activo: false, fixtureVersion: nextVersion }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({ caso: actualizado, fixtureVersion: nextVersion });
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
