/**
 * SPEC-436 (I-303) · el profesional abre SUS PROPIOS documentos.
 *
 * `clave` es un requisito del parámetro o `autorizacion`. Se sirve descifrado
 * al vuelo; nunca el cifrado crudo ni la ruta en disco. Cada apertura se audita.
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { PerfilProfesionalRepository } from "@/lib/dal/repositories/perfil-profesional";
import { servirDocumento } from "@/lib/profesional/documentos.service";

export async function GET(_req: Request, ctx: { params: Promise<{ clave: string }> }) {
    try {
        const user = await verifyAuth("PROFESIONAL");
        await assertModulo(user, "profesional_ficha");
        const { clave } = await ctx.params;
        const perfil = await new PerfilProfesionalRepository().findPorUsuarioId(user.id);
        if (!perfil) throw new AppError("Perfil profesional no encontrado", ERROR_CODES.NOT_FOUND, 404);

        const doc = await servirDocumento({
            perfilProfesionalId: perfil.id,
            clave,
            quienUsuarioId: user.id,
            comoRol: "PROFESIONAL",
        });
        return new NextResponse(new Uint8Array(doc.buffer), {
            status: 200,
            headers: {
                "Content-Type": doc.contentType,
                "Content-Disposition": `inline; filename="${doc.nombreDescarga}"`,
                // Documento reservado: que no quede en caches compartidas.
                "Cache-Control": "private, no-store",
            },
        });
    } catch (error) {
        return errorToResponse(error, "[PROFESIONAL/DOCUMENTOS/VER]");
    }
}
