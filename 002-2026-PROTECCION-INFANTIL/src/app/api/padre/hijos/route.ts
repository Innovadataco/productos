import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES, safeErrorMessage } from "@/lib/errors";
import { registrarHijo, listarHijos, DOCUMENTO_TIPOS, SEXOS } from "@/lib/dal/services/hijos";
import { sellarCookieSesionEstado } from "@/lib/routing/sellar-sesion-estado";
import { maximoHijosActivos, plantillaMensajeTope, resolverMensajeTope } from "@/lib/padre/tope-hijos";
import {
    validarDocumentoMenor,
    validarEdadMenor,
    edadDesdeAnio,
    EDAD_MENOR_MIN,
    EDAD_MENOR_MAX,
} from "@/lib/padre/documento-menor";

// SPEC-325 (002-PI-225) · "A quién protejo". PII de menor: solo el padre dueño
// (verifyAuth PARENT) accede; el DAL acota por HijoPadre. Documento OBLIGATORIO.
const createSchema = z.object({
    // SPEC-361 (F4): cada mensaje nombra su campo — el padre tiene que saber qué corregir.
    nombre: z.string({ error: "Escribe el nombre del menor." }).min(1, "Escribe el nombre del menor.").max(120, "El nombre es muy largo."),
    // SPEC-339 (FR-019): obligatorios. Las fichas viejas sin apellidos se conservan;
    // lo que cambia es la validación de las nuevas.
    apellidos: z.string({ error: "Escribe los apellidos del menor." }).min(1, "Escribe los apellidos del menor.").max(120, "Los apellidos son muy largos."),
    documentoTipo: z.enum(DOCUMENTO_TIPOS, { error: "Elige el tipo de documento del menor." }),
    documentoNumero: z.string({ error: "Escribe el número de documento del menor." }).min(1, "Escribe el número de documento del menor.").max(40, "El número de documento es muy largo."),
    // SPEC-372 (A-74 · P4 · I-262): el año se acota por EDAD (5-17), no por un
    // rango absoluto. La UI (F8) ya deriva el año de la edad; el servidor —que es
    // quien manda— valida lo mismo, con la misma constante, así saltarse la
    // pantalla no permite pasar un año fuera de rango.
    anioNacimiento: z
        .number()
        .int()
        .refine((anio) => validarEdadMenor(edadDesdeAnio(anio)) === null, {
            message: `El año de nacimiento del menor debe corresponder a una edad entre ${EDAD_MENOR_MIN} y ${EDAD_MENOR_MAX} años.`,
        })
        .optional(),
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
            // SPEC-361 (A-70 · F4): el servidor SABE qué campo está mal — que lo
            // diga. Antes respondía "Datos inválidos" y la pantalla mostraba
            // "no se pudo registrar": el padre no tenía forma de saber qué
            // corregir.
            return NextResponse.json(
                {
                    error: {
                        message: parsed.error.issues[0]?.message ?? "Revisa los datos del menor.",
                        code: ERROR_CODES.VALIDATION_ERROR,
                    },
                },
                { status: 400 }
            );
        }

        // SPEC-361 (A-70 · F7): la forma del número según su tipo. Se valida acá
        // además de en la pantalla: el servidor es quien manda.
        const errorDocumento = validarDocumentoMenor(parsed.data.documentoTipo, parsed.data.documentoNumero);
        if (errorDocumento) {
            return NextResponse.json(
                { error: { message: errorDocumento, code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        // SPEC-339 (FR-021 · brief §2.4): el tope es PARÁMETRO, no constante.
        // SPEC-361 (A-70 · F5, aclaración de Jelkin): el tope cuenta SOLO los
        // menores ACTIVOS. Inactivar es decisión del padre y libera cupo solo;
        // el producto NUNCA inactiva por su cuenta ni sugiere a cuál.
        // SPEC-363: el tope y su mensaje viven en un solo lugar (tope-hijos.ts),
        // compartidos con la reactivación (PATCH). Cuenta SOLO los activos (F5).
        const maximo = await maximoHijosActivos();
        const actuales = await listarHijos(usuario.id);
        const activos = actuales.filter((h) => h.estado === "activo").length;
        if (activos >= maximo) {
            const plantilla = await plantillaMensajeTope();
            return NextResponse.json(
                { error: { message: resolverMensajeTope(plantilla, activos, maximo), code: ERROR_CODES.CONFLICT } },
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
