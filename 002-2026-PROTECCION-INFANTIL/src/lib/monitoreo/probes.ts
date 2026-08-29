/**
 * SPEC-171 + SPEC-186 — Probes del vigilante de infraestructura.
 * Funciones puras: cada una mide UNA señal y devuelve su resultado sin
 * persistir nada (la persistencia y el ciclo de vida del incidente viven en
 * `incidentes.ts`). Los parámetros llegan por argumento para testabilidad;
 * el caller (`scripts/monitor-probes.mjs`) los relee de ParametroSistema en
 * cada ciclo.
 *
 * Frontera DAL (Q-3, auditoría ZEUS #55): este archivo NO importa prisma;
 * el probe de BD delega en `MonitoreoRepository`, y el piggyback/smoke
 * delega en `MonitoreoRepository` + `ClasificacionIARepository`.
 *
 * Señales: app | worker | bd | ollama_ping | ollama_smoke | tailscale.
 */
import { MonitoreoRepository } from "../dal/repositories/monitoreo.ts";
import { ClasificacionIARepository } from "../dal/repositories/clasificacion-ia.ts";
import { getParametroSistema } from "../parametros.ts";
import { leerHeartbeatWorker } from "../worker-heartbeat.ts";
import { leerAntiguedadTickSeg } from "./tick-vida.ts";
import { contarPendientesVencidas } from "../notificaciones/metricas.ts";

// SPEC-291 (002-PI-191): 7 nuevas señales por tick-vida (workers y app propios).
export const SENALES_TICK_VIDA = [
    "notificaciones", "senal_comunitaria", "analisis_score",
    "vigencia", "analisis_reglas", "expediente_motor", "anomalias",
] as const;
export type SenalTickVida = (typeof SENALES_TICK_VIDA)[number];

const NOMBRE_CONTENEDOR_POR_SENAL: Record<SenalTickVida, string> = {
    notificaciones: "pi-notificaciones",
    senal_comunitaria: "pi-senal-comunitaria",
    analisis_score: "pi-analisis-score",
    vigencia: "pi-vigencia",
    analisis_reglas: "pi-analisis-reglas",
    expediente_motor: "pi-expediente-motor",
    anomalias: "pi-anomalias",
};

export const SENALES_MONITOREO = [
    "app", "worker", "bd", "ollama_ping", "ollama_smoke", "tailscale", "indices",
    "notif_pendientes_vencidas",
    ...SENALES_TICK_VIDA,
] as const;
export type SenalMonitoreo = (typeof SENALES_MONITOREO)[number];

export const METODOS_PROBE = ["PING", "PIGGYBACK", "SMOKE"] as const;
export type MetodoProbe = (typeof METODOS_PROBE)[number];

export interface ResultadoProbe {
    ok: boolean;
    latenciaMs: number;
    detalle?: string;
    metodo?: MetodoProbe;
}

function mensajeError(error: unknown): string {
    const msg = error instanceof Error ? error.message : String(error);
    // Acota el detalle persistido (timeouts de undici pueden ser verbosos).
    return msg.length > 300 ? `${msg.slice(0, 300)}…` : msg;
}

/**
 * App Next.js: GET ${url}/api/health/worker (misma ruta que usa el
 * healthcheck de dev-restart.sh). Ok si HTTP 200.
 */
export async function probeApp({ url, timeoutMs = 5000 }: { url: string; timeoutMs?: number }): Promise<ResultadoProbe> {
    const inicio = Date.now();
    try {
        const res = await fetch(`${url}/api/health/worker`, { signal: AbortSignal.timeout(timeoutMs) });
        const latenciaMs = Date.now() - inicio;
        return res.ok
            ? { ok: true, latenciaMs, metodo: "PING" }
            : { ok: false, latenciaMs, detalle: `HTTP ${res.status}`, metodo: "PING" };
    } catch (error) {
        return { ok: false, latenciaMs: Date.now() - inicio, detalle: mensajeError(error), metodo: "PING" };
    }
}

/**
 * Worker de reportes: reutiliza `leerHeartbeatWorker` (spec 143): ok si el
 * archivo worker.heartbeat tiene un latido de hace ≤ heartbeatMaxSeg segundos.
 * Es una lectura de archivo local; latenciaMs queda en 0 (no aplica).
 */
export function probeWorker({ heartbeatMaxSeg }: { heartbeatMaxSeg: number }): ResultadoProbe {
    const latido = leerHeartbeatWorker();
    if (!latido) return { ok: false, latenciaMs: 0, detalle: "sin archivo de heartbeat del worker", metodo: "PING" };
    const edadSeg = Math.max(0, Math.floor((Date.now() - latido.getTime()) / 1000));
    return edadSeg <= heartbeatMaxSeg
        ? { ok: true, latenciaMs: 0, detalle: `último latido hace ${edadSeg}s`, metodo: "PING" }
        : { ok: false, latenciaMs: 0, detalle: `sin latido hace ${edadSeg}s (máx ${heartbeatMaxSeg}s)`, metodo: "PING" };
}

/** PostgreSQL: ok si `SELECT 1` no lanza. */
export async function probeBd(): Promise<ResultadoProbe> {
    const inicio = Date.now();
    try {
        await new MonitoreoRepository().pingBd();
        return { ok: true, latenciaMs: Date.now() - inicio, metodo: "PING" };
    } catch (error) {
        return { ok: false, latenciaMs: Date.now() - inicio, detalle: mensajeError(error), metodo: "PING" };
    }
}

/** Ollama vivo: GET ${baseUrl}/api/tags, ok si HTTP 200. */
export async function probeOllamaPing({ baseUrl, timeoutMs = 5000 }: { baseUrl: string; timeoutMs?: number }): Promise<ResultadoProbe> {
    const inicio = Date.now();
    try {
        const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(timeoutMs) });
        const latenciaMs = Date.now() - inicio;
        return res.ok
            ? { ok: true, latenciaMs, metodo: "PING" }
            : { ok: false, latenciaMs, detalle: `HTTP ${res.status}`, metodo: "PING" };
    } catch (error) {
        return { ok: false, latenciaMs: Date.now() - inicio, detalle: mensajeError(error), metodo: "PING" };
    }
}

/**
 * SPEC-186 (002-PI-081): piggyback en tráfico real de ClasificacionIA.
 * Si hubo una clasificación exitosa en los últimos `ventanaMin` minutos,
 * consideramos que Ollama está vivo y respondiendo bien, sin cargar modelo.
 */
export async function probeOllamaPiggyback({
    ventanaMin,
    clasificacionRepo = new ClasificacionIARepository(),
}: {
    ventanaMin: number;
    clasificacionRepo?: ClasificacionIARepository;
}): Promise<ResultadoProbe | null> {
    const ahora = Date.now();
    const desde = new Date(ahora - ventanaMin * 60 * 1000);
    const ultima = await clasificacionRepo.ultimaClasificacionExitosaDesde(desde);
    if (!ultima) return null;
    const haceMin = Math.max(1, Math.floor((ahora - ultima.creadoEn.getTime()) / 60_000));
    return {
        ok: true,
        latenciaMs: 0,
        detalle: `vivo por tráfico real, hace ${haceMin} min`,
        metodo: "PIGGYBACK",
    };
}

/**
 * Ollama de verdad genera: POST /api/generate con una generación mínima.
 * El modelo es el VIGENTE DEL MOTOR (primer elemento de `ia.rubrica.modelos`,
 * decisión ZEUS — nunca un modelo fijo). Si no hay modelo vigente válido, el
 * probe falla con detalle "sin modelo vigente configurado".
 *
 * SPEC-186: antes de ejecutar el smoke real se intenta un piggyback en
 * ClasificacionIA reciente. Solo si no aplica piggyback Y ya pasó
 * `intervaloMin` desde el último smoke real exitoso se dispara la generación.
 */
export async function probeOllamaSmoke({
    baseUrl,
    timeoutMs,
    piggybackMin,
    intervaloMin,
    monitoreoRepo = new MonitoreoRepository(),
    clasificacionRepo = new ClasificacionIARepository(),
}: {
    baseUrl: string;
    timeoutMs: number;
    piggybackMin: number;
    intervaloMin: number;
    monitoreoRepo?: MonitoreoRepository;
    clasificacionRepo?: ClasificacionIARepository;
}): Promise<ResultadoProbe> {
    // Bloque B: piggyback en tráfico real.
    const piggyback = await probeOllamaPiggyback({ ventanaMin: piggybackMin, clasificacionRepo });
    if (piggyback) return piggyback;

    // Bloque C: smoke real, pero solo si ya pasó el intervalo desde el último exitoso.
    const ahora = Date.now();
    const ultimoSmoke = await monitoreoRepo.ultimoProbePorSenalYMetodo("ollama_smoke", "SMOKE", true);
    if (ultimoSmoke && ahora - ultimoSmoke.creadoEn.getTime() < intervaloMin * 60 * 1000) {
        return {
            ok: true,
            latenciaMs: 0,
            detalle: `smoke real no necesario: último hace ${Math.floor((ahora - ultimoSmoke.creadoEn.getTime()) / 60_000)} min`,
            metodo: "SMOKE",
        };
    }

    const inicio = Date.now();

    // Selección de modelo: override operativo (SPEC-187) o modelo vigente del motor.
    let modelo: string | null = null;
    let fuenteModelo: "override" | "motor" = "motor";
    try {
        const paramOverride = await getParametroSistema("monitoreo.ollama.smoke.modelo");
        const overrideModelo = paramOverride?.valor?.trim() ?? "";
        if (overrideModelo.length > 0) {
            modelo = overrideModelo;
            fuenteModelo = "override";
        }
    } catch (error) {
        return { ok: false, latenciaMs: 0, detalle: `error leyendo monitoreo.ollama.smoke.modelo: ${mensajeError(error)}`, metodo: "SMOKE" };
    }

    if (!modelo) {
        let paramModelos;
        try {
            paramModelos = await getParametroSistema("ia.rubrica.modelos");
        } catch (error) {
            return { ok: false, latenciaMs: 0, detalle: `error leyendo ia.rubrica.modelos: ${mensajeError(error)}`, metodo: "SMOKE" };
        }
        try {
            const parsed: unknown = paramModelos ? JSON.parse(paramModelos.valor) : null;
            if (Array.isArray(parsed) && typeof parsed[0] === "string" && parsed[0].trim().length > 0) {
                modelo = parsed[0].trim();
            }
        } catch {
            modelo = null;
        }
    }

    if (!modelo) {
        return { ok: false, latenciaMs: 0, detalle: "sin modelo vigente configurado", metodo: "SMOKE" };
    }

    const detalleModelo = `(modelo ${modelo}, ${fuenteModelo})`;
    try {
        const res = await fetch(`${baseUrl}/api/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: modelo, prompt: "Responde solo: ok", stream: false, options: { num_predict: 5 } }),
            signal: AbortSignal.timeout(timeoutMs),
        });
        const latenciaMs = Date.now() - inicio;
        if (!res.ok) return { ok: false, latenciaMs, detalle: `HTTP ${res.status} ${detalleModelo}`, metodo: "SMOKE" };
        const data = (await res.json()) as { response?: unknown };
        const texto = typeof data.response === "string" ? data.response.trim() : "";
        return texto.length > 0
            ? { ok: true, latenciaMs, detalle: `smoke real ejecutado, latencia ${latenciaMs} ms ${detalleModelo}`, metodo: "SMOKE" }
            : { ok: false, latenciaMs, detalle: `respuesta vacía ${detalleModelo}`, metodo: "SMOKE" };
    } catch (error) {
        return { ok: false, latenciaMs: Date.now() - inicio, detalle: `${mensajeError(error)} ${detalleModelo}`, metodo: "SMOKE" };
    }
}

/**
 * Túnel Tailscale: sin URL configurada no aplica (ok con detalle "no-aplica";
 * el estado NO_APLICA del tablero se resuelve en el endpoint). Con URL, ok si
 * responde CUALQUIER status < 500 (un 401/404 igual prueba que la punta vive).
 */
export async function probeTailscale({ url, timeoutMs = 8000 }: { url: string; timeoutMs?: number }): Promise<ResultadoProbe> {
    if (!url.trim()) return { ok: true, latenciaMs: 0, detalle: "no-aplica", metodo: "PING" };
    const inicio = Date.now();
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
        const latenciaMs = Date.now() - inicio;
        return res.status < 500
            ? { ok: true, latenciaMs, detalle: `HTTP ${res.status}`, metodo: "PING" }
            : { ok: false, latenciaMs, detalle: `HTTP ${res.status}`, metodo: "PING" };
    } catch (error) {
        return { ok: false, latenciaMs: Date.now() - inicio, detalle: mensajeError(error), metodo: "PING" };
    }
}

// SPEC-251 (I-49): lista de índices que el probe debe verificar.
// Espejo intencionado de REQUIRED en scripts/verify-hnsw-indexes.ts — ambos
// deben mantenerse sincronizados al agregar un índice nuevo por SQL crudo.
// La fuente operativa (CLI + CI + deploy) es el script; esta lista es solo para pi-monitor.
const INDICES_REQUERIDOS = [
    { name: "Ciudad_nombreNormalizado_trgm_idx",                           type: "gin"    },
    { name: "EmbeddingDataset_vector_idx",                                 type: "hnsw"   },
    { name: "EmbeddingReporte_vector_idx",                                 type: "hnsw"   },
    { name: "AlertaColegio_patronInstitucionalId_idx",                     type: "btree"  },
    // normalizado por migración 20260826180000 (SPEC-251) — ambos entornos tienen _p_key
    { name: "patrones_institucionales_colegioId_periodo_grado_conducta_p_key", type: "unique" },
] as const;

/**
 * SPEC-251 (I-49): verifica los 5 índices críticos via MonitoreoRepository (Q-3).
 * Nunca reinicia nada. El resultado es solo observación.
 */
export async function probeIndices({
    repo = new MonitoreoRepository(),
}: { repo?: MonitoreoRepository } = {}): Promise<ResultadoProbe> {
    const inicio = Date.now();
    try {
        const rows = await repo.leerIndicesPublicos();
        const byName = new Map(rows.map((r) => [r.indexname, r]));

        const missing: string[] = [];
        const wrongType: string[] = [];

        for (const req of INDICES_REQUERIDOS) {
            const row = byName.get(req.name);
            if (!row) {
                missing.push(req.name);
                continue;
            }
            const def = row.indexdef.toLowerCase();
            let tipoOk = false;
            if (req.type === "hnsw")        tipoOk = def.includes("using hnsw");
            else if (req.type === "gin")    tipoOk = def.includes("using gin");
            else if (req.type === "btree")  tipoOk = def.includes("using btree") || !def.includes("using ");
            else if (req.type === "unique") tipoOk = Boolean(row.isunique);
            if (!tipoOk) wrongType.push(req.name);
        }

        const ok = missing.length === 0 && wrongType.length === 0;
        const partes: string[] = [];
        if (missing.length > 0) partes.push(`faltantes: ${missing.join(", ")}`);
        if (wrongType.length > 0) partes.push(`tipo incorrecto: ${wrongType.join(", ")}`);

        return {
            ok,
            latenciaMs: Date.now() - inicio,
            detalle: ok ? `${INDICES_REQUERIDOS.length} índices presentes` : partes.join(" | "),
            metodo: "PING",
        };
    } catch (error) {
        return {
            ok: false,
            latenciaMs: Date.now() - inicio,
            detalle: `error verificando índices: ${mensajeError(error)}`,
            metodo: "PING",
        };
    }
}

/**
 * SPEC-302 (002-PI-208 · R-022 §1.3 punto a): rojo si hay notificaciones
 * ENCOLADAs con `enviarEn` vencido hace más de `umbralMinutos` — señal
 * temprana de un worker atascado (patrón I-147), independiente del tick-vida
 * (que solo detecta que el proceso está vivo, no que la cola avanza).
 */
export async function probeNotifPendientesVencidas({
    umbralMinutos = 15,
}: { umbralMinutos?: number } = {}): Promise<ResultadoProbe> {
    const inicio = Date.now();
    try {
        const pendientes = await contarPendientesVencidas(umbralMinutos);
        return {
            ok: pendientes === 0,
            latenciaMs: Date.now() - inicio,
            detalle: pendientes === 0 ? "0 pendientes vencidas" : `${pendientes} pendientes vencidas (>${umbralMinutos}min)`,
            metodo: "PING",
        };
    } catch (error) {
        return {
            ok: false,
            latenciaMs: Date.now() - inicio,
            detalle: `error contando pendientes vencidas: ${mensajeError(error)}`,
            metodo: "PING",
        };
    }
}

/**
 * SPEC-291 (002-PI-191): probe genérico basado en tick-vida.
 * Ok si el touchfile `${WORKER_RUN_DIR}/tick-vida-<contenedor>` fue actualizado
 * hace menos de `maxAntiguedadSeg` (default 90s, coherente con healthcheck docker).
 * Detecta bucle silencioso: si el event loop del worker se bloquea, el interval
 * no dispara y el tick envejece.
 */
export function probeTickVida(senal: SenalTickVida, maxAntiguedadSeg: number = 90): ResultadoProbe {
    const contenedor = NOMBRE_CONTENEDOR_POR_SENAL[senal];
    const seg = leerAntiguedadTickSeg(contenedor);
    if (seg === null) {
        return { ok: false, latenciaMs: 0, detalle: `tick-vida ausente para ${contenedor}`, metodo: "PING" };
    }
    return seg <= maxAntiguedadSeg
        ? { ok: true, latenciaMs: 0, metodo: "PING" }
        : {
            ok: false,
            latenciaMs: 0,
            detalle: `tick-vida ${contenedor} tiene ${seg}s (>${maxAntiguedadSeg})`,
            metodo: "PING",
        };
}
