import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { PlataformaRepository } from "@/lib/dal/repositories/plataforma";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { verificarVigenciaColegioSalvoCamino } from "@/lib/colegio/vigencia-camino";
import { parseArchivoCarga } from "@/lib/colegio/carga/parser";
import { validarFilasUnificado } from "@/lib/colegio/unificado/validar-lista";

/**
 * SPEC-146 (FR-003) — POST /api/colegio/cursos/unificado/validar: dry-run de la
 * lista en Excel dentro del wizard. Reusa el parser del pipeline de carga
 * (mismos límites `carga.max_archivo_bytes` / `colegio.carga.max_filas`) y su
 * validator para las filas con identificador; responde
 * `{ filasValidas, problemas, resumen }` SIN persistir nada y SIN sesión roster
 * (stateless — las filas válidas vuelven al cliente y el guardado final las
 * re-valida con Zod, defensa en profundidad).
 *
 * Diferencia con el pipeline viejo: el identificador es OPCIONAL (en el wizard
 * es la sección 3) y el archivo NUNCA se rechaza entero por filas con
 * problemas — solo por errores de archivo (tamaño, encabezados, formato).
 */

function detectarExtension(nombreArchivo: string): "csv" | "xlsx" | null {
    const ext = nombreArchivo.split(".").pop()?.toLowerCase();
    if (ext === "csv") return "csv";
    if (ext === "xlsx" || ext === "xls") return "xlsx";
    return null;
}

export async function POST(request: Request) {
    try {
        const user = await verifyAuth("SCHOOL_ADMIN");
        await assertModulo(user, "colegios_gestion");
        const vigencia = await verificarVigenciaColegioSalvoCamino(user.id);
        if (!vigencia.vigente) {
            return NextResponse.json(
                { error: { message: vigencia.mensaje, code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const rate = await checkRateLimit(request, "admin_write", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        if (!user.colegioId) {
            return NextResponse.json(
                { error: { message: "Usuario no vinculado a un colegio", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        let formData: FormData;
        try {
            formData = await request.formData();
        } catch {
            return NextResponse.json(
                { error: { message: "Formulario inválido", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const archivo = formData.get("archivo");
        if (!archivo || typeof archivo !== "object" || !("arrayBuffer" in archivo)) {
            return NextResponse.json(
                { error: { message: "Debe enviar un archivo en el campo 'archivo'", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const archivoBlob = archivo as Blob;
        const nombreArchivo = (archivo as File).name || archivoBlob.type || "";
        const extension = detectarExtension(nombreArchivo);
        if (!extension) {
            return NextResponse.json(
                { error: { message: "Formato no soportado. Use CSV o XLSX", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const buffer = await archivoBlob.arrayBuffer();
        const parseado = await parseArchivoCarga(buffer, extension);

        // Errores de archivo (vacío, tamaño, filas, encabezados): no hay nada
        // que previsualizar — 400 con el primer motivo humano y el detalle.
        if (parseado.errores.length > 0) {
            return NextResponse.json(
                {
                    error: { message: parseado.errores[0].mensaje, code: ERROR_CODES.VALIDATION_ERROR },
                    problemas: parseado.errores,
                },
                { status: 400 }
            );
        }

        const plataformas = await new PlataformaRepository().findActivas();
        const plataformasMap = new Map(plataformas.map((p) => [p.nombre.toLowerCase(), p.id]));

        const resultado = validarFilasUnificado(parseado.filas, plataformasMap);

        return NextResponse.json({
            filasValidas: resultado.filasValidas,
            problemas: resultado.problemas,
            resumen: resultado.resumen,
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
