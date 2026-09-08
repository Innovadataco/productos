import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { AppError } from "@/lib/errors";

export async function GET() {
    try {
        const user = await verifyAuth();
        return NextResponse.json({
            id: user.id,
            email: user.email,
            nombre: user.nombre,
            rol: user.rol,
            tenantId: user.tenantId,
            debeCambiarPassword: user.debeCambiarPassword,
            // SPEC-598: el cliente decide si ofrece «Crear contraseña» (cuenta
            // OAuth sin clave local) o «Cambiar contraseña».
            googleSub: user.googleSub,
            passwordCreadaEn: user.passwordCreadaEn,
        });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        return NextResponse.json({ error: { message: "Error interno" } }, { status: 500 });
    }
}