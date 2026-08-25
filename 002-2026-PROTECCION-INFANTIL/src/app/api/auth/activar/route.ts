import { NextResponse } from "next/server";
import { createToken, setSessionCookie } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { activarSchema } from "@/lib/validators";
import { RegistroColegioService } from "@/lib/dal/services/registro-colegio";

export async function POST(request: Request) {
    try {
        const bodyRaw = await request.json().catch(() => undefined);
        const parsed = activarSchema.safeParse(bodyRaw);
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: parsed.error.issues[0]?.message || "Token y contraseña requeridos", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const { token, password } = parsed.data;
        const resultado = await new RegistroColegioService().activarPorToken(token, password);

        if (!resultado.ok) {
            const mensaje = resultado.tipo === "expirado"
                ? "El link de activación expiró. Contacta al administrador."
                : "El link de activación no es válido o ya fue usado.";
            return NextResponse.json(
                { error: { message: mensaje, code: ERROR_CODES.AUTH_EXPIRED } },
                { status: 400 }
            );
        }

        const { user } = resultado;
        const sessionToken = await createToken({ sub: user.id, rol: user.rol });
        await setSessionCookie(request, sessionToken);

        return NextResponse.json(
            {
                user: {
                    id: user.id,
                    email: user.email,
                    nombre: user.nombre,
                    rol: user.rol,
                },
            },
            { status: 200 }
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
