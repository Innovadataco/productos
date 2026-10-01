/**
 * SPEC-796 · GET — nuestro ADMIN ve el contrato firmado de un colegio desde la ficha cliente.
 *
 * `[id]` = suscripcionId. Guardia de SERVIDOR (rol admin + módulo). Resuelve el colegio desde la
 * suscripción y entrega el PDF descifrado del contrato VIGENTE. Nunca expone la ruta ni el archivoId.
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { errorToResponse } from "@/lib/api-handler";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { leerContratoColegioVigente } from "@/lib/colegio/contrato-colegio.service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth("ADMIN");
        await assertModulo(user, "pagos_admin");
        const { id: suscripcionId } = await params;
        const suscripcion = await new PagosRepository().obtenerSuscripcionPorId(suscripcionId);
        if (!suscripcion || !suscripcion.colegioId) {
            return new NextResponse(null, { status: 404 });
        }
        const pdf = await leerContratoColegioVigente(suscripcion.colegioId);
        if (!pdf) {
            return new NextResponse(null, { status: 404 });
        }
        return new NextResponse(new Uint8Array(pdf), {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": "inline; filename=\"contrato.pdf\"",
                "Cache-Control": "private, no-store",
            },
        });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/PAGOS/CLIENTE/CONTRATO/PDF/GET]");
    }
}
