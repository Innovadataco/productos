"use client";

import { useEffect, useRef, useState } from "react";

/**
 * ChatBI — chat REAL del motor NL→SQL (Fase 2), estilo mockup-bi-v2.
 *
 * Consume:
 * - POST /api/bi/preguntar con el payload real del contrato (T1):
 *   body EXACTO { pregunta } → 200 RespuestaMotor tal cual.
 * - GET /api/bi/ejemplos → sugerencias verificadas del catálogo (clicables).
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

interface Mensaje {
    id: number;
    rol: "usuario" | "bi";
    texto: string;
    /** Payload completo del motor (solo en mensajes bi que vinieron del API). */
    respuesta?: RespuestaMotor;
    /** Pregunta que quedó fallida (error del motor o de transporte): habilita Reintentar. */
    fallida?: string;
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

/** Mensaje del motor: render por estado (texto + SQL + badges + reintento). */
function MensajeBi({ msg, onReintentar }: { msg: Mensaje; onReintentar: (pregunta: string) => void }) {
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
