/**
 * SPEC-184 (002-PI-079): simulador de abusos.
 *
 * Genera reportes REALES (sin flag SIMULACION) para que el CEO pueda probar el
 * pipeline anti-abuso en el sandbox. Los reportes se envían por HTTP al endpoint
 * público `/api/reportes` desde un worker separado con advisory lock.
 *
 * Frontera DAL (Q-3): SimulacionAbusoRun solo se toca por su repositorio.
 */
import { SimulacionAbusoRepository, type ConfigSimulacionAbuso } from "@/lib/dal/repositories/simulacion-abuso";
import { validarIpInyectable } from "./rfc5737";
import { sendSimulacionAbuso } from "@/lib/queue";
import { logAudit } from "@/lib/audit";
import { escenarioSimulacionAbusoSchema, simularAbusoBodySchema } from "@/lib/schemas";
import type { z } from "zod";

export type EscenarioSimulacionAbuso = z.infer<typeof escenarioSimulacionAbusoSchema>;
export type SimularAbusoBody = z.infer<typeof simularAbusoBodySchema>;

export interface PayloadSimulacion {
    ip: string;
    identificador: string;
    plataforma: string;
    texto: string;
}

const PLATAFORMA_DEFAULT = "whatsapp";
const IDENTIFICADOR_DEFAULT = "3001234567";
const IP_DEFAULT = "192.0.2.10";

const TEXTOS_ROBOT = [
    "Este número contacta a menores por WhatsApp pidiendo fotos. Lo reporto porque ya son varias personas.",
    "Cuidado con este perfil, escribe mensajes inapropiados a adolescentes.",
    "Reporto este contacto porque intenta conseguir fotos de menores.",
    "Este número envía mensajes de contenido sexual a menores de edad.",
    "Alerta sobre este perfil, se hace pasar por otra persona para contactar niños.",
];

const TEXTOS_ATAQUE = [
    "Este usuario está acosando a una menor en Instagram. Pide fotos privadas.",
    "Reporto esta cuenta por grooming hacia una adolescente.",
    "Este perfil contacta a menores con contenido sexual.",
    "Denuncio a este usuario por pedir imágenes inapropiadas a una niña.",
    "Esta cuenta envía mensajes explícitos a menores.",
];

const TEXTOS_DENUNCIANTE = [
    "Una persona con este número envía mensajes inapropiados a menores.",
    "Reporto este contacto por acoso a adolescentes.",
    "Este número pide fotos privadas a menores.",
    "Cuidado, este perfil contacta a niños con contenido sexual.",
    "Denuncio este número por grooming.",
];

function textoAleatorio(banco: string[]): string {
    return banco[Math.floor(Math.random() * banco.length)];
}

function ipEnRango(base: string, idx: number): string {
    const partes = base.split(".").map(Number);
    partes[3] = (partes[3] + (idx % 254)) % 254 + 1;
    return partes.join(".");
}

/**
 * Genera los payloads del escenario. Toda IP se valida contra RFC 5737 antes
 * de llegar aquí.
 */
export function generarPayloads(params: SimularAbusoBody): PayloadSimulacion[] {
    const n = params.n;
    const baseIp = params.ip ?? IP_DEFAULT;
    const baseIdentificador = params.identificador ?? IDENTIFICADOR_DEFAULT;
    const plataforma = params.plataforma ?? PLATAFORMA_DEFAULT;

    const payloads: PayloadSimulacion[] = [];

    switch (params.escenario) {
        case "robot_inundando": {
            for (let i = 0; i < n; i++) {
                payloads.push({
                    ip: baseIp,
                    identificador: `${baseIdentificador.slice(0, -String(i).length)}${i}`,
                    plataforma,
                    texto: textoAleatorio(TEXTOS_ROBOT),
                });
            }
            break;
        }
        case "ataque_coordinado": {
            for (let i = 0; i < n; i++) {
                payloads.push({
                    ip: ipEnRango(baseIp, i),
                    identificador: baseIdentificador,
                    plataforma,
                    texto: textoAleatorio(TEXTOS_ATAQUE),
                });
            }
            break;
        }
        case "bot_ips_rotativas": {
            for (let i = 0; i < n; i++) {
                payloads.push({
                    ip: ipEnRango(baseIp, i),
                    identificador: `${baseIdentificador.slice(0, -String(i).length)}${i}`,
                    plataforma,
                    texto: textoAleatorio(TEXTOS_ROBOT),
                });
            }
            break;
        }
        case "denunciante_spam": {
            for (let i = 0; i < n; i++) {
                payloads.push({
                    ip: baseIp,
                    identificador: `${baseIdentificador.slice(0, -String(i).length)}${i}`,
                    plataforma,
                    texto: textoAleatorio(TEXTOS_DENUNCIANTE),
                });
            }
            break;
        }
        case "personalizado": {
            for (let i = 0; i < n; i++) {
                payloads.push({
                    ip: baseIp,
                    identificador: baseIdentificador,
                    plataforma,
                    texto: textoAleatorio(TEXTOS_ROBOT),
                });
            }
            break;
        }
    }

    return payloads;
}

/**
 * Crea el registro de simulación en PENDIENTE y encola el job.
 * Valida la IP inyectable contra RFC 5737.
 */
export async function crearSimulacionAbuso(params: SimularAbusoBody, usuarioId: string) {
    const ip = params.ip ?? IP_DEFAULT;
    const validacion = validarIpInyectable(ip);
    if (!validacion.ok) {
        throw new Error(validacion.mensaje);
    }

    const payloads = generarPayloads(params);
    const repo = new SimulacionAbusoRepository();

    const config: ConfigSimulacionAbuso = {
        n: payloads.length,
        ipInyectada: ip,
        identificador: params.identificador ?? baseIdentificadorParaEscenario(params.escenario, ip),
        plataforma: params.plataforma ?? PLATAFORMA_DEFAULT,
    };

    const run = await repo.crear({
        escenario: params.escenario,
        totalReportes: payloads.length,
        creadoPorId: usuarioId,
        configJson: config,
    });

    await logAudit({
        accion: "SIMULACION_ABUSO_INICIADA",
        tipoRecurso: "SimulacionAbusoRun",
        recursoId: run.id,
        usuarioId,
        valorNuevo: JSON.stringify({ escenario: run.escenario, n: run.totalReportes, ip: config.ipInyectada }),
    });

    await sendSimulacionAbuso(run.id);
    return { ...run, configJson: config };
}

function baseIdentificadorParaEscenario(escenario: EscenarioSimulacionAbuso, ip: string): string {
    if (escenario === "ataque_coordinado") return "3000000001";
    if (escenario === "personalizado") return "3001234567";
    // robot/bot/denunciante: usamos la IP como semilla simple para evitar colisiones
    return `300${ip.split(".").pop()?.padStart(4, "0") ?? "1234"}`;
}

/**
 * Cancela una simulación en curso o pendiente. El worker la detecta en el
 * siguiente ciclo y detiene el envío.
 */
export async function cancelarSimulacionAbuso(id: string, usuarioId: string): Promise<boolean> {
    const repo = new SimulacionAbusoRepository();
    const run = await repo.findById(id);
    if (!run) return false;
    if (run.estado !== "PENDIENTE" && run.estado !== "EN_PROGRESO") return false;

    await repo.actualizarEstado(id, "CANCELADA", new Date());
    await logAudit({
        accion: "SIMULACION_ABUSO_CANCELADA",
        tipoRecurso: "SimulacionAbusoRun",
        recursoId: id,
        usuarioId,
        valorAnterior: run.estado,
        valorNuevo: "CANCELADA",
    });
    return true;
}
