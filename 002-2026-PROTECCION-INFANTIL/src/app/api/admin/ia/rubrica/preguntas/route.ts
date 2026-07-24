import { NextResponse } from "next/server";
import { CategoriaConducta, RolUsuario } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { getParametroSistema } from "@/lib/parametros";
import { logAudit } from "@/lib/audit";
import { invalidateCache } from "@/lib/config-cache";
import { RUBRICA_SEMILLA, type SetsRubrica } from "@/lib/ai/rubrica-semilla";
import { AppError, ERROR_CODES } from "@/lib/errors";

const CLAVE_PREGUNTAS = "ia.rubrica.preguntas";

const preguntasBodySchema = z.object({
    categoria: z.enum(CategoriaConducta),
    preguntas: z
        .array(
            z.object({
                texto: z.string().min(10, "Cada pregunta debe tener al menos 10 caracteres").max(300, "Máximo 300 caracteres por pregunta"),
                activo: z.boolean(),
            })
        )
        .min(1, "El set debe tener al menos 1 pregunta")
        .max(10, "Máximo 10 preguntas por categoría"),
});

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

/**
 * PUT /api/admin/ia/rubrica/preguntas — reemplaza el set de preguntas de UNA
 * categoría dentro del JSON `ia.rubrica.preguntas` (lee-modifica-escribe).
 */
export async function PUT(request: Request) {
    try {
        const user = await verifyAuth(RolUsuario.ADMIN);
        await assertModulo(user, "ia_rubrica");

        const body = await request.json();
        const parsed = preguntasBodySchema.safeParse(body);
        if (!parsed.success) {
            const first = parsed.error.issues[0];
            throw new AppError(first?.message || "Datos inválidos", ERROR_CODES.VALIDATION_ERROR, 400);
        }
        const { categoria, preguntas } = parsed.data;

        const param = await getParametroSistema(CLAVE_PREGUNTAS);
        let sets: SetsRubrica;
        if (param) {
            try {
                sets = JSON.parse(param.valor) as SetsRubrica;
            } catch {
                throw new AppError("El parámetro ia.rubrica.preguntas tiene JSON inválido", ERROR_CODES.INTERNAL_ERROR, 500);
            }
        } else {
            sets = RUBRICA_SEMILLA;
        }

        const valorAnteriorCategoria = JSON.stringify(sets[categoria] ?? []);
        sets = { ...sets, [categoria]: preguntas };
        const valorNuevo = JSON.stringify(sets);

        const guardado = param
            ? await prisma.parametroSistema.update({
                  where: { clave: CLAVE_PREGUNTAS },
                  data: { valor: valorNuevo, actualizadoPorId: user.id },
              })
            : await prisma.parametroSistema.create({
                  data: {
                      clave: CLAVE_PREGUNTAS,
                      valor: valorNuevo,
                      tipo: "JSON",
                      categoria: "SYSTEM",
                      esPublico: false,
                      actualizadoPorId: user.id,
                  },
              });

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "PARAM_UPDATE",
            tipoRecurso: "parametro",
            recursoId: guardado.id,
            parametroId: guardado.id,
            usuarioId: user.id,
            valorAnterior: valorAnteriorCategoria,
            valorNuevo: JSON.stringify(preguntas),
            metadatos: { clave: CLAVE_PREGUNTAS, categoria },
            ipAddress,
            userAgent,
        });

        invalidateCache("public_params");

        return NextResponse.json({ categoria, preguntas });
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
