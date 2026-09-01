/**
 * SPEC-344 (A-69 · C1 · FR-026-bis) — GET /api/colegio/carga-profesores/plantilla.
 *
 * Emite la plantilla oficial de carga con TODAS las columnas obligatorias
 * (`COLUMNAS_PROFESOR`) + una fila de ejemplo válida. El CSV se genera desde
 * la MISMA constante que consume el validador (fuente única — cierra el
 * patrón de I-245 para profesores).
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { errorToResponse } from "@/lib/api-handler";
import { PLANTILLA_PROFESORES_CSV } from "@/lib/colegio/carga-profesores/parser";

export async function GET() {
    try {
        await verifyAuth("SCHOOL_ADMIN");
        return new NextResponse(PLANTILLA_PROFESORES_CSV, {
            status: 200,
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": 'attachment; filename="plantilla-profesores.csv"',
            },
        });
    } catch (error) {
        return errorToResponse(error, "[COLEGIO/CARGA-PROFESORES/PLANTILLA]");
    }
}
