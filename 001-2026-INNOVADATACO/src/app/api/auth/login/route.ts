import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/apiError";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { signToken } from "@/lib/auth";
import { cookieSecure } from "@/lib/authCookie";

export async function POST(req: NextRequest) {
    try {
        const { username, password } = await req.json();
        const user = await prisma.user.findUnique({ where: { username } });
        if (!user) {
            return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
        }

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
        }

        const token = await signToken({
            sub: user.id,
            username: user.username,
            role: user.role,
        });

        const res = NextResponse.json({ ok: true });
        res.cookies.set("token", token, {
            httpOnly: true,
            secure: cookieSecure(),
            sameSite: "strict",
            maxAge: 604800, // 7 días
        });
        return res;
    } catch (err: unknown) {
        return apiError("Auth", "POST login", "Error en login", 500, err);
    }
}