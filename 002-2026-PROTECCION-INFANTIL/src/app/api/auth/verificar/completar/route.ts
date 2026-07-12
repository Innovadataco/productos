import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, createToken } from "@/lib/auth";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { AppError, ERROR_CODES } from "@/lib/errors";

export async function POST(request: Request) {
    try {
        const body = (await request.json()) as {
            token: string;
            password: string;
            nombre?: string;
        };

        if (!body.token || !body.password) {
            return NextResponse.json(
                { error: { message: "Token y contraseña requeridos", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        if (body.password.length < 8 || !/[a-zA-Z]/.test(body.password) || !/[0-9]/.test(body.password)) {
            return NextResponse.json(
                { error: { message: "Contraseña: mínimo 8 caracteres, 1 letra y 1 número", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const payload = await verifyToken(body.token);
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
                nombre: body.nombre || null,
                passwordHash: await hashPassword(body.password),
                rol: "PARENT",
            },
        });

        const sessionToken = await createToken({ sub: user.id });
        const cookieStore = await cookies();
        cookieStore.set("token", sessionToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 60 * 60 * 24,
            path: "/",
        });

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