import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES, safeErrorMessage } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { encryptParameter, decryptParameter } from "@/lib/param-encryption";

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

async function validarComite(comiteId: string) {
    const comite = await prisma.usuario.findUnique({ where: { id: comiteId } });
    if (!comite || comite.rol !== "COMITE_VALIDACION") {
        return null;
    }
    return comite;
}

function serializarIntegrante(integrante: {
    id: string;
    comiteId: string;
    nombres: string;
    apellidos: string;
    tipoIdentificacion: string;
    numeroIdentificacion: string;
    email: string;
    fechaInicio: Date;
    fechaFin: Date | null;
    estado: string;
    creadoPorId: string;
    modificadoPorId: string | null;
    creadoEn: Date;
    actualizadoEn: Date;
}) {
    return {
        id: integrante.id,
        comiteId: integrante.comiteId,
        nombres: integrante.nombres,
        apellidos: integrante.apellidos,
        tipoIdentificacion: integrante.tipoIdentificacion,
        numeroIdentificacion: decryptParameter(integrante.numeroIdentificacion),
        email: integrante.email,
        fechaInicio: integrante.fechaInicio,
        fechaFin: integrante.fechaFin,
        estado: integrante.estado,
        creadoPorId: integrante.creadoPorId,
        modificadoPorId: integrante.modificadoPorId,
        creadoEn: integrante.creadoEn,
        actualizadoEn: integrante.actualizadoEn,
    };
}

export async function GET(request: Request) {
    try {
        const admin = await verifyAuth(["ADMIN", "SCHOOL_ADMIN"]);
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

        const comite = await validarComite(comiteId);
        if (!comite) {
            return NextResponse.json(
                { error: { message: "Comité no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        if (admin.rol === "SCHOOL_ADMIN" && comite.tenantId && comite.tenantId !== admin.tenantId) {
            return NextResponse.json(
                { error: { message: "No tienes permiso para ver este comité", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const integrantes = await prisma.integranteComite.findMany({
            where: { comiteId },
            orderBy: { creadoEn: "desc" },
        });

        return NextResponse.json({ integrantes: integrantes.map(serializarIntegrante) });
    } catch (error) {
        if (error instanceof Error && "code" in error && typeof error.code === "string") {
            return NextResponse.json({ error: { message: safeErrorMessage(error), code: error.code } }, { status: 403 });
        }
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const admin = await verifyAuth(["ADMIN", "SCHOOL_ADMIN"]);
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

        const { comiteId, nombres, apellidos, tipoIdentificacion, numeroIdentificacion, email, fechaInicio } = parsed.data;

        const comite = await validarComite(comiteId);
        if (!comite) {
            return NextResponse.json(
                { error: { message: "Comité no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        if (admin.rol === "SCHOOL_ADMIN" && comite.tenantId && comite.tenantId !== admin.tenantId) {
            return NextResponse.json(
                { error: { message: "No tienes permiso para gestionar este comité", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const numeroIdentificacionCifrado = encryptParameter(numeroIdentificacion);
        const { ipAddress, userAgent } = getClientInfo(request);

        const integrante = await prisma.integranteComite.create({
            data: {
                comiteId,
                nombres,
                apellidos,
                tipoIdentificacion,
                numeroIdentificacion: numeroIdentificacionCifrado,
                email,
                fechaInicio: fechaInicio ? new Date(fechaInicio) : new Date(),
                creadoPorId: admin.id,
            },
        });

        await logAudit({
            accion: "COMITE_INTEGRANTE_CREADO",
            tipoRecurso: "IntegranteComite",
            recursoId: integrante.id,
            usuarioId: admin.id,
            valorNuevo: JSON.stringify({ comiteId, nombres, apellidos, tipoIdentificacion, email }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({ integrante: serializarIntegrante(integrante) }, { status: 201 });
    } catch (error) {
        if (error instanceof Error && "code" in error && typeof error.code === "string") {
            return NextResponse.json({ error: { message: safeErrorMessage(error), code: error.code } }, { status: 403 });
        }
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
