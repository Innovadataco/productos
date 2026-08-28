import { NextResponse } from "next/server";
import { ParametroRepository } from "@/lib/dal/repositories/parametro";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { RolUsuario } from "@prisma/client";
import { AppError, ERROR_CODES } from "@/lib/errors";

export async function GET() {
    try {
        await assertModulo(await verifyAuth(RolUsuario.ADMIN), "configuracion_sistema");

        const items = await new ParametroRepository().findTodosOrdenados();

        const sanitizedItems = items.map((p) => ({
            ...p,
            valor: p.esSecreto ? null : p.valor,
        }));

        return NextResponse.json({ items: sanitizedItems });
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
