import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";

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
        const body = (await request.json()) as {
            email: string;
            password: string;
            nombre?: string;
            rol: string;
            tenantId?: string;
        };

        if (!body.email || !body.password || !body.rol) {
            return NextResponse.json(
                { error: { message: "Email, contraseña y rol requeridos", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        if (body.password.length < 8 || !/[a-zA-Z]/.test(body.password) || !/[0-9]/.test(body.password)) {
            return NextResponse.json(
                { error: { message: "Contraseña: mínimo 8 caracteres, 1 letra y 1 número", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const existing = await prisma.usuario.findUnique({ where: { email: body.email.toLowerCase() } });
        if (existing) {
            return NextResponse.json(
                { error: { message: "Email ya registrado", code: ERROR_CODES.CONFLICT } },
                { status: 409 }
            );
        }

        const allowedRoles = currentUser.rol === "ADMIN"
            ? ["ADMIN", "SCHOOL_ADMIN", "PARENT"]
            : ["PARENT"];

        if (!allowedRoles.includes(body.rol)) {
            return NextResponse.json(
                { error: { message: "Rol no permitido", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const user = await prisma.usuario.create({
            data: {
                email: body.email.toLowerCase(),
                nombre: body.nombre || null,
                passwordHash: await hashPassword(body.password),
                rol: body.rol as never,
                tenantId: body.tenantId || null,
            },
        });

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