import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

const ESTADO_VISUAL: Record<string, string> = {
    PENDIENTE: "Recibido",
    PROCESANDO: "En procesamiento",
    CLASIFICADO: "Procesado",
    CORREGIDO: "Procesado",
    REVISION_MANUAL: "En revisión",
    POSIBLE_SPAM: "En revisión",
    REQUIERE_ANONIMIZACION: "En revisión de privacidad",
    DUPLICADO: "Vinculado a reporte existente",
};

export async function GET(request: Request) {
    try {
        const user = await verifyAuth();

        const { searchParams } = new URL(request.url);
        const page = Math.max(1, Number(searchParams.get("page") || "1"));
        const pageSize = Math.min(
            MAX_PAGE_SIZE,
            Math.max(1, Number(searchParams.get("pageSize") || String(DEFAULT_PAGE_SIZE)))
        );
        const skip = (page - 1) * pageSize;

        const [items, total] = await Promise.all([
            prisma.reporte.findMany({
                where: { usuarioId: user.id },
                orderBy: { creadoEn: "desc" },
                skip,
                take: pageSize,
                select: {
                    id: true,
                    identificador: true,
                    estado: true,
                    numeroSeguimiento: true,
                    ciudad: true,
                    pais: true,
                    esAnonimo: true,
                    creadoEn: true,
                    plataforma: { select: { nombre: true } },
                },
            }),
            prisma.reporte.count({ where: { usuarioId: user.id } }),
        ]);

        const mapped = items.map((r) => ({
            id: r.id,
            identificador: r.identificador,
            plataforma: r.plataforma.nombre,
            estado: r.estado,
            estadoVisual: ESTADO_VISUAL[r.estado] || r.estado,
            numeroSeguimiento: r.numeroSeguimiento,
            ciudad: r.ciudad,
            pais: r.pais,
            esAnonimo: r.esAnonimo,
            creadoEn: r.creadoEn.toISOString(),
        }));

        return NextResponse.json({
            items: mapped,
            pagination: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize),
            },
        });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}