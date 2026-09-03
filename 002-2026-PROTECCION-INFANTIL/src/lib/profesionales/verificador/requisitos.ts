/**
 * SPEC-408 (A-75 · brief §9): lee la lista de requisitos parametrizada.
 *
 * Orden permanente de Jelkin: los 4 requisitos que revisa el Verificador NO
 * están quemados en el código — viven en `ParametroSistema.verificacion.requisitos`
 * (JSON) que el seed siembra idempotente. Agregar, quitar o renombrar un
 * requisito no cuesta un despliegue.
 */
import { z } from "zod";
import { getParametroSistemaValor, type ParametroClient } from "@/lib/parametros";

const requisitoSchema = z.object({
    clave: z.string().min(1).max(64),
    nombre: z.string().min(1).max(120),
    descripcion: z.string().max(400).optional().default(""),
});
const listaSchema = z.array(requisitoSchema).min(1);

export type RequisitoVerificacion = z.infer<typeof requisitoSchema>;

/**
 * Devuelve la lista de requisitos configurada por el admin. Si el parámetro
 * no existe o el JSON es inválido, tiran ambos casos por el borde con un error
 * claro: sin lista no hay verificación posible.
 */
export async function leerRequisitosVerificacion(client?: ParametroClient): Promise<RequisitoVerificacion[]> {
    const raw = await getParametroSistemaValor("verificacion.requisitos", client);
    if (!raw) {
        throw new Error(
            "[verificacion.requisitos] parámetro ausente — corré el seed (`npm run db:seed`) o creá la fila en admin",
        );
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch (err) {
        throw new Error(
            `[verificacion.requisitos] JSON inválido: ${err instanceof Error ? err.message : String(err)}`,
        );
    }
    const result = listaSchema.safeParse(parsed);
    if (!result.success) {
        throw new Error(
            `[verificacion.requisitos] estructura inválida: ${result.error.issues.map((i) => i.message).join(", ")}`,
        );
    }
    return result.data;
}

/**
 * Convierte una lista de requisitos en el shape del checklist inicial (todos
 * en `PENDIENTE`, sin observación). Se usa en la ficha cuando aún no hay
 * verificación previa.
 */
export function checklistVacio(requisitos: RequisitoVerificacion[]): Record<string, ItemChecklist> {
    return Object.fromEntries(requisitos.map((r) => [r.clave, { estado: "PENDIENTE" as const, observacion: "" }]));
}

export type EstadoItemChecklist = "PENDIENTE" | "CUMPLE" | "NO_CUMPLE";

export interface ItemChecklist {
    estado: EstadoItemChecklist;
    observacion: string;
}
