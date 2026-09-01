import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES, safeErrorMessage } from "@/lib/errors";
import { registrarHijo, listarHijos, DOCUMENTO_TIPOS, SEXOS } from "@/lib/dal/services/hijos";
import { getParametroSistemaValor } from "@/lib/parametros";
import { sellarCookieSesionEstado } from "@/lib/routing/sellar-sesion-estado";

// SPEC-325 (002-PI-225) · "A quién protejo". PII de menor: solo el padre dueño
// (verifyAuth PARENT) accede; el DAL acota por HijoPadre. Documento OBLIGATORIO.
const createSchema = z.object({
    nombre: z.string().min(1).max(120),
    // SPEC-339 (FR-019): obligatorios. Las fichas viejas sin apellidos se conservan;
    // lo que cambia es la validación de las nuevas.
    apellidos: z.string().min(1).max(120),
    documentoTipo: z.enum(DOCUMENTO_TIPOS),
    documentoNumero: z.string().min(1).max(40),
    anioNacimiento: z.number().int().min(1900).max(2100).optional(),
    sexo: z.enum(SEXOS).optional(),
    identificadores: z
        .array(
            z.object({
                valor: z.string().min(1).max(100),
                tipo: z.string().max(50).optional(),
                plataformaId: z.string().max(100).optional(),
            })
        )
        .optional(),
});

export async function GET() {
    try {
        const usuario = await verifyAuth("PARENT");
        return NextResponse.json(await listarHijos(usuario.id));
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

export async function POST(request: Request) {
    try {
        const usuario = await verifyAuth("PARENT");
        const parsed = createSchema.safeParse(await request.json());
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Datos inválidos", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }
        // SPEC-339 (FR-021 · brief §2.4): el tope es PARÁMETRO, no constante.
        // El mensaje que ve el padre también sale de un parámetro.
        const maximo = parseInt((await getParametroSistemaValor("padre.hijos.maximo")) ?? "5", 10);
        const actuales = await listarHijos(usuario.id);
        if (actuales.length >= maximo) {
            const plantilla =
                (await getParametroSistemaValor("padre.hijos.maximo_mensaje")) ??
                "Puedes cuidar hasta {{maximo}} menores desde esta cuenta.";
            return NextResponse.json(
                { error: { message: plantilla.replaceAll("{{maximo}}", String(maximo)), code: ERROR_CODES.CONFLICT } },
                { status: 409 }
            );
        }

        const res = await registrarHijo(usuario.id, parsed.data);
        // SPEC-339 (D-4): siempre se crea una ficha nueva de ESTE padre; ya no
        // existe el caso "vinculado a la ficha de otro padre" que devolvía 200.
        const respuesta = NextResponse.json(res, { status: 201 });
        // T073: registrar un menor puede CERRAR el Paso 3 del camino — re-sellar
        // al instante, no esperar los 5 minutos de la cookie (I-211/222/224/227).
        // Defensa: el helper promete no lanzar, pero si un cambio futuro rompe esa
        // promesa, el dato guardado no puede convertirse en un 500.
        const sellada = await sellarCookieSesionEstado(respuesta, usuario.id).catch(() => false);
        if (!sellada) {
            // T079: el menor quedó registrado; que el padre lo sepa.
            return NextResponse.json(
                { ...res, aviso: "Quedó registrado. Si la página no avanza en un momento, recárgala." },
                { status: 201 }
            );
        }
        return respuesta;
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        logger.error("[HIJOS] Error registrando hijo:", error);
        return NextResponse.json(
            { error: { message: safeErrorMessage(error), code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}
