import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { getParametroSistema, descifrarValorParametro } from "@/lib/parametros";
import type { EstrategiaAsignacion } from "@/lib/operadores/asignador";

const patchSchema = z.object({
    cupoMaximoDefault: z.number().int().min(1).max(200).optional(),
    estrategia: z.enum(["ponderado_carga_inversa", "aleatorio_puro"]).optional(),
});

async function obtenerModeloActual() {
    const [cupoParam, estrategiaParam] = await Promise.all([
        getParametroSistema("operadores.cupo_maximo_default"),
        getParametroSistema("operadores.estrategia_asignacion"),
    ]);

    return {
        cupoMaximoDefault: cupoParam ? parseInt(descifrarValorParametro(cupoParam).valor, 10) || 10 : 10,
        estrategia: (estrategiaParam ? descifrarValorParametro(estrategiaParam).valor : "ponderado_carga_inversa") as EstrategiaAsignacion,
    };
}

export async function GET(req: Request) {
    try {
        const user = await verifyAuth(["ADMIN", "SCHOOL_ADMIN"]);
        const rate = await checkRateLimit(req, "admin_read", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Esperá un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const modelo = await obtenerModeloActual();
        return NextResponse.json(modelo);
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

export async function PATCH(req: Request) {
    try {
        const user = await verifyAuth(["ADMIN", "SCHOOL_ADMIN"]);
        const rate = await checkRateLimit(req, "admin_write", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Esperá un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const body = await req.json();
        const parsed = patchSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Datos inválidos", code: ERROR_CODES.VALIDATION_ERROR, details: parsed.error.format() } },
                { status: 400 }
            );
        }

        const anterior = await obtenerModeloActual();
        const cambios: { cupoMaximoDefault?: number; estrategia?: EstrategiaAsignacion } = {};

        if (parsed.data.cupoMaximoDefault !== undefined) {
            await prisma.parametroSistema.upsert({
                where: { clave: "operadores.cupo_maximo_default" },
                update: { valor: String(parsed.data.cupoMaximoDefault) },
                create: {
                    clave: "operadores.cupo_maximo_default",
                    valor: String(parsed.data.cupoMaximoDefault),
                    tipo: "INTEGER",
                    categoria: "SECURITY",
                    esPublico: false,
                    descripcion: "Cupo máximo default para operadores sin override explícito",
                },
            });
            cambios.cupoMaximoDefault = parsed.data.cupoMaximoDefault;
        }

        if (parsed.data.estrategia !== undefined) {
            await prisma.parametroSistema.upsert({
                where: { clave: "operadores.estrategia_asignacion" },
                update: { valor: parsed.data.estrategia },
                create: {
                    clave: "operadores.estrategia_asignacion",
                    valor: parsed.data.estrategia,
                    tipo: "STRING",
                    categoria: "SECURITY",
                    esPublico: false,
                    descripcion: "Estrategia de asignación de casos a operadores",
                },
            });
            cambios.estrategia = parsed.data.estrategia;
        }

        const nuevo = await obtenerModeloActual();

        await logAudit({
            accion: "CONFIGURACION_ASIGNACION_ACTUALIZADA",
            tipoRecurso: "ParametroSistema",
            recursoId: "operadores.asignacion",
            usuarioId: user.id,
            valorAnterior: JSON.stringify(anterior),
            valorNuevo: JSON.stringify(nuevo),
        });

        return NextResponse.json(nuevo);
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
