import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { verificarVigenciaColegio } from "@/lib/colegio/vigencia";
import {
    COLUMNAS_REQUERIDAS,
    COLUMNA_OPCIONAL_APELLIDOS,
    COLUMNAS_OPCIONALES_DOCUMENTO,
} from "@/lib/colegio/carga/parser";

// SPEC-344 (A-69 · C1 · FR-026-ter · I-245): la plantilla oficial DEBE traer
// TODAS las columnas obligatorias del validador — incluidas las de documento
// del alumno (obligatorias desde SPEC-320). El defecto anterior: la plantilla
// omitía `documento_tipo_alumno`/`documento_numero_alumno` y todo rector que
// la descargaba y la subía tal cual obtenía 0 filas válidas. Un test-candado
// (plantilla-autoconsistente) protege contra la regresión.
const COLUMNAS_PLANTILLA = [
    ...COLUMNAS_REQUERIDAS.slice(0, 4),
    COLUMNA_OPCIONAL_APELLIDOS,
    ...COLUMNAS_OPCIONALES_DOCUMENTO,
    ...COLUMNAS_REQUERIDAS.slice(4),
];

const FILA_EJEMPLO = [
    "6A - Matemáticas",
    "Sexto",
    "2026",
    "María",
    "Gómez Pérez",
    "CC",
    "1098552331",
    "telefono",
    "+573001234567",
    "ESTUDIANTE",
    "WhatsApp",
].join(",");

// Exportado para el test-candado plantilla-autoconsistente (SPEC-344 · I-245):
// la MISMA cadena que emite el endpoint alimenta el parser + validator en el
// test, garantizando que la plantilla no se desincronice del validador.
export const CSV_PLANTILLA_ALUMNOS = [COLUMNAS_PLANTILLA.join(","), FILA_EJEMPLO].join("\n");
const CSV_PLANTILLA = CSV_PLANTILLA_ALUMNOS;

export async function GET(request: Request) {
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

        const rate = await checkRateLimit(request, "admin_read", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        return new NextResponse(CSV_PLANTILLA, {
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": 'attachment; filename="plantilla-carga-alumnos.csv"',
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
