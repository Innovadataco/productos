import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { authRegisterSchema } from "@/lib/validators";
import { AutenticacionService } from "@/lib/dal/services/autenticacion";

export async function POST(request: Request) {
    try {
        const rate = await checkRateLimit(request, "register");
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiados intentos de registro. Intenta más tarde.", code: ERROR_CODES.RATE_LIMITED, retryAfter: Math.ceil((rate.resetAt - Date.now()) / 1000) } },
                { status: 429, headers: rate.headers }
            );
        }

        const currentUser = await verifyAuth("ADMIN");
        const body = await request.json();
        const parsed = authRegisterSchema.safeParse(body);
        if (!parsed.success) {
            const issue = parsed.error.issues[0];
            return NextResponse.json(
                { error: { message: issue?.message || "Datos inválidos", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const data = parsed.data;

        const allowedRoles = currentUser.rol === "ADMIN"
            ? ["ADMIN", "SCHOOL_ADMIN", "PARENT"]
            : ["PARENT"];

        if (!allowedRoles.includes(data.rol)) {
            return NextResponse.json(
                { error: { message: "Rol no permitido", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        // SPEC-053: unicidad y creación del usuario viven en el DAL; la ruta no toca prisma.
        const resultado = await new AutenticacionService().registrar(data);

        if (!resultado.ok) {
            return NextResponse.json(
                { error: { message: "Email ya registrado", code: ERROR_CODES.CONFLICT } },
                { status: 409 }
            );
        }

        const { user } = resultado;
        return NextResponse.json(
            { user: { id: user.id, email: user.email, rol: user.rol } },
            { status: 201 }
        );
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
