import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { verificarVigenciaColegioSalvoCamino } from "@/lib/colegio/vigencia-camino";
import { COLUMNAS_REQUERIDAS, COLUMNA_OPCIONAL_APELLIDOS, COLUMNAS_OPCIONALES_DOCUMENTO, COLUMNAS_OPCIONALES_ACUDIENTE } from "@/lib/colegio/carga/parser";

/**
 * SPEC-146 (FR-003) — GET /api/colegio/cursos/unificado/plantilla: plantilla de
 * la lista del wizard. Mismas columnas base de la plantilla de carga (los
 * archivos que la secretaría ya tiene sirven tal cual) MÁS las 4 columnas
 * opcionales de acudiente. La genera la plataforma (nunca el usuario a mano).
 * Terminología §3: el archivo se llama "lista de estudiantes" (nunca "carga").
 */
const COLUMNAS_PLANTILLA = [
    ...COLUMNAS_REQUERIDAS.slice(0, 4),
    COLUMNA_OPCIONAL_APELLIDOS,
    ...COLUMNAS_OPCIONALES_DOCUMENTO, // SPEC-320 (§2.2-bis): documento del alumno
    ...COLUMNAS_REQUERIDAS.slice(4),
    ...COLUMNAS_OPCIONALES_ACUDIENTE,
];

const FILA_EJEMPLO = [
    "6A - Matemáticas",
    "Sexto",
    "2026",
    "María",
    "Gómez Pérez",
    "TI",
    "1020304050",
    "telefono",
    "+573001234567",
    "ESTUDIANTE",
    "WhatsApp",
    "Laura Gómez",
    "Madre",
    "+573101112131",
    "laura@example.com",
].join(",");

// SPEC-368 (A-74): se exporta para el test-candado autoconsistente. La plantilla
// de carga ya tenía el suyo desde I-245; esta —la del camino guiado, que es la
// que descarga el rector— no, y podía divergir de su validador sin que nadie se
// enterara hasta que un colegio subiera el archivo y no cargara ni una fila.
export const CSV_PLANTILLA_LISTA = [COLUMNAS_PLANTILLA.join(","), FILA_EJEMPLO].join("\n");

export async function GET(request: Request) {
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

        const rate = await checkRateLimit(request, "admin_read", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        return new NextResponse(CSV_PLANTILLA_LISTA, {
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": 'attachment; filename="plantilla-lista-estudiantes.csv"',
            },
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
