import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { idSchema } from "@/lib/validators";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { esAdminRol, esComiteRol } from "@/lib/operadores/permisos";
import { ComiteBandejaService } from "@/lib/dal/services/comite-bandeja";

const resolverSchema = z.object({
    categoria: z.enum([
        "CONTACTO_INSISTENTE",
        "SOLICITUD_MATERIAL",
        "OFRECIMIENTO_REGALOS",
        "SUPLANTACION_IDENTIDAD",
        "SOLICITUD_ENCUENTRO",
        "COMPARTIMIENTO_SEXUAL",
        "EXTORSION",
        "CONTENIDO_GENERADO_IA",
        "DIFUSION_NO_CONSENTIDA",
        "DOXING",
        "OTRO",
    ]),
    resolucion: z.string().max(4000).optional(),
});

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth();
        await assertModulo(user, "comite_bandeja");
        if (!esAdminRol(user.rol) && !esComiteRol(user.rol)) {
            return NextResponse.json(
                { error: { message: "Permisos insuficientes", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const rate = await checkRateLimit(request, "admin_write", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const { id: rawId } = await params;
        const parsedId = idSchema.safeParse(rawId);
        if (!parsedId.success) {
            return NextResponse.json(
                { error: { message: "ID inválido", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }
        const id = parsedId.data;

        const body = await request.json();
        const parsed = resolverSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Datos inválidos", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }
        const { categoria, resolucion } = parsed.data;

        // SPEC-053: validaciones, corrección transaccional, visibilidad/score y
        // auditoría viven en el DAL.
        const resultado = await new ComiteBandejaService().resolver(
            id,
            { categoria, resolucion },
            { id: user.id, rol: user.rol, esComite: esComiteRol(user.rol) },
            getClientInfo(request)
        );

        return NextResponse.json(resultado);
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
