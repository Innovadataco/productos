import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { auditCorreccion, logAudit } from "@/lib/audit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { esAdminRol, puedeGestionarReporte } from "@/lib/operadores/permisos";
import { anonimizarTexto } from "@/lib/ai/anonimizador";
import { generarEmbedding } from "@/lib/ai/embedder";
import { publishDatasetAnonimizacionBackfill, publishDatasetEmbeddingBackfill } from "@/lib/queue";
import { registrarTransicion, responsableTipoFromRol } from "@/lib/reporte-transiciones";
import { z } from "zod";

type CategoriaConducta =
    | "CONTACTO_INSISTENTE"
    | "SOLICITUD_MATERIAL"
    | "OFRECIMIENTO_REGALOS"
    | "SUPLANTACION_IDENTIDAD"
    | "SOLICITUD_ENCUENTRO"
    | "COMPARTIMIENTO_SEXUAL"
    | "EXTORSION"
    | "CONTENIDO_GENERADO_IA"
    | "DIFUSION_NO_CONSENTIDA"
    | "DOXING"
    | "OTRO";

const correccionSchema = z.object({
    reporteId: z.string().min(1),
    categoriaCorregida: z.enum([
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
    ]),
    comentario: z.string().max(2000).optional(),
});

function requireOperadorOAdmin(user: { rol: string }) {
    if (!esAdminRol(user.rol) && user.rol !== "OPERADOR") {
        throw new AppError("Permisos insuficientes", ERROR_CODES.FORBIDDEN, 403);
    }
}

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

export async function POST(request: Request) {
    try {
        const user = await verifyAuth();
        await assertModulo(user, "bandeja_reportes");
        requireOperadorOAdmin(user);

        const rate = await checkRateLimit(request, "admin_write", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas correcciones. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const body = await request.json();
        const parsed = correccionSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Datos inválidos", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const { reporteId, categoriaCorregida, comentario } = parsed.data;

        const reporte = await prisma.reporte.findUnique({
            where: { id: reporteId },
            include: { clasificacion: true },
        });
        if (!reporte) {
            return NextResponse.json(
                { error: { message: "Reporte no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        if (!puedeGestionarReporte(user, reporte)) {
            return NextResponse.json(
                { error: { message: "No tienes permiso para gestionar este caso", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        if (reporte.eliminado) {
            return NextResponse.json(
                { error: { message: "No se puede corregir un reporte dado de baja", code: ERROR_CODES.CONFLICT } },
                { status: 409 }
            );
        }

        const categoriaAnterior = reporte.clasificacion?.categoria || "OTRO";

        const correccionExistente = await prisma.correccionAdmin.findUnique({
            where: { clasificacionId: reporte.clasificacion!.id },
        });
        if (correccionExistente) {
            return NextResponse.json(
                { error: { message: "Este reporte ya fue confirmado o corregido", code: ERROR_CODES.CONFLICT } },
                { status: 409 }
            );
        }

        // Guardar corrección usando Prisma ORM
        const correccion = await prisma.correccionAdmin.create({
            data: {
                clasificacionId: reporte.clasificacion!.id,
                categoriaOriginal: categoriaAnterior,
                categoriaCorregida: categoriaCorregida,
                adminId: user.id,
                motivo: comentario || null,
            },
        });

        // Actualizar clasificación con la corrección
        if (reporte.clasificacion) {
            await prisma.clasificacionIA.update({
                where: { reporteId },
                data: {
                    categoria: categoriaCorregida,
                    confianza: 1.0,
                },
            });
        }

        // Actualizar estado del reporte y registrar transición atómicamente
        const estadoAnterior = reporte.estado;
        const responsableTipo = responsableTipoFromRol(user.rol) ?? "ADMIN";
        await prisma.$transaction(async (tx) => {
            await registrarTransicion({
                reporteId,
                estadoAnterior,
                estadoNuevo: "CORREGIDO",
                responsableTipo,
                responsableId: user.id,
                motivo: comentario || "Caso corregido por operador/admin",
                tx,
            });
            await tx.reporte.update({
                where: { id: reporteId },
                data: { estado: "CORREGIDO" },
            });
        });

        // Registrar auditoría (solo metadata, nunca texto)
        await auditCorreccion({
            request,
            usuarioId: user.id,
            reporteId,
            categoriaOriginal: categoriaAnterior as import("@prisma/client").CategoriaConducta,
            categoriaCorregida: categoriaCorregida as import("@prisma/client").CategoriaConducta,
        });

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "CASO_CORREGIDO",
            tipoRecurso: "Reporte",
            recursoId: reporteId,
            usuarioId: user.id,
            valorAnterior: JSON.stringify({ estado: reporte.estado, categoria: categoriaAnterior }),
            valorNuevo: JSON.stringify({ estado: "CORREGIDO", categoria: categoriaCorregida }),
            ipAddress,
            userAgent,
        });

        // Preparar texto seguro para el dataset de entrenamiento.
        // Si el reporte ya fue anonimizado previamente, su campo `texto` es seguro.
        // Si no, y la clasificación indica PII, forzamos anonimización antes de guardar.
        let textoDataset = reporte.texto;
        let datasetAnonimizado = false;
        let requiereBackfill = false;
        try {
            if (reporte.textoOriginal !== null) {
                // El texto ya fue anonimizado en el flujo de procesamiento.
                textoDataset = reporte.texto;
                datasetAnonimizado = true;
            } else if (reporte.clasificacion?.contienePii) {
                const paramModelo = await prisma.parametroSistema.findUnique({
                    where: { clave: "reportes.classification_model" },
                });
                const modelo = paramModelo?.valor || process.env.IA_MODEL_ANONIMIZACION || "ornith:9b";
                const resultado = await anonimizarTexto(modelo, reporte.texto);
                textoDataset = resultado.textoAnonimizado;
                datasetAnonimizado = true;
            }
        } catch (err) {
            console.error("[CORRECCION] Fallo anonimización para dataset, guardando texto sin anonimizar y encolando backfill:", err);
            textoDataset = reporte.texto;
            datasetAnonimizado = false;
            requiereBackfill = true;
        }

        // Guardar en dataset de entrenamiento
        const datasetRegistro = await prisma.datasetEntrenamiento.create({
            data: {
                texto: textoDataset,
                clasificacionCorrecta: categoriaCorregida,
                fuente: "correccion_admin",
                correccionId: correccion.id,
                textoAnonimizado: datasetAnonimizado,
            },
        });

        if (requiereBackfill) {
            try {
                await publishDatasetAnonimizacionBackfill(datasetRegistro.id);
            } catch (queueErr) {
                console.error("[CORRECCION] No se pudo encolar backfill de anonimización:", queueErr);
            }
        }

        // Generar embedding para RAG (F5). Si falla, no bloquear la corrección.
        try {
            const paramEmbedding = await prisma.parametroSistema.findUnique({
                where: { clave: "reportes.embedding_model" },
            });
            const modeloEmbedding = paramEmbedding?.valor || "nomic-embed-text";
            const vector = await generarEmbedding(modeloEmbedding, datasetRegistro.texto);
            const vectorStr = "[" + vector.join(",") + "]";
            await prisma.$executeRaw`
                INSERT INTO "EmbeddingDataset" (id, "datasetId", vector, "modeloUsado", "creadoEn")
                VALUES (${crypto.randomUUID()}, ${datasetRegistro.id}, ${vectorStr}::vector, ${modeloEmbedding}, NOW())
            `;
        } catch (embedErr) {
            console.error("[CORRECCION] Fallo embedding para dataset, encolando backfill:", embedErr);
            try {
                await publishDatasetEmbeddingBackfill(datasetRegistro.id);
            } catch (queueErr) {
                console.error("[CORRECCION] No se pudo encolar backfill de embedding:", queueErr);
            }
        }

        return NextResponse.json({
            reporteId,
            categoriaAnterior,
            categoriaCorregida,
            estado: "CORREGIDO",
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