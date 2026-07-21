import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES, safeErrorMessage } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { withValidation } from "@/lib/validation";
import { colegioIdParamsSchema, colegioUpdateBodySchema } from "@/lib/schemas";

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

async function validarUbicacionActualizada(
    data: {
        paisId?: string;
        departamentoId?: string | null;
        ciudadId?: string;
    },
    colegio: { paisId: string; departamentoId?: string | null; ciudadId: string }
) {
    const paisId = data.paisId ?? colegio.paisId;
    const ciudadId = data.ciudadId ?? colegio.ciudadId;
    const departamentoId = data.departamentoId !== undefined ? data.departamentoId : colegio.departamentoId;

    const ciudad = await prisma.ciudad.findUnique({ where: { id: ciudadId } });
    if (!ciudad) throw new AppError("Ciudad no encontrada", ERROR_CODES.NOT_FOUND, 404);
    if (ciudad.paisId !== paisId) {
        throw new AppError("La ciudad no pertenece al país seleccionado", ERROR_CODES.VALIDATION_ERROR, 400);
    }

    if (departamentoId) {
        const departamento = await prisma.departamento.findUnique({ where: { id: departamentoId } });
        if (!departamento) throw new AppError("Departamento no encontrado", ERROR_CODES.NOT_FOUND, 404);
        if (departamento.paisId !== paisId) {
            throw new AppError("El departamento no pertenece al país seleccionado", ERROR_CODES.VALIDATION_ERROR, 400);
        }
        if (ciudad.departamentoId && ciudad.departamentoId !== departamentoId) {
            throw new AppError("La ciudad no pertenece al departamento seleccionado", ERROR_CODES.VALIDATION_ERROR, 400);
        }
    }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const admin = await verifyAuth("ADMIN");
        const rate = await checkRateLimit(request, "admin_write", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const { id } = withValidation.params(colegioIdParamsSchema)(await params);
        const body = await withValidation.body(colegioUpdateBodySchema)(request);

        const colegio = await prisma.colegio.findUnique({
            where: { id },
            include: { admin: { select: { id: true, email: true } } },
        });
        if (!colegio || colegio.estado === "eliminado") {
            return NextResponse.json(
                { error: { message: "Colegio no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        await validarUbicacionActualizada(body, colegio);

        const data: Record<string, unknown> = {};
        if (body.nombre !== undefined) data.nombre = body.nombre;
        if (body.paisId !== undefined) data.paisId = body.paisId;
        if (body.departamentoId !== undefined) data.departamentoId = body.departamentoId;
        if (body.ciudadId !== undefined) data.ciudadId = body.ciudadId;
        if (body.direccion !== undefined) data.direccion = body.direccion;
        if (body.representanteLegalNombre !== undefined) data.representanteLegalNombre = body.representanteLegalNombre;
        if (body.representanteLegalIdentificacion !== undefined) data.representanteLegalIdentificacion = body.representanteLegalIdentificacion;
        if (body.representanteLegalEmail !== undefined) data.representanteLegalEmail = body.representanteLegalEmail;
        if (body.representanteLegalTelefono !== undefined) data.representanteLegalTelefono = body.representanteLegalTelefono;
        if (body.inicioServicio !== undefined) data.inicioServicio = new Date(body.inicioServicio);
        if (body.finServicio !== undefined) data.finServicio = body.finServicio ? new Date(body.finServicio) : null;
        if (body.tipoPeriodo !== undefined) data.tipoPeriodo = body.tipoPeriodo;
        if (body.estado !== undefined) data.estado = body.estado;

        const actualizado = await prisma.colegio.update({
            where: { id },
            data,
        });

        const { ipAddress, userAgent } = getClientInfo(request);
        const accionAudit = body.estado === "inactivo"
            ? "COLEGIO_DESACTIVADO"
            : body.estado === "activo"
            ? "COLEGIO_REACTIVADO"
            : "COLEGIO_ACTUALIZADO";

        await logAudit({
            accion: accionAudit,
            tipoRecurso: "Colegio",
            recursoId: id,
            usuarioId: admin.id,
            valorAnterior: JSON.stringify({
                nombre: colegio.nombre,
                estado: colegio.estado,
                finServicio: colegio.finServicio,
            }),
            valorNuevo: JSON.stringify({
                nombre: actualizado.nombre,
                estado: actualizado.estado,
                finServicio: actualizado.finServicio,
            }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({ colegio: actualizado });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        if (error instanceof Error && "code" in error && typeof error.code === "string") {
            return NextResponse.json({ error: { message: safeErrorMessage(error), code: error.code } }, { status: 403 });
        }
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const admin = await verifyAuth("ADMIN");
        const rate = await checkRateLimit(request, "admin_write", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const { id } = withValidation.params(colegioIdParamsSchema)(await params);
        const colegio = await prisma.colegio.findUnique({
            where: { id },
            include: { admin: { select: { id: true } } },
        });
        if (!colegio || colegio.estado === "eliminado") {
            return NextResponse.json(
                { error: { message: "Colegio no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        await prisma.$transaction([
            prisma.colegio.update({ where: { id }, data: { estado: "eliminado" } }),
            ...(colegio.admin ? [prisma.usuario.update({ where: { id: colegio.admin.id }, data: { estado: "inactivo" } })] : []),
        ]);

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "COLEGIO_DESACTIVADO",
            tipoRecurso: "Colegio",
            recursoId: id,
            usuarioId: admin.id,
            valorAnterior: JSON.stringify({ estado: colegio.estado }),
            valorNuevo: JSON.stringify({ estado: "eliminado" }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({ mensaje: "Colegio eliminado" });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        if (error instanceof Error && "code" in error && typeof error.code === "string") {
            return NextResponse.json({ error: { message: safeErrorMessage(error), code: error.code } }, { status: 403 });
        }
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
