import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { OperadorService } from "@/lib/dal/services/operadores";

const patchSchema = z.object({
    cupoMaximoDefault: z.number().int().min(1).max(200).optional(),
    estrategia: z.enum(["ponderado_carga_inversa", "aleatorio_puro"]).optional(),
});

export async function GET(req: Request) {
    try {
        const user = await verifyAuth("ADMIN");
        await assertModulo(user, "operadores");
        const rate = await checkRateLimit(req, "admin_read", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        // SPEC-053: la lectura de parámetros vive en el DAL; la ruta no toca prisma.
        const modelo = await new OperadorService().obtenerModelo();
        return NextResponse.json(modelo);
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

export async function PATCH(req: Request) {
    try {
        const user = await verifyAuth("ADMIN");
        await assertModulo(user, "operadores");
        const rate = await checkRateLimit(req, "admin_write", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const body = await req.json();
        const parsed = patchSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Datos inválidos", code: ERROR_CODES.VALIDATION_ERROR, details: parsed.error.format() } },
                { status: 400 }
            );
        }

        // SPEC-053: upsert de parámetros y auditoría viven en el DAL; la ruta no toca prisma.
        const { nuevo } = await new OperadorService().actualizarModelo(parsed.data, user.id);

        return NextResponse.json(nuevo);
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
