import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { verificarVigenciaColegio } from "@/lib/colegio/vigencia";
import { DOCUMENTOS_CONFIANZA, leerDocumentoConfianza } from "@/lib/colegio/confianza-documentos";
import { AppError, ERROR_CODES } from "@/lib/errors";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

        const { searchParams } = new URL(request.url);
        const clave = searchParams.get("clave");

        if (!clave) {
            return NextResponse.json({ documentos: DOCUMENTOS_CONFIANZA });
        }

        const documento = await leerDocumentoConfianza(clave);
        if (!documento) {
            return NextResponse.json(
                { error: { message: "Documento no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        return NextResponse.json(documento);
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
