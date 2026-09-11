import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { ExpedienteRepository } from "@/lib/dal/repositories/expediente-repository";
import { CodigoAccesoContenidoRepository } from "@/lib/dal/repositories/codigo-acceso";

/**
 * GET /api/padre/expedientes/[id]/accesos — SPEC-610 (I-372 · D-129).
 *
 * «Quién ha leído este expediente»: los pases que un profesional (o el mismo
 * padre) CANJEÓ para abrir ESTE expediente — quién, cuándo y cuántos eventos leyó.
 * SOLO metadatos: esta vía NUNCA descifra ni devuelve contenido. El padre solo ve
 * los accesos de SUS expedientes: `obtenerExpedientePorId` scopa por titular y
 * devuelve null si el expediente no existe o no es suyo → 404 (sin revelar nada).
 *
 * Response: { items: [{ id, cuando, quien, rol, eventosLeidos }] }.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth("PARENT");
        const { id } = await params;

        const expediente = await new ExpedienteRepository().obtenerExpedientePorId(id, user.id);
        if (!expediente) {
            return NextResponse.json({ error: { message: "Expediente no encontrado" } }, { status: 404 });
        }

        const accesos = await new CodigoAccesoContenidoRepository().listarAccesosPorExpediente(id);
        const items = accesos.map((acceso) => ({
            id: acceso.id,
            cuando: acceso.canjeadoEn,
            quien: acceso.canjeadoPor?.nombre ?? null,
            rol: acceso.canjeadoPor?.rol ?? null,
            eventosLeidos: acceso._count.lecturas,
        }));

        return NextResponse.json({ items });
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
