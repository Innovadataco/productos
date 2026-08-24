import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { logAudit } from "@/lib/audit";
import { ContactoEmergenciaRepository } from "@/lib/dal/repositories/contacto-emergencia";
import { contactoEmergenciaUpdateSchema } from "@/lib/schemas";

/**
 * SPEC-239 (002-PI-mega-cola): detalle de contacto de emergencia del padre
 * (US1, FR-006). Solo rol PARENT y solo contactos propios: cualquier id ajeno
 * o inexistente responde 404 sin tocar nada (SC-001).
 *
 * PATCH  /api/padre/contacto-emergencia/[id] — actualiza campos permitidos
 *        (nombre, relacion, telefono, email, prioridad, activo).
 * DELETE /api/padre/contacto-emergencia/[id] — baja lógica (activo=false, D3).
 */

interface RouteContext {
    params: Promise<{ id: string }>;
}

function extraerCliente(request: Request): { ipAddress: string; userAgent: string } {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

async function requirePadre() {
    const user = await verifyAuth();
    if (user.rol !== "PARENT") {
        throw new AppError("Permisos insuficientes", ERROR_CODES.FORBIDDEN, 403);
    }
    return user;
}

export async function PATCH(request: Request, context: RouteContext) {
    try {
        const user = await requirePadre();
        const { id } = await context.params;
        const body = contactoEmergenciaUpdateSchema.parse(await request.json());

        const repo = new ContactoEmergenciaRepository();
        const existente = await repo.findByIdAndPadre(id, user.id);
        if (!existente) {
            throw new AppError("Contacto no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }

        const contacto = await repo.actualizar(id, body);

        const cliente = extraerCliente(request);
        await logAudit({
            accion: "CONTACTO_EMERGENCIA_ACTUALIZADO",
            tipoRecurso: "ContactoEmergencia",
            recursoId: contacto.id,
            usuarioId: user.id,
            ipAddress: cliente.ipAddress,
            userAgent: cliente.userAgent,
            metadatos: { campos: Object.keys(body) },
        });

        return NextResponse.json({ contacto });
    } catch (error) {
        return errorToResponse(error, "[PADRE/CONTACTO-EMERGENCIA]");
    }
}

export async function DELETE(request: Request, context: RouteContext) {
    try {
        const user = await requirePadre();
        const { id } = await context.params;

        const repo = new ContactoEmergenciaRepository();
        const existente = await repo.findByIdAndPadre(id, user.id);
        if (!existente) {
            throw new AppError("Contacto no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }

        // Baja lógica (D3): se conserva la fila para trazabilidad de activaciones.
        await repo.desactivar(id);

        const cliente = extraerCliente(request);
        await logAudit({
            accion: "CONTACTO_EMERGENCIA_ELIMINADO",
            tipoRecurso: "ContactoEmergencia",
            recursoId: id,
            usuarioId: user.id,
            ipAddress: cliente.ipAddress,
            userAgent: cliente.userAgent,
            metadatos: { bajaLogica: true },
        });

        return NextResponse.json({ eliminado: true });
    } catch (error) {
        return errorToResponse(error, "[PADRE/CONTACTO-EMERGENCIA]");
    }
}
