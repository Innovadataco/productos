/**
 * SPEC-142 (F6): patrones institucionales para colegios.
 *
 * Agregación determinista (SIN IA, FR-010): cada reporte APROBADO (predicado
 * único `esReporteAprobado`, D-08 — NUNCA ESTADOS_VISIBLES, FR-005) cuyo
 * identificador tiene alerta en un colegio incrementa el agregado por
 * (colegio, grado, conducta, plataforma, trimestre) — sin persistir jamás
 * identificador, reporteId, alumnoId ni textos en `PatronInstitucional` (FR-002).
 *
 * Disparos (FR-001/FR-004): post-hook del worker (tras las alertas), corrección
 * admin → CORREGIDO, comité resolver → CORREGIDO. Reversa exacta en baja vía
 * `AlertaColegio.patronInstitucionalId` (marcador de idempotencia, FR-003).
 *
 * Lectura (FR-007): k-anonimato en TODOS los desgloses (ZEUS D-2: grado,
 * conducta Y plataforma) — celda con conteo < k se suprime, solo agregado;
 * el total del colegio siempre incluye todo (ataque por diferencia: riesgo
 * residual aceptado y documentado en la spec).
 */
import { esReporteAprobado } from "@/lib/reporte-aprobado";
import { getParametroSistemaValor } from "@/lib/parametros";
import { logger } from "@/lib/logger";
import { withUnitOfWork } from "@/lib/dal/unit-of-work";
import { ReporteRepository } from "@/lib/dal/repositories/reporte";
import { AlertaColegioRepository } from "@/lib/dal/repositories/alerta-colegio";
import { PatronInstitucionalRepository } from "@/lib/dal/repositories/patron-institucional";
import { PlataformaRepository } from "@/lib/dal/repositories/plataforma";
import { verificarVigenciaPorColegioId } from "./vigencia";
import type { CategoriaConducta, Prisma } from "@prisma/client";

/** Sentinel no nulo para Curso.grado nullable (la única del agregado lo exige). */
export const SIN_GRADO_REGISTRADO = "Sin grado registrado";

const K_DEFAULT = 3;

/** Trimestre calendario (UTC) de una fecha: "2026-Q3". Determinístico. */
export function periodoTrimestre(fecha: Date): string {
    const q = Math.floor(fecha.getUTCMonth() / 3) + 1;
    return `${fecha.getUTCFullYear()}-Q${q}`;
}

/** Trimestre anterior en el mismo formato ("2026-Q3" → "2026-Q2"). */
export function periodoAnteriorTrimestre(periodo: string): string {
    const [anioRaw, qRaw] = periodo.split("-Q");
    const anio = Number(anioRaw);
    const q = Number(qRaw);
    return q === 1 ? `${anio - 1}-Q4` : `${anio}-Q${q - 1}`;
}

/**
 * FR-001/FR-003: agrega el aporte del reporte al patrón de cada colegio con
 * alerta (la MÁS ANTIGUA por colegio — dedupe determinístico cuando hay varios
 * vínculos del mismo identificador en el mismo colegio; el grado es snapshot
 * del vínculo más antiguo). Idempotente por el marcador de la alerta.
 */
export async function agregarPatronPorReporte(reporteId: string): Promise<void> {
    const reporte = await new ReporteRepository().findParaPatron(reporteId);
    if (!reporte || !esReporteAprobado(reporte, reporte.clasificacion?.categoria)) {
        return;
    }
    const conducta = reporte.clasificacion!.categoria;

    const alertas = await new AlertaColegioRepository().findPorReporteConVinculoYGrado(reporteId);
    // La lista viene ordenada por creadoEn asc: la primera por colegio ES la más antigua.
    const masAntiguaPorColegio = new Map<string, (typeof alertas)[number]>();
    for (const alerta of alertas) {
        if (!masAntiguaPorColegio.has(alerta.colegioId)) {
            masAntiguaPorColegio.set(alerta.colegioId, alerta);
        }
    }

    const periodo = periodoTrimestre(reporte.creadoEn);
    for (const [colegioId, alerta] of masAntiguaPorColegio) {
        if (alerta.patronInstitucionalId) continue; // ya aportó (reproceso/reintento)
        const vigencia = await verificarVigenciaPorColegioId(colegioId);
        if (!vigencia.vigente) continue; // colegio no vigente: no acumula (regla de alertas)

        const grado = alerta.identificadorAlumno.alumno.curso?.grado ?? SIN_GRADO_REGISTRADO;
        try {
            await withUnitOfWork(async (tx) => {
                const patron = await new PatronInstitucionalRepository(tx).upsertIncrementar(colegioId, {
                    periodo,
                    grado,
                    conducta,
                    plataformaId: reporte.plataformaId,
                });
                await new AlertaColegioRepository(tx).marcarPatron(alerta.id, patron.id);
            });
        } catch (err) {
            // Fail-open por colegio: un error de agregación NUNCA rompe el disparo.
            logger.error(`[PATRONES] Error agregando patrón reporte=${reporteId} colegio=${colegioId}:`, err);
        }
    }
}

/**
 * FR-004: reversa exacta en baja — decrementa (piso 0) las filas agregadas que
 * el reporte aportó y limpia los marcadores (una segunda baja no re-decrementa).
 * Pensada para correr DENTRO de la tx de la baja (reporte-lifecycle).
 */
export async function revertirPatronPorReporte(reporteId: string, tx?: Prisma.TransactionClient): Promise<void> {
    const alertasRepo = new AlertaColegioRepository(tx);
    const patronesRepo = new PatronInstitucionalRepository(tx);
    const marcadas = await alertasRepo.findPorReporteConPatron(reporteId);
    for (const marcada of marcadas) {
        if (!marcada.patronInstitucionalId) continue;
        await patronesRepo.decrementarConPiso(marcada.patronInstitucionalId);
        await alertasRepo.desmarcarPatron(marcada.id);
    }
}

export interface EntradaDesglose {
    clave: string;
    conteo: number;
}

export interface PatronesColegioDto {
    colegioId: string;
    periodo: string;
    k: number;
    total: number;
    porGrado: EntradaDesglose[];
    gradosSuprimidos: boolean;
    porConducta: EntradaDesglose[];
    conductasSuprimidas: boolean;
    porPlataforma: { plataforma: string; conteo: number }[];
    plataformasSuprimidas: boolean;
    tendencia: { periodoAnterior: string; totalAnterior: number; variacion: number };
}

async function obtenerK(): Promise<number> {
    const raw = await getParametroSistemaValor("colegio.patrones.k_anonimato");
    const k = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(k) && k > 0 ? k : K_DEFAULT;
}

/** Regla ÚNICA de k-anonimato (FR-007): suprime entradas con conteo < k. */
function aplicarK(grupos: Map<string, number>, k: number): { visibles: EntradaDesglose[]; suprimidos: boolean } {
    const entradas = [...grupos.entries()].map(([clave, conteo]) => ({ clave, conteo }));
    const visibles = entradas.filter((e) => e.conteo >= k).sort((a, b) => b.conteo - a.conteo || a.clave.localeCompare(b.clave));
    return { visibles, suprimidos: visibles.length < entradas.length };
}

/**
 * FR-006/FR-007/FR-009: lectura de patrones del colegio con k-anonimato en
 * TODOS los desgloses (ZEUS D-2) y tendencia vs. trimestre anterior.
 */
export async function obtenerPatronesColegio(colegioId: string, periodo: string): Promise<PatronesColegioDto> {
    const k = await obtenerK();
    const filas = await new PatronInstitucionalRepository().findPorPeriodo(colegioId, periodo);

    const porGrado = new Map<string, number>();
    const porConducta = new Map<string, number>();
    const porPlataforma = new Map<string, number>();
    let total = 0;
    for (const fila of filas) {
        total += fila.conteo;
        porGrado.set(fila.grado, (porGrado.get(fila.grado) ?? 0) + fila.conteo);
        porConducta.set(fila.conducta, (porConducta.get(fila.conducta) ?? 0) + fila.conteo);
        porPlataforma.set(fila.plataformaId, (porPlataforma.get(fila.plataformaId) ?? 0) + fila.conteo);
    }

    const grado = aplicarK(porGrado, k);
    const conducta = aplicarK(porConducta, k);
    const plataforma = aplicarK(porPlataforma, k);

    const plataformaIds = plataforma.visibles.map((e) => e.clave);
    const nombres = plataformaIds.length > 0 ? await new PlataformaRepository().findNombresPorIds(plataformaIds) : [];
    const nombrePorId = Object.fromEntries(nombres.map((p) => [p.id, p.nombre]));

    const anterior = periodoAnteriorTrimestre(periodo);
    const totalAnterior = await new PatronInstitucionalRepository().totalPorPeriodo(colegioId, anterior);

    return {
        colegioId,
        periodo,
        k,
        total,
        porGrado: grado.visibles,
        gradosSuprimidos: grado.suprimidos,
        porConducta: conducta.visibles,
        conductasSuprimidas: conducta.suprimidos,
        porPlataforma: plataforma.visibles.map((e) => ({
            plataforma: nombrePorId[e.clave] ?? "Desconocida",
            conteo: e.conteo,
        })),
        plataformasSuprimidas: plataforma.suprimidos,
        tendencia: { periodoAnterior: anterior, totalAnterior, variacion: total - totalAnterior },
    };
}
