import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { signToken } from "@/lib/auth";

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
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 604800, // 7 días
        });
        return res;
    } catch (err: any) {
        console.error(err);
        return NextResponse.json({ error: err.message || "Error en login" }, { status: 500 });
    }
}