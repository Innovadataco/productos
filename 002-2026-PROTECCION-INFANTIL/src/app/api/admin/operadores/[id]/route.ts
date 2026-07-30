import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { OperadorService } from "@/lib/dal/services/operadores";

const updateSchema = z.object({
    nombre: z.string().min(2).max(100).optional(),
    cupoMaximo: z.coerce.number().int().min(1).max(200).optional(),
    esRevisorDeApelaciones: z.boolean().optional(),
    notasInternas: z.string().max(500).optional(),
    estado: z.enum(["activo", "inactivo"]).optional(),
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
        await assertModulo(admin, "operadores");
        const rate = await checkRateLimit(request, "admin_write", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }
        const { id } = await params;

        // SPEC-053: búsqueda y actualización viven en el DAL; la ruta no toca prisma.
        const service = new OperadorService();
        const operador = await service.obtenerOperador(id);
        if (!operador) {
            return NextResponse.json({ error: { message: "Operador no encontrado", code: ERROR_CODES.NOT_FOUND } }, { status: 404 });
        }

        const body = await request.json();
        const parsed = updateSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Datos inválidos", code: ERROR_CODES.VALIDATION_ERROR, details: parsed.error.format() } },
                { status: 400 }
            );
        }

        const actualizado = await service.actualizar(operador, parsed.data, admin.id, getClientInfo(request));
        return NextResponse.json({ operador: actualizado });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/OPERADORES]");
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "operadores");
        const rate = await checkRateLimit(request, "admin_write", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }
        const { id } = await params;

        const service = new OperadorService();
        const operador = await service.obtenerOperador(id);
        if (!operador) {
            return NextResponse.json({ error: { message: "Operador no encontrado", code: ERROR_CODES.NOT_FOUND } }, { status: 404 });
        }

        if (operador.estado === "inactivo") {
            return NextResponse.json({ operador });
        }

        await service.desactivar(operador, admin.id, getClientInfo(request));

        return NextResponse.json({ operador: { ...operador, estado: "inactivo" } });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/OPERADORES]");
    }
}
