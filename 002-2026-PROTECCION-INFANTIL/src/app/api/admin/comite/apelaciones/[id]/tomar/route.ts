import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { idSchema } from "@/lib/validators";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { esAdminRol, esComiteRol } from "@/lib/operadores/permisos";

/**
 * SPEC-110 — El comité (o ADMIN) toma un caso de apelación.
 *
 * RECIBIDA → EN_REVISION, asignado a sí mismo. Sin triaje automático: el caso llega
 * directo a la bandeja y un humano lo toma. Si ya está tomado o resuelto → 409.
 * La asignación queda trazada en el propio caso (comiteId + asignadoEn).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth();
        await assertModulo(user, "comite_bandeja");
        if (!esAdminRol(user.rol) && !esComiteRol(user.rol)) {
            return NextResponse.json(
                { error: { message: "Permisos insuficientes", code: ERROR_CODES.FORBIDDEN } },
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

        const { id: rawId } = await params;
        const parsedId = idSchema.safeParse(rawId);
        if (!parsedId.success) {
            return NextResponse.json(
                { error: { message: "ID inválido", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }
        const id = parsedId.data;

        const apelacion = await prisma.apelacion.findUnique({ where: { id }, select: { id: true, estado: true, comiteId: true, numero: true } });
        if (!apelacion) {
            return NextResponse.json(
                { error: { message: "Apelación no encontrada", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }
        if (apelacion.estado !== "RECIBIDA") {
            return NextResponse.json(
                { error: { message: "El caso ya fue tomado o resuelto", code: ERROR_CODES.CONFLICT } },
                { status: 409 }
            );
        }

        const actualizada = await prisma.apelacion.update({
            where: { id },
            data: { estado: "EN_REVISION", comiteId: user.id, asignadoEn: new Date() },
            select: { id: true, numero: true, estado: true, comiteId: true, asignadoEn: true },
        });

        return NextResponse.json({ apelacion: actualizada });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        const msg = error instanceof Error ? error.message : String(error);
        console.error("[ComiteApelaciones] Error tomando caso:", msg);
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
