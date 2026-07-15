import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, createToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";

export async function POST(request: Request) {
    try {
        const rate = await checkRateLimit(request, "login");
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiados intentos de inicio de sesión. Intenta más tarde.", code: ERROR_CODES.RATE_LIMITED, retryAfter: Math.ceil((rate.resetAt - Date.now()) / 1000) } },
                { status: 429, headers: rate.headers }
            );
        }

        const body = (await request.json()) as { email: string; password: string };
        const email = body.email?.toLowerCase().trim();

        if (!email || !body.password) {
            return NextResponse.json(
                { error: { message: "Email y contraseña requeridos", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const user = await prisma.usuario.findUnique({ where: { email } });
        if (!user) {
            return NextResponse.json(
                { error: { message: "Credenciales inválidas", code: ERROR_CODES.AUTH_INVALID } },
                { status: 401 }
            );
        }

        if (user.estado === "bloqueado" && user.bloqueadoHasta && user.bloqueadoHasta > new Date()) {
            return NextResponse.json(
                { error: { message: "Cuenta bloqueada temporalmente", code: ERROR_CODES.AUTH_INVALID } },
                { status: 401 }
            );
        }

        const valid = await verifyPassword(body.password, user.passwordHash);
        if (!valid) {
            const newAttempts = user.intentosFallidos + 1;
            const maxAttempts = parseInt((await prisma.parametroSistema.findUnique({
                where: { clave: "security.max_login_attempts" },
            }))?.valor || "5", 10);
            const lockoutMinutes = parseInt((await prisma.parametroSistema.findUnique({
                where: { clave: "security.lockout_duration_minutes" },
            }))?.valor || "30", 10);

            const updates: { intentosFallidos: number; estado?: never; bloqueadoHasta?: Date } = {
                intentosFallidos: newAttempts,
            };

            if (newAttempts >= maxAttempts) {
                (updates as Record<string, unknown>).estado = "bloqueado";
                (updates as Record<string, unknown>).bloqueadoHasta = new Date(Date.now() + lockoutMinutes * 60 * 1000);
            }

            await prisma.usuario.update({ where: { id: user.id }, data: updates });
            return NextResponse.json(
                { error: { message: "Credenciales inválidas", code: ERROR_CODES.AUTH_INVALID } },
                { status: 401 }
            );
        }

        await prisma.usuario.update({
            where: { id: user.id },
            data: { intentosFallidos: 0, estado: "activo", bloqueadoHasta: null, ultimaSesion: new Date() },
        });

        const token = await createToken({ sub: user.id, rol: user.rol });
        const cookieStore = await cookies();
        cookieStore.set("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 60 * 60 * 24,
            path: "/",
        });

        return NextResponse.json({
            user: { id: user.id, email: user.email, nombre: user.nombre, rol: user.rol },
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