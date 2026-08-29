import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { ComiteIntegrantesService } from "@/lib/dal/services/comite-integrantes";

const TIPOS_IDENTIFICACION = ["CEDULA_CIUDADANIA", "CEDULA_EXTRANJERIA", "PASAPORTE", "OTRO"] as const;
const ESTADOS_INTEGRANTE = ["ACTIVO", "INACTIVO"] as const;

const updateSchema = z.object({
    nombres: z.string().min(1).max(100).optional(),
    apellidos: z.string().min(1).max(100).optional(),
    tipoIdentificacion: z.enum(TIPOS_IDENTIFICACION).optional(),
    numeroIdentificacion: z.string().min(1).max(100).optional(),
    email: z.string().email().optional(),
    fechaInicio: z.string().datetime().optional(),
    fechaFin: z.string().datetime().optional(),
    estado: z.enum(ESTADOS_INTEGRANTE).optional(),
});

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
        const { id } = await params;

        // SPEC-053: guardas (404, pertenencia al comité) ANTES del parseo del
        // body, como el flujo original; cifrado, edición y auditoría en el DAL.
        const service = new ComiteIntegrantesService();
        const integrante = await service.obtenerConComite(id);
        service.assertPerteneceAComite(integrante);

        const body = await request.json();
        const parsed = updateSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Datos inválidos", code: ERROR_CODES.VALIDATION_ERROR, details: parsed.error.format() } },
                { status: 400 }
            );
        }

        const resultado = await service.actualizar(integrante, parsed.data, admin.id, getClientInfo(request));

        return NextResponse.json(resultado);
    } catch (error) {
        return errorToResponse(error, "[ADMIN/COMITE/INTEGRANTES]");
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
        const { id } = await params;

        // SPEC-053: baja lógica idempotente y auditoría viven en el DAL.
        const resultado = await new ComiteIntegrantesService().inactivar(id, admin.id, getClientInfo(request));

        return NextResponse.json(resultado);
    } catch (error) {
        return errorToResponse(error, "[ADMIN/COMITE/INTEGRANTES]");
    }
}
