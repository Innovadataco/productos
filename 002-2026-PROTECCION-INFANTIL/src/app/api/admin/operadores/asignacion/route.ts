import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { esAdminRol } from "@/lib/operadores/permisos";
import { obtenerConfigAsignacion } from "@/lib/operadores/asignador";

export async function GET(req: Request) {
    try {
        const user = await verifyAuth("ADMIN");
        await assertModulo(user, "operadores");
        const rate = await checkRateLimit(req, "admin_read", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const [sinAsignar, operadoresRaw, distribucion, config] = await Promise.all([
            prisma.reporte.count({
                where: {
                    estado: "REVISION_MANUAL",
                    operadorId: null,
                    eliminado: false,
                },
            }),
            prisma.usuario.findMany({
                where: { rol: "OPERADOR", estado: "activo" },
                include: { perfilOperador: { select: { cupoMaximo: true, esRevisorDeApelaciones: true } } },
                orderBy: { creadoEn: "asc" },
            }),
            prisma.reporte.groupBy({
                by: ["operadorId"],
                where: {
                    estado: "REVISION_MANUAL",
                    eliminado: false,
                    operadorId: { not: null },
                },
                _count: { operadorId: true },
            }),
            obtenerConfigAsignacion(),
        ]);

        const casosPorOperador = new Map(distribucion.map((d) => [d.operadorId, d._count.operadorId]));

        const operadores = await Promise.all(
            operadoresRaw.map(async (op) => {
                const casosAbiertos = casosPorOperador.get(op.id) ?? 0;
                const cupo = op.perfilOperador?.cupoMaximo ?? config.cupoDefault;
                return {
                    id: op.id,
                    email: op.email,
                    nombre: op.nombre,
                    esRevisorDeApelaciones: op.perfilOperador?.esRevisorDeApelaciones ?? false,
                    casosAbiertos,
                    cupoMaximo: cupo,
                    libre: Math.max(0, cupo - casosAbiertos),
                };
            })
        );

        return NextResponse.json({
            sinAsignar,
            operadores,
            estrategia: config.estrategia,
            cupoDefault: config.cupoDefault,
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
