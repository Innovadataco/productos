import { NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES, safeErrorMessage } from "@/lib/errors";
import { actualizarHijo, cambiarEstadoHijo, DOCUMENTO_TIPOS, SEXOS } from "@/lib/dal/services/hijos";
import { sellarCookieSesionEstado } from "@/lib/routing/sellar-sesion-estado";
import { maximoHijosActivos, plantillaMensajeTope, resolverMensajeTope } from "@/lib/padre/tope-hijos";
import { validarAnioNacimientoMenor } from "@/lib/padre/documento-menor";

// SPEC-325 · SPEC-339 (FR-022): antes este PATCH aceptaba SOLO { estado } — el
// padre no podía corregir un apellido mal escrito. Ahora acepta la corrección
// completa. El DAL exige que el padre sea dueño (PII acceso-solo-dueño) y
// rechaza el documento repetido DENTRO de su propia lista (D-4).
const patchSchema = z
    .object({
        nombre: z.string().trim().min(1).max(120).optional(),
        apellidos: z.string().trim().min(1).max(120).optional(),
        documentoTipo: z.enum(DOCUMENTO_TIPOS).optional(),
        documentoNumero: z.string().trim().min(1).max(40).optional(),
        anioNacimiento: z.number().int().min(1900).max(2100).optional(),
        sexo: z.enum(SEXOS).optional(),
        estado: z.enum(["activo", "inactivo"]).optional(),
    })
    .refine((d) => Object.values(d).some((v) => v !== undefined), {
        message: "Nada que corregir",
    });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const usuario = await verifyAuth("PARENT");
        const { id } = await params;
        const parsed = patchSchema.safeParse(await request.json());
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Datos inválidos", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }
        // SPEC-372 (A-74 P4 · I-262): mismo control de rango que en POST — si
        // el PATCH trae anioNacimiento debe caer en la ventana 5-17 del año en
        // curso. `undefined` (no lo tocan) pasa sin ruido.
        const errorAnio = validarAnioNacimientoMenor(parsed.data.anioNacimiento);
        if (errorAnio) {
            return NextResponse.json(
                { error: { message: errorAnio, code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }
        // SPEC-363: el cambio de estado va por `cambiarEstadoHijo` (audita
        // `{estado}` para la bitácora · BUG2, y aplica el cupo al reactivar ·
        // BUG1). Las correcciones de datos siguen por `actualizarHijo`. Un PATCH
        // puede traer las dos cosas: se separan.
        const { estado, ...correccion } = parsed.data;
        let res: { ok: boolean; estado?: string } = { ok: true };
        if (Object.keys(correccion).length > 0) {
            res = await actualizarHijo(usuario.id, id, correccion);
        }
        if (estado !== undefined) {
            const maximo = await maximoHijosActivos();
            const plantilla = await plantillaMensajeTope();
            res = await cambiarEstadoHijo(usuario.id, id, estado, {
                maximoActivos: maximo,
                mensajeSiExcede: (activos, max) => resolverMensajeTope(plantilla, activos, max),
            });
        }
        const respuesta = NextResponse.json(res);
        // T073: inactivar el ÚNICO menor activo reabre el Paso 3, y reactivarlo
        // lo cierra — re-sellar siempre que cambie el estado, al instante.
        if (parsed.data.estado !== undefined) {
            const sellada = await sellarCookieSesionEstado(respuesta, usuario.id).catch(() => false);
            if (!sellada) {
                return NextResponse.json({
                    ...res,
                    aviso: "Quedó guardado. Si la página no avanza en un momento, recárgala.",
                });
            }
        }
        return respuesta;
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        if (error instanceof Error && /no encontrado/i.test(error.message)) {
            return NextResponse.json(
                { error: { message: "Hijo no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }
        logger.error("[HIJOS] Error actualizando hijo:", error);
        return NextResponse.json(
            { error: { message: safeErrorMessage(error), code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
