import { NextResponse } from "next/server";
import { RolUsuario } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { logAudit } from "@/lib/audit";
import { invalidateCache } from "@/lib/config-cache";
import { AppError, ERROR_CODES } from "@/lib/errors";

const configBodySchema = z
    .object({
        modelos: z.array(z.string().min(1)).min(1, "Debe haber al menos 1 modelo").max(5, "Máximo 5 modelos").optional(),
        temperatura: z.number().min(0, "La temperatura mínima es 0").max(2, "La temperatura máxima es 2").optional(),
        umbralPresencia: z.number().min(0, "El umbral mínimo es 0").max(1, "El umbral máximo es 1").optional(),
        modeloEmbudo: z.string().min(1, "El modelo de embudo no puede estar vacío").max(100).optional(),
    })
    .refine((obj) => Object.values(obj).some((v) => v !== undefined), {
        message: "Debe enviar al menos un parámetro a actualizar",
    });

const CLAVES = {
    modelos: "ia.rubrica.modelos",
    temperatura: "ia.rubrica.temperatura",
    umbralPresencia: "ia.rubrica.umbral_presencia",
    modeloEmbudo: "ia.rubrica.modelo_embudo",
} as const;

const TIPOS = {
    modelos: "JSON",
    temperatura: "FLOAT",
    umbralPresencia: "FLOAT",
    modeloEmbudo: "STRING",
} as const;

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

/**
 * PATCH /api/admin/ia/rubrica/config — actualiza parámetros operativos de la
 * rúbrica (modelos, temperatura, umbral de presencia, modelo de embudo).
 */
export async function PATCH(request: Request) {
    try {
        const user = await verifyAuth(RolUsuario.ADMIN);
        await assertModulo(user, "ia_rubrica");

        const body = await request.json();
        const parsed = configBodySchema.safeParse(body);
        if (!parsed.success) {
            const first = parsed.error.issues[0];
            throw new AppError(first?.message || "Datos inválidos", ERROR_CODES.VALIDATION_ERROR, 400);
        }

        const cambios = parsed.data;
        const actualizados: Record<string, string> = {};
        const { ipAddress, userAgent } = getClientInfo(request);

        for (const campo of Object.keys(CLAVES) as Array<keyof typeof CLAVES>) {
            const valor = cambios[campo];
            if (valor === undefined) continue;

            const clave = CLAVES[campo];
            const valorStr = campo === "modelos" ? JSON.stringify(valor) : String(valor);

            const existing = await prisma.parametroSistema.findUnique({ where: { clave } });
            const guardado = existing
                ? await prisma.parametroSistema.update({
                      where: { clave },
                      data: { valor: valorStr, actualizadoPorId: user.id },
                  })
                : await prisma.parametroSistema.create({
                      data: {
                          clave,
                          valor: valorStr,
                          tipo: TIPOS[campo],
                          categoria: "SYSTEM",
                          esPublico: false,
                          actualizadoPorId: user.id,
                      },
                  });

            await logAudit({
                accion: "PARAM_UPDATE",
                tipoRecurso: "parametro",
                recursoId: guardado.id,
                parametroId: guardado.id,
                usuarioId: user.id,
                valorAnterior: existing?.valor,
                valorNuevo: valorStr,
                metadatos: { clave },
                ipAddress,
                userAgent,
            });

            actualizados[clave] = valorStr;
        }

        invalidateCache("public_params");

        return NextResponse.json({ actualizados });
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
