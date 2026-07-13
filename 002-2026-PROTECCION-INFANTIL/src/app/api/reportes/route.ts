import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { crearReporteSchema } from "@/lib/validators";
import { generarNumeroSeguimiento } from "@/lib/reporte-utils";
import { getUserFromToken } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const parsed = crearReporteSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Datos inválidos", code: ERROR_CODES.VALIDATION_ERROR, details: parsed.error.format() } },
                { status: 400 }
            );
        }

        const { identificador, plataforma: plataformaClave, texto, fechaIncidente, ciudad, pais } = parsed.data;

        // Verificar plataforma
        const plataforma = await prisma.plataforma.findUnique({
            where: { clave: plataformaClave },
        });
        if (!plataforma) {
            return NextResponse.json(
                { error: { message: "Plataforma no válida", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        // Obtener usuario autenticado (opcional)
        const user = await getUserFromToken(request);
        const usuarioId = user?.id ?? null;
        const esAnonimo = !usuarioId;

        // Deduplicación autenticada: mismo usuario + identificador en 30 días
        if (usuarioId) {
            const desde = new Date(Date.now() - THIRTY_DAYS_MS);
            const existente = await prisma.reporte.findFirst({
                where: {
                    usuarioId,
                    identificador,
                    creadoEn: { gte: desde },
                },
                orderBy: { creadoEn: "desc" },
            });
            if (existente) {
                return NextResponse.json(
                    { error: { message: "Ya reportaste este identificador recientemente", code: "DUPLICATE_REPORT", reporteExistenteId: existente.id } },
                    { status: 429 }
                );
            }
        }

        // Generar número de seguimiento único
        let numeroSeguimiento: string;
        let intentos = 0;
        do {
            numeroSeguimiento = generarNumeroSeguimiento();
            const existente = await prisma.reporte.findUnique({
                where: { numeroSeguimiento },
            });
            if (!existente) break;
            intentos++;
        } while (intentos < 10);

        if (intentos >= 10) {
            return NextResponse.json(
                { error: { message: "Error generando número de seguimiento", code: ERROR_CODES.INTERNAL_ERROR } },
                { status: 500 }
            );
        }

        // Crear reporte
        const reporte = await prisma.reporte.create({
            data: {
                identificador,
                plataformaId: plataforma.id,
                texto,
                fechaIncidente: new Date(fechaIncidente),
                ciudad,
                pais,
                esAnonimo,
                usuarioId,
                numeroSeguimiento,
                tenantId: user?.tenantId ?? null,
            },
        });

        // Actualizar o crear IdentificadorReportado
        await prisma.identificadorReportado.upsert({
            where: {
                identificador_plataformaId: {
                    identificador,
                    plataformaId: plataforma.id,
                },
            },
            update: {
                totalReportes: { increment: 1 },
                reportesAutenticados: esAnonimo ? undefined : { increment: 1 },
                reportesAnonimos: esAnonimo ? { increment: 1 } : undefined,
                ultimoReporteEn: new Date(),
            },
            create: {
                identificador,
                plataformaId: plataforma.id,
                totalReportes: 1,
                reportesAutenticados: esAnonimo ? 0 : 1,
                reportesAnonimos: esAnonimo ? 1 : 0,
                ultimoReporteEn: new Date(),
            },
        });

        // TODO: Publicar en cola pg-boss para procesamiento (Fase 4)

        return NextResponse.json(
            {
                reporte: {
                    id: reporte.id,
                    numeroSeguimiento: reporte.numeroSeguimiento,
                    estado: reporte.estado,
                },
                mensaje: "Reporte recibido. Tu número de seguimiento es " + numeroSeguimiento + ".",
            },
            { status: 201 }
        );
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