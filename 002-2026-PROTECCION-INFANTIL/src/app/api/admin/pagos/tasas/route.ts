import { NextResponse } from "next/server";
import { FuenteTasa } from "@prisma/client";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { logAudit } from "@/lib/audit";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { withValidation } from "@/lib/validation";
import { pagosTasaManualBodySchema } from "@/lib/schemas/pagos";
import { getClientInfo } from "@/lib/pagos/api-helpers";

export async function GET(request: Request) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "pagos_admin");
        const rate = await checkRateLimit(request, "admin_read", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const url = new URL(request.url);
        const monedaDestino = url.searchParams.get("monedaDestino") ?? undefined;

        const tasas = await new PagosRepository().listarTasasVigentes({ monedaDestino });
        return NextResponse.json({ tasas });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/PAGOS/TASAS]");
    }
}

export async function POST(request: Request) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "pagos_admin");
        const rate = await checkRateLimit(request, "admin_write", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const body = await withValidation.body(pagosTasaManualBodySchema)(request);

        const tasa = await new PagosRepository().crearTasaCambio({
            monedaOrigen: "USD",
            monedaDestino: body.monedaDestino,
            tasa: body.tasa,
            fecha: new Date(),
            fuente: FuenteTasa.ADMIN_MANUAL,
            ingresadoPorAdminId: admin.id,
            motivoManual: body.motivoManual,
        });

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "TASA_MANUAL_CREADA",
            tipoRecurso: "TasaCambio",
            recursoId: tasa.id,
            usuarioId: admin.id,
            valorNuevo: JSON.stringify({ monedaDestino: tasa.monedaDestino, tasa: tasa.tasa, motivoManual: tasa.motivoManual }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({ tasa }, { status: 201 });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/PAGOS/TASAS]");
    }
}
