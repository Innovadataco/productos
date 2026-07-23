import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES, safeErrorMessage } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { verificarVigenciaColegio } from "@/lib/colegio/vigencia";
import { withValidation } from "@/lib/validation";
import { alumnoIdParamsSchema, identificadorAlumnoBodySchema } from "@/lib/schemas";
import { verificarPropiedadAlumno } from "@/lib/colegio/permisos";
import { normalizarIdentificador } from "@/lib/colegio/normalizacion";
import type { EtiquetaRelacionAlumno } from "@prisma/client";

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth("SCHOOL_ADMIN");
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

        const { id } = withValidation.params(alumnoIdParamsSchema)(await params);
        await verificarPropiedadAlumno(user.id, id);

        const identificadores = await prisma.identificadorAlumno.findMany({
            where: { alumnoId: id, estado: "activo" },
            include: { plataforma: { select: { id: true, clave: true, nombre: true } } },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json({ identificadores });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        if (error instanceof Error && error.message === "Alumno no encontrado") {
            return NextResponse.json(
                { error: { message: "Alumno no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
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

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth("SCHOOL_ADMIN");
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

        const { id } = withValidation.params(alumnoIdParamsSchema)(await params);
        const body = await withValidation.body(identificadorAlumnoBodySchema)(request);

        await verificarPropiedadAlumno(user.id, id);

        const valorNormalizado = normalizarIdentificador(body.valor, body.tipo);

        if (body.plataformaId) {
            const plataforma = await prisma.plataforma.findUnique({
                where: { id: body.plataformaId },
            });
            if (!plataforma) {
                return NextResponse.json(
                    { error: { message: "Plataforma no encontrada", code: ERROR_CODES.NOT_FOUND } },
                    { status: 404 }
                );
            }
        }

        const duplicado = await prisma.identificadorAlumno.findFirst({
            where: {
                alumnoId: id,
                tipo: body.tipo,
                valor: valorNormalizado,
                plataformaId: body.plataformaId ?? null,
            },
        });
        if (duplicado) {
            return NextResponse.json(
                { error: { message: "Identificador duplicado para este alumno", code: ERROR_CODES.CONFLICT } },
                { status: 409 }
            );
        }

        const identificador = await prisma.identificadorAlumno.create({
            data: {
                alumnoId: id,
                tipo: body.tipo,
                valor: valorNormalizado,
                plataformaId: body.plataformaId ?? null,
                etiquetaRelacion: (body.etiquetaRelacion ?? "ALUMNO") as EtiquetaRelacionAlumno,
                estado: "activo",
            },
            include: { plataforma: { select: { id: true, clave: true, nombre: true } } },
        });

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "COLEGIO_IDENTIFICADOR_CREADO",
            tipoRecurso: "IdentificadorAlumno",
            recursoId: identificador.id,
            usuarioId: user.id,
            colegioId: user.colegioId ?? undefined,
            valorNuevo: JSON.stringify({
                alumnoId: id,
                tipo: body.tipo,
                valor: valorNormalizado,
                plataformaId: body.plataformaId ?? null,
                etiquetaRelacion: body.etiquetaRelacion ?? "ALUMNO",
            }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({ identificador }, { status: 201 });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        if (error instanceof Error && error.message === "Alumno no encontrado") {
            return NextResponse.json(
                { error: { message: "Alumno no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
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
