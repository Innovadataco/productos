/**
 * SPEC-185: sugerencias de configuración para el simulador de abusos.
 * Evita reusar IPs ya empleadas en simulaciones previas y destaca escenarios
 * según lo observado en rate-limit reciente.
 */
import { RateLimitRepository } from "@/lib/dal/repositories/rate-limit";
import { SimulacionAbusoRepository } from "@/lib/dal/repositories/simulacion-abuso";
import { getParametroSistemaValor } from "@/lib/parametros";

const RANGOS_TEST = [
    { red: "192.0.2", label: "192.0.2.0/24" },
    { red: "198.51.100", label: "198.51.100.0/24" },
    { red: "203.0.113", label: "203.0.113.0/24" },
];

export interface SugerenciasSimulacion {
    ipsSugeridas: string[];
    identificadoresSugeridos: string[];
    escenariosSugeridos: string[];
}

function generarIpsCandidatas(): string[] {
    const ips: string[] = [];
    for (const rango of RANGOS_TEST) {
        for (let i = 1; i <= 253; i++) {
            ips.push(`${rango.red}.${i}`);
        }
    }
    return ips;
}

/**
 * Genera sugerencias para una nueva simulación.
 * - Excluye IPs ya usadas en corridas previas.
 * - Si hay IPs bloqueadas recientemente, prioriza escenarios que exploten
 *   rate-limit (robot_inundando, ataque_coordinado).
 */
export async function generarSugerenciasSimulacion(): Promise<SugerenciasSimulacion> {
    const repoSim = new SimulacionAbusoRepository();
    const repoRate = new RateLimitRepository();

    const usadas = await repoSim.buscarIpsUsadas();
    const candidatas = generarIpsCandidatas();
    const frescas = candidatas.filter((ip) => !usadas.has(ip));

    const ipsSugeridas: string[] = frescas.slice(0, 5);
    if (ipsSugeridas.length === 0) {
        // Fallback: reusar la primera IP disponible aunque ya se haya usado.
        ipsSugeridas.push(...candidatas.slice(0, 5));
    }

    const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const maxRequestsRaw = await getParametroSistemaValor("ratelimit.report.max_requests");
    const maxRequests = Math.max(0, parseInt(maxRequestsRaw ?? "5", 10));
    const bloqueadas = await repoRate.buscarIpsBloqueadasRecientemente(
        Array.from(usadas),
        hace24h,
        "report",
        maxRequests
    );

    const escenariosSugeridos: string[] = [];
    if (bloqueadas.size > 0) {
        escenariosSugeridos.push("robot_inundando", "ataque_coordinado");
    } else {
        escenariosSugeridos.push("bot_ips_rotativas", "personalizado");
    }
    escenariosSugeridos.push("denunciante_spam");

    const identificadoresSugeridos = [
        "3001000001",
        "3001000002",
        "3001000003",
        "3001000004",
        "3001000005",
    ];

    return {
        ipsSugeridas,
        identificadoresSugeridos,
        escenariosSugeridos: [...new Set(escenariosSugeridos)],
    };
}
