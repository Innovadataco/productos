import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { crearPeticionServicio } from "@/lib/dal/services/soporte/peticion-servicio.service";

/**
 * SPEC-824 (cablea SPEC-819) · POST /api/padre/soporte/peticiones — la Puerta de Soporte del padre.
 *
 * Crea la `PeticionServicio` del motivo elegido y —solo para `DATOS_PERSONALES`— la `SolicitudHabeasData`
 * canónica enlazada (ver el servicio). Solo rol PARENT; la petición cuelga del `usuario.id` de la sesión
 * (no anónima). El tipo y el sujeto de habeas data los PREGUNTA la forma y llegan en el body — el endpoint
 * no los infiere; el servicio vuelve a validar el contrato (detalle 1:1 con el motivo) y la propiedad del hijo.
 *
 * Este endpoint lo creó 819 y lo BORRÉ en 819 a propósito (la puerta no podía ser alcanzable sin bandeja).
 * 824 lo recrea JUNTO con la bandeja del operador, en el mismo PR/deploy — la invariante «nadie entra antes
 * de que alguien pueda ver lo que entra» se mantiene porque ambas piezas llegan juntas.
 */

const MOTIVOS = ["DATOS_PERSONALES", "PAGO_O_COBRO", "CITA", "SERVICIO_PLATAFORMA", "OTRA"] as const;
const TIPOS_HABEAS = ["CONSULTA", "RECTIFICACION", "SUPRESION"] as const;
// SPEC-827 · el OBJETO de la petición: conjunto CERRADO (nunca texto libre). La ruta acepta el ENUM COMPLETO
// aunque la UI hoy solo ofrezca RELATO_CITA — el derecho de habeas data es general; el copy de UI es parcial,
// y el canal de soporte puede registrar lo que la pantalla todavía no ofrece (hueco-funcional declarado).
const CLASES_DATO = ["PERFIL", "HIJOS", "IDENTIFICADORES_CIRCULO", "RELATO_CITA", "CONTENIDO_REPORTE", "OTRO"] as const;

const sujetoSchema = z.discriminatedUnion("calidad", [
    z.object({ calidad: z.literal("TITULAR_CUENTA") }),
    z.object({ calidad: z.literal("REPRESENTANTE_LEGAL"), hijoId: z.string().min(1) }),
]);

const bodySchema = z
    .object({
        motivo: z.enum(MOTIVOS),
        tipo: z.enum(TIPOS_HABEAS).optional(),
        sujeto: sujetoSchema.optional(),
        clasesSolicitadas: z.array(z.enum(CLASES_DATO)).optional(),
    })
    .superRefine((v, ctx) => {
        if (v.motivo === "DATOS_PERSONALES") {
            if (!v.tipo) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["tipo"], message: "El tipo es obligatorio para datos personales" });
            if (!v.sujeto) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["sujeto"], message: "El sujeto es obligatorio para datos personales" });
            // SPEC-827 · OBJETO POR TIPO: RECTIFICACION/SUPRESION exigen ≥1 clase (sin objeto no son accionables);
            // CONSULTA no lleva objeto («qué datos tienen sobre mí» no lo necesita). Espeja el CHECK de la BD.
            const requiereObjeto = v.tipo === "RECTIFICACION" || v.tipo === "SUPRESION";
            if (requiereObjeto && (!v.clasesSolicitadas || v.clasesSolicitadas.length === 0)) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["clasesSolicitadas"], message: "Indica sobre qué datos recae la solicitud" });
            }
            if (v.tipo === "CONSULTA" && v.clasesSolicitadas && v.clasesSolicitadas.length > 0) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["clasesSolicitadas"], message: "Una consulta no lleva un objeto de datos" });
            }
        } else if (v.tipo || v.sujeto || (v.clasesSolicitadas && v.clasesSolicitadas.length > 0)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["motivo"], message: "El detalle de datos personales no aplica a este motivo" });
        }
    });

export async function POST(request: Request) {
    try {
        const user = await verifyAuth();
        if (user.rol !== "PARENT") {
            throw new AppError("Permisos insuficientes", ERROR_CODES.FORBIDDEN, 403);
        }

        const body = bodySchema.parse(await request.json());
        const { numeroSeguimiento } = await crearPeticionServicio(
            body.motivo === "DATOS_PERSONALES" && body.tipo && body.sujeto
                ? {
                    usuarioId: user.id,
                    motivo: body.motivo,
                    habeasData: {
                        tipo: body.tipo,
                        sujeto: body.sujeto,
                        clasesSolicitadas: body.clasesSolicitadas ?? [],
                    },
                }
                : { usuarioId: user.id, motivo: body.motivo },
        );

        return NextResponse.json({ numeroSeguimiento }, { status: 201 });
    } catch (error) {
        return errorToResponse(error, "[PADRE/SOPORTE/PETICIONES]");
    }
}
