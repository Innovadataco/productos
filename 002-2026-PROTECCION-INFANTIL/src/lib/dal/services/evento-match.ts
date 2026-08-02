/**
 * SPEC-139 (F5): detección y registro del EventoMatch — un reporte APROBADO
 * (predicado único D-08, `esReporteAprobado`) sobre un identificador que ya
 * tiene ≥1 aprobado de OTRO denunciante. "Denunciante distinto": autenticados
 * por `usuarioId`; anónimos por huella de fuente S-1 (ipHash/fingerprintHash);
 * históricos SIN huella NO cuentan (conservador, presunción de inocencia).
 *
 * Disparos (ZEUS D-1): post-hook del worker Y corrección humana (corrección
 * admin → CORREGIDO, comité resolver → CORREGIDO). Idempotente por
 * `reporteNuevoId` único (FR-004); fail-open a cargo del llamador (FR-005).
 * NUNCA persiste ni expone denunciantes ni textos (FR-009): solo metadatos
 * agregados (conteo, ciudades, conductas).
 */
import { Prisma } from "@prisma/client";
import { esReporteAprobado, whereReporteAprobado } from "@/lib/reporte-aprobado";
import { logAudit } from "@/lib/audit";
import { registrarPaso } from "@/lib/expediente/pasos";
import { ReporteRepository } from "../repositories/reporte";
import { IdentificadorReportadoRepository } from "../repositories/identificador-reportado";
import { EventoMatchRepository } from "../repositories/evento-match";

export interface ResultadoDeteccionMatch {
    registrado: boolean;
    yaExistia?: boolean;
    motivo?: string;
}

type FilaFuente = {
    usuarioId: string | null;
    fuente: { ipHash: string | null; fingerprintHash: string | null } | null;
};

/**
 * Clave de fuente independiente: `u:<usuarioId>` (autenticado) u
 * `h:<ipHash|fingerprintHash>` (anónimo con huella S-1). Null si no se puede
 * probar la fuente (anónimo histórico sin huella) — conservador: no cuenta.
 */
function claveFuente(r: FilaFuente): string | null {
    if (r.usuarioId) return `u:${r.usuarioId}`;
    const huella = [r.fuente?.ipHash, r.fuente?.fingerprintHash].filter(Boolean).join("|");
    return huella ? `h:${huella}` : null;
}

export async function detectarYRegistrarMatch(reporteId: string): Promise<ResultadoDeteccionMatch> {
    const reportes = new ReporteRepository();
    const reporte = await reportes.findParaMatch(reporteId);

    // FR-001: la puerta es el predicado único D-08 (aprobado), nada más.
    if (!reporte || !esReporteAprobado(reporte, reporte.clasificacion?.categoria)) {
        return { registrado: false, motivo: "no_aprobado" };
    }

    const eventos = new EventoMatchRepository();
    // FR-004: un reporte dispara como mucho un evento, ante cualquier reintento.
    if (await eventos.findPorReporteNuevoId(reporteId)) {
        return { registrado: false, yaExistia: true };
    }

    const agregado = await new IdentificadorReportadoRepository().findPorClave(reporte.identificador, reporte.plataformaId);
    if (!agregado) return { registrado: false, motivo: "sin_agregado" };

    // FR-002 (conservador): el disparador también debe probar su fuente.
    const claveNueva = claveFuente(reporte);
    if (!claveNueva) return { registrado: false, motivo: "sin_fuente" };

    const previos = await reportes.findAprobadosParaMatch(
        whereReporteAprobado({
            identificador: reporte.identificador,
            plataformaId: reporte.plataformaId,
            id: { not: reporteId },
        })
    );

    const clavesPrevias = new Set(previos.map(claveFuente).filter((k): k is string => k !== null));
    const hayFuenteDistinta = [...clavesPrevias].some((k) => k !== claveNueva);
    if (!hayFuenteDistinta) return { registrado: false, motivo: "sin_fuente_distinta" };

    // FR-003: conteo de fuentes independientes aprobadas vigentes (incluido el nuevo).
    const claves = new Set([...clavesPrevias, claveNueva]);
    const conteoAcumulado = claves.size;

    // Ciudades de los aprobados de fuentes probadas (incluido el nuevo).
    const relevantes = previos.filter((r) => claveFuente(r) !== null);
    const ciudades = [...new Set([...relevantes.map((r) => r.ciudad), reporte.ciudad])].sort();
    const interCiudad = ciudades.length >= 2;

    // Conductas presentes en ≥2 fuentes independientes.
    const porFuente = new Map<string, Set<string>>();
    const acumularConducta = (clave: string | null, categoria: string | null | undefined) => {
        if (!clave || !categoria) return;
        const set = porFuente.get(clave) ?? new Set<string>();
        set.add(categoria);
        porFuente.set(clave, set);
    };
    for (const r of previos) acumularConducta(claveFuente(r), r.clasificacion?.categoria);
    acumularConducta(claveNueva, reporte.clasificacion?.categoria);
    const fuentesPorConducta = new Map<string, number>();
    for (const cats of porFuente.values()) {
        for (const c of cats) fuentesPorConducta.set(c, (fuentesPorConducta.get(c) ?? 0) + 1);
    }
    const conductasCoincidentes = [...fuentesPorConducta.entries()]
        .filter(([, n]) => n >= 2)
        .map(([c]) => c)
        .sort();

    let evento;
    try {
        evento = await eventos.crear({
            identificadorId: agregado.id,
            reporteNuevoId: reporteId,
            conteoAcumulado,
            ciudades,
            conductasCoincidentes,
            interCiudad,
        });
    } catch (err) {
        // Carrera de reintentos concurrentes: otro proceso registró primero (P2002).
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
            return { registrado: false, yaExistia: true };
        }
        throw err;
    }

    // Auditoría de la mutación (convención): solo metadatos agregados, nunca texto.
    await logAudit({
        accion: "MATCH_DETECTADO",
        tipoRecurso: "EventoMatch",
        recursoId: evento.id,
        metadatos: { identificadorId: agregado.id, conteoAcumulado, interCiudad },
        ipAddress: "worker",
        userAgent: "worker",
    });

    // Traza del expediente (referencias agregadas, no textos ni identidades).
    await registrarPaso(reporteId, "match_detectado", {
        veredicto: interCiudad ? "match_inter_ciudad" : "match",
        detalle: { conteoAcumulado, ciudades: ciudades.length, conductasCoincidentes },
    });

    return { registrado: true };
}
