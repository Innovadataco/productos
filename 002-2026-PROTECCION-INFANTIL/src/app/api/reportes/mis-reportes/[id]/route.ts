import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { mapEstadoUsuario } from "@/lib/reporte-estados-usuario";
import { construirExplicacionPadre } from "@/lib/expediente/mensaje-padre";
import { formatPlataforma } from "@/lib/plataforma";
import { formatCategoria } from "@/lib/labels";
import { AppError, ERROR_CODES } from "@/lib/errors";

type RouteContext = { params: Promise<{ id: string }> };

/** Categorías internas que NUNCA se muestran al padre (spec 093-US2). */
const CATEGORIAS_OCULTAS = new Set(["SPAM", "OTRO"]);

function categoriasDeSecundarias(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    const cats: string[] = [];
    for (const item of value) {
        if (typeof item === "object" && item !== null) {
            const cat = (item as { categoria?: unknown }).categoria;
            if (typeof cat === "string") cats.push(cat);
        }
    }
    return cats;
}

/**
 * GET /api/reportes/mis-reportes/[id] — detalle PRIVADO del reporte (spec 090, US3;
 * contrato rehecho en spec 116). Solo el dueño (PARENT autenticado) puede verlo.
 *
 * El padre ve SOLO tres cosas: las conductas CONFIRMADAS (las que superaron el
 * umbral en el motor — la traza de votos ya no se lee aquí), qué significan
 * (plantilla determinista D-23, nunca salida cruda del modelo) y, en la UI, los
 * canales oficiales. La traza técnica completa (modelos, votos, porcentajes,
 * umbrales, categorías descartadas) es superficie del admin (D-22): vive en el
 * expediente de spec 096 y NUNCA sale por este endpoint.
 */
export async function GET(_request: Request, context: RouteContext) {
    try {
        const user = await verifyAuth("PARENT");
        const { id } = await context.params;

        const reporte = await prisma.reporte.findUnique({
            where: { id },
            include: {
                plataforma: { select: { nombre: true, clave: true } },
                clasificacion: true,
            },
        });

        if (!reporte || reporte.eliminado) {
            throw new AppError("Reporte no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }
        if (reporte.usuarioId !== user.id) {
            throw new AppError("Este reporte pertenece a otro usuario", ERROR_CODES.FORBIDDEN, 403);
        }

        const estadoUsuario = mapEstadoUsuario(reporte.estado);
        const reporteJson = {
            id: reporte.id,
            identificador: reporte.identificador,
            plataforma: formatPlataforma(reporte.plataforma.nombre, reporte.otraPlataforma, reporte.plataforma.clave),
            ciudad: reporte.ciudad,
            pais: reporte.pais,
            creadoEn: reporte.creadoEn.toISOString(),
            estadoVisual: estadoUsuario.estadoVisual,
            badge: estadoUsuario.badge,
            enProceso: estadoUsuario.enProceso,
        };

        const clasificacion = reporte.clasificacion;
        if (!clasificacion) {
            // Reporte pendiente/procesando: sin conductas todavía (no es error).
            return NextResponse.json({ reporte: reporteJson, clasificacion: null });
        }

        // Conductas CONFIRMADAS = principal + secundarias persistidas (el motor
        // ya guarda en secundarias SOLO las que superaron el umbral de presencia;
        // las descartadas quedan en ClasificacionRubricaVoto, que aquí no se lee).
        const confirmadas = [
            clasificacion.categoria,
            ...categoriasDeSecundarias(clasificacion.categoriasSecundarias),
        ].filter((cat, i, arr) => !CATEGORIAS_OCULTAS.has(cat) && arr.indexOf(cat) === i);

        return NextResponse.json({
            reporte: reporteJson,
            clasificacion: {
                conductas: confirmadas.map((cat) => ({ categoria: cat, label: formatCategoria(cat) })),
                mensaje: construirExplicacionPadre(confirmadas),
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
