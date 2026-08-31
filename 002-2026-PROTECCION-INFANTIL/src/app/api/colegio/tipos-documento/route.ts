/**
 * SPEC-320 (§2.3): tipos de documento ACTIVOS del catálogo, para poblar los
 * formularios de los tres sujetos (estudiante, profesor, comité) desde la fuente
 * única. Lectura para el rol de colegio (SCHOOL_ADMIN); el CRUD vive en /api/admin.
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { TipoDocumentoRepository } from "@/lib/dal/repositories/tipo-documento";

export async function GET(request: Request) {
    try {
        const user = await verifyAuth("SCHOOL_ADMIN");
        const rate = await checkRateLimit(request, "admin_read", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }
        const items = await new TipoDocumentoRepository().listarActivos();
        return NextResponse.json({ items });
    } catch (error) {
        return errorToResponse(error, "[COLEGIO/TIPOS-DOCUMENTO]");
    }
}
