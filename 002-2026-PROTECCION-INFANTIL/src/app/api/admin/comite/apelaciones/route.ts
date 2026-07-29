import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { esAdminRol, esComiteRol } from "@/lib/operadores/permisos";
import { diasHabilesTranscurridos, estaEnAvisoPrevio, getAvisoPrevioDias } from "@/lib/apelaciones";

/**
 * SPEC-110 — Bandeja propia de apelaciones del comité de validación.
 *
 * Lista los casos con estado, fechas, días hábiles transcurridos y la marca de
 * "próximo a vencer" (≥ apelacion.aviso_previo_dias días hábiles sin resolver).
 * Reutiliza los patrones de la bandeja existente (assertModulo comite_bandeja,
 * paginación page/pageSize).
 */

const querySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    estado: z.enum(["RECIBIDA", "EN_REVISION", "ACEPTADA", "RECHAZADA"]).optional(),
});

export async function GET(request: Request) {
    try {
        const user = await verifyAuth();
        await assertModulo(user, "comite_bandeja");
        if (!esAdminRol(user.rol) && !esComiteRol(user.rol)) {
            return NextResponse.json(
                { error: { message: "Permisos insuficientes", code: ERROR_CODES.FORBIDDEN } },
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

        const url = new URL(request.url);
        const parsedQuery = querySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
        if (!parsedQuery.success) {
            return NextResponse.json(
                { error: { message: "Parámetros inválidos", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }
        const { page, pageSize, estado } = parsedQuery.data;
        const skip = (page - 1) * pageSize;

        const where = estado ? { estado } : {};
        const [apelaciones, total, avisoPrevioDias] = await Promise.all([
            prisma.apelacion.findMany({
                where,
                orderBy: [{ estado: "asc" }, { creadoEn: "desc" }],
                skip,
                take: pageSize,
                select: {
                    id: true,
                    numero: true,
                    identificador: true,
                    estado: true,
                    esRepresentante: true,
                    creadoEn: true,
                    plazoRespuestaEn: true,
                    resueltoEn: true,
                    decision: true,
                    plataforma: { select: { nombre: true, clave: true } },
                    usuario: { select: { id: true, nombre: true, email: true } },
                    comite: { select: { id: true, nombre: true } },
                },
            }),
            prisma.apelacion.count({ where }),
            getAvisoPrevioDias(),
        ]);

        const ahora = new Date();
        const items = apelaciones.map((a) => ({
            id: a.id,
            numero: a.numero,
            identificador: a.identificador,
            plataforma: a.plataforma,
            estado: a.estado,
            esRepresentante: a.esRepresentante,
            creadoEn: a.creadoEn,
            plazoRespuestaEn: a.plazoRespuestaEn,
            resueltoEn: a.resueltoEn,
            decision: a.decision,
            apelante: a.usuario,
            comiteAsignado: a.comite,
            diasHabilesTranscurridos: diasHabilesTranscurridos(a.creadoEn, ahora),
            proximoAVencer: estaEnAvisoPrevio({ estado: a.estado, creadoEn: a.creadoEn }, avisoPrevioDias, ahora),
        }));

        return NextResponse.json({
            items,
            pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
        });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        const msg = error instanceof Error ? error.message : String(error);
        console.error("[ComiteApelaciones] Error listando bandeja:", msg);
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
