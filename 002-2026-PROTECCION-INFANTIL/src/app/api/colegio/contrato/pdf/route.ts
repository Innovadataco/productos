/**
 * SPEC-796 · GET — el COLEGIO DUEÑO ve su propio contrato firmado.
 *
 * Guardia de SERVIDOR: resuelve el colegio desde la SESIÓN (`usuario.colegioId` del SCHOOL_ADMIN),
 * NO desde un id en la URL — un colegio solo puede pedir el SUYO. No es una URL pública/adivinable:
 * entrega el PDF descifrado tras autenticar. Nunca expone la ruta ni el archivoId.
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { errorToResponse } from "@/lib/api-handler";
import { leerContratoColegioVigente } from "@/lib/colegio/contrato-colegio.service";

export async function GET() {
    try {
        const user = await verifyAuth("SCHOOL_ADMIN");
        if (!user.colegioId) {
            return new NextResponse(null, { status: 404 });
        }
        const pdf = await leerContratoColegioVigente(user.colegioId);
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
        return errorToResponse(error, "[COLEGIO/CONTRATO/PDF/GET]");
    }
}
