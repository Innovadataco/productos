/**
 * SPEC-379 (PR B · D5a) — POST /api/colegio/carga-cursos/validar.
 *
 * Dry-run: parsea el archivo (CSV/XLSX), valida contra el catálogo del colegio
 * (cursos existentes por (nombre, grado, año) y profesores por documento),
 * y devuelve resumen + token firmado (JWT 15 min) que ampara la confirmación.
 * El roster (los cursos "crear" normalizados) vive server-side vía
 * `CargaRosterSesion` — el JWT firma SOLO el id de sesión.
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { parseArchivoCargaCursos } from "@/lib/colegio/carga-cursos/parser";
import { validarFilasCursos } from "@/lib/colegio/carga-cursos/validator";
import { CursoRepository } from "@/lib/dal/repositories/curso";
import { ProfesorRepository } from "@/lib/dal/repositories/profesor";
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
        const parseado = await parseArchivoCargaCursos(buffer, extension);
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

        // Catálogos del colegio: cursos existentes (para el candado de
        // duplicado) y profesores activos por documento (para resolver
        // `profesor_titular_documento`).
        const cursosRepo = new CursoRepository();
        const cursosExistentes = await cursosRepo.listarPorColegio(user.colegioId, { incluirInactivos: true });
        const cursosEnBd = new Set(
            cursosExistentes.map((c) =>
                `${c.nombre.trim().toLowerCase()}|${(c.grado ?? "").trim()}|${(c.anioLectivo ?? "").trim()}`,
            ),
        );

        const profesores = await new ProfesorRepository().listarPorColegio(user.colegioId);
        const profesoresPorDocumento = new Map<string, string>();
        for (const p of profesores) {
            if (p.estado === "activo") {
                profesoresPorDocumento.set(p.numeroDocumento.trim().toUpperCase(), p.id);
            }
        }

        const validacion = validarFilasCursos(parseado.filas, { cursosEnBd, profesoresPorDocumento });
        const paraCrear = validacion.filas
            .filter((f): f is Extract<typeof f, { estado: "crear" }> => f.estado === "crear")
            .map((f) => f.curso);

        if (paraCrear.length === 0) {
            return NextResponse.json({
                valido: true,
                resumen: validacion.resumen,
                filas: validacion.filas,
                token: null,
            });
        }

        // Persistimos el roster con el helper compartido (fachada del
        // CargaRosterSesionRepository — la misma que usan alumnos y profesores).
        // El shape del roster de cursos se valida al LEER con `obtenerValidaCursos`
        // (Zod schema `filaCursoJsonSchema`). Q-3: nada de prisma directo acá.
        const sesionId = await crearSesionRoster(user.colegioId, paraCrear as never);
        const token = await generarTokenCarga({ sesionId, colegioId: user.colegioId });

        return NextResponse.json({
            valido: true,
            resumen: validacion.resumen,
            filas: validacion.filas,
            token,
        });
    } catch (error) {
        return errorToResponse(error, "[COLEGIO/CARGA-CURSOS/VALIDAR]");
    }
}
