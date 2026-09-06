/**
 * SPEC-340 (A-68 §3.2) — POST /api/reportes/[id]/evento · «Agregar otro evento».
 *
 * El sistema YA SABE sobre qué está parado: nick, plataforma, país, ciudad y
 * edad se HEREDAN del reporte de la cadena EN SERVIDOR — el padre escribe solo
 * el texto y el día y la hora. (Hoy la vinculación existía pero re-pedía esos
 * datos: fricción exactamente donde el padre está más angustiado.)
 *
 * Por debajo reusa el alta completa (cifrado, número de seguimiento, estado
 * inicial, encolado del clasificador) con la vinculación de SPEC-137/#202
 * intacta, y escribe la CADENA (reportePrincipalId) como el alta normal.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES, safeErrorMessage } from "@/lib/errors";
import { checkRateLimit } from "@/lib/rate-limit";
import { withUnitOfWork } from "@/lib/dal/unit-of-work";
import { ReporteCreationService } from "@/lib/dal/services/reporte-creation";
import { sendReporte } from "@/lib/queue";
import { fechaIncidenteSchema } from "@/lib/validators";

const bodySchema = z.object({
    texto: z.string().trim().min(10, "Cuéntanos qué pasó").max(2000),
    // SPEC-513 (PA-21): la fecha del hecho reusa la regla CANÓNICA (incluye la
    // cota de futuro). Antes tenía un `Date.parse` propio que aceptaba futuro.
    fechaIncidente: fechaIncidenteSchema,
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const usuario = await verifyAuth("PARENT");
        const { id } = await params;

        const rate = await checkRateLimit(request, "reportes");
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Con calma: espera un momento antes de agregar otro evento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const parsed = bodySchema.safeParse(await request.json().catch(() => undefined));
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: parsed.error.issues[0]?.message ?? "Datos inválidos", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const { resultado, principalId } = await withUnitOfWork(async (tx) => {
            // El reporte base debe ser del padre. Puede ser el principal o un
            // evento: la herencia sale del PRINCIPAL (fuente única de la cadena).
            const base = await tx.reporte.findFirst({
                where: { id, usuarioId: usuario.id },
                select: { id: true, reportePrincipalId: true },
            });
            if (!base) return { resultado: null, principalId: null };

            const principalId = base.reportePrincipalId ?? base.id;
            const principal = await tx.reporte.findFirstOrThrow({
                where: { id: principalId },
                select: {
                    id: true,
                    identificador: true,
                    plataformaId: true,
                    otraPlataforma: true,
                    ciudad: true,
                    pais: true,
                    paisId: true,
                    ciudadId: true,
                    edadVictima: true,
                    tenantId: true,
                    creadoEn: true,
                },
            });

            // El más reciente de la cadena es el "previo" que la vinculación
            // acepta (findDuplicadoReciente devuelve el más reciente).
            const masReciente = await tx.reporte.findFirst({
                where: { OR: [{ id: principal.id }, { reportePrincipalId: principal.id }], usuarioId: usuario.id },
                orderBy: { creadoEn: "desc" },
                select: { id: true },
            });

            const servicio = new ReporteCreationService(tx);
            const resultado = await servicio.crear({
                identificador: principal.identificador,
                plataformaId: principal.plataformaId ?? "",
                plataformaClave: "",
                texto: parsed.data.texto,
                fechaIncidente: parsed.data.fechaIncidente,
                ciudad: principal.ciudad ?? "",
                pais: principal.pais ?? "",
                paisId: principal.paisId ?? undefined,
                ciudadId: principal.ciudadId ?? undefined,
                otraPlataforma: principal.otraPlataforma ?? undefined,
                edadVictima: principal.edadVictima ?? undefined,
                esAnonimo: false,
                usuarioId: usuario.id,
                origenRol: "PARENT",
                tenantId: principal.tenantId ?? null,
                estadoInicial: "PENDIENTE",
                prioridadAlta: true,
                keywordsDetectadas: [],
                reportePrevioId: masReciente?.id,
            });

            if (resultado.ok) {
                // La cadena se escribe SIEMPRE acá: la vinculación es EXPLÍCITA
                // (el padre está agregando A este reporte). El dedup de 30 días
                // no gobierna — el caso central del brief es "en dos o tres
                // meses hay un evento adicional", muy fuera de esa ventana.
                await tx.reporte.update({
                    where: { id: resultado.reporte.id },
                    data: { reportePrincipalId: principal.id },
                });
            }
            return { resultado, principalId: principal.id };
        });

        if (!principalId) {
            return NextResponse.json(
                { error: { message: "Reporte no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }
        if (!resultado || !resultado.ok) {
            // "duplicado" acá significa que el más reciente no cruzó la ventana
            // de dedup como esperábamos — improbable; error sereno.
            return NextResponse.json(
                { error: { message: "No pudimos guardar el evento. Intenta de nuevo.", code: ERROR_CODES.INTERNAL_ERROR } },
                { status: 500 }
            );
        }

        // Encolar el clasificador FUERA de la transacción, como el alta normal.
        try {
            await sendReporte(resultado.reporte.id, { prioridadAlta: true });
        } catch (err) {
            logger.error("[EVENTO] Encolado fallido (el worker de rescate lo tomará):", err);
        }

        return NextResponse.json(
            { reporte: { id: resultado.reporte.id, numeroSeguimiento: resultado.reporte.numeroSeguimiento }, principalId },
            { status: 201 }
        );
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        logger.error("[EVENTO] Error agregando evento a la cadena:", error);
        return NextResponse.json(
            { error: { message: safeErrorMessage(error), code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
