/**
 * SPEC-351 (T032) · GET /api/colegio/casos/[id]/informes/[hash]/pdf.
 *
 * El PDF no se retiene en disco (constitución §1.3d): se REGENERA desde el
 * snapshot de la fila y se verifica que el hash coincida con el registrado.
 * Si difiere (los datos del caso cambiaron el render), 409 — jamás entregar
 * un documento cuyo sello no verifica. Q-3: prisma solo en el DAL.
 */
import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { cargarCasoConHechos } from "@/lib/caso/hechos-caso";
import { generarPdfInformeCaso, type SeccionInforme } from "@/lib/caso/pdf-informe-caso";
import { leerEscudoDataUri } from "@/lib/colegio/escudo-storage";
import { cargarInformePorHash, cargarContextoInforme, formatearCorrelativo } from "@/lib/dal/services/informes-caso";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; hash: string }> }) {
    try {
        const user = await verifyAuth();
        if (user.rol !== "SCHOOL_ADMIN") {
            return NextResponse.json(
                { error: { message: "Permisos insuficientes", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }
        const { id, hash } = await params;

        const informe = await cargarInformePorHash(id, hash, user.id);
        if (!informe) {
            return NextResponse.json(
                { error: { message: "Informe no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        const [datos, contexto] = await Promise.all([
            cargarCasoConHechos(id),
            cargarContextoInforme(id, user.id),
        ]);
        if (!datos || !contexto) {
            return NextResponse.json(
                { error: { message: "Caso no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        const secciones = (Array.isArray(informe.seccionesJson) ? informe.seccionesJson : []) as SeccionInforme[];
        const correlativo = formatearCorrelativo(informe.anio, informe.numeroCorrelativo);
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://pi.innovadataco.com";

        const buffer = await generarPdfInformeCaso({
            colegio: { nombre: contexto.colegio.nombre, nit: contexto.colegio.nit },
            escudoDataUri: await leerEscudoDataUri(informe.escudoAssetKey),
            correlativo,
            fechaGeneracion: informe.generadoEn,
            tipoSujeto: contexto.caso.tipoSujeto,
            curso: contexto.caso.curso,
            secciones,
            hechos: datos.hechos,
            notas: contexto.notas,
            analisisComite: secciones.includes("analisis_comite") ? contexto.analisisComite : null,
            firmadoPorNombre: informe.firmadoPorNombre,
            firmadoPorDocumento: informe.firmadoPorDocumento,
            codigoVerificacion: informe.codigoVerificacion,
            urlVerificacion: `${baseUrl}/verificar/${informe.codigoVerificacion}`,
        });

        const hashActual = createHash("sha256").update(buffer).digest("hex");
        if (hashActual !== informe.pdfHash) {
            return NextResponse.json(
                { error: { message: "El caso cambió desde la generación — genere un informe nuevo", code: ERROR_CODES.CONFLICT } },
                { status: 409 }
            );
        }

        return new Response(new Uint8Array(buffer), {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="${correlativo}.pdf"`,
                "Content-Length": String(buffer.length),
                "Cache-Control": "no-store",
            },
        });
    } catch (error) {
        if (error instanceof AppError) return NextResponse.json(error.toJSON(), { status: error.statusCode });
        logger.error("[INFORME·CASO·PDF] error interno:", error);
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
