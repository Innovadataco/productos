"use client";

import { useState } from "react";

/**
 * Playground Admin IA (006): réplica de la LÓGICA del playground de PI
 * (/dashboard/admin/ia?tab=playground) como SISTEMA SEPARADO — sondear Ollama
 * → listar modelos → seleccionar/guardar → probar. Consume la API propia del
 * 006 (/api/bi/ollama/*) con payload real (T1); la config vive en bi_config
 * (B3) y nada se comparte con PI.
 */

/* Contratos de /api/bi/ollama/* (los implementa otro agente; se consumen tal cual) */
interface EstadoOllamaOk {
    ok: true;
    alcanzable: boolean;
    totalModelos: number;
    modeloActual: string;
    modelosClasificacion: string[];
    modelosEmbedding: string[];
}
interface ApiError {
    ok: false;
    error: string;
}
interface ConfigOk {
    ok: true;
    modelo: string;
}
interface ProbarOk {
    ok: true;
    respuesta: string;
    metrics: {
        modelo: string;
        latenciaMs: number;
        promptTokens: number | null;
        responseTokens: number | null;
    };
}

type FaseSondeo =
    | { fase: "inicial" }
    | { fase: "sondeando" }
    | { fase: "ok"; datos: EstadoOllamaOk }
    | { fase: "error"; mensaje: string };

type FaseGuardado =
    | { fase: "inicial" }
    | { fase: "guardando" }
    | { fase: "guardado"; modelo: string }
    | { fase: "error"; mensaje: string };

type FasePrueba =
    | { fase: "inicial" }
    | { fase: "probando" }
    | { fase: "ok"; respuesta: string; metrics: ProbarOk["metrics"] }
    | { fase: "error"; mensaje: string };

const MENSAJE_INALCANZABLE = "Ollama inalcanzable — verificá Tailscale/Mac Studio";

/** Códigos de error de la API traducidos a mensajes claros */
const MENSAJES_ERROR: Record<string, string> = {
    ollama_inalcanzable: MENSAJE_INALCANZABLE,
    url_no_local: "La URL de Ollama configurada no es local (R2) — revisá bi_config / OLLAMA_BASE_URL",
    modelo_no_instalado: "Ese modelo no está instalado en Ollama",
    payload_invalido: "La API rechazó el payload enviado",
};

/** Mensaje de error legible a partir del código de la API */
function mensajeError(codigo: string | undefined, fallback: string): string {
    if (!codigo) return fallback;
    return MENSAJES_ERROR[codigo] ?? codigo;
}

const btnPrimario =
    "accent-gradient inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-[#060b0a] transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed";

const claseInput =
    "w-full rounded-[var(--radio-input)] border border-[rgb(var(--tinta-rgb)/0.12)] bg-[rgb(var(--tinta-rgb)/0.04)] px-3.5 py-2.5 text-sm text-body placeholder:text-subtle focus:outline-none focus:border-[rgb(var(--pino-rgb)/0.6)]";

function PasoEncabezado({ numero, titulo, detalle }: { numero: number; titulo: string; detalle?: string }) {
    return (
        <div className="flex items-baseline gap-3 mb-5 flex-wrap">
            <span className="microetiqueta">Paso {numero}</span>
            <h2 className="text-lg font-semibold tracking-tight">{titulo}</h2>
            {detalle && <span className="text-muted text-[13px]">{detalle}</span>}
        </div>
    );
}

function Cargando({ texto }: { texto: string }) {
    return (
        <span className="inline-flex items-center gap-2.5 text-muted text-sm">
            <span className="punto punto-warn anim-pulso" />
            {texto}
        </span>
    );
}

export default function AdminIaPlayground() {
    const [sondeo, setSondeo] = useState<FaseSondeo>({ fase: "inicial" });
    const [modeloSel, setModeloSel] = useState("");
    const [guardado, setGuardado] = useState<FaseGuardado>({ fase: "inicial" });
    const [texto, setTexto] = useState("");
    const [prueba, setPrueba] = useState<FasePrueba>({ fase: "inicial" });

    const datos = sondeo.fase === "ok" ? sondeo.datos : null;
    const modeloPrueba = modeloSel || datos?.modeloActual || "";

    /* PASO 1 — Sondeo de Ollama vía la API propia del 006 */
    async function sondear() {
        setSondeo({ fase: "sondeando" });
        setGuardado({ fase: "inicial" });
        try {
            const res = await fetch("/api/bi/ollama/estado", { credentials: "include" });
            const data = (await res.json().catch(() => null)) as EstadoOllamaOk | ApiError | null;
            if (!res.ok || !data || data.ok !== true) {
                const codigo = data && "error" in data ? data.error : undefined;
                setSondeo({
                    fase: "error",
                    mensaje: mensajeError(codigo, `Error consultando Ollama (HTTP ${res.status})`),
                });
                return;
            }
            setSondeo({ fase: "ok", datos: data });
            // Preselecciona el modelo actual; si no está en la lista, conserva
            // la selección previa solo si sigue existiendo en Ollama
            setModeloSel((prev) => {
                if (data.modeloActual && data.modelosClasificacion.includes(data.modeloActual)) {
                    return data.modeloActual;
                }
                if (prev && data.modelosClasificacion.includes(prev)) return prev;
                return data.modelosClasificacion[0] ?? "";
            });
        } catch {
            setSondeo({ fase: "error", mensaje: "No se pudo contactar la API del 006" });
        }
    }

    /* PASO 2 — Guardar el modelo de chat en bi_config */
    async function guardarModelo() {
        if (!modeloSel) return;
        setGuardado({ fase: "guardando" });
        try {
            const res = await fetch("/api/bi/ollama/config", {
                method: "PUT",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ modelo: modeloSel }),
            });
            const data = (await res.json().catch(() => null)) as ConfigOk | ApiError | null;
            if (!res.ok || !data || data.ok !== true) {
                const codigo = data && "error" in data ? data.error : undefined;
                setGuardado({ fase: "error", mensaje: mensajeError(codigo, `Error guardando (HTTP ${res.status})`) });
                return;
            }
            setGuardado({ fase: "guardado", modelo: data.modelo });
            // Refresca el "actual" que muestra la tarjeta de conexión
            setSondeo((prev) =>
                prev.fase === "ok" ? { fase: "ok", datos: { ...prev.datos, modeloActual: data.modelo } } : prev,
            );
        } catch {
            setGuardado({ fase: "error", mensaje: "No se pudo guardar la configuración" });
        }
    }

    /* PASO 3 — Prueba real del modelo (payload real: modelo + prompt del usuario) */
    async function probar() {
        const prompt = texto.trim();
        if (!prompt || !modeloPrueba) return;
        setPrueba({ fase: "probando" });
        try {
            const res = await fetch("/api/bi/ollama/probar", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ modelo: modeloPrueba, prompt }),
            });
            const data = (await res.json().catch(() => null)) as ProbarOk | ApiError | null;
            if (!res.ok || !data || data.ok !== true) {
                const codigo = data && "error" in data ? data.error : undefined;
                setPrueba({ fase: "error", mensaje: mensajeError(codigo, `Error en la prueba (HTTP ${res.status})`) });
                return;
            }
            setPrueba({ fase: "ok", respuesta: data.respuesta, metrics: data.metrics });
        } catch {
            setPrueba({ fase: "error", mensaje: "No se pudo ejecutar la prueba" });
        }
    }

    return (
        <div className="space-y-6">
            {/* ============ PASO 1 · Conexión ============ */}
            <section
                className="glass anim-entrada p-6 sm:p-8"
                style={{ "--anim-retardo": "120ms" } as React.CSSProperties}
            >
                <PasoEncabezado
                    numero={1}
                    titulo="Conexión"
                    detalle="Sondeá el Ollama del Mac Studio (vía Tailscale) antes de configurar"
                />
                <div className="flex flex-wrap items-center gap-4">
                    <button type="button" onClick={sondear} disabled={sondeo.fase === "sondeando"} className={btnPrimario}>
                        {sondeo.fase === "sondeando" ? "Sondeando…" : "Sondear Ollama"}
                    </button>
                    {sondeo.fase === "sondeando" && <Cargando texto="Consultando /api/bi/ollama/estado…" />}
                    {sondeo.fase === "ok" && datos && (
                        <span className="inline-flex items-center gap-2.5 text-sm">
                            <span className="punto punto-ok anim-pulso" />
                            <span className="text-estado-pino font-medium">Ollama alcanzable</span>
                            <span className="text-muted">
                                · <span className="cifra">{datos.totalModelos}</span>{" "}
                                {datos.totalModelos === 1 ? "modelo instalado" : "modelos instalados"}
                            </span>
                        </span>
                    )}
                    {sondeo.fase === "error" && (
                        <span className="inline-flex items-center gap-2.5 text-sm">
                            <span className="punto punto-bad anim-pulso" />
                            <span className="text-estado-rubi font-medium">{sondeo.mensaje}</span>
                        </span>
                    )}
                </div>
                {datos && (
                    <div className="flex gap-2.5 flex-wrap mt-5">
                        <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12.5px] font-medium border border-[rgb(var(--tinta-rgb)/0.08)] bg-[rgb(var(--papel-rgb)/0.6)]">
                            <span className="punto punto-ok" /> Modelo de chat actual:{" "}
                            <code className="font-mono text-[12px]">{datos.modeloActual || "sin configurar"}</code>
                        </span>
                        <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12.5px] font-medium border border-[rgb(var(--tinta-rgb)/0.08)] bg-[rgb(var(--papel-rgb)/0.6)]">
                            <span className="punto punto-warn" />
                            <span className="cifra">{datos.modelosEmbedding.length}</span> de embedding (excluidos del selector)
                        </span>
                    </div>
                )}
            </section>

            {/* ============ PASO 2 · Modelo ============ */}
            <section
                className="glass anim-entrada p-6 sm:p-8"
                style={{ "--anim-retardo": "200ms" } as React.CSSProperties}
            >
                <PasoEncabezado
                    numero={2}
                    titulo="Modelo"
                    detalle="Elegí el modelo de chat y guardalo en la configuración del 006"
                />
                {!datos ? (
                    <p className="text-muted text-sm">Sondeá Ollama primero para listar los modelos disponibles.</p>
                ) : datos.modelosClasificacion.length === 0 ? (
                    <p className="text-estado-ambar text-sm inline-flex items-center gap-2.5">
                        <span className="punto punto-warn" />
                        Ollama no tiene modelos de chat instalados — descargá alguno en el Mac Studio.
                    </p>
                ) : (
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="admin-ia-modelo" className="microetiqueta block mb-2">
                                Modelo de chat
                            </label>
                            <select
                                id="admin-ia-modelo"
                                value={modeloSel}
                                onChange={(e) => {
                                    setModeloSel(e.target.value);
                                    setGuardado({ fase: "inicial" });
                                }}
                                className={claseInput}
                            >
                                {datos.modelosClasificacion.map((m) => (
                                    <option key={m} value={m}>
                                        {m}
                                        {m === datos.modeloActual ? " · actual" : ""}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex flex-wrap items-center gap-4">
                            <button
                                type="button"
                                onClick={guardarModelo}
                                disabled={guardado.fase === "guardando" || !modeloSel || modeloSel === datos.modeloActual}
                                className={btnPrimario}
                            >
                                {guardado.fase === "guardando" ? "Guardando…" : "Guardar como modelo de chat"}
                            </button>
                            {guardado.fase === "guardando" && <Cargando texto="Escribiendo en bi_config…" />}
                            {guardado.fase === "guardado" && (
                                <span className="inline-flex items-center gap-2.5 text-sm">
                                    <span className="punto punto-ok anim-pulso" />
                                    <span className="text-estado-pino font-medium">
                                        Modelo de chat actualizado:{" "}
                                        <code className="font-mono text-[12.5px]">{guardado.modelo}</code>
                                    </span>
                                </span>
                            )}
                            {guardado.fase === "error" && (
                                <span className="inline-flex items-center gap-2.5 text-sm">
                                    <span className="punto punto-bad" />
                                    <span className="text-estado-rubi font-medium">{guardado.mensaje}</span>
                                </span>
                            )}
                        </div>
                    </div>
                )}
            </section>

            {/* ============ PASO 3 · Probar ============ */}
            <section
                className="glass anim-entrada p-6 sm:p-8"
                style={{ "--anim-retardo": "280ms" } as React.CSSProperties}
            >
                <PasoEncabezado
                    numero={3}
                    titulo="Probar"
                    detalle="Mandá un prompt real al modelo y medí latencia y tokens"
                />
                <div className="space-y-4">
                    <div>
                        <label htmlFor="admin-ia-prompt" className="microetiqueta block mb-2">
                            Prompt de prueba
                        </label>
                        <textarea
                            id="admin-ia-prompt"
                            value={texto}
                            onChange={(e) => setTexto(e.target.value)}
                            placeholder="Escribí algo para probar el modelo…"
                            rows={5}
                            maxLength={4000}
                            className={`${claseInput} resize-y`}
                        />
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                        <button
                            type="button"
                            onClick={probar}
                            disabled={prueba.fase === "probando" || !texto.trim() || !modeloPrueba}
                            className={btnPrimario}
                        >
                            {prueba.fase === "probando" ? "Esperando respuesta…" : "Enviar prueba"}
                        </button>
                        {prueba.fase === "probando" && (
                            <Cargando texto={`Generando con ${modeloPrueba} (puede tardar varios segundos)…`} />
                        )}
                        {prueba.fase !== "probando" && modeloPrueba && (
                            <span className="text-muted text-[13px]">
                                Se probará con <code className="font-mono text-[12.5px]">{modeloPrueba}</code>
                            </span>
                        )}
                        {!modeloPrueba && (
                            <span className="text-muted text-[13px]">Sondeá Ollama y elegí un modelo para probar.</span>
                        )}
                    </div>

                    {prueba.fase === "error" && (
                        <div className="glass-strong p-4 flex items-center gap-2.5">
                            <span className="punto punto-bad" />
                            <p className="text-sm text-estado-rubi font-medium">{prueba.mensaje}</p>
                        </div>
                    )}

                    {prueba.fase === "ok" && (
                        <div className="glass-strong anim-entrada p-5 space-y-4">
                            <div className="flex gap-2.5 flex-wrap">
                                <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12.5px] font-medium border border-[rgb(var(--tinta-rgb)/0.08)] bg-[rgb(var(--papel-rgb)/0.6)]">
                                    <span className="punto punto-ok" />
                                    <code className="font-mono text-[12px]">{prueba.metrics.modelo}</code>
                                </span>
                                <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12.5px] font-medium border border-[rgb(var(--tinta-rgb)/0.08)] bg-[rgb(var(--papel-rgb)/0.6)]">
                                    Latencia <span className="cifra">{prueba.metrics.latenciaMs} ms</span>
                                </span>
                                <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12.5px] font-medium border border-[rgb(var(--tinta-rgb)/0.08)] bg-[rgb(var(--papel-rgb)/0.6)]">
                                    Tokens entrada{" "}
                                    <span className="cifra">
                                        {prueba.metrics.promptTokens === null ? "—" : prueba.metrics.promptTokens}
                                    </span>
                                </span>
                                <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12.5px] font-medium border border-[rgb(var(--tinta-rgb)/0.08)] bg-[rgb(var(--papel-rgb)/0.6)]">
                                    Tokens salida{" "}
                                    <span className="cifra">
                                        {prueba.metrics.responseTokens === null ? "—" : prueba.metrics.responseTokens}
                                    </span>
                                </span>
                            </div>
                            <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{prueba.respuesta}</p>
                        </div>
                    )}
                </div>
            </section>

            <p className="text-subtle text-[12.5px] text-center anim-entrada" style={{ "--anim-retardo": "360ms" } as React.CSSProperties}>
                Config propia del 006 (<code className="font-mono">bi_config</code>) — no comparte parámetros con PI.
            </p>
        </div>
    );
}
