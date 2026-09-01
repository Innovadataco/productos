/**
 * SPEC-344 (A-69 · C1) — POST /api/colegio/carga-profesores/validar.
 *
 * Dry-run: parsea el archivo (CSV/XLSX), valida contra las reglas de negocio
 * (identidad ya existente, sexo/año inválidos, tipo de documento inactivo),
 * y devuelve un resumen + token firmado (JWT 15 min) que ampara la confirmación.
 *
 * El roster (las filas "crear" normalizadas) vive server-side vía
 * `CargaRosterSesion` — PII de profesores NUNCA viaja en el JWT.
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { parseArchivoCargaProfesores } from "@/lib/colegio/carga-profesores/parser";
import { validarFilasProfesores } from "@/lib/colegio/carga-profesores/validator";
import { ProfesorRepository } from "@/lib/dal/repositories/profesor";
import { TipoDocumentoRepository } from "@/lib/dal/repositories/tipo-documento";
import { crearSesionRoster } from "@/lib/colegio/carga/sesion-roster";
import { generarTokenCarga } from "@/lib/colegio/carga/token";

function detectarExtension(nombreArchivo: string): "csv" | "xlsx" | null {
    const ext = nombreArchivo.split(".").pop()?.toLowerCase();
    if (ext === "csv") return "csv";
    if (ext === "xlsx" || ext === "xls") return "xlsx";
    return null;
}

export async function POST(request: Request) {
    try {
        const user = await verifyAuth("SCHOOL_ADMIN");

        if (!user.colegioId) {
            return NextResponse.json(
                { error: { message: "Este rector no tiene colegio asociado.", code: ERROR_CODES.CONFLICT } },
                { status: 409 },
            );
        }

        const rate = await checkRateLimit(request, "admin_write", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers },
            );
        }

        let formData: FormData;
        try {
            formData = await request.formData();
        } catch {
            return NextResponse.json(
                { error: { message: "Formulario inválido", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 },
            );
        }

        const archivo = formData.get("archivo");
        if (!archivo || typeof archivo !== "object" || !("arrayBuffer" in archivo)) {
            return NextResponse.json(
                { error: { message: "Debe enviar un archivo en el campo 'archivo'.", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 },
            );
        }

        const archivoBlob = archivo as Blob;
        const nombreArchivo = (archivo as File).name || archivoBlob.type || "";
        const extension = detectarExtension(nombreArchivo);
        if (!extension) {
            return NextResponse.json(
                { error: { message: "Formato no soportado. Use CSV o XLSX.", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 },
            );
        }

        const buffer = await archivoBlob.arrayBuffer();
        const parseado = await parseArchivoCargaProfesores(buffer, extension);
        if (parseado.errores.length > 0) {
            return NextResponse.json(
                {
                    valido: false,
                    resumen: { crear: 0, omitidos: 0, errores: parseado.errores.length },
                    filas: parseado.errores.map((e) => ({
                        estado: "error" as const,
                        linea: e.linea,
                        columna: e.columna,
                        razon: e.mensaje,
                    })),
                    token: null,
                },
                { status: 400 },
            );
        }

        // Cargamos catálogos y estado del colegio para validar.
        const tiposDoc = await new TipoDocumentoRepository().listarActivos();
        const tiposActivos = new Set(tiposDoc.map((t) => t.clave.toUpperCase()));

        const profesoresExistentes = await new ProfesorRepository().listarPorColegio(user.colegioId);
        const documentosEnBd = new Set(
            profesoresExistentes.map((p) => `${p.tipoDocumento.toUpperCase()}|${p.numeroDocumento.toUpperCase()}`),
        );

        const validacion = validarFilasProfesores(parseado.filas, { tiposDocumentoActivos: tiposActivos, documentosEnBd });

        const paraCrear = validacion.filas.filter((f): f is { estado: "crear"; linea: number; profesor: import("@/lib/colegio/carga-profesores/validator").ProfesorNormalizado } => f.estado === "crear")
            .map((f) => f.profesor);

        if (paraCrear.length === 0) {
            return NextResponse.json({
                valido: true,
                resumen: validacion.resumen,
                filas: validacion.filas,
                token: null,
            });
        }

        // Persistimos el roster con `crearSesionRoster` (reusa el modelo
        // CargaRosterSesion; JSON genérico) y firmamos su id.
        const sesionId = await crearSesionRoster(user.colegioId, paraCrear as never);
        const token = await generarTokenCarga({ sesionId, colegioId: user.colegioId });

        return NextResponse.json({
            valido: true,
            resumen: validacion.resumen,
            filas: validacion.filas,
            token,
        });
    } catch (error) {
        return errorToResponse(error, "[COLEGIO/CARGA-PROFESORES/VALIDAR]");
    }
}
