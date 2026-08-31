import { NextResponse } from "next/server";
import { createToken, verifyToken, setSessionCookie } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { verificarCompletarSchema } from "@/lib/validators";
import { AutenticacionService } from "@/lib/dal/services/autenticacion";
import { RegistroColegioService } from "@/lib/dal/services/registro-colegio";

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
        const { token, password, nombre, nombreColegio, nit, rol } = parsed.data;

        const payload = await verifyToken(token);
        if (!payload || payload.type !== "verification" || !payload.sub) {
            return NextResponse.json(
                { error: { message: "Token inválido o expirado", code: ERROR_CODES.AUTH_EXPIRED } },
                { status: 400 }
            );
        }

        const email = payload.sub as string;

        let user: { id: string; email: string; nombre: string | null; rol: string };

        if (nombreColegio && rol === "SCHOOL_ADMIN") {
            // SPEC-240 (002-PI-143): registro público de colegio desde /registro-colegio.
            // SPEC-320 (§2.2-bis): el NIT es obligatorio para el registro de colegio.
            if (!nit) {
                return NextResponse.json(
                    { error: { message: "Falta el NIT del colegio", code: ERROR_CODES.VALIDATION_ERROR } },
                    { status: 400 }
                );
            }
            const resultado = await new RegistroColegioService().registrarPublico(
                email,
                password,
                nombre || email,
                nombreColegio,
                nit
            );
            if (!resultado.ok) {
                if (resultado.tipo === "ubicacion_no_configurada") {
                    return NextResponse.json(
                        { error: { message: "Ubicación default no configurada", code: ERROR_CODES.INTERNAL_ERROR } },
                        { status: 500 }
                    );
                }
                if (resultado.tipo === "nit_existente") {
                    return NextResponse.json(
                        { error: { message: "Ya existe un colegio con ese NIT", code: ERROR_CODES.CONFLICT } },
                        { status: 409 }
                    );
                }
                return NextResponse.json(
                    { error: { message: "Email ya registrado", code: ERROR_CODES.CONFLICT } },
                    { status: 409 }
                );
            }
            user = resultado.user;
        } else {
            // SPEC-053: unicidad y creación del usuario viven en el DAL; la ruta no toca prisma.
            const resultado = await new AutenticacionService().completarRegistro(email, password, nombre);
            if (!resultado.ok) {
                return NextResponse.json(
                    { error: { message: "Email ya registrado", code: ERROR_CODES.CONFLICT } },
                    { status: 409 }
                );
            }
            user = resultado.user;
        }

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
