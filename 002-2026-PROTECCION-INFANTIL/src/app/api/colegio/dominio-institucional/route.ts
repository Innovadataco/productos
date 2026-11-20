/**
 * SPEC-958 (M5a) · GET /api/colegio/dominio-institucional
 *
 * Devuelve el dominio institucional del colegio para preseleccionarlo en el campo
 * de correo del PROFESOR (paso 3 del camino). El dominio sale del correo del rector
 * (`Colegio.representanteLegalEmail`) SOLO si NO es genérico (`dominioInstitucionalDe`);
 * si es genérico o falta, devuelve `null` → el campo cae a comunes + «Otro», sin
 * inventar nada. Solo SCHOOL_ADMIN (el campo vive dentro del camino del colegio).
 *
 * El servidor NO deriva el dominio del NOMBRE del colegio (no da dominio confiable):
 * la fuente es el correo del rector, verificado en el alta.
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { ColegioRepository } from "@/lib/dal/repositories/colegio";
import { dominioInstitucionalDe } from "@/lib/email-typo";
import { AppError, ERROR_CODES, safeErrorMessage } from "@/lib/errors";

export async function GET() {
    try {
        const user = await verifyAuth("SCHOOL_ADMIN");
        if (!user.colegioId) {
            return NextResponse.json({ dominioInstitucional: null });
        }
        const email = await new ColegioRepository().obtenerRepresentanteEmail(user.colegioId);
        return NextResponse.json({ dominioInstitucional: dominioInstitucionalDe(email) });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        return NextResponse.json(
            { error: { message: safeErrorMessage(error), code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 },
        );
    }
}
