import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { logAudit } from "@/lib/audit";
import { verificarVigenciaColegio } from "@/lib/colegio/vigencia";
import { withValidation } from "@/lib/validation";
import { onboardingPatchSchema } from "@/lib/schemas";
import { calcularOnboarding } from "@/lib/colegio/onboarding";
import { OnboardingColegioRepository } from "@/lib/dal/repositories/onboarding-colegio";

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

async function verificarAccesoColegio(request: Request, scope: "admin_read" | "admin_write") {
    const user = await verifyAuth("SCHOOL_ADMIN");
    await assertModulo(user, "colegios_onboarding");
    const vigencia = await verificarVigenciaColegio(user.id);
    if (!vigencia.vigente) {
        return { error: NextResponse.json({ error: { message: vigencia.mensaje, code: ERROR_CODES.FORBIDDEN } }, { status: 403 }) };
    }

    const rate = await checkRateLimit(request, scope, { identifier: user.id });
    if (!rate.allowed) {
        return {
            error: NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            ),
        };
    }

    if (!user.colegioId) {
        return { error: NextResponse.json({ error: { message: "Usuario no vinculado a un colegio", code: ERROR_CODES.FORBIDDEN } }, { status: 403 }) };
    }

    return { user, colegioId: user.colegioId };
}

export async function GET(request: Request) {
    try {
        const acceso = await verificarAccesoColegio(request, "admin_read");
        if ("error" in acceso) return acceso.error;

        let onboarding = await new OnboardingColegioRepository().obtenerPorColegio(acceso.colegioId);
        if (!onboarding) {
            onboarding = await new OnboardingColegioRepository().crear({
                colegioId: acceso.colegioId,
                estado: "activo",
                pasoActual: 1,
            });
        }

        const resultado = await calcularOnboarding(acceso.colegioId);
        return NextResponse.json({ onboarding: resultado });
    } catch (error) {
        return errorToResponse(error, "[COLEGIO/ONBOARDING]");
    }
}

export async function PATCH(request: Request) {
    try {
        const acceso = await verificarAccesoColegio(request, "admin_write");
        if ("error" in acceso) return acceso.error;

        const body = await withValidation.body(onboardingPatchSchema)(request);

        const repo = new OnboardingColegioRepository();
        let onboarding = await repo.obtenerPorColegio(acceso.colegioId);
        if (!onboarding) {
            onboarding = await repo.crear({ colegioId: acceso.colegioId, estado: "activo", pasoActual: 1 });
        }

        if (onboarding.estado === body.estado) {
            const resultado = await calcularOnboarding(acceso.colegioId);
            return NextResponse.json({ onboarding: resultado });
        }

        const accionAudit =
            body.estado === "omitido"
                ? "COLEGIO_ONBOARDING_OMITIDO"
                : "COLEGIO_ONBOARDING_REACTIVADO";

        await repo.actualizarEstado(acceso.colegioId, body.estado, {
            completadoEn: body.estado === "activo" ? null : onboarding.completadoEn,
        });

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: accionAudit,
            tipoRecurso: "OnboardingColegio",
            recursoId: onboarding.id,
            usuarioId: acceso.user.id,
            colegioId: acceso.colegioId,
            valorAnterior: JSON.stringify({ estado: onboarding.estado }),
            valorNuevo: JSON.stringify({ estado: body.estado }),
            ipAddress,
            userAgent,
        });

        const resultado = await calcularOnboarding(acceso.colegioId);
        return NextResponse.json({ onboarding: resultado });
    } catch (error) {
        return errorToResponse(error, "[COLEGIO/ONBOARDING]");
    }
}
