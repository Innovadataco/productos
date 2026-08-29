/**
 * SPEC-184 (002-PI-079): tablero operativo anti-abuso.
 *
 * Agrega señales de abuso desde RateLimit, Reporte, BlockList e IncidenteInfra.
 * Frontera DAL (Q-3): usa repositorios, nunca prisma directo.
 */
import { RateLimitRepository } from "@/lib/dal/repositories/rate-limit";
import { ReporteRepository } from "@/lib/dal/repositories/reporte";
import { BlockListRepository } from "@/lib/dal/repositories/block-list";
import { MonitoreoRepository } from "@/lib/dal/repositories/monitoreo";
import { getScopeDefaults } from "@/lib/rate-limit";

export type VentanaTiempo = "24h" | "7d" | "30d";

const VENTANA_MS: Record<VentanaTiempo, number> = {
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
};

export interface IpBloqueadaRow {
    ip: string;
    bloqueos: number;
    ultimoBloqueoEn: Date | null;
}

export interface IdentificadorTopRow {
    identificador: string;
    plataformaId: string;
    plataformaNombre: string;
    total: number;
}

export interface FingerprintTopRow {
    fingerprintHash: string;
    reportes: number;
    ipsUnicas: number;
    ultimoReporteEn: Date | null;
}

export interface BloqueoVigenteRow {
    id: string;
    ipHash: string;
    ipOriginal: string | null;
    motivo: string;
    expiraEn: Date | null;
    creadoEn: Date;
}

export interface AlertaActivaRow {
    senal: string;
    inicio: Date;
    detalle: string | null;
}

export interface TableroAntiAbuso {
    ventana: VentanaTiempo;
    topIpsBloqueadas: IpBloqueadaRow[];
    topIdentificadores: IdentificadorTopRow[];
    topFingerprints: FingerprintTopRow[];
    bloqueosVigentes: BloqueoVigenteRow[];
    alertasActivas: AlertaActivaRow[];
}

function desdeVentana(ventana: VentanaTiempo): Date {
    return new Date(Date.now() - VENTANA_MS[ventana]);
}

export async function obtenerTableroAntiAbuso(ventana: VentanaTiempo = "24h"): Promise<TableroAntiAbuso> {
    const repoRateLimit = new RateLimitRepository();
    const repoReporte = new ReporteRepository();
    const repoBlockList = new BlockListRepository();
    const repoMonitoreo = new MonitoreoRepository();

    const desde = desdeVentana(ventana);
    const scope = "report";
    const defaults = getScopeDefaults(scope);
    const limite = 10;

    const [topIps, topIdentificadores, topFingerprints, bloqueosVigentes, senalesAlertas] = await Promise.all([
        repoRateLimit.topIpsBloqueadas(scope, desde, defaults.maxRequests, limite),
        repoReporte.topIdentificadoresEnVentana(desde, limite),
        repoReporte.topFingerprintsRepetidores(desde, limite),
        repoBlockList.findPaginadosVigentes({ skip: 0, take: 50 }).then(([items]) => items),
        repoMonitoreo.senalesConIncidentesAbiertos(),
    ]);

    const alertasActivas = senalesAlertas
        .filter((s) => s.startsWith("rate_limit:"))
        .map((senal) => ({
            senal,
            inicio: new Date(),
            detalle: null as string | null,
        }));

    return {
        ventana,
        topIpsBloqueadas: topIps.map((r) => ({
            ip: r.identifier,
            bloqueos: r.bloqueos,
            ultimoBloqueoEn: r.ultimoBloqueoEn,
        })),
        topIdentificadores,
        topFingerprints,
        bloqueosVigentes,
        alertasActivas,
    };
}
