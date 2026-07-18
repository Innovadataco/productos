import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { ERROR_CODES } from "@/lib/errors";
import { logAudit } from "@/lib/audit";

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

async function getOperador(id: string, admin: { id: string; rol: string; tenantId: string | null }) {
    const where: Record<string, unknown> = { id, rol: { in: ["OPERADOR", "COMITE_VALIDACION"] } };
    if (admin.rol === "SCHOOL_ADMIN") {
        where.tenantId = admin.tenantId ?? null;
    }
    return prisma.usuario.findFirst({ where, include: { perfilOperador: true } });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const admin = await verifyAuth(["ADMIN", "SCHOOL_ADMIN"]);
        const { id } = await params;
        const operador = await getOperador(id, admin);
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

        const { nombre, estado, ...perfilData } = parsed.data;
        const { ipAddress, userAgent } = getClientInfo(request);

        if (estado && estado !== operador.estado) {
            await prisma.usuario.update({ where: { id }, data: { estado } });
            await logAudit({
                accion: estado === "activo" ? "OPERADOR_ACTIVADO" : "OPERADOR_DESACTIVADO",
                tipoRecurso: "Usuario",
                recursoId: id,
                usuarioId: admin.id,
                valorAnterior: JSON.stringify({ estado: operador.estado }),
                valorNuevo: JSON.stringify({ estado }),
                ipAddress,
                userAgent,
            });
        }

        if (nombre) {
            await prisma.usuario.update({ where: { id }, data: { nombre } });
        }

        if (operador.perfilOperador && Object.keys(perfilData).length > 0) {
            await prisma.perfilOperador.update({
                where: { usuarioId: id },
                data: perfilData,
            });
        }

        const actualizado = await prisma.usuario.findUnique({ where: { id }, include: { perfilOperador: true } });
        return NextResponse.json({ operador: actualizado });
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
        const { id } = await params;
        const operador = await getOperador(id, admin);
        if (!operador) {
            return NextResponse.json({ error: { message: "Operador no encontrado", code: ERROR_CODES.NOT_FOUND } }, { status: 404 });
        }

        if (operador.estado === "inactivo") {
            return NextResponse.json({ operador });
        }

        await prisma.usuario.update({ where: { id }, data: { estado: "inactivo" } });
        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "OPERADOR_DESACTIVADO",
            tipoRecurso: "Usuario",
            recursoId: id,
            usuarioId: admin.id,
            valorAnterior: JSON.stringify({ estado: operador.estado }),
            valorNuevo: JSON.stringify({ estado: "inactivo" }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({ operador: { ...operador, estado: "inactivo" } });
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
