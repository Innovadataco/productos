/**
 * SPEC-340 (A-68 §4.4 · capa 1) — GET /api/padre/expedientes/[id]/lectura.
 *
 * «Lo que muestra tu expediente»: SOLO cifras calculadas en vivo de los datos
 * (siempre al día, con o sin análisis). Los hechos: la cadena PROPIA del
 * expediente + los ajenos BLINDADOS (fecha/lugar/clasificación — jamás texto
 * ni autor). El perfil cruza el identificador con los hijos del padre.
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES, safeErrorMessage } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { whereReporteAprobado } from "@/lib/reportes-acceso";
import { lecturaCapa1, type HechoCapa1 } from "@/lib/expediente/lectura-capa1";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const usuario = await verifyAuth("PARENT");
        const { id } = await params;

        const expediente = await prisma.expediente.findFirst({
            where: { id, padreUsuarioId: usuario.id },
            select: { id: true, identificadorReportado: true },
        });
        if (!expediente) {
            return NextResponse.json(
                { error: { message: "Expediente no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        const [propios, ajenos, hijoCruzado] = await Promise.all([
            prisma.reporte.findMany({
                where: { usuarioId: usuario.id, eliminado: false, identificador: expediente.identificadorReportado },
                select: {
                    fechaIncidente: true,
                    ciudad: true,
                    pais: true,
                    edadVictima: true,
                    ciudadRel: { select: { nombre: true } },
                    clasificacion: { select: { categoria: true } },
                },
            }),
            prisma.reporte.findMany({
                where: whereReporteAprobado({
                    identificador: expediente.identificadorReportado,
                    NOT: { usuarioId: usuario.id },
                }),
                select: {
                    fechaIncidente: true,
                    ciudad: true,
                    pais: true,
                    esAnonimo: true,
                    edadVictima: true,
                    ciudadRel: { select: { nombre: true } },
                    clasificacion: { select: { categoria: true } },
                },
            }),
            // Perfil: si el identificador es una cuenta de un hijo del padre,
            // su edad entra a la lectura (brief §4.4 capa 1).
            prisma.hijo.findFirst({
                where: {
                    usuarioId: usuario.id,
                    estado: "activo",
                    identificadores: { some: { valor: expediente.identificadorReportado, activo: true } },
                },
                select: { nombre: true, anioNacimiento: true, sexo: true },
            }),
        ]);

        const hechos: HechoCapa1[] = [
            ...propios.map((r) => ({
                fecha: r.fechaIncidente,
                ciudad: r.ciudadRel?.nombre ?? r.ciudad,
                pais: r.pais,
                clasificacion: r.clasificacion?.categoria ?? null,
                esPropio: true,
                esAnonimo: false,
                edadReportada: r.edadVictima ?? null,
            })),
            ...ajenos.map((r) => ({
                fecha: r.fechaIncidente,
                ciudad: r.ciudadRel?.nombre ?? r.ciudad,
                pais: r.pais,
                clasificacion: r.clasificacion?.categoria ?? null,
                esPropio: false,
                esAnonimo: r.esAnonimo,
                edadReportada: r.edadVictima ?? null,
            })),
        ];

        const lectura = lecturaCapa1(hechos);

        return NextResponse.json({
            lectura,
            hijoCruzado: hijoCruzado
                ? {
                      // Solo el primer nombre (PII mínima) y los datos del perfil.
                      nombre: hijoCruzado.nombre.split(" ")[0],
                      anioNacimiento: hijoCruzado.anioNacimiento,
                      sexo: hijoCruzado.sexo,
                  }
                : null,
        });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        logger.error("[LECTURA] Error calculando la capa 1:", error);
        return NextResponse.json(
            { error: { message: safeErrorMessage(error), code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
