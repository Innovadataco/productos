import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { verificarVigenciaColegio } from "@/lib/colegio/vigencia";
import { getParametroSistemaValor } from "@/lib/parametros";
import { parseArchivoCarga } from "@/lib/colegio/carga/parser";
import { validarFilasCarga } from "@/lib/colegio/carga/validator";
import { generarTokenCarga } from "@/lib/colegio/carga/token";

const DEFAULT_MAX_FILAS = 500;

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
        const vigencia = await verificarVigenciaColegio(user.id);
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
        const parseado = parseArchivoCarga(buffer, extension);

        if (parseado.errores.length > 0) {
            return NextResponse.json(
                {
                    valido: false,
                    totalFilas: 0,
                    filasValidas: 0,
                    errores: parseado.errores,
                    tokenConfirmacion: null,
                    resumen: null,
                },
                { status: 400 }
            );
        }

        const maxFilasRaw = await getParametroSistemaValor("colegio.carga.max_filas");
        const maxFilas = maxFilasRaw ? parseInt(maxFilasRaw, 10) : DEFAULT_MAX_FILAS;
        if (Number.isNaN(maxFilas) || maxFilas <= 0) {
            return NextResponse.json(
                { error: { message: "Configuración de límite de filas inválida", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        if (parseado.filas.length > maxFilas) {
            return NextResponse.json(
                {
                    error: {
                        message: `El archivo excede el límite de ${maxFilas} filas`,
                        code: ERROR_CODES.VALIDATION_ERROR,
                    },
                },
                { status: 400 }
            );
        }

        const plataformas = await prisma.plataforma.findMany({
            where: { esActiva: true },
            select: { id: true, nombre: true },
        });
        const plataformasMap = new Map(plataformas.map((p) => [p.nombre.toLowerCase(), p.id]));

        const validacion = validarFilasCarga(parseado.filas, plataformasMap);

        if (validacion.errores.length > 0) {
            return NextResponse.json({
                valido: false,
                totalFilas: parseado.filas.length,
                filasValidas: validacion.filasValidas.length,
                errores: validacion.errores,
                tokenConfirmacion: null,
                resumen: null,
            });
        }

        const token = await generarTokenCarga({ filas: validacion.filasValidas, colegioId: user.colegioId });

        return NextResponse.json({
            valido: true,
            totalFilas: parseado.filas.length,
            filasValidas: validacion.filasValidas.length,
            errores: [],
            tokenConfirmacion: token,
            resumen: validacion.resumen,
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
