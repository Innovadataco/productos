import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, createToken, verifyToken, setSessionCookie } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { verificarCompletarSchema } from "@/lib/validators";

export async function POST(request: Request) {
    try {
        // SPEC-125: esquema Zod; los mensajes son contrato del frontend (registro/page.tsx).
        const bodyRaw = await request.json().catch(() => undefined);
        const parsed = verificarCompletarSchema.safeParse(bodyRaw);
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: parsed.error.issues[0]?.message || "Token y contraseña requeridos", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }
        const { token, password, nombre } = parsed.data;

        const payload = await verifyToken(token);
        if (!payload || payload.type !== "verification" || !payload.sub) {
            return NextResponse.json(
                { error: { message: "Token inválido o expirado", code: ERROR_CODES.AUTH_EXPIRED } },
                { status: 400 }
            );
        }

        const email = payload.sub as string;
        const existingUser = await prisma.usuario.findUnique({ where: { email } });
        if (existingUser) {
            return NextResponse.json(
                { error: { message: "Email ya registrado", code: ERROR_CODES.CONFLICT } },
                { status: 409 }
            );
        }

        const user = await prisma.usuario.create({
            data: {
                email,
                nombre: nombre || null,
                passwordHash: await hashPassword(password),
                rol: "PARENT",
            },
        });

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