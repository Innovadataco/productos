import { NextResponse } from "next/server";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { restablecerPasswordSchema } from "@/lib/validators";
import { AutenticacionService } from "@/lib/dal/services/autenticacion";
import { enviarEmailCambioPassword } from "@/lib/email";
import { logAudit } from "@/lib/audit";
import { AccionAudit } from "@prisma/client";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const parsed = restablecerPasswordSchema.safeParse(body);
        if (!parsed.success) {
            const issue = parsed.error.issues[0];
            return NextResponse.json(
                { error: { message: issue?.message || "Token y contraseña requeridos", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const { token, password } = parsed.data;

        // SPEC-053: validación del token, nuevo hash y marcado viven en el DAL (UNA tx);
        // la ruta no toca prisma.
        const resultado = await new AutenticacionService().restablecerPassword(token, password);

        if (!resultado.ok) {
            if (resultado.tipo === "sin_usuario") {
                return NextResponse.json(
                    { error: { message: "Usuario no encontrado", code: ERROR_CODES.NOT_FOUND } },
                    { status: 400 }
                );
            }
            return NextResponse.json(
                { error: { message: "Token inválido o expirado", code: ERROR_CODES.AUTH_INVALID } },
                { status: 400 }
            );
        }

        // SPEC-322 (camino 1): aviso de seguridad al dueño de la cuenta.
        // try/catch: un fallo de correo no debe romper el cambio de clave.
        try {
            await enviarEmailCambioPassword(resultado.email);
        } catch {
            // fallo silencioso — el aviso no es bloqueante
        }

        // US5 · SPEC-318: auditar restablecimiento (enum USUARIO_CAMBIO_PASSWORD requiere T003-T005;
        // resultado.userId disponible por F3 APROBADO — ResultadoRestablecer extendida en T006)
        await logAudit({
            accion: AccionAudit.USUARIO_CAMBIO_PASSWORD,
            tipoRecurso: "Usuario",
            recursoId: resultado.userId,
            usuarioId: resultado.userId,
        });

        return NextResponse.json({ message: "Contraseña actualizada correctamente." });
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
