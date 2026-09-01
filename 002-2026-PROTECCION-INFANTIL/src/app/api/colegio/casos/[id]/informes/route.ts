/**
 * SPEC-351 (A-69 · C5 · T031) · POST/GET /api/colegio/casos/[id]/informes.
 *
 * POST: genera el informe firmado — el correlativo se decide bajo advisory-lock
 * DENTRO de la transacción del DAL, el PDF se renderiza con ese correlativo y
 * el hash del BUFFER FINAL queda registrado (contrato de sello SPEC-234).
 * GET: historial inmutable del caso.
 *
 * Boundary: SCHOOL_ADMIN del colegio del caso (el comité asesora, el rector firma).
 * Q-3: prisma no sale del DAL — todo pasa por informes-caso.ts.
 * FR-004-bis: los hechos vienen de cargarCasoConHechos (SPEC-350, blindados);
 * las notas son texto propio del colegio; jamás texto/identidad del denunciante.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes, createHash } from "node:crypto";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { cargarCasoConHechos } from "@/lib/caso/hechos-caso";
import { generarPdfInformeCaso, type SeccionInforme } from "@/lib/caso/pdf-informe-caso";
import { leerEscudoDataUri } from "@/lib/colegio/escudo-storage";
import {
    cargarContextoInforme,
    generarYRegistrarInforme,
    listarInformesCaso,
    anioBogota,
} from "@/lib/dal/services/informes-caso";

const bodySchema = z.object({
    secciones: z.array(z.enum(["hechos", "actuacion", "analisis_comite", "contexto_curso"])).min(1),
});

async function guardRector() {
    const user = await verifyAuth();
    if (user.rol !== "SCHOOL_ADMIN") {
        throw new AppError("Permisos insuficientes", ERROR_CODES.FORBIDDEN, 403);
    }
    return user;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await guardRector();
        const { id } = await params;
        const parsed = bodySchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Secciones inválidas", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }
        const secciones = parsed.data.secciones as SeccionInforme[];

        const contexto = await cargarContextoInforme(id, user.id);
        if (!contexto) {
            return NextResponse.json(
                { error: { message: "Caso no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }
        if (!contexto.rector) {
            return NextResponse.json(
                { error: { message: "Complete su nombre y documento en el perfil antes de firmar informes", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const datos = await cargarCasoConHechos(id);
        if (!datos) {
            return NextResponse.json(
                { error: { message: "Caso no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        // Sello (contrato SPEC-234): código ANTES del render.
        const codigoVerificacion = randomBytes(8).toString("hex");
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://pi.innovadataco.com";
        const escudoDataUri = await leerEscudoDataUri(contexto.colegio.escudoAssetKey);
        const fechaGeneracion = new Date();

        const resultado = await generarYRegistrarInforme({
            casoId: id,
            anio: anioBogota(),
            firmadoPorId: contexto.rector.id,
            firmadoPorNombre: contexto.rector.nombre,
            firmadoPorDocumento: contexto.rector.documento,
            codigoVerificacion,
            escudoAssetKey: contexto.colegio.escudoAssetKey,
            secciones,
            render: (correlativo) => generarPdfInformeCaso({
                colegio: { nombre: contexto.colegio.nombre, nit: contexto.colegio.nit },
                escudoDataUri,
                correlativo,
                fechaGeneracion,
                tipoSujeto: contexto.caso.tipoSujeto,
                curso: contexto.caso.curso,
                secciones,
                hechos: datos.hechos,
                notas: contexto.notas,
                analisisComite: secciones.includes("analisis_comite") ? contexto.analisisComite : null,
                firmadoPorNombre: contexto.rector!.nombre,
                firmadoPorDocumento: contexto.rector!.documento,
                codigoVerificacion,
                urlVerificacion: `${baseUrl}/verificar/${codigoVerificacion}`,
            }),
            hashDelBuffer: (buffer) => createHash("sha256").update(buffer).digest("hex"),
        });

        return new Response(new Uint8Array(resultado.buffer), {
            status: 201,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="${resultado.correlativo}.pdf"`,
                "Content-Length": String(resultado.buffer.length),
                "Cache-Control": "no-store",
                "X-Informe-Id": resultado.id,
                "X-Informe-Correlativo": resultado.correlativo,
                "X-Informe-Hash": resultado.pdfHash,
                ...(contexto.colegio.escudoAssetKey ? {} : { "X-Aviso-Escudo": "sin-escudo" }),
            },
        });
    } catch (error) {
        if (error instanceof AppError) return NextResponse.json(error.toJSON(), { status: error.statusCode });
        logger.error("[INFORME·CASO·POST] error interno:", error);
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await guardRector();
        const { id } = await params;
        const contexto = await cargarContextoInforme(id, user.id);
        if (!contexto) {
            return NextResponse.json(
                { error: { message: "Caso no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }
        const informes = await listarInformesCaso(id);
        return NextResponse.json({
            informes: informes.map((i) => ({
                id: i.id,
                correlativo: i.correlativo,
                generadoEn: i.generadoEn.toISOString(),
                firmadoPorNombre: i.firmadoPorNombre,
                codigoVerificacion: i.codigoVerificacion,
            })),
        }, { status: 200 });
    } catch (error) {
        if (error instanceof AppError) return NextResponse.json(error.toJSON(), { status: error.statusCode });
        logger.error("[INFORME·CASO·GET] error interno:", error);
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
