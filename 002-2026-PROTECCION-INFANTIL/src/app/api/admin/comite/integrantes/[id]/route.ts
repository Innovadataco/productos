import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { encryptParameter, decryptParameter } from "@/lib/param-encryption";

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

async function getIntegrante(id: string, admin: { id: string; rol: string; tenantId: string | null }) {
    const integrante = await prisma.integranteComite.findUnique({
        where: { id },
        include: { comite: true },
    });
    if (!integrante) return null;
    if (admin.rol === "SCHOOL_ADMIN" && integrante.comite.tenantId && integrante.comite.tenantId !== admin.tenantId) {
        return null;
    }
    return integrante;
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

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const admin = await verifyAuth(["ADMIN", "SCHOOL_ADMIN"]);
        const rate = await checkRateLimit(request, "admin_write", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }
        const { id } = await params;
        const integrante = await getIntegrante(id, admin);
        if (!integrante) {
            return NextResponse.json({ error: { message: "Integrante no encontrado", code: ERROR_CODES.NOT_FOUND } }, { status: 404 });
        }

        if (integrante.comite.rol !== "COMITE_VALIDACION") {
            return NextResponse.json(
                { error: { message: "El integrante no pertenece a un comité de validación", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const body = await request.json();
        const parsed = updateSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Datos inválidos", code: ERROR_CODES.VALIDATION_ERROR, details: parsed.error.format() } },
                { status: 400 }
            );
        }

        const { numeroIdentificacion, fechaInicio, fechaFin, estado, ...resto } = parsed.data;
        const data: Record<string, unknown> = { ...resto };
        if (numeroIdentificacion) {
            data.numeroIdentificacion = encryptParameter(numeroIdentificacion);
        }
        if (fechaInicio) {
            data.fechaInicio = new Date(fechaInicio);
        }
        if (fechaFin) {
            data.fechaFin = new Date(fechaFin);
        }
        if (estado) {
            data.estado = estado;
            if (estado === "INACTIVO" && integrante.estado !== "INACTIVO") {
                data.fechaFin = new Date();
            }
        }
        data.modificadoPorId = admin.id;

        const actualizado = await prisma.integranteComite.update({
            where: { id },
            data,
        });

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "COMITE_INTEGRANTE_ACTUALIZADO",
            tipoRecurso: "IntegranteComite",
            recursoId: id,
            usuarioId: admin.id,
            valorAnterior: JSON.stringify({
                nombres: integrante.nombres,
                apellidos: integrante.apellidos,
                tipoIdentificacion: integrante.tipoIdentificacion,
                email: integrante.email,
                estado: integrante.estado,
            }),
            valorNuevo: JSON.stringify({
                nombres: actualizado.nombres,
                apellidos: actualizado.apellidos,
                tipoIdentificacion: actualizado.tipoIdentificacion,
                email: actualizado.email,
                estado: actualizado.estado,
            }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({ integrante: serializarIntegrante(actualizado) });
    } catch (error) {
        if (error instanceof Error && "code" in error && typeof error.code === "string") {
            return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: 403 });
        }
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const admin = await verifyAuth(["ADMIN", "SCHOOL_ADMIN"]);
        const rate = await checkRateLimit(request, "admin_write", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }
        const { id } = await params;
        const integrante = await getIntegrante(id, admin);
        if (!integrante) {
            return NextResponse.json({ error: { message: "Integrante no encontrado", code: ERROR_CODES.NOT_FOUND } }, { status: 404 });
        }

        if (integrante.estado === "INACTIVO") {
            return NextResponse.json({ integrante: serializarIntegrante(integrante) });
        }

        const actualizado = await prisma.integranteComite.update({
            where: { id },
            data: { estado: "INACTIVO", fechaFin: new Date(), modificadoPorId: admin.id },
        });

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "COMITE_INTEGRANTE_INACTIVADO",
            tipoRecurso: "IntegranteComite",
            recursoId: id,
            usuarioId: admin.id,
            valorAnterior: JSON.stringify({ estado: integrante.estado }),
            valorNuevo: JSON.stringify({ estado: "INACTIVO" }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({ integrante: serializarIntegrante(actualizado) });
    } catch (error) {
        if (error instanceof Error && "code" in error && typeof error.code === "string") {
            return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: 403 });
        }
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
