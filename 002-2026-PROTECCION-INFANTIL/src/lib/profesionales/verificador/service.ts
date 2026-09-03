/**
 * SPEC-408 (A-75 · brief §9) — Service del Verificador.
 *
 * Encapsula la mutación del perfil profesional a partir de una decisión del
 * Verificador. Todo pasa por acá: los endpoints son capas finas.
 *
 * Candados legales (Ley 1918/2018 · 2375/2024 · brief §5):
 *   - `checklist`, `resultado`, `notaInterna` NUNCA salen por API pública.
 *     Los DTOs son distintos para el Verificador y para el profesional.
 *   - La aprobación exige que TODOS los ítems configurados estén en `CUMPLE`.
 *   - El rechazo exige observación escrita en cada ítem `NO_CUMPLE`: sin
 *     observación no se puede devolver — el profesional tiene que saber qué
 *     corregir (brief §5-bis "sin observación no se puede rechazar").
 *   - `venceEn = revisadoEn + 4 meses` (Ley 2375/2024) via `calcularVenceEn`.
 *   - Ciclo sin límite: rechazar/aprobar re-crean fila en `VerificacionProfesional`
 *     (historial completo — el modelo es N por profesional).
 */
import type {
    PerfilProfesional,
    Prisma,
    ResultadoVerificacion,
    Usuario,
    VerificacionProfesional,
} from "@prisma/client";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { enviarEmailNotificacion } from "@/lib/notificaciones/enviar-email";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { calcularVenceEn } from "@/lib/profesionales/vigencia";
import { VerificadorRepository } from "@/lib/dal/repositories/verificador-repository";
import { leerRequisitosVerificacion, type ItemChecklist, type RequisitoVerificacion } from "./requisitos";

// ────────────────────────────────────────────────────────────────────────────
// Schemas de entrada (validación en el borde)
// ────────────────────────────────────────────────────────────────────────────

const itemChecklistSchema = z.object({
    estado: z.enum(["CUMPLE", "NO_CUMPLE"]),
    observacion: z.string().max(1000).optional().default(""),
});

export const decidirSchema = z.object({
    /**
     * Mapa `claveRequisito → { estado, observacion }`. El service verifica que
     * cubra todos los requisitos configurados en el momento de la decisión;
     * cualquier clave desconocida o faltante rompe el envío antes de tocar BD.
     */
    checklist: z.record(z.string(), itemChecklistSchema).refine((r) => Object.keys(r).length > 0, {
        message: "checklist vacío",
    }),
});

export type DecisionEntrada = z.infer<typeof decidirSchema>;

// ────────────────────────────────────────────────────────────────────────────
// Consultas — cola y ficha
// ────────────────────────────────────────────────────────────────────────────

export interface FilaColaVerificacion {
    solicitudId: string;
    profesionalId: string;
    nombreVisible: string;
    email: string;
    ciudadNombre: string;
    tituloProfesional: string;
    especialidades: string[];
    reintentos: number;
    esperandoDesde: string; // ISO
}

/**
 * Cola de solicitudes en `EN_REVISION`. Ordenada por antigüedad ascendente
 * (la más vieja primero — la que más lleva esperando pide más atención).
 * Solo campos que se pintan en la lista; `checklist` / `resultado` / URLs
 * NO salen por acá.
 */
export async function listarSolicitudesEnRevision(): Promise<FilaColaVerificacion[]> {
    const perfiles = await new VerificadorRepository().listarPerfilesEnRevision();
    return perfiles.map((p) => ({
        solicitudId: p.id,
        profesionalId: p.usuarioId,
        nombreVisible: p.nombreVisible,
        email: p.usuario.email,
        ciudadNombre: p.ciudad.nombre,
        tituloProfesional: p.tituloProfesional,
        especialidades: p.especialidades,
        reintentos: p.verificaciones.length,
        esperandoDesde: p.actualizadoEn.toISOString(),
    }));
}

export interface FichaVerificacion {
    solicitudId: string;
    profesional: {
        id: string;
        nombreVisible: string;
        email: string;
        tituloProfesional: string;
        especialidades: string[];
        ciudadNombre: string;
        aniosExperiencia: number;
        presentacion: string;
        atiendeVirtual: boolean;
        atiendePresencial: boolean;
    };
    autorizacionArchivoUrl: string | null;
    requisitos: RequisitoVerificacion[];
    /** Checklist actual (si hay verificación previa) o vacío. */
    checklist: Record<string, ItemChecklist>;
    historial: Array<{
        id: string;
        resultado: ResultadoVerificacion;
        revisadoPor: string;
        revisadoEn: string;
        notaInterna: string | null;
    }>;
}

/**
 * Devuelve la ficha completa VISTA POR EL VERIFICADOR. Contiene datos internos
 * (URL de autorización, notaInterna del historial, checklist). Nunca serializar
 * este objeto en un endpoint público; el Verificador lee, el profesional no.
 */
export async function abrirFicha(solicitudId: string): Promise<FichaVerificacion> {
    const perfil = await new VerificadorRepository().obtenerFicha(solicitudId);
    if (!perfil) {
        throw new AppError("Solicitud no encontrada", ERROR_CODES.NOT_FOUND, 404);
    }

    const requisitos = await leerRequisitosVerificacion();
    const ultimaChecklist = perfil.verificaciones[0]?.checklist as unknown as Record<string, ItemChecklist> | undefined;

    return {
        solicitudId: perfil.id,
        profesional: {
            id: perfil.usuarioId,
            nombreVisible: perfil.nombreVisible,
            email: perfil.usuario.email,
            tituloProfesional: perfil.tituloProfesional,
            especialidades: perfil.especialidades,
            ciudadNombre: perfil.ciudad.nombre,
            aniosExperiencia: perfil.aniosExperiencia,
            presentacion: perfil.presentacion,
            atiendeVirtual: perfil.atiendeVirtual,
            atiendePresencial: perfil.atiendePresencial,
        },
        autorizacionArchivoUrl: perfil.autorizacionArchivoUrl,
        requisitos,
        checklist:
            ultimaChecklist ??
            Object.fromEntries(requisitos.map((r) => [r.clave, { estado: "PENDIENTE" as const, observacion: "" }])),
        historial: perfil.verificaciones.map((v) => ({
            id: v.id,
            resultado: v.resultado,
            revisadoPor: v.revisadoPor.email,
            revisadoEn: v.revisadoEn.toISOString(),
            notaInterna: v.notaInterna,
        })),
    };
}

// ────────────────────────────────────────────────────────────────────────────
// Decisión — aprobar o devolver
// ────────────────────────────────────────────────────────────────────────────

export interface ResultadoDecision {
    resultado: ResultadoVerificacion;
    perfil: PerfilProfesional;
    verificacion: VerificacionProfesional;
}

/**
 * Toma una decisión sobre una solicitud. La forma de la decisión sale del
 * checklist:
 *   - Todos CUMPLE → APROBADO → perfil pasa a `ACTIVO`, entra al directorio.
 *   - Al menos uno NO_CUMPLE → RECHAZADO (devolución con observaciones) →
 *     perfil vuelve a `BORRADOR` para que el profesional corrija y reenvíe.
 *
 * Rechaza el request si:
 *   - la solicitud no está `EN_REVISION`,
 *   - el checklist no cubre todos los requisitos configurados,
 *   - hay al menos un ítem `NO_CUMPLE` sin observación,
 *   - se intenta aprobar con algún NO_CUMPLE presente.
 *
 * Envía email al profesional en ambos casos (aviso positivo o de corrección).
 */
export async function decidir(
    solicitudId: string,
    verificador: Pick<Usuario, "id" | "email">,
    entrada: DecisionEntrada,
): Promise<ResultadoDecision> {
    const repo = new VerificadorRepository();
    const perfil = await repo.obtenerFicha(solicitudId);
    if (!perfil) throw new AppError("Solicitud no encontrada", ERROR_CODES.NOT_FOUND, 404);
    if (perfil.estado !== "EN_REVISION") {
        throw new AppError(
            `La solicitud está en estado ${perfil.estado} y no acepta una decisión ahora.`,
            ERROR_CODES.VALIDATION_ERROR,
            409,
        );
    }
    if (!perfil.autorizacionArchivoUrl) {
        throw new AppError(
            "El profesional aún no subió la autorización firmada — no se puede decidir sin ella.",
            ERROR_CODES.VALIDATION_ERROR,
            409,
        );
    }

    const requisitos = await leerRequisitosVerificacion();
    const clavesConfiguradas = new Set(requisitos.map((r) => r.clave));
    const clavesEnviadas = new Set(Object.keys(entrada.checklist));

    // El checklist tiene que ser exactamente los requisitos configurados —
    // ni faltantes (el Verificador tiene que decidir sobre cada ítem) ni sobrantes
    // (una clave desconocida es un cliente desactualizado o un intento).
    const faltantes = [...clavesConfiguradas].filter((k) => !clavesEnviadas.has(k));
    const sobrantes = [...clavesEnviadas].filter((k) => !clavesConfiguradas.has(k));
    if (faltantes.length > 0 || sobrantes.length > 0) {
        throw new AppError(
            `Checklist inválido — faltan: [${faltantes.join(", ")}]; sobran: [${sobrantes.join(", ")}]`,
            ERROR_CODES.VALIDATION_ERROR,
            400,
        );
    }

    const noCumple = requisitos.filter((r) => entrada.checklist[r.clave].estado === "NO_CUMPLE");
    const sinObservacion = noCumple.filter((r) => !entrada.checklist[r.clave].observacion.trim());
    if (sinObservacion.length > 0) {
        // Regla dura del brief §5-bis: sin observación no se puede rechazar.
        throw new AppError(
            `Cada ítem "NO CUMPLE" exige observación escrita. Faltan: ${sinObservacion.map((r) => r.nombre).join(", ")}`,
            ERROR_CODES.VALIDATION_ERROR,
            400,
        );
    }

    // Brief §5-bis + veredicto CEO 16:2x: **el ciclo no tiene rechazo terminal**.
    // Devolver ≠ rechazar; el profesional corrige y reenvía sin límite hasta
    // aprobar. Por eso la devolución se marca como MAS_INFORMACION, y
    // `ResultadoVerificacion.RECHAZADO` queda SIN USO en este flujo (Verificador
    // no lo emite jamás). El enum lo conserva por compatibilidad y por si un
    // caso adverso futuro lo requiere; hoy es efectivamente huérfano acá.
    const resultado: ResultadoVerificacion = noCumple.length === 0 ? "APROBADO" : "MAS_INFORMACION";
    const revisadoEn = new Date();
    const venceEn = calcularVenceEn(revisadoEn);

    const nuevoEstadoPerfil = resultado === "APROBADO" ? "ACTIVO" : "BORRADOR";
    // La nota interna se usa como resumen indexable de la devolución (aparece en
    // el historial); el detalle por ítem vive en `checklist`. Nunca sale por API pública.
    const notaInterna =
        resultado === "APROBADO"
            ? "Verificación aprobada."
            : `Devuelto con ${noCumple.length} ítem(s) por corregir: ${noCumple.map((r) => r.nombre).join(", ")}`;

    const { perfil: perfilActualizado, verificacion } = await repo.transaccion(async (tx) => {
        const repoTx = new VerificadorRepository(tx);
        const verificacion = await repoTx.crearVerificacion({
            perfilProfesionalId: perfil.id,
            revisadoPorId: verificador.id,
            revisadoEn,
            checklist: entrada.checklist as unknown as Prisma.InputJsonValue,
            resultado,
            autorizacionArchivoUrl: perfil.autorizacionArchivoUrl!,
            venceEn,
            notaInterna,
        });
        const perfilActualizado = await repoTx.cambiarEstadoPerfil(perfil.id, nuevoEstadoPerfil);
        return { perfil: perfilActualizado, verificacion };
    });

    // Audit + email fuera de la transacción — un problema del proveedor no
    // debe revertir la decisión clínica del Verificador (mismo criterio que
    // otras acciones con notificación).
    // Devolver ≠ rechazar: emitimos _MAS_INFO, no _RECHAZADA. _RECHAZADA queda
    // reservada para un caso terminal futuro que hoy no existe.
    const accionAudit =
        resultado === "APROBADO" ? "PROFESIONAL_VERIFICACION_APROBADA" : "PROFESIONAL_VERIFICACION_MAS_INFO";
    await logAudit({
        usuarioId: verificador.id,
        accion: accionAudit,
        tipoRecurso: "PerfilProfesional",
        recursoId: perfil.id,
        metadatos: { resultado, itemsNoCumple: noCumple.map((r) => r.clave) },
    });

    try {
        await enviarEmailProfesional({
            emailProfesional: perfil.usuario.email,
            nombreProfesional: perfil.nombreVisible,
            resultado,
            observaciones: noCumple.map((r) => ({
                requisito: r.nombre,
                observacion: entrada.checklist[r.clave].observacion.trim(),
            })),
        });
    } catch (err) {
        // No propagar — el envío es best-effort y ya se auditó la decisión.
        // El worker de notificaciones tiene su propio reintento; el motor de
        // email no es de misión crítica para cerrar la decisión.
        console.error("[SPEC-408] envío de email al profesional falló:", err);
    }

    return { resultado, perfil: perfilActualizado, verificacion };
}

async function enviarEmailProfesional(params: {
    emailProfesional: string;
    nombreProfesional: string;
    resultado: ResultadoVerificacion;
    observaciones: Array<{ requisito: string; observacion: string }>;
}): Promise<void> {
    if (params.resultado === "APROBADO") {
        await enviarEmailNotificacion(
            params.emailProfesional,
            "Tu perfil profesional fue aprobado",
            [
                `Hola ${params.nombreProfesional},`,
                "",
                "Verificamos tus documentos y tu perfil quedó activo. Ya podés cargar tu carta de",
                "presentación, tu disponibilidad y aparecer en el directorio de familias.",
                "",
                "Ingresá a la plataforma para continuar.",
                "",
                "— Protección Infantil",
            ].join("\n"),
        );
        return;
    }
    const detalle = params.observaciones
        .map((o, i) => `${i + 1}. ${o.requisito}: ${o.observacion}`)
        .join("\n");
    await enviarEmailNotificacion(
        params.emailProfesional,
        "Necesitamos que corrijas algunos documentos",
        [
            `Hola ${params.nombreProfesional},`,
            "",
            "Revisamos tu solicitud y hay ítems por corregir antes de aprobar tu perfil:",
            "",
            detalle,
            "",
            "Ingresá, ajustá lo indicado y reenviá — el ciclo se repite hasta aprobar.",
            "",
            "— Protección Infantil",
        ].join("\n"),
    );
}

// ────────────────────────────────────────────────────────────────────────────
// Cola 2 — Incidentes de citas
// ────────────────────────────────────────────────────────────────────────────

export interface FilaIncidente {
    solicitudId: string;
    padre: { email: string; nombre: string | null };
    profesional: { email: string; nombreVisible: string };
    fechaCita: string; // ISO
    montoTotal: number;
    estadoDesde: string; // ISO
    /**
     * SPEC-408 §9 · momento 6 · "traza de códigos a la vista": el modelo de
     * los dos códigos (cita/expediente) todavía no existe (spec futuro).
     * Este campo queda cableado para que el candado de Calidad lo vea; hoy
     * viene como null y la UI pinta "pendiente de instrumentación".
     */
    trazaCodigos: null;
}

/**
 * Cola 2 · citas en `SIN_CONFIRMAR` — el par padre × profesional no cerró la
 * cita y toca revisar. La ordenamos por `actualizadoEn` desc (lo más reciente
 * primero: los incidentes viejos ya fueron mirados o cerraron por autocierre).
 */
export async function listarIncidentesCitas(): Promise<FilaIncidente[]> {
    const solicitudes = await new VerificadorRepository().listarIncidentesSinConfirmar();
    return solicitudes.map((s) => ({
        solicitudId: s.id,
        padre: { email: s.padreUsuario.email, nombre: s.padreUsuario.nombre },
        profesional: { email: s.profesional.usuario.email, nombreVisible: s.profesional.nombreVisible },
        fechaCita: s.creadoEn.toISOString(),
        montoTotal: s.montoTotal,
        estadoDesde: s.actualizadoEn.toISOString(),
        trazaCodigos: null,
    }));
}
