/**
 * SPEC-379 (PR B · D5a) — GET /api/colegio/carga-cursos/plantilla.
 *
 * Emite la plantilla oficial de carga masiva de cursos con TODAS las
 * columnas del validador + una fila de ejemplo válida. La cadena se toma
 * de `PLANTILLA_CURSOS_CSV` (fuente única — la MISMA que consume el test
 * autoconsistente que cierra el patrón I-245).
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { errorToResponse } from "@/lib/api-handler";
import { PLANTILLA_CURSOS_CSV } from "@/lib/colegio/carga-cursos/parser";

export async function GET() {
    try {
        await verifyAuth("SCHOOL_ADMIN");
        return new NextResponse(PLANTILLA_CURSOS_CSV, {
            status: 200,
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": 'attachment; filename="plantilla-cursos.csv"',
            },
        });
    } catch (error) {
        return errorToResponse(error, "[COLEGIO/CARGA-CURSOS/PLANTILLA]");
    }
}
