import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

        const colegio = user.colegioId
            ? await prisma.colegio.findUnique({
                  where: { id: user.colegioId },
                  include: {
                      pais: { select: { id: true, nombre: true } },
                      departamento: { select: { id: true, nombre: true } },
                      ciudad: { select: { id: true, nombre: true } },
                  },
              })
            : null;

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
