/**
 * SPEC-184 (002-PI-079) + SPEC-185: simulador de abusos.
 *
 * Genera reportes REALES (sin flag SIMULACION) para que el CEO pueda probar el
 * pipeline anti-abuso en el sandbox. Los reportes se envían por HTTP al endpoint
 * público `/api/reportes` desde un worker separado con advisory lock.
 *
 * Frontera DAL (Q-3): SimulacionAbusoRun solo se toca por su repositorio.
 */
import { SimulacionAbusoRepository, type ConfigSimulacionAbuso } from "../dal/repositories/simulacion-abuso";
import { UsuarioRepository } from "../dal/repositories/usuario";
import { validarIpInyectable } from "./rfc5737";
import { sendSimulacionAbuso } from "../queue";
import { logAudit } from "../audit";
import { AppError } from "../errors";
import { escenarioSimulacionAbusoSchema, simularAbusoBodySchema } from "../schemas";
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

function primeraIpValida(params: SimularAbusoBody): string {
    if (params.ips && params.ips.length > 0) return params.ips[0];
    return params.ip ?? IP_DEFAULT;
}

function validarIpsInyectables(params: SimularAbusoBody): void {
    const ips: string[] = [];
    if (params.ip) ips.push(params.ip);
    if (params.ips) ips.push(...params.ips);
    for (const ip of new Set(ips)) {
        const validacion = validarIpInyectable(ip);
        if (!validacion.ok) {
            throw new AppError(validacion.mensaje, "VALIDATION_ERROR", 400);
        }
    }
}

function identificadorParaEscenario(params: SimularAbusoBody, ip: string, idx: number): string {
    if (params.identificadores && params.identificadores.length > 0) {
        return params.identificadores[idx % params.identificadores.length];
    }
    if (params.identificador) return params.identificador;
    if (params.escenario === "ataque_coordinado") return "3000000001";
    if (params.escenario === "personalizado") return "3001234567";
    return `300${ip.split(".").pop()?.padStart(4, "0") ?? "1234"}`;
}

function ipParaIndice(params: SimularAbusoBody, idx: number): string {
    if (params.ips && params.ips.length > 0) {
        return params.ips[idx % params.ips.length];
    }
    const baseIp = params.ip ?? IP_DEFAULT;
    if (params.escenario === "ataque_coordinado" || params.escenario === "bot_ips_rotativas") {
        return ipEnRango(baseIp, idx);
    }
    return baseIp;
}

function textoParaEscenario(escenario: EscenarioSimulacionAbuso): string {
    if (escenario === "ataque_coordinado") return textoAleatorio(TEXTOS_ATAQUE);
    if (escenario === "denunciante_spam") return textoAleatorio(TEXTOS_DENUNCIANTE);
    return textoAleatorio(TEXTOS_ROBOT);
}

/**
 * Genera los payloads del escenario. Toda IP se valida contra RFC 5737 antes
 * de llegar aquí.
 */
export function generarPayloads(params: SimularAbusoBody): PayloadSimulacion[] {
    const n = params.n;
    const plataforma = params.plataforma ?? PLATAFORMA_DEFAULT;

    const payloads: PayloadSimulacion[] = [];

    for (let i = 0; i < n; i++) {
        const ip = ipParaIndice(params, i);
        payloads.push({
            ip,
            identificador: identificadorParaEscenario(params, ip, i),
            plataforma,
            texto: textoParaEscenario(params.escenario),
        });
    }

    return payloads;
}

/**
 * Crea el registro de simulación en PENDIENTE y encola el job.
 * Valida la IP inyectable contra RFC 5737 y, para denunciante_spam, exige un
 * usuario PARENT activo.
 */
export async function crearSimulacionAbuso(params: SimularAbusoBody, usuarioId: string, opts?: { nota?: string | null | undefined }) {
    validarIpsInyectables(params);

    if (params.escenario === "denunciante_spam") {
        if (!params.usuarioId) {
            throw new AppError(
                "Falta configurar simulacion.spam.usuario_id en Configuración → Sistema. Debe apuntar al id de un usuario PARENT de prueba.",
                "VALIDATION_ERROR",
                400
            );
        }
        const usuario = await new UsuarioRepository().findById(params.usuarioId);
        if (!usuario || usuario.rol !== "PARENT" || usuario.estado !== "activo") {
            throw new AppError(
                "El usuario configurado en simulacion.spam.usuario_id no existe o no es un PARENT activo.",
                "VALIDATION_ERROR",
                400
            );
        }
    }

    const ip = primeraIpValida(params);
    const payloads = generarPayloads(params);
    const repo = new SimulacionAbusoRepository();

    const config: ConfigSimulacionAbuso = {
        n: payloads.length,
        ipInyectada: ip,
        identificador:
            params.identificador ??
            (params.identificadores && params.identificadores.length > 0 ? params.identificadores[0] : IDENTIFICADOR_DEFAULT),
        plataforma: params.plataforma ?? PLATAFORMA_DEFAULT,
        ...(params.usuarioId ? { usuarioId: params.usuarioId } : {}),
    };

    const run = await repo.crear({
        escenario: params.escenario,
        totalReportes: payloads.length,
        creadoPorId: usuarioId,
        configJson: config,
        nota: opts?.nota,
    });

    await logAudit({
        accion: "SIMULACION_ABUSO_INICIADA",
        tipoRecurso: "SimulacionAbusoRun",
        recursoId: run.id,
        usuarioId,
        valorNuevo: JSON.stringify({
            escenario: run.escenario,
            n: run.totalReportes,
            ip: config.ipInyectada,
            conUsuario: !!config.usuarioId,
        }),
    });

    await sendSimulacionAbuso(run.id);
    return { ...run, configJson: config };
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

    await repo.actualizarEstado(id, "CANCELADA");
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
