import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { MonitoreoRepository } from "@/lib/dal/repositories/monitoreo";
import { getParametroSistema } from "@/lib/parametros";
import { SENALES_MONITOREO, type SenalMonitoreo } from "@/lib/monitoreo/probes";

type EstadoSenal = "verde" | "rojo" | "no-aplica";

interface EstadoSenalDto {
    estado: EstadoSenal;
    ultimoProbeEn: string | null;
    detalle: string | null;
}

/**
 * GET /api/admin/monitoreo/estado (SPEC-171, Pilar B; cierra I-51)
 * Estado actual de cada señal de infraestructura para el tablero operativo:
 * rojo si hay IncidenteInfra ABIERTO de la señal, no-aplica para tailscale sin
 * URL configurada, verde en cualquier otro caso. Sin datos de reportes.
 */
export async function GET(request: Request) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "estadisticas");
        const rate = await checkRateLimit(request, "admin_read", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const repo = new MonitoreoRepository();
        const [senalesEnRojo, autorefreshParam, enabledParam, tailscaleParam, ultimosProbes] = await Promise.all([
            repo.senalesConIncidentesAbiertos(),
            getParametroSistema("monitoreo.autorefresh_seg"),
            getParametroSistema("monitoreo.enabled"),
            getParametroSistema("monitoreo.tailscale.url"),
            repo.ultimosProbesPorSenal(SENALES_MONITOREO),
        ]);

        const enRojo = new Set(senalesEnRojo);
        const tailscaleSinUrl = (tailscaleParam?.valor ?? "").trim().length === 0;

        const senales = {} as Record<SenalMonitoreo, EstadoSenalDto>;
        SENALES_MONITOREO.forEach((senal, idx) => {
            const ultimo = ultimosProbes[idx];
            let estado: EstadoSenal = "verde";
            if (enRojo.has(senal)) estado = "rojo";
            else if (senal === "tailscale" && tailscaleSinUrl) estado = "no-aplica";
            senales[senal] = {
                estado,
                ultimoProbeEn: ultimo ? ultimo.creadoEn.toISOString() : null,
                detalle: ultimo?.detalle ?? null,
            };
        });

        const autorefreshNum = Number(autorefreshParam?.valor);
        return NextResponse.json({
            senales,
            autorefreshSeg: Number.isFinite(autorefreshNum) && autorefreshNum > 0 ? Math.floor(autorefreshNum) : 30,
            monitoreoEnabled: enabledParam ? enabledParam.valor === "true" : true,
        });
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
