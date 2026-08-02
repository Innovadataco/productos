import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { logAudit } from "@/lib/audit";
import { withValidation } from "@/lib/validation";
import { colegioIdParamsSchema, colegioUpdateBodySchema } from "@/lib/schemas";
import { esRangoServicioValido } from "@/lib/colegio/periodo";
import { withUnitOfWork } from "@/lib/dal/unit-of-work";
import { ColegioRepository } from "@/lib/dal/repositories/colegio";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";
import { CiudadRepository } from "@/lib/dal/repositories/ciudad";
import { DepartamentoRepository } from "@/lib/dal/repositories/departamento";
import type { Prisma } from "@prisma/client";

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

async function validarUbicacionActualizada(
    data: {
        paisId?: string | undefined;
        departamentoId?: string | null | undefined;
        ciudadId?: string | undefined;
    },
    colegio: { paisId: string; departamentoId?: string | null; ciudadId: string }
) {
    const paisId = data.paisId ?? colegio.paisId;
    const ciudadId = data.ciudadId ?? colegio.ciudadId;
    const departamentoId = data.departamentoId !== undefined ? data.departamentoId : colegio.departamentoId;

    const ciudad = await new CiudadRepository().findById(ciudadId);
    if (!ciudad) throw new AppError("Ciudad no encontrada", ERROR_CODES.NOT_FOUND, 404);
    if (ciudad.paisId !== paisId) {
        throw new AppError("La ciudad no pertenece al país seleccionado", ERROR_CODES.VALIDATION_ERROR, 400);
    }

    if (departamentoId) {
        const departamento = await new DepartamentoRepository().findById(departamentoId);
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
        await assertModulo(admin, "colegios_gestion");
        const rate = await checkRateLimit(request, "admin_write", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const { id } = withValidation.params(colegioIdParamsSchema)(await params);
        const body = await withValidation.body(colegioUpdateBodySchema)(request);

        // E-8: las lecturas/escrituras viven en los repos; la ruta no toca prisma.
        const colegio = await new ColegioRepository().findParaActualizar(id);
        if (!colegio || colegio.estado === "eliminado") {
            return NextResponse.json(
                { error: { message: "Colegio no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        await validarUbicacionActualizada(body, colegio);

        // Validación cruzada de vigencia: si cambia alguna fecha, fin debe ser > inicio.
        if (body.inicioServicio !== undefined || body.finServicio !== undefined) {
            const inicio = body.inicioServicio !== undefined ? new Date(body.inicioServicio) : colegio.inicioServicio;
            const fin =
                body.finServicio !== undefined
                    ? body.finServicio
                        ? new Date(body.finServicio)
                        : null
                    : colegio.finServicio;
            if (fin && !esRangoServicioValido(inicio, fin)) {
                throw new AppError(
                    "La fecha de fin del servicio debe ser posterior a la fecha de inicio",
                    ERROR_CODES.VALIDATION_ERROR,
                    400
                );
            }
        }

        const data: Prisma.ColegioUncheckedUpdateInput = {};
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

        const actualizado = await new ColegioRepository().actualizar(id, data);

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
            colegioId: id,
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
        return errorToResponse(error, "[ADMIN/COLEGIOS]");
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "colegios_gestion");
        const rate = await checkRateLimit(request, "admin_write", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const { id } = withValidation.params(colegioIdParamsSchema)(await params);
        // E-8: las lecturas/escrituras viven en los repos; la ruta no toca prisma.
        const colegio = await new ColegioRepository().findParaEliminar(id);
        if (!colegio || colegio.estado === "eliminado") {
            return NextResponse.json(
                { error: { message: "Colegio no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        await withUnitOfWork(async (tx) => {
            await new ColegioRepository(tx).actualizar(id, { estado: "eliminado" });
            if (colegio.admin) {
                await new UsuarioRepository(tx).actualizar(colegio.admin.id, { estado: "inactivo" });
            }
        });

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "COLEGIO_DESACTIVADO",
            tipoRecurso: "Colegio",
            recursoId: id,
            usuarioId: admin.id,
            colegioId: id,
            valorAnterior: JSON.stringify({ estado: colegio.estado }),
            valorNuevo: JSON.stringify({ estado: "eliminado" }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({ mensaje: "Colegio eliminado" });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/COLEGIOS]");
    }
}
