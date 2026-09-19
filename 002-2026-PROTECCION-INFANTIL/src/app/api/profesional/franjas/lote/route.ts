/**
 * SPEC-714 · POST — materializa un LOTE de franjas (repetir un patrón, copiar un
 * día). Es POST, no GET: muta. Misma puerta que la creación unitaria
 * (`../route.ts`): auth PROFESIONAL + habilitado + módulo. La lógica y las cuatro
 * reglas viven en `franjas.service.materializarFranjas` (transaccional).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { exigirProfesionalHabilitadoApi } from "@/lib/profesionales/habilitacion";
import { assertModulo } from "@/lib/permisos-modulos";
import { errorToResponse } from "@/lib/api-handler";
import { PerfilProfesionalRepository } from "@/lib/dal/repositories/perfil-profesional";
import { materializarFranjas } from "@/lib/profesional/calendario/franjas.service";
import { AppError, ERROR_CODES } from "@/lib/errors";

const loteSchema = z.object({
    franjas: z
        .array(
            z.object({
                inicio: z.string().datetime(),
                fin: z.string().datetime(),
                modalidad: z.enum(["VIRTUAL", "PRESENCIAL"]),
            }),
        )
        .min(1)
        .max(60),
});

export async function POST(request: Request) {
    try {
        const user = await verifyAuth("PROFESIONAL");
        await exigirProfesionalHabilitadoApi(user.id); // SPEC-690: ruta operativa — solo habilitado
        await assertModulo(user, "profesional_calendario");
        const perfil = await new PerfilProfesionalRepository().findPorUsuarioId(user.id);
        if (!perfil) throw new AppError("Perfil profesional no existe", ERROR_CODES.NOT_FOUND, 404);
        const body = loteSchema.parse(await request.json());
        const resultado = await materializarFranjas(perfil.id, body.franjas);
        return NextResponse.json({ data: resultado });
    } catch (error) {
        return errorToResponse(error, "[PROFESIONAL/FRANJAS/LOTE/POST]");
    }
}
