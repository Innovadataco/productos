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
import { programar, despacharEnvios } from "@/lib/notificaciones";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { calcularVenceEn } from "@/lib/profesionales/vigencia";
import { VerificadorRepository } from "@/lib/dal/repositories/verificador-repository";
import { leerRequisitosVerificacion, type ItemChecklist, type RequisitoVerificacion } from "./requisitos";
import { DocumentoProfesionalRepository } from "@/lib/dal/repositories/documento-profesional";
import { estadoDeDocumentos, type EstadoDocumento } from "@/lib/profesional/documentos.service";
import { AutorizacionProfesionalService } from "@/lib/dal/services/autorizacion-profesional";

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

// ────────────────────────────────────────────────────────────────────────────
// SPEC-693 (I-416) · Cola 3 — «Documentos nuevos» (renovaciones por requisito)
// ────────────────────────────────────────────────────────────────────────────

export interface VersionDocumentoFila {
    extension: string;
    subidoEn: string; // ISO
}

export interface RequisitoRenovacion {
    clave: string;
    nombre: string;
    /** La versión aprobada que sigue respaldando mientras se revisa la nueva. */
    vigente: VersionDocumentoFila | null;
    /** La versión nueva EN_REVISION que el verificador tiene que aprobar o devolver. */
    nuevo: VersionDocumentoFila;
}

export interface FilaRenovacion {
    profesionalId: string; // = perfil.id, el [id] de la ruta de renovación
    nombreVisible: string;
    email: string;
    tituloProfesional: string;
    ciudadNombre: string;
    /**
     * Vigencia actual del profesional. La vista pinta la franja ÁMBAR si vence en ≤30
     * días (Diseño): es la única urgencia real — si vence mientras el documento espera,
     * la compuerta frena al profesional. Renovar un requisito NO mueve esta fecha.
     */
    venceEn: string | null;
    requisitos: RequisitoRenovacion[];
}

/**
 * SPEC-693 · cola de profesionales ACTIVOS que subieron una versión nueva de algún
 * requisito. Un renglón por profesional; dentro, los requisitos con versión nueva, con
 * la vigente y la nueva lado a lado. «documento nuevo», nunca «renovación» (Diseño: la
 * palabra reabre la confusión tarjeta/verificación que SPEC-691 cerró).
 */
export async function listarRenovaciones(): Promise<FilaRenovacion[]> {
    const [perfiles, requisitos] = await Promise.all([
        new VerificadorRepository().listarRenovacionesPendientes(),
        leerRequisitosVerificacion(),
    ]);
    const nombrePorClave = new Map(requisitos.map((r) => [r.clave, r.nombre]));

    return perfiles.map((p) => {
        type Doc = (typeof p.documentos)[number];
        const porClave = new Map<string, { vigente?: Doc; pendiente?: Doc }>();
        for (const d of p.documentos) {
            const slot = porClave.get(d.requisitoClave) ?? {};
            if (d.estado === "VIGENTE") slot.vigente = d;
            else if (d.estado === "EN_REVISION") slot.pendiente = d;
            porClave.set(d.requisitoClave, slot);
        }
        const requisitosPendientes: RequisitoRenovacion[] = [...porClave.entries()]
            .filter(([, s]) => s.pendiente !== undefined)
            .map(([clave, s]) => ({
                clave,
                nombre: nombrePorClave.get(clave) ?? clave,
                vigente: s.vigente
                    ? { extension: s.vigente.extension, subidoEn: s.vigente.subidoEn.toISOString() }
                    : null,
                nuevo: { extension: s.pendiente!.extension, subidoEn: s.pendiente!.subidoEn.toISOString() },
            }));
        return {
            profesionalId: p.id,
            nombreVisible: p.nombreVisible,
            email: p.usuario.email,
            tituloProfesional: p.tituloProfesional,
            ciudadNombre: p.ciudad.nombre,
            venceEn: p.verificaciones[0]?.venceEn.toISOString() ?? null,
            requisitos: requisitosPendientes,
        };
    });
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
    autorizacionArchivoId: string | null;
    requisitos: RequisitoVerificacion[];
    /**
     * SPEC-436: qué documento tiene cargado cada requisito. `cargado: false` es
     * lo que la ficha pinta como «sin documento» — y lo que impide el CUMPLE.
     */
    documentos: EstadoDocumento[];
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
        autorizacionArchivoId: perfil.autorizacionArchivoId,
        requisitos,
        documentos: await estadoDeDocumentos(perfil.id),
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
    // SPEC-686 (I-420): la revisión necesita una autorización PREVIA. Acepta la ACEPTACIÓN en
    // pantalla (mecanismo nuevo) o el archivo firmado (legacy, filas pre-686). Sin ninguna, no
    // se decide — «una verificación no puede quedar revisada sin autorización con fecha anterior»
    // (candado de anterioridad). La aceptación se busca con fecha <= ahora, así que la que se
    // registre en la verificación SIEMPRE es previa a `revisadoEn`.
    const aceptacionPrevia = await new AutorizacionProfesionalService().aceptacionAntesDe(
        perfil.usuarioId,
        new Date(),
    );
    if (!aceptacionPrevia && !perfil.autorizacionArchivoId) {
        throw new AppError(
            "El profesional no tiene una autorización previa (aceptada en pantalla ni archivo firmado) — no se puede decidir sin ella.",
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

    // SPEC-436 (I-304) · no se puede marcar CUMPLE un requisito del que NADIE
    // cargó documento: hasta hoy se podía aprobar sin haber visto nada. La
    // guardia vive acá, en el servidor, y no solo en la pantalla — una guardia
    // que solo deshabilita un botón se saltea con una petición directa.
    const cumple = requisitos.filter((r) => entrada.checklist[r.clave].estado === "CUMPLE");
    if (cumple.length > 0) {
        const cargados = new Set(
            (await new DocumentoProfesionalRepository().listarPorPerfil(perfil.id)).map(
                (d) => d.requisitoClave,
            ),
        );
        const sinDocumento = cumple.filter((r) => !cargados.has(r.clave));
        if (sinDocumento.length > 0) {
            throw new AppError(
                `No se puede marcar CUMPLE sin el documento cargado. Falta: ${sinDocumento.map((r) => r.nombre).join(", ")}`,
                ERROR_CODES.VALIDATION_ERROR,
                400,
            );
        }
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

    // SPEC-418 (I-295): el aviso se ENCOLA DENTRO de la transacción, junto con
    // la decisión que lo origina. Antes se enviaba después, directo por Resend y
    // con el error tragado: con el proveedor caído el profesional nunca se
    // enteraba de que le devolvieron y no quedaba rastro. Como de este aviso
    // depende que el ciclo siga, sin él el profesional espera para siempre.
    const observaciones = noCumple.map((r) => ({
        requisito: r.nombre,
        observacion: entrada.checklist[r.clave].observacion.trim(),
    }));

    const { perfil: perfilActualizado, verificacion, envios } = await repo.transaccion(async (tx) => {
        const repoTx = new VerificadorRepository(tx);
        const verificacion = await repoTx.crearVerificacion({
            perfilProfesionalId: perfil.id,
            revisadoPorId: verificador.id,
            revisadoEn,
            checklist: entrada.checklist as unknown as Prisma.InputJsonValue,
            resultado,
            // SPEC-686: se registra la vía que respaldó la revisión — la aceptación previa
            // (mecanismo nuevo) y/o el archivo legacy. Una de las dos existe (guarda de arriba).
            autorizacionArchivoId: perfil.autorizacionArchivoId,
            aceptacionAutorizacionId: aceptacionPrevia?.id ?? null,
            venceEn,
            notaInterna,
        });
        const perfilActualizado = await repoTx.cambiarEstadoPerfil(perfil.id, nuevoEstadoPerfil);

        // SPEC-693 (I-416): al APROBAR, cada requisito queda respaldado por su versión
        // VIGENTE y la verificación fija en la tabla de unión QUÉ bytes revisó. Se
        // promueve la versión pendiente si el profesional subió una nueva (la anterior
        // pasa a SUPERSEDIDA, no se pierde); si no re-subió ese requisito, se re-aprueba
        // la vigente. Reemplazar un documento más tarde ya no puede alterar los bytes que
        // respaldan ESTA verificación — el candado de integridad lo custodia.
        if (resultado === "APROBADO") {
            const docRepo = new DocumentoProfesionalRepository(tx);
            const idsRevisados: string[] = [];
            for (const r of requisitos) {
                const promovida = await docRepo.promoverPendienteAVigente(perfil.id, r.clave);
                const vigente = promovida ?? (await docRepo.buscarVigente(perfil.id, r.clave));
                if (vigente) idsRevisados.push(vigente.id);
            }
            await repoTx.registrarDocumentosRevisados(verificacion.id, idsRevisados);
        }

        const aviso = await programar(
            {
                evento:
                    resultado === "APROBADO"
                        ? "profesional.verificacion.aprobada"
                        : "profesional.verificacion.devuelta",
                sujetoTipo: "PerfilProfesional",
                sujetoId: perfil.id,
                destinatarios: [
                    {
                        usuarioId: perfil.usuarioId,
                        email: perfil.usuario.email,
                        rol: "PROFESIONAL",
                        variables: {
                            nombreProfesional: perfil.nombreVisible,
                            detalleObservaciones: observaciones
                                .map((o, i) => `${i + 1}. ${o.requisito}: ${o.observacion}`)
                                .join("\n"),
                        },
                    },
                ],
            },
            { tx },
        );

        // Falla en CERRADO: si no hay regla activa no habría a quién avisar, y
        // committear la decisión dejaría al profesional esperando sin saberlo —
        // que es exactamente I-295. Mejor que la decisión no pase y se vea el
        // error, a que pase y desaparezca el aviso. Las reglas se siembran en
        // `prisma/seed.ts` (`seedVerificacionProfesional`) y son `obligatoria`,
        // así que una preferencia del profesional no puede dejarlo en cero.
        if (aviso.programadas === 0) {
            throw new AppError(
                "No se pudo encolar el aviso al profesional: falta la regla activa del motor de notificaciones. La decisión no se guardó.",
                ERROR_CODES.INTERNAL_ERROR,
                500,
            );
        }

        return { perfil: perfilActualizado, verificacion, envios: aviso.envios ?? [] };
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

    // Ya committeado: se le avisa al worker para que salga ahora en vez de
    // esperar al próximo poll. Si esto falla no se pierde nada — la fila está
    // ENCOLADA en la base y el polling de respaldo la recoge.
    await despacharEnvios(envios);

    return { resultado, perfil: perfilActualizado, verificacion };
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
