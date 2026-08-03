import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { verificarVigenciaColegio } from "@/lib/colegio/vigencia";
import { COLUMNAS_REQUERIDAS, COLUMNA_OPCIONAL_APELLIDOS } from "@/lib/colegio/carga/parser";

// SPEC-144 (D4): la plantilla generada por la plataforma ya trae la columna de
// apellidos (opcional en el parser para no rechazar plantillas viejas).
const COLUMNAS_PLANTILLA = [
    ...COLUMNAS_REQUERIDAS.slice(0, 4),
    COLUMNA_OPCIONAL_APELLIDOS,
    ...COLUMNAS_REQUERIDAS.slice(4),
];

const FILA_EJEMPLO = [
    "6A - Matemáticas",
    "Sexto",
    "2026",
    "María",
    "Gómez Pérez",
    "telefono",
    "+573001234567",
    "ESTUDIANTE",
    "WhatsApp",
].join(",");

const CSV_PLANTILLA = [COLUMNAS_PLANTILLA.join(","), FILA_EJEMPLO].join("\n");

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
