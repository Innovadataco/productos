import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { ProfesorRepository } from "@/lib/dal/repositories/profesor";
import { TipoDocumentoRepository } from "@/lib/dal/repositories/tipo-documento";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES, AppError } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { logAudit } from "@/lib/audit";
import { verificarVigenciaColegio } from "@/lib/colegio/vigencia";
import { withValidation, ValidationError } from "@/lib/validation";
import { profesorBodySchema, profesoresQuerySchema } from "@/lib/schemas";
import { sellarCookieSesionEstado } from "@/lib/routing/sellar-sesion-estado";

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

export async function GET(request: Request) {
    try {
        const user = await verifyAuth("SCHOOL_ADMIN");
        await assertModulo(user, "colegios_gestion");
        const vigencia = await verificarVigenciaColegio(user.id);
        if (!vigencia.vigente) {
            return NextResponse.json(
                { error: { message: vigencia.mensaje, code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const rate = await checkRateLimit(request, "admin_read", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        if (!user.colegioId) {
            return NextResponse.json(
                { error: { message: "Usuario no vinculado a un colegio", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const url = new URL(request.url);
        const parsedQuery = profesoresQuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
        if (!parsedQuery.success) {
            return NextResponse.json(
                { error: { message: "Parámetros de consulta inválidos", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const { page, pageSize, estado } = parsedQuery.data;

        // SPEC-145 (E-1): la consulta paginada vive en el repo (SIEMPRE con tenant).
        const [items, total] = await new ProfesorRepository().listarPaginados(user.colegioId, {
            estado,
            skip: (page - 1) * pageSize,
            take: pageSize,
        });

        // SPEC-321 (P10): exponer el conteo de identificadores activos por profesor.
        const itemsConConteo = items.map(({ _count, ...p }) => ({
            ...p,
            identificadoresActivos: _count.identificadoresProf,
        }));

        return NextResponse.json({
            items: itemsConConteo,
            pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
        });
    } catch (error) {
        return errorToResponse(error, "[COLEGIO/PROFESORES]");
    }
}

export async function POST(request: Request) {
    try {
        const user = await verifyAuth("SCHOOL_ADMIN");
        await assertModulo(user, "colegios_gestion");
        const vigencia = await verificarVigenciaColegio(user.id);
        if (!vigencia.vigente) {
            return NextResponse.json(
                { error: { message: vigencia.mensaje, code: ERROR_CODES.FORBIDDEN } },
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

        if (!user.colegioId) {
            return NextResponse.json(
                { error: { message: "Usuario no vinculado a un colegio", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        // SPEC-145 (FR-005): obligatorios solo nombre + apellidos; el 400 lleva el
        // mensaje humano de la primera issue ("Falta el apellido del profesor", …).
        const body = await withValidation.body(profesorBodySchema)(request).catch((error: unknown) => {
            if (error instanceof ValidationError) {
                throw new AppError(error.details[0]?.message ?? "Datos inválidos", ERROR_CODES.VALIDATION_ERROR, 400);
            }
            throw error;
        });

        // SPEC-320 (§2.2 · FR-014): tipoDocumento debe existir y estar activo en el catálogo.
        const claveActiva = await new TipoDocumentoRepository().claveActiva(body.tipoDocumento);
        if (!claveActiva) {
            return NextResponse.json(
                { error: { message: "Tipo de documento inválido o inactivo", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        // SPEC-145 (E-1): duplicado y creación viven en el repo (SIEMPRE con tenant).
        // FR-007: duplicado nombre + apellidos ACTIVO en el mismo colegio → 409.
        const profesores = new ProfesorRepository();
        const duplicado = await profesores.buscarPorNombreApellidosEnColegio(user.colegioId, body.nombre, body.apellidos);
        if (duplicado) {
            return NextResponse.json(
                { error: { message: "Ya existe un profesor con ese nombre y apellidos", code: ERROR_CODES.CONFLICT } },
                { status: 409 }
            );
        }

        // SPEC-320 (§2.2 · FR-009): documento (tipo+número) único por colegio.
        const docDuplicado = await profesores.buscarPorDocumentoEnColegio(
            user.colegioId,
            body.tipoDocumento,
            body.numeroDocumento
        );
        if (docDuplicado) {
            return NextResponse.json(
                { error: { message: "Ya existe un profesor con ese documento en el colegio", code: ERROR_CODES.CONFLICT } },
                { status: 409 }
            );
        }

        const profesor = await profesores.crear(user.colegioId, {
            nombre: body.nombre,
            apellidos: body.apellidos,
            tipoDocumento: body.tipoDocumento,
            numeroDocumento: body.numeroDocumento,
            anioNacimiento: body.anioNacimiento,
            sexo: body.sexo,
            email: body.email,
            telefono: body.telefono,
        });

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "COLEGIO_PROFESOR_CREADO",
            tipoRecurso: "Profesor",
            recursoId: profesor.id,
            usuarioId: user.id,
            colegioId: user.colegioId ?? undefined,
            valorNuevo: JSON.stringify({ nombre: body.nombre, apellidos: body.apellidos, colegioId: user.colegioId }),
            ipAddress,
            userAgent,
        });

        const res = NextResponse.json({ profesor }, { status: 201 });
        // SPEC-344 (A-69 · C1 · Phase 9-bis / analyze I1): sellar cookie —
        // al crear el primer profesor activo, el Paso 3 del camino cierra.
        await sellarCookieSesionEstado(res, user.id);
        return res;
    } catch (error) {
        return errorToResponse(error, "[COLEGIO/PROFESORES]");
    }
}
