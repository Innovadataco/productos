import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { IaEvalsService } from "@/lib/dal/services/ia-evals";
import { RolUsuario } from "@prisma/client";
import { z } from "zod";

const compareSchema = z.object({
    ids: z.array(z.string().cuid()).min(2).max(5),
});

export async function POST(request: Request) {
    try {
        const user = await verifyAuth(RolUsuario.ADMIN);
        await assertModulo(user, "ia_eval");

        const rate = await checkRateLimit(request, "admin_read", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas peticiones", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const body = await request.json();
        const parsed = compareSchema.safeParse(body);
        if (!parsed.success) {
            throw new AppError("Se requieren entre 2 y 5 IDs de experimentos", ERROR_CODES.VALIDATION_ERROR, 400);
        }

        // SPEC-053: validación de corridas, métricas y fronteras viven en el DAL.
        const resultado = await new IaEvalsService().compararExperimentos(parsed.data.ids);

        if (!resultado.comparable) {
            return NextResponse.json(
                {
                    error: {
                        message: "No se pueden comparar experimentos de distintas fixtureVersion",
                        code: ERROR_CODES.VALIDATION_ERROR,
                    },
                    comparable: false,
                    fixtureVersions: resultado.fixtureVersions,
                },
                { status: 400 }
            );
        }

        return NextResponse.json(resultado);
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
