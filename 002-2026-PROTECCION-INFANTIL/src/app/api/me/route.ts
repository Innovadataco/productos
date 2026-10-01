import { NextResponse } from "next/server";
import { verifyAuth, sessionCookieAttributes } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { obtenerHabilitacionProfesional } from "@/lib/profesionales/habilitacion";

export async function GET() {
    try {
        const user = await verifyAuth();
        const base = {
            id: user.id,
            email: user.email,
            nombre: user.nombre,
            rol: user.rol,
            tenantId: user.tenantId,
            debeCambiarPassword: user.debeCambiarPassword,
        };
        if (user.rol === "PROFESIONAL") {
            // SPEC-690 (I-414) / contrato SPEC-691: estado + «habilitado ahora»,
            // derivado en el servidor contra la base en CADA petición (nunca de la
            // cookie). Sin perfil ⇒ no habilitado. Alimenta el menú por estado.
            const hab = await obtenerHabilitacionProfesional(user.id);
            return NextResponse.json({
                ...base,
                profesional: hab ?? { estado: null, habilitado: false },
            });
        }
        return NextResponse.json(base);
    } catch (error) {
        if (error instanceof AppError) {
            const res = NextResponse.json(error.toJSON(), { status: error.statusCode });
            if (error.statusCode === 401) {
                // SPEC-603: un 401 acá significa que la sesión no sirve (token inválido
                // o expirado, o usuario ya eliminado de la BD con JWT aún vigente). El
                // proxy solo limpia cookies cuando la FIRMA falla; la sesión huérfana la
                // atrapa verifyAuth. Expiramos ambas cookies en la respuesta (mismos
                // atributos que logout, Spec 106) o el navegador reintenta en loop.
                res.cookies.set("__Host-token", "", { ...sessionCookieAttributes(true), maxAge: 0 });
                res.cookies.set("token", "", { ...sessionCookieAttributes(false), maxAge: 0 });
            }
            return res;
        }
        return NextResponse.json({ error: { message: "Error interno" } }, { status: 500 });
    }
}