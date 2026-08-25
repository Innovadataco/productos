import { NextResponse } from "next/server";
import { CategoriaConducta, RolUsuario } from "@prisma/client";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { IaRubricaService } from "@/lib/dal/services/ia-rubrica";
import { withValidation } from "@/lib/validation";
import { AppError, ERROR_CODES } from "@/lib/errors";

const categoriaParamsSchema = z.object({ categoria: z.enum(CategoriaConducta) });

const definicionBodySchema = z.object({
    conductaLegal: z.string().min(1, "conductaLegal es obligatorio"),
    definicionLiteral: z.string().min(1, "definicionLiteral es obligatorio"),
    referenciaNormativa: z.string().min(1, "referenciaNormativa es obligatorio"),
    rolDentroDeConducta: z.string().nullish(),
});

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

/**
 * PATCH /api/admin/ia/rubrica/definiciones/[categoria] — actualiza el fundamento
 * legal de UNA categoría (SPEC-248, 002-PI-151). Rol ADMIN únicamente.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ categoria: string }> }) {
    try {
        const user = await verifyAuth(RolUsuario.ADMIN);
        await assertModulo(user, "ia_rubrica");

        const { categoria } = withValidation.params(categoriaParamsSchema)(await params);
        const body = await withValidation.body(definicionBodySchema)(request);

        const { rolDentroDeConducta, ...resto } = body;
        const definicion = await new IaRubricaService().actualizarDefinicion(
            categoria,
            rolDentroDeConducta ? { ...resto, rolDentroDeConducta } : resto,
            user.id,
            getClientInfo(request)
        );

        return NextResponse.json(definicion);
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
