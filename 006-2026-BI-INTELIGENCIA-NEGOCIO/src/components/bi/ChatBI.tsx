"use client";

import { useEffect, useRef, useState } from "react";

/**
 * ChatBI — chat REAL del motor NL→SQL (Fase 2), estilo mockup-bi-v2.
 *
 * Consume:
 * - POST /api/bi/preguntar con el payload real del contrato (T1):
 *   body EXACTO { pregunta } → 200 RespuestaMotor tal cual.
 * - GET /api/bi/ejemplos → sugerencias verificadas del catálogo (clicables).
 * - GET /api/bi/consultas → MI historial (últimas 50): al montar repuebla
 *   la conversación (más reciente abajo). Una consulta mía en estado
 *   'pendiente' se muestra "procesando…" con polling cada 3 s al detalle
 *   (máx 3 min) hasta que resuelva.
 * - GET /api/bi/consultas/[id] → auditoría paso a paso ("Ver traza") de
 *   cada respuesta: hitos del pipeline con ms desde el inicio.
 *
 * Candados reflejados en UI:
 * - El texto narrativo y las cifras llegan del motor (plantillas deterministas
 *   + ResultSet, candados 9 y 10): el componente jamás calcula ni completa
 *   cifras — solo las muestra.
 * - ok: texto + SQL validado colapsable + badges (validador, N filas, cache).
 * - clarificacion → ámbar · rechazada → rubí · sin_datos → neutro ·
 *   error → mensaje honesto + botón Reintentar.
 */

/* Contrato de RespuestaMotor (lo implementa otro agente en src/lib/bi/motor.ts
   y lo expone POST /api/bi/preguntar; se consume tal cual — tipo local para
   no arrastrar módulos de servidor al bundle del cliente). */
interface RespuestaMotor {
    estado: "ok" | "clarificacion" | "rechazada" | "sin_datos" | "error";
    texto: string;
    sql?: string;
    filas?: number;
    fuenteCache?: boolean;
    consultaLogId?: string;
}

/* Paso de la auditoría del pipeline (espejo de PasoTraza de
   src/lib/observabilidad/traza.ts — tipo local, mismo motivo). */
interface PasoTraza {
    paso: string;
    detalle?: string;
    ms: number;
}

/* Resumen de MI historial (lo que devuelve GET /api/bi/consultas). */
interface ConsultaResumen {
    id: string;
    preguntaNL: string;
    respuestaTexto: string | null;
    estado: string;
    creadoEn: string;
    latenciaMs: number | null;
}

/* Detalle de UNA consulta mía (GET /api/bi/consultas/[id]). */
interface ConsultaDetalle {
    id: string;
    preguntaNL: string;
    respuestaTexto: string | null;
    sqlGenerado: string | null;
    plan: unknown;
    pasos: PasoTraza[] | null;
    estado: string;
    latenciaMs: number | null;
    fuenteCache: boolean;
    error: string | null;
    creadoEn: string;
}

const ESTADOS_MOTOR: readonly string[] = ["ok", "clarificacion", "rechazada", "sin_datos", "error"];

function esEstadoMotor(v: string): v is RespuestaMotor["estado"] {
    return ESTADOS_MOTOR.includes(v);
}

interface Mensaje {
    id: number;
    rol: "usuario" | "bi";
    texto: string;
    /** Payload completo del motor (solo en mensajes bi que vinieron del API). */
    respuesta?: RespuestaMotor;
    /** Pregunta que quedó fallida (error del motor o de transporte): habilita Reintentar. */
    fallida?: string;
    /** Id de la bitácora (habilita la auditoría "Ver traza"). */
    consultaId?: string;
    /** Consulta mía aún en proceso al cargar: puntos latiendo + polling. */
    pendiente?: boolean;
}

// Largo máximo del input: espejo del contrato de la API (1..500 chars).
const MAX_PREGUNTA_CHARS = 500;

/* Saludo inicial: SOLO explica cómo usar el chat. Nada de "hallazgos"
   inventados (candado 9: si no hay dato, no se inventa). */
const MENSAJE_INICIAL: Mensaje = {
    id: 0,
    rol: "bi",
    texto: "Hola 👋 Preguntame en español sobre la operación de PI: reportes por fechas, tendencias, categorías, colegios. Genero SQL de solo lectura, validado antes de ejecutarse contra la réplica — y si no hay dato, te lo digo sin inventar.",
};

const MENSAJE_SESION_VENCIDA =
    "Tu sesión venció. Recargá la página y volvé a entrar para seguir preguntando.";
const MENSAJE_ERROR_TRANSPORTE =
    "No pude contactar el motor — error de red o del servidor. Podés reintentar la pregunta.";
const MENSAJE_SIN_RESPUESTA_REGISTRADA = "(sin respuesta registrada en la bitácora)";
const MENSAJE_SIGUE_EN_PROCESO =
    "La consulta sigue en proceso. Recargá la página para ver el resultado.";

/* Polling de una consulta que quedó 'pendiente' al cargar el historial:
   cada 3 s al detalle, máximo 3 minutos (después se informa y se para). */
const POLLING_INTERVALO_MS = 3_000;
const POLLING_MAX_MS = 180_000;

/** Badge estándar del sistema de diseño (mismo patrón que dashboard/admin). */
function Badge({ children, tono = "neutro" }: { children: React.ReactNode; tono?: "neutro" | "ok" | "ambar" | "rubi" }) {
    const punto =
        tono === "ok" ? "punto punto-ok" : tono === "ambar" ? "punto punto-warn" : tono === "rubi" ? "punto punto-bad" : "";
    return (
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[12px] font-medium border border-[rgb(var(--tinta-rgb)/0.08)] bg-[rgb(var(--papel-rgb)/0.6)]">
            {punto && <span className={punto} />}
            {children}
        </span>
    );
}

/** Puntos de tipeo del mockup ("pensando"). Animación CSS pura: el bloque
    prefers-reduced-motion de globals.css la apaga sin excepción. */
function PuntosTipeo() {
    return (
        <span className="cb-puntos" role="status" aria-label="El motor está pensando">
            <i />
            <i />
            <i />
        </span>
    );
}

/** Auditoría paso a paso de una consulta ("Ver traza"): carga perezosa del
    detalle al primer despliegue; muestra hito, ms desde el inicio y detalle.
    El SQL ya se muestra aparte (colapsable "Ver SQL validado"). */
function TrazaConsulta({ consultaId }: { consultaId: string }) {
    const [abierta, setAbierta] = useState(false);
    const [cargando, setCargando] = useState(false);
    const [pasos, setPasos] = useState<PasoTraza[] | null>(null);
    const [fallo, setFallo] = useState(false);

    async function alternar() {
        const abre = !abierta;
        setAbierta(abre);
        if (abre && pasos === null && !cargando && !fallo) {
            setCargando(true);
            try {
                const res = await fetch(`/api/bi/consultas/${consultaId}`, { credentials: "include" });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const det = (await res.json()) as { pasos?: unknown };
                setPasos(Array.isArray(det.pasos) ? (det.pasos as PasoTraza[]) : []);
            } catch {
                setFallo(true);
            } finally {
                setCargando(false);
            }
        }
    }

    return (
        <div className="cb-traza">
            <button type="button" onClick={() => void alternar()} className="cb-traza-boton">
                {abierta ? "Ocultar traza" : "Ver traza"}
            </button>
            {abierta && (
                <div className="cb-traza-lista">
                    {cargando && <p className="cb-traza-nota">Cargando auditoría…</p>}
                    {fallo && <p className="cb-traza-nota">No se pudo cargar la traza de esta consulta.</p>}
                    {!cargando && !fallo && pasos !== null && pasos.length === 0 && (
                        <p className="cb-traza-nota">Esta consulta no tiene pasos registrados.</p>
                    )}
                    {!cargando &&
                        !fallo &&
                        pasos?.map((p, i) => (
                            <div key={`${p.paso}-${i}`} className="cb-traza-paso">
                                <span className="cb-traza-ms">+{p.ms} ms</span>
                                <span className="cb-traza-nombre">{p.paso}</span>
                                {p.detalle && <span className="cb-traza-detalle">{p.detalle}</span>}
                            </div>
                        ))}
                </div>
            )}
        </div>
    );
}

/** Mensaje del motor: render por estado (texto + SQL + badges + traza + reintento). */
function MensajeBi({ msg, onReintentar }: { msg: Mensaje; onReintentar: (pregunta: string) => void }) {
    // Consulta que quedó 'pendiente' al cargar el historial: puntos latiendo.
    if (msg.pendiente) {
        return (
            <div className="cb-msg cb-msg-bi">
                <p className="text-muted text-[13px] mb-1">Procesando tu pregunta anterior…</p>
                <PuntosTipeo />
            </div>
        );
    }

    const estado = msg.respuesta?.estado ?? "error";
    const clases = ["cb-msg", "cb-msg-bi"];
    if (estado === "clarificacion") clases.push("cb-msg-ambar");
    if (estado === "rechazada" || estado === "error") clases.push("cb-msg-rubi");

    return (
        <div className={clases.join(" ")}>
            <p className="whitespace-pre-wrap">{msg.texto}</p>

            {estado === "ok" && msg.respuesta?.sql && (
                <details className="cb-sql">
                    <summary>Ver SQL validado</summary>
                    <pre>{msg.respuesta.sql}</pre>
                </details>
            )}

            <div className="flex gap-2 mt-3 flex-wrap">
                {estado === "ok" && (
                    <>
                        <Badge tono="ok">✓ Validador SQL · solo lectura</Badge>
                        {typeof msg.respuesta?.filas === "number" && (
                            <Badge>
                                <span className="cifra">{msg.respuesta.filas}</span>{" "}
                                {msg.respuesta.filas === 1 ? "fila" : "filas"}
                            </Badge>
                        )}
                        {msg.respuesta?.fuenteCache && <Badge>⚡ Cache humano</Badge>}
                    </>
                )}
                {estado === "clarificacion" && <Badge tono="ambar">Necesito un dato más</Badge>}
                {estado === "rechazada" && <Badge tono="rubi">Consulta rechazada</Badge>}
            </div>

            {msg.consultaId && <TrazaConsulta consultaId={msg.consultaId} />}

            {msg.fallida && (
                <div className="mt-3">
                    <button
                        type="button"
                        onClick={() => onReintentar(msg.fallida as string)}
                        className="accent-gradient inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[12.5px] font-semibold text-[#060b0a] transition-opacity hover:opacity-90"
                    >
                        Reintentar pregunta
                    </button>
                </div>
            )}
        </div>
    );
}

export default function ChatBI() {
    const [mensajes, setMensajes] = useState<Mensaje[]>([MENSAJE_INICIAL]);
    const [sugerencias, setSugerencias] = useState<string[]>([]);
    const [entrada, setEntrada] = useState("");
    const [pensando, setPensando] = useState(false);

    // Contador de IDs de mensajes (jamás Math.random() en render).
    const contadorId = useRef(1);
    const cajaRef = useRef<HTMLDivElement>(null);

    /* Sugerencias verificadas del catálogo (fail-open: sin ellas el chat
       funciona igual — no son dato operativo). */
    useEffect(() => {
        let vivo = true;
        fetch("/api/bi/ejemplos", { credentials: "include" })
            .then((res) => (res.ok ? res.json() : null))
            .then((data: { sugerencias?: unknown } | null) => {
                if (!vivo || !data || !Array.isArray(data.sugerencias)) return;
                setSugerencias(data.sugerencias.filter((s): s is string => typeof s === "string"));
            })
            .catch(() => {
                /* silencio deliberado: la tarjeta muestra su estado vacío */
            });
        return () => {
            vivo = false;
        };
    }, []);

    /* Historial persistente: al montar, MI bitácora repuebla la conversación
       (la API trae más reciente primero; acá abajo va la más reciente).
       Una consulta mía en estado 'pendiente' queda "procesando…" con
       polling al detalle cada 3 s (máx 3 min) hasta que resuelva.
       Fail-open: si el historial no carga, el chat funciona igual. */
    useEffect(() => {
        let vivo = true;
        const temporizadores: ReturnType<typeof setInterval>[] = [];

        function resolverPendiente(msgId: number, det: ConsultaDetalle) {
            setMensajes((prev) =>
                prev.map((m) =>
                    m.id === msgId
                        ? {
                              ...m,
                              pendiente: false,
                              texto: det.respuestaTexto ?? MENSAJE_SIN_RESPUESTA_REGISTRADA,
                              respuesta: {
                                  estado: esEstadoMotor(det.estado) ? det.estado : "error",
                                  texto: det.respuestaTexto ?? "",
                                  ...(det.sqlGenerado ? { sql: det.sqlGenerado } : {}),
                                  fuenteCache: det.fuenteCache,
                              },
                          }
                        : m,
                ),
            );
        }

        function arrancarPolling(consultaId: string, msgId: number) {
            const inicio = Date.now();
            const timer = setInterval(() => {
                void (async () => {
                    if (!vivo) return;
                    if (Date.now() - inicio > POLLING_MAX_MS) {
                        clearInterval(timer);
                        setMensajes((prev) =>
                            prev.map((m) =>
                                m.id === msgId ? { ...m, pendiente: false, texto: MENSAJE_SIGUE_EN_PROCESO } : m,
                            ),
                        );
                        return;
                    }
                    try {
                        const res = await fetch(`/api/bi/consultas/${consultaId}`, { credentials: "include" });
                        if (!res.ok) return; // reintenta en el próximo tick
                        const det = (await res.json()) as ConsultaDetalle;
                        if (det.estado === "pendiente") return;
                        clearInterval(timer);
                        resolverPendiente(msgId, det);
                    } catch {
                        /* error de transporte: reintenta en el próximo tick */
                    }
                })();
            }, POLLING_INTERVALO_MS);
            temporizadores.push(timer);
        }

        fetch("/api/bi/consultas", { credentials: "include" })
            .then((res) => (res.ok ? res.json() : null))
            .then((data: { consultas?: unknown } | null) => {
                if (!vivo || !data || !Array.isArray(data.consultas)) return;
                const cronologico = [...(data.consultas as ConsultaResumen[])].reverse();
                const cargados: Mensaje[] = [];
                const pendientes: { consultaId: string; msgId: number }[] = [];
                for (const c of cronologico) {
                    if (typeof c?.preguntaNL !== "string" || typeof c?.id !== "string") continue;
                    cargados.push({ id: nuevoId(), rol: "usuario", texto: c.preguntaNL });
                    const msgId = nuevoId();
                    if (c.estado === "pendiente") {
                        cargados.push({ id: msgId, rol: "bi", texto: "", consultaId: c.id, pendiente: true });
                        pendientes.push({ consultaId: c.id, msgId });
                    } else {
                        const texto = c.respuestaTexto ?? MENSAJE_SIN_RESPUESTA_REGISTRADA;
                        cargados.push({
                            id: msgId,
                            rol: "bi",
                            texto,
                            consultaId: c.id,
                            respuesta: {
                                estado: esEstadoMotor(c.estado) ? c.estado : "error",
                                texto,
                            },
                        });
                    }
                }
                if (cargados.length > 0) setMensajes((prev) => [...prev, ...cargados]);
                for (const p of pendientes) arrancarPolling(p.consultaId, p.msgId);
            })
            .catch(() => {
                /* historial fail-open: la conversación nueva funciona igual */
            });

        return () => {
            vivo = false;
            for (const t of temporizadores) clearInterval(t);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar
    }, []);

    /* Autoscroll al último mensaje (o a los puntos de tipeo). */
    useEffect(() => {
        const caja = cajaRef.current;
        if (caja) caja.scrollTop = caja.scrollHeight;
    }, [mensajes, pensando]);

    function nuevoId(): number {
        const id = contadorId.current;
        contadorId.current += 1;
        return id;
    }

    /* Envío real al motor (T1: el body es EXACTAMENTE { pregunta }). */
    async function enviar(preguntaCruda: string) {
        const pregunta = preguntaCruda.trim();
        if (!pregunta || pensando) return;
        setPensando(true);
        setEntrada("");
        setMensajes((prev) => [...prev, { id: nuevoId(), rol: "usuario", texto: pregunta }]);
        try {
            const res = await fetch("/api/bi/preguntar", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pregunta }),
            });
            const data = (await res.json().catch(() => null)) as RespuestaMotor | { error: string } | null;
            if (res.status === 401) {
                // Sin reintento: reintentar no arregla una sesión vencida.
                setMensajes((prev) => [...prev, { id: nuevoId(), rol: "bi", texto: MENSAJE_SESION_VENCIDA }]);
                return;
            }
            if (!res.ok || !data || !("estado" in data)) {
                setMensajes((prev) => [
                    ...prev,
                    { id: nuevoId(), rol: "bi", texto: MENSAJE_ERROR_TRANSPORTE, fallida: pregunta },
                ]);
                return;
            }
            setMensajes((prev) => [
                ...prev,
                {
                    id: nuevoId(),
                    rol: "bi",
                    texto: data.texto,
                    respuesta: data,
                    // Traza de la bitácora disponible para esta respuesta.
                    ...(data.consultaLogId ? { consultaId: data.consultaLogId } : {}),
                    // Error reportado por el motor: mensaje honesto + reintento.
                    ...(data.estado === "error" ? { fallida: pregunta } : {}),
                },
            ]);
        } catch {
            setMensajes((prev) => [
                ...prev,
                { id: nuevoId(), rol: "bi", texto: MENSAJE_ERROR_TRANSPORTE, fallida: pregunta },
            ]);
        } finally {
            setPensando(false);
        }
    }

    return (
        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
            {/* ============ Caja del chat ============ */}
            <section
                className="glass anim-entrada flex flex-col h-[580px]"
                style={{ "--anim-retardo": "80ms" } as React.CSSProperties}
            >
                <div ref={cajaRef} className="cb-msgs" role="log" aria-live="polite" aria-label="Conversación con el motor">
                    {mensajes.map((msg) =>
                        msg.rol === "usuario" ? (
                            <div key={msg.id} className="cb-msg cb-msg-usuario">
                                <p className="whitespace-pre-wrap">{msg.texto}</p>
                            </div>
                        ) : (
                            <MensajeBi key={msg.id} msg={msg} onReintentar={enviar} />
                        ),
                    )}
                    {pensando && (
                        <div className="cb-msg cb-msg-bi">
                            <PuntosTipeo />
                        </div>
                    )}
                </div>

                <form
                    className="cb-input"
                    onSubmit={(e) => {
                        e.preventDefault();
                        void enviar(entrada);
                    }}
                >
                    <label htmlFor="cb-entrada" className="sr-only">
                        Pregunta para el motor
                    </label>
                    <input
                        id="cb-entrada"
                        type="text"
                        value={entrada}
                        onChange={(e) => setEntrada(e.target.value)}
                        placeholder="Ej: ¿cuántos reportes hubo por categoría este mes?"
                        maxLength={MAX_PREGUNTA_CHARS}
                        autoComplete="off"
                    />
                    <button
                        type="submit"
                        disabled={pensando || entrada.trim().length === 0}
                        className="accent-gradient inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-[#060b0a] transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {pensando ? "Pensando…" : "Preguntar"}
                    </button>
                </form>
            </section>

            {/* ============ Panel lateral ============ */}
            <aside className="anim-entrada" style={{ "--anim-retardo": "160ms" } as React.CSSProperties}>
                <div className="glass p-6 mb-4">
                    <h3 className="font-semibold tracking-tight mb-3">Sugeridas por BI</h3>
                    {sugerencias.length === 0 ? (
                        <p className="text-muted text-[13px] leading-relaxed">
                            Aún no hay preguntas de ejemplo verificadas en el catálogo.
                        </p>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {sugerencias.map((s) => (
                                <button
                                    key={s}
                                    type="button"
                                    onClick={() => void enviar(s)}
                                    disabled={pensando}
                                    className="cb-sugerencia"
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <div className="glass p-6">
                    <h3 className="font-semibold tracking-tight mb-3">Garantías del motor</h3>
                    <div className="flex flex-col gap-2 text-[13px] text-muted">
                        <div>✓ Solo lectura sobre la réplica — nunca toca PI</div>
                        <div>✓ SQL validado antes de ejecutarse</div>
                        <div>✓ Cifras del ResultSet, nunca inventadas</div>
                        <div>✓ Sin PII: datos de menores jamás llegan a BI</div>
                        <div>✓ Cada consulta queda en bitácora</div>
                    </div>
                </div>
            </aside>

            {/* Estilos del mockup (sección chat) que no viven en globals.css.
                Las animaciones usan keyframes CSS: prefers-reduced-motion las
                apaga vía la regla global, sin excepción. */}
            <style>{`
                .cb-msgs { flex: 1; overflow-y: auto; padding: 24px; display: flex; flex-direction: column; gap: 16px; }
                .cb-msg { max-width: 86%; padding: 14px 18px; border-radius: 16px; font-size: 15px; line-height: 1.6; animation: cb-entrada 0.5s var(--curva) both; }
                .cb-msg-usuario { align-self: flex-end; color: #060b0a; font-weight: 500; background: linear-gradient(135deg, rgb(var(--pino-rgb)), rgb(var(--cielo-rgb))); border-bottom-right-radius: 4px; }
                .cb-msg-bi { align-self: flex-start; background: rgb(var(--tinta-rgb) / 0.05); border: 1px solid rgb(var(--tinta-rgb) / 0.08); border-bottom-left-radius: 4px; }
                .cb-msg-ambar { border-color: rgb(var(--ambar-rgb) / 0.45); background: rgb(var(--ambar-rgb) / 0.08); }
                .cb-msg-rubi { border-color: rgb(var(--rubi-rgb) / 0.45); background: rgb(var(--rubi-rgb) / 0.07); }
                .cb-puntos { display: inline-flex; gap: 4px; padding: 4px 2px; }
                .cb-puntos i { width: 7px; height: 7px; border-radius: 50%; background: rgb(var(--tinta-subtle-rgb)); animation: cb-salta 1.2s ease-in-out infinite; }
                .cb-puntos i:nth-child(2) { animation-delay: 0.15s; }
                .cb-puntos i:nth-child(3) { animation-delay: 0.3s; }
                .cb-sql { margin-top: 12px; }
                .cb-sql summary { cursor: pointer; font-size: 12.5px; color: rgb(var(--tinta-muted-rgb)); user-select: none; }
                .cb-sql pre { margin-top: 8px; padding: 14px 16px; border-radius: 10px; background: #0b1311; color: #9fe8cf; font-size: 12.5px; line-height: 1.6; overflow-x: auto; white-space: pre; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
                .cb-traza { margin-top: 10px; }
                .cb-traza-boton { font-size: 12px; color: rgb(var(--tinta-muted-rgb)); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; transition: color 0.2s; }
                .cb-traza-boton:hover { color: rgb(var(--pino-rgb)); }
                .cb-traza-lista { margin-top: 8px; padding: 10px 12px; border-radius: 10px; border: 1px solid rgb(var(--tinta-rgb) / 0.08); background: rgb(var(--tinta-rgb) / 0.03); display: flex; flex-direction: column; gap: 6px; }
                .cb-traza-paso { display: flex; align-items: baseline; gap: 8px; font-size: 12.5px; }
                .cb-traza-ms { flex-shrink: 0; min-width: 64px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; color: rgb(var(--tinta-subtle-rgb)); }
                .cb-traza-nombre { font-weight: 600; color: rgb(var(--tinta-rgb)); }
                .cb-traza-detalle { color: rgb(var(--tinta-muted-rgb)); overflow-wrap: anywhere; }
                .cb-traza-nota { font-size: 12.5px; color: rgb(var(--tinta-muted-rgb)); margin: 0; }
                .cb-input { display: flex; gap: 10px; padding: 16px; border-top: 1px solid rgb(var(--tinta-rgb) / 0.08); }
                .cb-input input { flex: 1; border-radius: var(--radio-input); border: 1px solid rgb(var(--tinta-rgb) / 0.12); background: rgb(var(--tinta-rgb) / 0.04); padding: 10px 14px; font-size: 14px; color: rgb(var(--tinta-rgb)); outline: none; transition: border-color 0.2s, box-shadow 0.2s; }
                .cb-input input::placeholder { color: rgb(var(--tinta-subtle-rgb)); }
                .cb-input input:focus { border-color: rgb(var(--pino-rgb)); box-shadow: 0 0 0 2px rgb(var(--pino-rgb) / 0.3), 0 0 18px rgb(var(--pino-rgb) / 0.15); }
                .cb-sugerencia { text-align: left; font-size: 13px; padding: 10px 14px; border-radius: 12px; border: 1px solid rgb(var(--tinta-rgb) / 0.08); background: rgb(var(--tinta-rgb) / 0.03); color: rgb(var(--tinta-rgb)); transition: border-color 0.2s, background 0.2s; cursor: pointer; }
                .cb-sugerencia:hover:not(:disabled) { border-color: rgb(var(--pino-rgb) / 0.5); background: rgb(var(--pino-rgb) / 0.07); }
                .cb-sugerencia:disabled { opacity: 0.5; cursor: not-allowed; }
                @keyframes cb-entrada { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes cb-salta { 0%, 60%, 100% { transform: translateY(0); opacity: 0.5; } 30% { transform: translateY(-4px); opacity: 1; } }
            `}</style>
        </div>
    );
}
