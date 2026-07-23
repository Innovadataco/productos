import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { idSchema } from "@/lib/validators";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { darDeBajaReporte } from "@/lib/reporte-lifecycle";
import { registrarTransicion, responsableTipoFromRol } from "@/lib/reporte-transiciones";
import { esAdminRol, esOperadorRol } from "@/lib/operadores/permisos";
import { generarEmbedding } from "@/lib/ai/embedder";
import { z } from "zod";
import type { CategoriaConducta } from "@prisma/client";

const resolverSpamSchema = z.object({
    esSpam: z.boolean(),
    categoria: z.string().optional(),
    motivo: z.string().max(2000).optional(),
});

const CATEGORIAS_VALIDAS: CategoriaConducta[] = [
    "CONTACTO_INSISTENTE",
    "SOLICITUD_MATERIAL",
    "OFRECIMIENTO_REGALOS",
    "SUPLANTACION_IDENTIDAD",
    "SOLICITUD_ENCUENTRO",
    "COMPARTIMIENTO_SEXUAL",
    "EXTORSION",
    "CONTENIDO_GENERADO_IA",
    "DIFUSION_NO_CONSENTIDA",
    "DOXING",
    "OTRO",
];

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth();
        await assertModulo(user, "anti_abuso");
        if (!esAdminRol(user.rol) && !esOperadorRol(user.rol)) {
            return NextResponse.json(
                { error: { message: "Solo el operador asignado o un admin puede resolver", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const rate = await checkRateLimit(request, "admin_write", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas resoluciones. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
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

        const body = await request.json();
        const parsedBody = resolverSpamSchema.safeParse(body);
        if (!parsedBody.success) {
            return NextResponse.json(
                { error: { message: "Datos inválidos", code: ERROR_CODES.VALIDATION_ERROR, details: parsedBody.error.format() } },
                { status: 400 }
            );
        }
        const { esSpam, categoria, motivo } = parsedBody.data;

        const reporte = await prisma.reporte.findUnique({
            where: { id },
            include: { clasificacion: true },
        });
        if (!reporte) {
            return NextResponse.json(
                { error: { message: "Reporte no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        const estadoValido =
            reporte.estado === "POSIBLE_SPAM" ||
            (reporte.estado === "REVISION_MANUAL" && reporte.clasificacion?.categoria === "SPAM");
        if (!estadoValido) {
            return NextResponse.json(
                { error: { message: "El reporte no está en revisión de spam", code: "INVALID_STATE" } },
                { status: 400 }
            );
        }

        if (reporte.eliminado) {
            return NextResponse.json(
                { error: { message: "El reporte ya fue dado de baja", code: ERROR_CODES.CONFLICT } },
                { status: 409 }
            );
        }

        if (user.rol === "OPERADOR" && reporte.operadorId !== user.id) {
            return NextResponse.json(
                { error: { message: "Solo el operador asignado o un admin puede resolver", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const responsableTipo = responsableTipoFromRol(user.rol) ?? "ADMIN";

        if (esSpam) {
            await prisma.$transaction(async (tx) => {
                await darDeBajaReporte({
                    reporteId: id,
                    motivo: "RETIRO_LIMPIEZA",
                    nota: motivo || "Confirmado como spam por operador",
                    adminId: user.id,
                    tx,
                    accionAudit: "CASO_DADO_DE_BAJA",
                });

                const dataset = await tx.datasetEntrenamiento.create({
                    data: {
                        texto: reporte.texto,
                        clasificacionCorrecta: "SPAM",
                        fuente: "spam_revisado",
                        textoAnonimizado: true,
                    },
                });

                try {
                    const paramEmbedding = await tx.parametroSistema.findUnique({
                        where: { clave: "reportes.embedding_model" },
                    });
                    const modeloEmbedding = paramEmbedding?.valor || "nomic-embed-text";
                    const vector = await generarEmbedding(modeloEmbedding, reporte.texto);
                    const vectorStr = "[" + vector.join(",") + "]";
                    await tx.$executeRaw`
                        INSERT INTO "EmbeddingDataset" (id, "datasetId", vector, "modeloUsado", "creadoEn")
                        VALUES (${crypto.randomUUID()}, ${dataset.id}, ${vectorStr}::vector, ${modeloEmbedding}, NOW())
                    `;
                } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    console.warn(`[SPAM] No se pudo generar embedding para ejemplo spam: ${msg}`);
                }
            });

            return NextResponse.json({
                reporteId: id,
                estado: "DADO_DE_BAJA",
                motivoBaja: "RETIRO_LIMPIEZA",
                datasetRegistrado: true,
            });
        }

        // Reporte válido: corregir categoría y pasar a CLASIFICADO
        const categoriaFinal = categoria ?? "OTRO";
        if (!CATEGORIAS_VALIDAS.includes(categoriaFinal as CategoriaConducta)) {
            return NextResponse.json(
                { error: { message: "Categoría inválida", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        await prisma.$transaction(async (tx) => {
            if (reporte.clasificacion) {
                await tx.correccionAdmin.create({
                    data: {
                        clasificacionId: reporte.clasificacion.id,
                        categoriaOriginal: "SPAM",
                        categoriaCorregida: categoriaFinal as CategoriaConducta,
                        adminId: user.id,
                        motivo: motivo || "Reporte válido revisado como spam",
                        confirmada: true,
                    },
                });
            }

            await registrarTransicion({
                reporteId: id,
                estadoAnterior: reporte.estado,
                estadoNuevo: "CLASIFICADO",
                responsableTipo,
                responsableId: user.id,
                motivo: `Reporte marcado como válido (${categoriaFinal}) tras revisión de spam`,
                tx,
            });

            await tx.reporte.update({
                where: { id },
                data: { estado: "CLASIFICADO" },
            });
        });

        return NextResponse.json({
            reporteId: id,
            estado: "CLASIFICADO",
            categoria: categoriaFinal,
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
