import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { ComiteIntegrantesService } from "@/lib/dal/services/comite-integrantes";

const TIPOS_IDENTIFICACION = ["CEDULA_CIUDADANIA", "CEDULA_EXTRANJERIA", "PASAPORTE", "OTRO"] as const;

const integranteSchema = z.object({
    comiteId: z.string(),
    nombres: z.string().min(1).max(100),
    apellidos: z.string().min(1).max(100),
    tipoIdentificacion: z.enum(TIPOS_IDENTIFICACION),
    numeroIdentificacion: z.string().min(1).max(100),
    email: z.string().email(),
    fechaInicio: z.string().datetime().optional(),
});

const querySchema = z.object({
    comiteId: z.string(),
});

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

export async function GET(request: Request) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "comite");
        const rate = await checkRateLimit(request, "admin_read", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }
        const url = new URL(request.url);
        const parsedQuery = querySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
        if (!parsedQuery.success) {
            return NextResponse.json(
                { error: { message: "comiteId requerido", code: ERROR_CODES.VALIDATION_ERROR, details: parsedQuery.error.format() } },
                { status: 400 }
            );
        }
        const { comiteId } = parsedQuery.data;

        // SPEC-053: validación del comité, padrón y descifrado viven en el DAL.
        const resultado = await new ComiteIntegrantesService().listar(comiteId);

        return NextResponse.json(resultado);
    } catch (error) {
        return errorToResponse(error, "[ADMIN/COMITE/INTEGRANTES]");
    }
}

export async function POST(request: Request) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "comite");
        const rate = await checkRateLimit(request, "admin_write", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }
        const body = await request.json();
        const parsed = integranteSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Datos inválidos", code: ERROR_CODES.VALIDATION_ERROR, details: parsed.error.format() } },
                { status: 400 }
            );
        }

        // SPEC-053: validación del comité, cifrado de la identificación, alta y
        // auditoría viven en el DAL.
        const resultado = await new ComiteIntegrantesService().crear(parsed.data, admin.id, getClientInfo(request));

        return NextResponse.json(resultado, { status: 201 });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/COMITE/INTEGRANTES]");
    }
}
