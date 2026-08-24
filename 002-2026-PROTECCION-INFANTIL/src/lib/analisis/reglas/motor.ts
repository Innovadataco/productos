/**
 * SPEC-221 (002-PI-122): motor de evaluación de reglas de recomendación.
 *
 * - `evaluarRegla(reglaId)`: valida la query (sandbox estático), la ejecuta en
 *   transacción READ ONLY con timeout (DAL), filtra por `umbralMinimo`,
 *   renderiza la plantilla por fila y aplica dedup `(reglaId, sujetoId)` en
 *   estado PENDIENTE (actualiza en vez de duplicar). Regla en modo EJECUTA:
 *   genera igual pero NO ejecuta la acción (diferida a SPEC-226, candado D-77).
 * - `evaluarReglasPendientes()`: reglas activas cuya cadencia efectiva
 *   (`max(frecuenciaMin, analisis.recomendaciones.frecuencia_evaluacion_min)`)
 *   ya venció desde `ultimaEvaluacionEn`. Una regla que falla no tumba a las demás.
 * - `expirarRecomendacionesVencidas()`: barrido idempotente (FR-008).
 *
 * Sin PII por construcción: las queries solo leen el dominio SaaS/análisis;
 * `datosContexto` guarda el snapshot comercial de la fila, nunca texto de
 * reportes ni datos de menores.
 */
import { createHash } from "node:crypto";
import { Prisma, type ReglaRecomendacion } from "@prisma/client";
import { getParametroSistemaValor } from "@/lib/parametros";
import { logAudit } from "@/lib/audit";
import {
    ReglasRecomendacionRepository,
    type FilaCandidata,
} from "@/lib/dal/repositories/reglas-recomendacion";
import { validarSqlRegla } from "./ejecutor-sql";
import { renderPlantilla } from "./plantilla";

export const EXPIRACION_DIAS_DEFAULT = 7;
export const STATEMENT_TIMEOUT_MS_DEFAULT = 5000;
export const FRECUENCIA_EVALUACION_MIN_DEFAULT = 60;

export interface ResultadoEvaluacion {
    reglaId: string;
    clave: string;
    candidatos: number;
    creadas: number;
    actualizadas: number;
    error?: string;
}

type ValorContexto = string | number | boolean | null;

/** Normaliza una fila cruda (bigint/Date de $queryRawUnsafe) a valores JSON seguros. */
function normalizarFila(fila: FilaCandidata): Record<string, ValorContexto> {
    const salida: Record<string, ValorContexto> = {};
    for (const [k, v] of Object.entries(fila)) {
        if (typeof v === "bigint") salida[k] = Number(v);
        else if (v instanceof Date) salida[k] = v.toISOString();
        else if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") salida[k] = v;
        else if (v === null || v === undefined) salida[k] = null;
        else salida[k] = JSON.stringify(v);
    }
    return salida;
}

/**
 * Clave de dedup para filas sin `sujeto_id`: hash estable del contenido
 * normalizado de la fila (claves ordenadas).
 */
function dedupKeyDeFila(contexto: Record<string, ValorContexto>): string {
    const estable = Object.keys(contexto)
        .sort()
        .map((k) => `${k}=${String(contexto[k])}`)
        .join("|");
    return createHash("sha256").update(estable).digest("hex").slice(0, 32);
}

async function paramEntero(clave: string, defecto: number): Promise<number> {
    const valor = await getParametroSistemaValor(clave);
    const n = valor === null ? NaN : Number(valor);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : defecto;
}

function filaSuperaUmbral(contexto: Record<string, ValorContexto>, umbral: number): boolean {
    const valor = contexto["valor"];
    const numerico = typeof valor === "number" ? valor : Number(valor);
    return Number.isFinite(numerico) && numerico >= umbral;
}

/**
 * Evalúa una regla concreta. Nunca lanza: cualquier error queda en
 * `resultado.error` y en el log `[Analisis/Reglas]`; la regla NO se desactiva.
 */
export async function evaluarRegla(
    reglaId: string,
    repo: ReglasRecomendacionRepository = new ReglasRecomendacionRepository()
): Promise<ResultadoEvaluacion> {
    const regla = await repo.obtenerRegla(reglaId);
    if (!regla) {
        return { reglaId, clave: "(desconocida)", candidatos: 0, creadas: 0, actualizadas: 0, error: "Regla no encontrada" };
    }
    const base: ResultadoEvaluacion = { reglaId, clave: regla.clave, candidatos: 0, creadas: 0, actualizadas: 0 };
    if (!regla.activa) return base;

    const validacion = validarSqlRegla(regla.sqlQuery);
    if (!validacion.ok) {
        console.error(`[Analisis/Reglas] Regla ${regla.clave}: query rechazada — ${validacion.motivo}`);
        // FR-015: el intento queda auditado; la query se trunca a 200 chars y nunca se ejecuta.
        await logAudit({
            accion: "ACCESO_DENEGADO",
            tipoRecurso: "ReglaRecomendacion",
            recursoId: regla.id,
            metadatos: {
                clave: regla.clave,
                motivo: validacion.motivo,
                sqlQueryTruncada: regla.sqlQuery.slice(0, 200),
            },
        });
        return { ...base, error: validacion.motivo };
    }

    try {
        const [timeoutMs, expiracionDias] = await Promise.all([
            paramEntero("analisis.recomendaciones.statement_timeout_ms", STATEMENT_TIMEOUT_MS_DEFAULT),
            paramEntero("analisis.recomendaciones.expiracion_dias", EXPIRACION_DIAS_DEFAULT),
        ]);
        const filasCrudas = await repo.ejecutarQuerySoloLectura(regla.sqlQuery, timeoutMs);
        const filas = filasCrudas.map(normalizarFila);

        let candidatas = filas;
        if (regla.umbralMinimo !== null) {
            candidatas = filas.filter((f) => filaSuperaUmbral(f, regla.umbralMinimo as number));
            if (filas.length > 0 && candidatas.length === 0 && !("valor" in filas[0]!)) {
                console.warn(
                    `[Analisis/Reglas] Regla ${regla.clave}: umbralMinimo configurado pero la query no expone columna 'valor'`
                );
            }
        }

        // expiraEn = ahora + N días (duración; independiente de zona horaria).
        const expiraEn = new Date(Date.now() + expiracionDias * 86_400_000);
        let creadas = 0;
        let actualizadas = 0;

        for (const contextoFila of candidatas) {
            const render = renderPlantilla(regla.plantillaRecomendacion, contextoFila);
            const sujetoTipo = typeof contextoFila["sujeto_tipo"] === "string" ? contextoFila["sujeto_tipo"] : null;
            const sujetoIdCrudo = contextoFila["sujeto_id"];
            const sujetoId = sujetoIdCrudo === null ? null : String(sujetoIdCrudo);
            const dedupKey = sujetoId ?? dedupKeyDeFila(contextoFila);
            const datosContexto = { ...contextoFila, dedupKey };

            const escritura = {
                titulo: render.titulo,
                descripcion: render.descripcion,
                prioridad: regla.prioridad,
                datosContexto,
                accionSugerida: regla.accionEjecutable ?? null,
                accionParametros:
                    regla.accionParametros === null
                        ? Prisma.JsonNull
                        : (regla.accionParametros as Prisma.InputJsonValue),
                expiraEn,
            };

            const existente = sujetoId
                ? await repo.buscarPendientePorSujeto(regla.id, sujetoId)
                : await repo.buscarPendientePorDedupKey(regla.id, dedupKey);

            if (existente) {
                await repo.actualizarRecomendacionPendiente(existente.id, escritura);
                actualizadas += 1;
            } else {
                await repo.crearRecomendacion({
                    ...escritura,
                    reglaId: regla.id,
                    categoria: regla.categoria,
                    sujetoTipo,
                    sujetoId,
                });
                creadas += 1;
            }
        }

        await repo.marcarReglaEvaluada(regla.id, new Date());

        if (regla.modo === "EJECUTA") {
            // FR-006: en SPEC-221 ninguna acción automática se ejecuta (D-77).
            console.warn(
                `[Analisis/Reglas] Regla ${regla.clave} en modo EJECUTA: ejecución de la acción diferida a SPEC-226`
            );
        }

        return { ...base, candidatos: candidatas.length, creadas, actualizadas };
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`[Analisis/Reglas] Error evaluando regla ${regla.clave}: ${msg}`);
        return { ...base, error: msg };
    }
}

/**
 * Evalúa las reglas activas cuya cadencia efectiva ya venció. El piso global
 * `analisis.recomendaciones.frecuencia_evaluacion_min` limita la cadencia de
 * todas las reglas aunque su `frecuenciaMin` sea menor.
 */
export async function evaluarReglasPendientes(
    repo: ReglasRecomendacionRepository = new ReglasRecomendacionRepository()
): Promise<ResultadoEvaluacion[]> {
    const pisoMin = await paramEntero(
        "analisis.recomendaciones.frecuencia_evaluacion_min",
        FRECUENCIA_EVALUACION_MIN_DEFAULT
    );
    const ahora = Date.now();
    const reglas = await repo.listarReglasActivas();
    const vencidas = reglas.filter((r: ReglaRecomendacion) => {
        if (!r.ultimaEvaluacionEn) return true;
        const cadenciaMs = Math.max(r.frecuenciaMin, pisoMin) * 60_000;
        return ahora - r.ultimaEvaluacionEn.getTime() >= cadenciaMs;
    });

    const resultados: ResultadoEvaluacion[] = [];
    for (const regla of vencidas) {
        resultados.push(await evaluarRegla(regla.id, repo));
    }
    return resultados;
}

/** Barrido idempotente de expiración (FR-008). Devuelve cuántas se marcaron. */
export function expirarRecomendacionesVencidas(
    repo: ReglasRecomendacionRepository = new ReglasRecomendacionRepository()
): Promise<number> {
    return repo.expirarVencidas(new Date());
}
