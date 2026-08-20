/**
 * SPEC-185: sugerencias de configuración para el simulador de abusos.
 * Cada escenario devuelve una config recomendada con IPs frescas (RFC 5737)
 * que no hayan sido usadas en las últimas 2 horas.
 */
import { RateLimitRepository } from "@/lib/dal/repositories/rate-limit";
import { SimulacionAbusoRepository } from "@/lib/dal/repositories/simulacion-abuso";
import { getParametroSistemaValor } from "@/lib/parametros";
import { escenarioSimulacionAbusoSchema } from "@/lib/schemas";
import type { z } from "zod";

export type EscenarioSimulacionAbuso = z.infer<typeof escenarioSimulacionAbusoSchema>;

export interface ConfigSugeridaSimulacion {
    escenario: EscenarioSimulacionAbuso;
    n: number;
    ip?: string;
    ips?: string[];
    identificador?: string;
    identificadores?: string[];
    plataforma: string;
    usuarioId?: string;
    descripcion: string;
}

const VENTANA_FRESQUEZA_MS = 2 * 60 * 60 * 1000;

function ipEnRango(base: string, idx: number): string {
    const partes = base.split(".").map(Number);
    partes[3] = (partes[3] + idx) % 256;
    return partes.join(".");
}

function generarRango(base: string, inicio: number, cantidad: number): string[] {
    return Array.from({ length: cantidad }, (_, i) => ipEnRango(base, inicio + i));
}

function identificadorAleatorio(): string {
    return `300${String(Math.floor(Math.random() * 90_000_000) + 10_000_000)}`;
}

function victimasDistintas(cantidad: number): string[] {
    return Array.from({ length: cantidad }, (_, i) => `300${String(10_000_000 + i).padStart(7, "0")}`);
}

/**
 * Busca la primera IP de un rango que no esté en `usadas`.
 * Si todas están usadas, devuelve la primera del rango (fallback determinista).
 */
function primeraIpFresca(rango: string[], usadas: Set<string>): string {
    for (const ip of rango) {
        if (!usadas.has(ip)) return ip;
    }
    return rango[0];
}

/**
 * Devuelve las IPs del rango que NO estén en `usadas`.
 * Si todas lo están, devuelve el rango completo como fallback.
 */
function ipsFrescas(rango: string[], usadas: Set<string>): string[] {
    const frescas = rango.filter((ip) => !usadas.has(ip));
    return frescas.length > 0 ? frescas : rango;
}

async function ipsUsadasVentana(): Promise<Set<string>> {
    const repoSim = new SimulacionAbusoRepository();
    const repoRate = new RateLimitRepository();
    const hace2h = new Date(Date.now() - VENTANA_FRESQUEZA_MS);

    const [usadasEnSim, bloqueadas] = await Promise.all([
        repoSim.buscarIpsUsadas(hace2h),
        repoRate.buscarIpsBloqueadasRecientemente([], hace2h, "report", 0),
    ]);

    return new Set([...usadasEnSim, ...bloqueadas]);
}

/**
 * Genera la configuración sugerida para un escenario.
 * - `robot_inundando`: IP nueva de 192.0.2.0/24, identificador aleatorio, N=50, whatsapp.
 * - `ataque_coordinado`: rango 192.0.2.20-49, mismo identificador nuevo, N=30, whatsapp.
 * - `bot_ips_rotativas`: rango 198.51.100.0/24, identificadores distintos, N=20, telegram.
 * - `denunciante_spam`: usuarioId desde `simulacion.spam.usuario_id`, víctimas distintas, N=15, instagram.
 * - `personalizado`: sin sugerencias.
 */
export async function generarSugerenciasPorEscenario(
    escenario: EscenarioSimulacionAbuso
): Promise<ConfigSugeridaSimulacion> {
    const usadas = await ipsUsadasVentana();

    switch (escenario) {
        case "robot_inundando": {
            const rango = generarRango("192.0.2.1", 0, 253);
            return {
                escenario,
                n: 50,
                ip: primeraIpFresca(rango, usadas),
                plataforma: "whatsapp",
                descripcion:
                    "Simuló un robot enviando N reportes desde una sola IP en poco tiempo. Prueba el rate-limit por IP (5/hora).",
            };
        }
        case "ataque_coordinado": {
            const rango = generarRango("192.0.2.20", 0, 30);
            return {
                escenario,
                n: 30,
                ips: ipsFrescas(rango, usadas),
                identificador: identificadorAleatorio(),
                plataforma: "whatsapp",
                descripcion:
                    "Simuló N personas distintas atacando al mismo teléfono/@. Prueba el rate-limit por identificador (10/hora).",
            };
        }
        case "bot_ips_rotativas": {
            const rango = generarRango("198.51.100.1", 0, 253);
            return {
                escenario,
                n: 20,
                ips: ipsFrescas(rango, usadas).slice(0, 20),
                identificadores: victimasDistintas(20),
                plataforma: "telegram",
                descripcion:
                    "Simuló IPs distintas atacando objetivos distintos. Prueba que el sistema no bloquea IPs legítimas sin señal de abuso.",
            };
        }
        case "denunciante_spam": {
            const usuarioIdParam = await getParametroSistemaValor("simulacion.spam.usuario_id");
            const rango = generarRango("192.0.2.1", 0, 253);
            const config: ConfigSugeridaSimulacion = {
                escenario,
                n: 15,
                ip: primeraIpFresca(rango, usadas),
                identificadores: victimasDistintas(15),
                plataforma: "instagram",
                descripcion:
                    "Simuló usuario autenticado enviando contra víctimas distintas. Prueba el rate-limit por usuario.",
            };
            if (usuarioIdParam) {
                config.usuarioId = usuarioIdParam;
            }
            return config;
        }
        case "personalizado":
        default:
            return {
                escenario,
                n: 10,
                plataforma: "whatsapp",
                descripcion: "Escenario configurable por el operador para pruebas específicas.",
            };
    }
}
