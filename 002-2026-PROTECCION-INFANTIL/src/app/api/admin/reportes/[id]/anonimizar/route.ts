import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { auditAnonimizacion } from "@/lib/audit";
import { generarEmbedding } from "@/lib/ai/embedder";
import { actualizarVisibilidadPublica } from "@/lib/visibility";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { z } from "zod";
import { idSchema } from "@/lib/validators";
import { registrarTransicion, responsableTipoFromRol } from "@/lib/reporte-transiciones";
import { encryptParameter, decryptParameter, isEncryptedValue } from "@/lib/param-encryption";

const anonimizarSchema = z.object({
    textoAnonimizado: z.string().min(20).max(5000),
});

function requireAdmin(user: { rol: string }) {
    if (String(user.rol) !== "ADMIN") {
        throw new AppError("Permisos insuficientes", ERROR_CODES.FORBIDDEN, 403);
    }
}

function obtenerTextoOriginalPlano(textoOriginalCifrado: string | null, textoActual: string): string {
    if (textoOriginalCifrado && isEncryptedValue(textoOriginalCifrado)) {
        return decryptParameter(textoOriginalCifrado);
    }
    return textoOriginalCifrado ?? textoActual;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth();
        await assertModulo(user, "bandeja_reportes");
        requireAdmin(user);

        const rate = await checkRateLimit(request, "admin_write", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas anonimizaciones. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
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
        const reporteId = parsedId.data;

        const body = await request.json();
        const parsed = anonimizarSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Datos inválidos", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const { textoAnonimizado } = parsed.data;

        const reporte = await prisma.reporte.findUnique({
            where: { id: reporteId },
            include: { clasificacion: true, embedding: true },
        });
        if (!reporte) {
            return NextResponse.json(
                { error: { message: "Reporte no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        if (reporte.eliminado) {
            return NextResponse.json(
                { error: { message: "No se puede anonimizar un reporte dado de baja", code: ERROR_CODES.CONFLICT } },
                { status: 409 }
            );
        }

        if (reporte.estado !== "REQUIERE_ANONIMIZACION") {
            return NextResponse.json(
                { error: { message: "El reporte no requiere anonimización", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const piiEliminada = reporte.clasificacion?.piiDetectada || [];

        const originalPlano = obtenerTextoOriginalPlano(reporte.textoOriginal, reporte.texto);
        let textoOriginalCifrado: string;
        try {
            textoOriginalCifrado = encryptParameter(originalPlano);
        } catch (err) {
            console.error("[ANONIMIZAR] Error cifrando texto original:", err);
            return NextResponse.json(
                { error: { message: "Error de seguridad almacenando el original", code: ERROR_CODES.INTERNAL_ERROR } },
                { status: 500 }
            );
        }

        const responsableTipo = responsableTipoFromRol(user.rol) ?? "ADMIN";

        // Transacción: registrar transición, preservar original cifrado y actualizar texto y estado
        await prisma.$transaction(async (tx) => {
            await registrarTransicion({
                reporteId,
                estadoAnterior: "REQUIERE_ANONIMIZACION",
                estadoNuevo: "CLASIFICADO",
                responsableTipo,
                responsableId: user.id,
                motivo: "Texto anonimizado por admin",
                tx,
            });
            await tx.reporte.update({
                where: { id: reporteId },
                data: {
                    textoOriginal: textoOriginalCifrado,
                    texto: textoAnonimizado,
                    estado: "CLASIFICADO",
                },
            });
        });

        // Regenerar embedding sobre texto anonimizado (best-effort)
        try {
            const paramEmbedding = await prisma.parametroSistema.findUnique({
                where: { clave: "reportes.embedding_model" },
            });
            const modeloEmbedding = paramEmbedding?.valor || "nomic-embed-text";
            const vector = await generarEmbedding(modeloEmbedding, textoAnonimizado);

            const vectorStr = "[" + vector.join(",") + "]";
            if (reporte.embedding) {
                await prisma.$executeRaw`
                    UPDATE "EmbeddingReporte"
                    SET vector = ${vectorStr}::vector, "modeloUsado" = ${modeloEmbedding}
                    WHERE "reporteId" = ${reporteId}
                `;
            } else {
                const embeddingId = crypto.randomUUID();
                await prisma.$executeRaw`
                    INSERT INTO "EmbeddingReporte" (id, "reporteId", vector, "modeloUsado", "creadoEn")
                    VALUES (${embeddingId}, ${reporteId}, ${vectorStr}::vector, ${modeloEmbedding}, NOW())
                `;
            }
        } catch (embedErr) {
            const msg = embedErr instanceof Error ? embedErr.message : String(embedErr);
            console.error("[ANONIMIZAR] Embedding falló (no crítico):", msg);
            // No fallamos la anonimización; el embedding se puede regenerar después
        }

        // Actualizar visibilidad pública del identificador tras clasificar
        await actualizarVisibilidadPublica(reporte.identificador, reporte.plataformaId);

        // Registrar auditoría (solo metadata, nunca texto)
        await auditAnonimizacion({
            request,
            usuarioId: user.id,
            reporteId,
            estadoAnterior: "REQUIERE_ANONIMIZACION",
            estadoNuevo: "CLASIFICADO",
        });

        return NextResponse.json({
            reporteId,
            estadoAnterior: "REQUIERE_ANONIMIZACION",
            estadoNuevo: "CLASIFICADO",
            textoAnonimizado,
            piiEliminada,
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