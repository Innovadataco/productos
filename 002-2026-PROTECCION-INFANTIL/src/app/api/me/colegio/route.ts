import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { ColegioRepository } from "@/lib/dal/repositories/colegio";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { verificarVigenciaColegio } from "@/lib/colegio/vigencia";

export async function GET() {
    try {
        const user = await verifyAuth("SCHOOL_ADMIN");
        const vigencia = await verificarVigenciaColegio(user.id);
        if (!vigencia.vigente) {
            return NextResponse.json(
                { error: { message: vigencia.mensaje, code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        // SPEC-134 (E-1): la consulta vive en el repo (tenant = propio colegio del usuario).
        const colegio = user.colegioId ? await new ColegioRepository().obtenerConUbicacion(user.colegioId) : null;

        if (!colegio) {
            return NextResponse.json(
                { error: { message: "No se encontró la información del colegio", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        return NextResponse.json({ colegio });
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
