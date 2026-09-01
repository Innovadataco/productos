/**
 * SPEC-159 (FR-002/FR-003/FR-004) — Seguimiento del caso del colegio.
 *
 * El caso ES la alerta (1:1). La línea de tiempo se deriva SOLO de fuentes
 * reales: creación de la alerta (detectado), AuditLog COLEGIO_ALERTA_ESTADO
 * (vista/gestionada con fechas reales), RegistroAvisoColegio por reporteId
 * (avisado: ENVIADO es la verdad; OMITIDO/PENDIENTE_DIGEST/FALLIDO se muestran
 * con su estado honesto) y EventoMatch por reporteId (corroborado: solo
 * agregados, FR-009). Un hito que no ocurrió aparece PENDIENTE, nunca
 * inventado. "Lo que falta que haga el rector" se computa de datos reales
 * (estado de la alerta + existencia de notas).
 *
 * I-28/I-29: el DTO nunca incluye el valor del identificador, texto del
 * reporte, denunciantes, ciudades ni scores.
 */
import { logAudit } from "@/lib/audit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { withUnitOfWork } from "@/lib/dal/unit-of-work";
import { AlertaColegioRepository } from "@/lib/dal/repositories/alerta-colegio";
import { AuditLogRepository } from "@/lib/dal/repositories/audit-log";
import { RegistroAvisoColegioRepository } from "@/lib/dal/repositories/registro-aviso-colegio";
import { EventoMatchRepository } from "@/lib/dal/repositories/evento-match";
import { SeguimientoCasoRepository } from "@/lib/dal/repositories/seguimiento-caso";
import type { TipoSujeto } from "@/lib/dal/repositories/alerta-colegio";

export type TipoHitoCaso = "detectado" | "corroborado" | "vista" | "gestionada" | "avisado";

/** DTO de la línea de tiempo (Key Entities de la spec): fecha null = pendiente. */
export interface HitoCaso {
    tipo: TipoHitoCaso;
    estado: "cumplido" | "pendiente";
    fecha: string | null;
    detalle: string;
}

export interface FuentesTimeline {
    alertaCreadoEn: Date;
    /** Filas de AuditLog COLEGIO_ALERTA_ESTADO de la alerta, asc. */
    hitosEstado: { valorNuevo: string | null; creadoEn: Date }[];
    /** Registros de aviso del colegio para el reporte de la alerta, asc. */
    avisos: { tipoEvento: string; estado: string; creadoEn: Date; actualizadoEn: Date }[];
    /** Match agregado del reporte (FR-009): null si no hubo corroboración. */
    match: { conteoAcumulado: number; interCiudad: boolean; creadoEn: Date } | null;
}

const ORDEN_HITOS: TipoHitoCaso[] = ["detectado", "corroborado", "vista", "gestionada", "avisado"];

/** Estado destino de un cambio de alerta, leído del valorNuevo del audit (tolerante). */
function estadoDestino(valorNuevo: string | null): string | null {
    if (!valorNuevo) return null;
    try {
        const parsed: unknown = JSON.parse(valorNuevo);
        if (parsed && typeof parsed === "object" && "estado" in parsed && typeof parsed.estado === "string") {
            return parsed.estado;
        }
        return null;
    } catch {
        return null;
    }
}

/**
 * Arma la línea de tiempo del caso (pura). Cumplidos primero en orden
 * cronológico asc; pendientes al final en orden canónico. Detalles en
 * terminología §3 (cero jerga técnica).
 */
export function armarTimeline(fuentes: FuentesTimeline): HitoCaso[] {
    const hitos = new Map<TipoHitoCaso, HitoCaso>();

    hitos.set("detectado", {
        tipo: "detectado",
        estado: "cumplido",
        fecha: fuentes.alertaCreadoEn.toISOString(),
        detalle: "Se detectó un reporte de la comunidad sobre un identificador registrado",
    });

    hitos.set(
        "corroborado",
        fuentes.match
            ? {
                tipo: "corroborado",
                estado: "cumplido",
                fecha: fuentes.match.creadoEn.toISOString(),
                detalle: `Corroborado por un segundo reporte independiente (${fuentes.match.conteoAcumulado} reportes acumulados${
                    fuentes.match.interCiudad ? ", desde más de una ciudad" : ""
                })`,
            }
            : {
                tipo: "corroborado",
                estado: "pendiente",
                fecha: null,
                detalle: "Aún no hay un segundo reporte independiente que lo corrobore",
            }
    );

    for (const [tipo, estadoBuscado, pendiente] of [
        ["vista", "vista", "Aún no la has revisado"],
        ["gestionada", "gestionada", "Aún no está gestionada"],
    ] as const) {
        const hito = fuentes.hitosEstado.find((h) => estadoDestino(h.valorNuevo) === estadoBuscado);
        hitos.set(
            tipo,
            hito
                ? {
                    tipo,
                    estado: "cumplido",
                    fecha: hito.creadoEn.toISOString(),
                    detalle: tipo === "vista" ? "Revisaste la alerta" : "Marcaste la alerta como gestionada",
                }
                : { tipo, estado: "pendiente", fecha: null, detalle: pendiente }
        );
    }

    const avisoEnviado = fuentes.avisos.find((a) => a.estado === "ENVIADO");
    const avisoPendiente = fuentes.avisos.find((a) => a.estado === "PENDIENTE_DIGEST");
    const avisoOmitido = fuentes.avisos.find((a) => a.estado === "OMITIDO");
    const avisoFallido = fuentes.avisos.find((a) => a.estado === "FALLIDO");
    hitos.set(
        "avisado",
        avisoEnviado
            ? {
                tipo: "avisado",
                estado: "cumplido",
                fecha: avisoEnviado.actualizadoEn.toISOString(),
                detalle: "Te avisamos por correo",
            }
            : {
                tipo: "avisado",
                estado: "pendiente",
                fecha: null,
                detalle: avisoPendiente
                    ? "El aviso por correo saldrá en el próximo resumen"
                    : avisoOmitido
                        ? "El aviso por correo está desactivado en tus preferencias"
                        : avisoFallido
                            ? "El envío del aviso por correo falló; se reintentará"
                            : "Aún no te hemos avisado por correo",
            }
    );

    const lista = [...hitos.values()];
    const cumplidos = lista
        .filter((h) => h.estado === "cumplido")
        .sort((a, b) => (a.fecha ?? "").localeCompare(b.fecha ?? ""));
    const pendientes = ORDEN_HITOS.map((tipo) => hitos.get(tipo)!).filter((h) => h.estado === "pendiente");
    return [...cumplidos, ...pendientes];
}

export interface PendienteCaso {
    clave: "revisar" | "gestionar" | "registrar";
    texto: string;
}

/** "Lo que falta que haga el rector" (puro): derivado del estado real del caso. */
export function calcularPendientes(caso: { estadoAlerta: string; tieneNotas: boolean }): PendienteCaso[] {
    const pendientes: PendienteCaso[] = [];
    if (caso.estadoAlerta === "nueva") {
        pendientes.push({ clave: "revisar", texto: "Revisa la alerta: márcala como vista cuando la leas" });
    }
    if (caso.estadoAlerta !== "gestionada") {
        pendientes.push({ clave: "gestionar", texto: "Márcala gestionada cuando termines de actuar" });
    }
    if (!caso.tieneNotas) {
        pendientes.push({ clave: "registrar", texto: "Registra lo que hiciste en la bitácora" });
    }
    return pendientes;
}

export interface NotaCasoVista {
    id: string;
    texto: string;
    autor: string;
    creadoEn: string;
}

/** DTO del detalle del caso (UNA llamada del endpoint GET). */
export interface DetalleCaso {
    alerta: {
        id: string;
        estado: string;
        estadoReporte: string;
        categoria: string | null;
        creadoEn: string;
        tipoSujeto: TipoSujeto;
        sujetoNombre: string;
        sujetoRelacion: string | null;
        curso: { nombre: string; grado: string | null } | null;
        plataforma: string | null;
        tipoIdentificador: string;
    };
    timeline: HitoCaso[];
    pendientes: PendienteCaso[];
    // SPEC-350: id del SeguimientoCaso para montar el caso vivo (mapa+análisis IA).
    seguimiento: { id: string | null; estado: string | null; notas: NotaCasoVista[] };
}

/**
 * Detalle completo del caso en UNA llamada agregada (Promise.all tras resolver
 * la alerta, cero N+1). 404 si la alerta no existe o es de OTRO colegio
 * (tenant-first E-1): ningún dato cruza, ni por API ni por timeline.
 */
export async function obtenerDetalleCaso(colegioId: string, alertaId: string): Promise<DetalleCaso> {
    const alerta = await new AlertaColegioRepository().obtenerDetalleConCurso(colegioId, alertaId);
    if (!alerta) {
        throw new AppError("Alerta no encontrada", ERROR_CODES.NOT_FOUND, 404);
    }

    const [hitosEstado, avisos, match, seguimiento] = await Promise.all([
        new AuditLogRepository().hitosPorRecurso(["COLEGIO_ALERTA_ESTADO"], alerta.id),
        new RegistroAvisoColegioRepository().porEntidad(colegioId, alerta.reporteId),
        new EventoMatchRepository().porReporteIdAgregado(alerta.reporteId),
        new SeguimientoCasoRepository().obtenerPorAlerta(colegioId, alerta.id),
    ]);

    const notas: NotaCasoVista[] = (seguimiento?.notas ?? []).map((n) => ({
        id: n.id,
        texto: n.texto,
        autor: n.autor.nombre?.trim() || n.autor.email,
        creadoEn: n.creadoEn.toISOString(),
    }));

    let sujetoNombre: string;
    let sujetoRelacion: string | null = null;
    let curso: { nombre: string; grado: string | null } | null = null;
    let plataforma: string | null = null;
    let tipoIdentificador: string;

    if (alerta.tipoSujeto === "ESTUDIANTE" && alerta.identificadorEstudiante) {
        const est = alerta.identificadorEstudiante.estudiante;
        sujetoNombre = `${est.nombre} ${est.apellidos}`.trim();
        sujetoRelacion = alerta.identificadorEstudiante.etiquetaRelacion;
        curso = { nombre: est.curso.nombre, grado: est.curso.grado };
        plataforma = alerta.identificadorEstudiante.plataforma?.nombre ?? null;
        tipoIdentificador = alerta.identificadorEstudiante.tipo;
    } else if (alerta.tipoSujeto === "PROFESOR" && alerta.identificadorProfesor) {
        const prof = alerta.identificadorProfesor.profesor;
        sujetoNombre = `${prof.nombre} ${prof.apellidos}`.trim();
        sujetoRelacion = "PROFESOR";
        plataforma = alerta.identificadorProfesor.plataforma?.nombre ?? null;
        tipoIdentificador = alerta.identificadorProfesor.tipo;
    } else if (alerta.tipoSujeto === "ACUDIENTE" && alerta.identificadorAcudiente) {
        const acu = alerta.identificadorAcudiente.acudiente;
        sujetoNombre = acu.nombre;
        sujetoRelacion = acu.relacion;
        plataforma = alerta.identificadorAcudiente.plataforma?.nombre ?? null;
        tipoIdentificador = alerta.identificadorAcudiente.tipo;
    } else {
        throw new AppError("Alerta con sujeto incompleto", ERROR_CODES.INTERNAL_ERROR, 500);
    }

    return {
        alerta: {
            id: alerta.id,
            estado: alerta.estado,
            estadoReporte: alerta.reporte.estado,
            categoria: alerta.reporte.clasificacion?.categoria ?? null,
            creadoEn: alerta.creadoEn.toISOString(),
            tipoSujeto: alerta.tipoSujeto as TipoSujeto,
            sujetoNombre,
            sujetoRelacion,
            curso,
            plataforma,
            tipoIdentificador,
        },
        timeline: armarTimeline({
            alertaCreadoEn: alerta.creadoEn,
            hitosEstado,
            avisos,
            match,
        }),
        pendientes: calcularPendientes({ estadoAlerta: alerta.estado, tieneNotas: notas.length > 0 }),
        seguimiento: { id: seguimiento?.id ?? null, estado: seguimiento?.estado ?? null, notas },
    };
}

/**
 * Registra lo actuado: crea el seguimiento (lazy, 1:1) + la nota + el audit
 * `COLEGIO_CASO_NOTA_AGREGADA` en LA MISMA transacción (withUnitOfWork) — un
 * fallo a mitad deja 0 filas. La nota queda INMUTABLE (sin verbos de edición).
 * El audit lleva solo metadatos (nunca el texto de la nota).
 */
export async function agregarNotaCaso(
    colegioId: string,
    alertaId: string,
    autorId: string,
    texto: string,
    request?: Request
): Promise<{ id: string; creadoEn: string }> {
    const alerta = await new AlertaColegioRepository().obtenerPorId(colegioId, alertaId);
    if (!alerta) {
        throw new AppError("Alerta no encontrada", ERROR_CODES.NOT_FOUND, 404);
    }

    const ipAddress = request?.headers.get("x-forwarded-for") || request?.headers.get("x-real-ip") || "unknown";
    const userAgent = request?.headers.get("user-agent") || "unknown";

    return withUnitOfWork(async (tx) => {
        const seguimientos = new SeguimientoCasoRepository(tx);
        const seguimiento = await seguimientos.obtenerOCrearPorAlerta(colegioId, alertaId);
        const nota = await seguimientos.agregarNota({ seguimientoId: seguimiento.id, colegioId, texto, autorId });
        await logAudit({
            accion: "COLEGIO_CASO_NOTA_AGREGADA",
            tipoRecurso: "NotaSeguimiento",
            recursoId: nota.id,
            usuarioId: autorId,
            colegioId,
            valorNuevo: JSON.stringify({ alertaId, seguimientoId: seguimiento.id }),
            ipAddress,
            userAgent,
            tx,
        });
        return { id: nota.id, creadoEn: nota.creadoEn.toISOString() };
    });
}
