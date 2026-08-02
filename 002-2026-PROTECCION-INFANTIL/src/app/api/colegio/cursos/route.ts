import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { CursoRepository } from "@/lib/dal/repositories/curso";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { logAudit } from "@/lib/audit";
import { verificarVigenciaColegio } from "@/lib/colegio/vigencia";
import { withValidation } from "@/lib/validation";
import { cursoBodySchema } from "@/lib/schemas";

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
            return NextResponse.json({ cursos: [] });
        }

        // SPEC-134 (E-1): la consulta vive en el repo (tenant obligatorio); la ruta no toca prisma.
        const cursos = await new CursoRepository().listarActivos(user.colegioId);

        return NextResponse.json({ cursos });
    } catch (error) {
        return errorToResponse(error, "[COLEGIO/CURSOS]");
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

        const body = await withValidation.body(cursoBodySchema)(request);
        const { nombre, grado, anioLectivo } = body;

        // SPEC-134 (E-1): duplicado y creación viven en el repo (tenant obligatorio).
        const cursos = new CursoRepository();
        const existente = await cursos.buscarPorDatos(user.colegioId, {
            nombre,
            grado: grado ?? null,
            anioLectivo: anioLectivo ?? null,
        });
        if (existente) {
            return NextResponse.json(
                { error: { message: "Ya existe un curso con ese nombre", code: ERROR_CODES.CONFLICT } },
                { status: 409 }
            );
        }

        const curso = await cursos.crear(user.colegioId, { nombre, grado, anioLectivo });

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "COLEGIO_CURSO_CREADO",
            tipoRecurso: "Curso",
            recursoId: curso.id,
            usuarioId: user.id,
            colegioId: user.colegioId ?? undefined,
            valorNuevo: JSON.stringify({ nombre, grado, anioLectivo, colegioId: user.colegioId }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({ curso }, { status: 201 });
    } catch (error) {
        return errorToResponse(error, "[COLEGIO/CURSOS]");
    }
}
