import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { logAudit } from "@/lib/audit";
import { ContactoEmergenciaRepository } from "@/lib/dal/repositories/contacto-emergencia";
import { contactoEmergenciaBodySchema, contactoEmergenciaQuerySchema } from "@/lib/schemas";

/**
 * SPEC-239 (002-PI-mega-cola): CRUD de contactos de emergencia del padre
 * (US1, FR-006). Solo rol PARENT; toda lectura/escritura queda acotada al
 * `usuario.id` de la sesión (anti cross-user leak, SC-001).
 *
 * GET  /api/padre/contacto-emergencia — lista paginada (solo activos por
 *      defecto; `?incluirInactivos=true` los incluye), ordenada por prioridad.
 * POST /api/padre/contacto-emergencia — crea un contacto (E.164 obligatorio).
 */

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

export async function GET(request: Request) {
    try {
        const user = await requirePadre();
        const url = new URL(request.url);
        const query = contactoEmergenciaQuerySchema.parse({
            page: url.searchParams.get("page") ?? undefined,
            pageSize: url.searchParams.get("pageSize") ?? undefined,
            incluirInactivos: url.searchParams.get("incluirInactivos") ?? undefined,
        });

        const repo = new ContactoEmergenciaRepository();
        const { items, total } = await repo.listarPorPadre(user.id, {
            soloActivos: !query.incluirInactivos,
            page: query.page,
            pageSize: query.pageSize,
        });

        return NextResponse.json({
            items,
            pagination: {
                page: query.page,
                pageSize: query.pageSize,
                total,
                totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
            },
        });
    } catch (error) {
        return errorToResponse(error, "[PADRE/CONTACTO-EMERGENCIA]");
    }
}

export async function POST(request: Request) {
    try {
        const user = await requirePadre();
        const body = contactoEmergenciaBodySchema.parse(await request.json());

        const repo = new ContactoEmergenciaRepository();
        const contacto = await repo.crear({
            padreUsuarioId: user.id,
            nombre: body.nombre,
            relacion: body.relacion,
            telefono: body.telefono,
            email: body.email,
            prioridad: body.prioridad,
        });

        const cliente = extraerCliente(request);
        await logAudit({
            accion: "CONTACTO_EMERGENCIA_CREADO",
            tipoRecurso: "ContactoEmergencia",
            recursoId: contacto.id,
            usuarioId: user.id,
            ipAddress: cliente.ipAddress,
            userAgent: cliente.userAgent,
            metadatos: { relacion: contacto.relacion, prioridad: contacto.prioridad },
        });

        return NextResponse.json({ contacto }, { status: 201 });
    } catch (error) {
        return errorToResponse(error, "[PADRE/CONTACTO-EMERGENCIA]");
    }
}
