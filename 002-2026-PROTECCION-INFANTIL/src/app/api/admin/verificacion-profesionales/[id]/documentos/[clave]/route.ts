/**
 * SPEC-436 (I-303) · el Verificador abre los documentos de LA FICHA QUE REVISA.
 *
 * `id` es el perfil profesional de la ficha; `clave` es un requisito del
 * parámetro o `autorizacion`. La puerta es doble y ninguna sobra:
 *  1. `assertModulo(admin_verificacion_profesionales)` — solo VERIFICADOR/ADMIN.
 *  2. El documento servido es el DE ESA FICHA: el `id` viene de la ruta y el
 *     service resuelve el archivo por ese perfil, así que no hay forma de pedir
 *     el documento de otro profesional desde la ficha de uno.
 *
 * Ley 1918/2018 · 2375/2024 §5: el certificado de antecedentes es reservado y
 * cada apertura queda auditada (lo hace `servirDocumento`).
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { PerfilProfesionalRepository } from "@/lib/dal/repositories/perfil-profesional";
import { servirDocumento } from "@/lib/profesional/documentos.service";

/**
 * SPEC-436 · defensa en profundidad sobre un documento RESERVADO por ley.
 *
 * `assertModulo` ya exige el módulo del Verificador, pero ese permiso es una
 * fila de BD que se puede activar desde el panel de admin. Para el certificado
 * de antecedentes eso no alcanza: el rol se exige TAMBIÉN en código, para que
 * un permiso mal configurado no abra un documento reservado. Las dos puertas
 * suman; ninguna sustituye a la otra.
 */
const ROLES_QUE_REVISAN = new Set(["VERIFICADOR", "ADMIN"]);

export async function GET(_req: Request, ctx: { params: Promise<{ id: string; clave: string }> }) {
    try {
        const user = await verifyAuth();
        if (!ROLES_QUE_REVISAN.has(user.rol)) {
            throw new AppError("Permisos insuficientes", ERROR_CODES.FORBIDDEN, 403);
        }
        await assertModulo(user, "admin_verificacion_profesionales");
        const { id, clave } = await ctx.params;

        const perfil = await new PerfilProfesionalRepository().findPorId(id);
        if (!perfil) throw new AppError("Ficha no encontrada", ERROR_CODES.NOT_FOUND, 404);

        const doc = await servirDocumento({
            perfilProfesionalId: perfil.id,
            clave,
            quienUsuarioId: user.id,
            comoRol: user.rol,
        });
        return new NextResponse(new Uint8Array(doc.buffer), {
            status: 200,
            headers: {
                "Content-Type": doc.contentType,
                "Content-Disposition": `inline; filename="${doc.nombreDescarga}"`,
                "Cache-Control": "private, no-store",
            },
        });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/VERIFICACION-PROFESIONALES/DOCUMENTO]");
    }
}
