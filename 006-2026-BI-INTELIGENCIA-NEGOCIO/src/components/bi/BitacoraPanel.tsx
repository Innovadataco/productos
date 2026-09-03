"use client";

import { Fragment, useEffect, useState } from "react";

/**
 * BitacoraPanel — panel admin de la bitácora de BI (SPEC-006 · Lote 3 +
 * bitácora general 2026-09-02). Dos vistas:
 *
 * - Chat: consume GET /api/bi/bitacora?tipo=chat (default) → consultas del
 *   motor con filtros de fecha/estado y paginación; drill-down perezoso con
 *   GET /api/bi/consultas/[id] (403 de tenancy se anuncia sin inventar).
 * - Eventos: GET /api/bi/bitacora?tipo=eventos → bitácora general
 *   (logins, cambios de config, exportaciones) con filtro por acción.
 *   Sin drill-down: el evento ya trae su detalle en la fila.
 *
 * Candados: latencias y totales llegan del API tal cual (candado 10); los
 * vacíos y errores se anuncian con texto honesto (candado 9). Sin animaciones
 * JS: la entrada usa la clase CSS anim-entrada, gobernada por la regla global
 * prefers-reduced-motion.
 */

/* Fila del listado de chat (GET /api/bi/bitacora?tipo=chat). */
interface FilaBitacora {
    id: string;
    preguntaNL: string;
    estado: string;
    latenciaMs: number | null;
    fuenteCache: boolean;
    creadoEn: string;
    usuarioId: string;
}

/* Fila de la bitácora general (GET /api/bi/bitacora?tipo=eventos). */
interface FilaEvento {
    id: string;
    accion: string;
    email: string;
    detalle: string | null;
    creadoEn: string;
}

interface RespuestaChat {
    tipo: "chat";
    filas: FilaBitacora[];
    total: number;
    pagina: number;
    paginas: number;
}

interface RespuestaEventos {
    tipo: "eventos";
    filas: FilaEvento[];
    total: number;
    pagina: number;
    paginas: number;
}

type RespuestaBitacora = RespuestaChat | RespuestaEventos;

/* Paso de la auditoría del pipeline (espejo de PasoTraza — tipo local para
   no arrastrar módulos de servidor al bundle del cliente). */
interface PasoTraza {
    paso: string;
    detalle?: string;
    ms: number;
}

/* Detalle de UNA consulta (GET /api/bi/consultas/[id]). */
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

/** Vistas del panel. */
const TIPOS = [
    { id: "chat", etiqueta: "Chat" },
    { id: "eventos", etiqueta: "Eventos" },
] as const;

type TipoBitacora = (typeof TIPOS)[number]["id"];

/** Chips de filtro por estado ("" = sin filtro). Solo en la vista Chat. */
const FILTROS_ESTADO = [
    { id: "", etiqueta: "Todos" },
    { id: "ok", etiqueta: "ok" },
    { id: "sin_datos", etiqueta: "sin datos" },
    { id: "clarificacion", etiqueta: "clarificación" },
    { id: "rechazada", etiqueta: "rechazada" },
    { id: "error", etiqueta: "error" },
] as const;

/** Chips de filtro por acción ("" = sin filtro). Solo en la vista Eventos. */
const FILTROS_ACCION = [
    { id: "", etiqueta: "Todas" },
    { id: "LOGIN_OK", etiqueta: "ingresos" },
    { id: "LOGIN_FALLIDO", etiqueta: "ingresos fallidos" },
    { id: "CONFIG_CAMBIO", etiqueta: "cambios de config" },
    { id: "EXPORTACION", etiqueta: "exportaciones" },
] as const;

const MENSAJE_SESION_VENCIDA = "Tu sesión venció. Recargá la página y volvé a entrar.";
const MENSAJE_ERROR_CARGA = "No se pudo cargar la bitácora — error de red o del servidor. Reintentá en un momento.";

/** Píldora de estado con su color del sistema de diseño:
    ok pino · sin_datos cielo · clarificacion ámbar · rechazada/error rubí. */
function PildoraEstado({ estado }: { estado: string }) {
    let clases: string;
    let etiqueta: string;
    switch (estado) {
        case "ok":
            clases = "text-estado-pino bg-[rgb(var(--pino-rgb)/0.12)] border-[rgb(var(--pino-rgb)/0.3)]";
            etiqueta = "ok";
            break;
        case "sin_datos":
            clases = "text-[rgb(var(--cielo-ink-rgb))] bg-[rgb(var(--cielo-rgb)/0.12)] border-[rgb(var(--cielo-rgb)/0.3)]";
            etiqueta = "sin datos";
            break;
        case "clarificacion":
            clases = "text-estado-ambar bg-[rgb(var(--ambar-rgb)/0.12)] border-[rgb(var(--ambar-rgb)/0.3)]";
            etiqueta = "clarificación";
            break;
        case "rechazada":
            clases = "text-estado-rubi bg-[rgb(var(--rubi-rgb)/0.12)] border-[rgb(var(--rubi-rgb)/0.3)]";
            etiqueta = "rechazada";
            break;
        case "error":
            clases = "text-estado-rubi bg-[rgb(var(--rubi-rgb)/0.12)] border-[rgb(var(--rubi-rgb)/0.3)]";
            etiqueta = "error";
            break;
        default:
            // Estado no contemplado (p.ej. "pendiente"): se muestra tal cual, neutro.
            clases = "text-muted bg-[rgb(var(--tinta-rgb)/0.05)] border-[rgb(var(--tinta-rgb)/0.12)]";
            etiqueta = estado;
    }
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-medium border ${clases}`}>
            {etiqueta}
        </span>
    );
}

/** Píldora de acción de la bitácora general:
    LOGIN_OK pino · LOGIN_FALLIDO rubí · CONFIG_CAMBIO cielo · EXPORTACION ámbar. */
function PildoraAccion({ accion }: { accion: string }) {
    let clases: string;
    let etiqueta: string;
    switch (accion) {
        case "LOGIN_OK":
            clases = "text-estado-pino bg-[rgb(var(--pino-rgb)/0.12)] border-[rgb(var(--pino-rgb)/0.3)]";
            etiqueta = "ingreso";
            break;
        case "LOGIN_FALLIDO":
            clases = "text-estado-rubi bg-[rgb(var(--rubi-rgb)/0.12)] border-[rgb(var(--rubi-rgb)/0.3)]";
            etiqueta = "ingreso fallido";
            break;
        case "CONFIG_CAMBIO":
            clases = "text-[rgb(var(--cielo-ink-rgb))] bg-[rgb(var(--cielo-rgb)/0.12)] border-[rgb(var(--cielo-rgb)/0.3)]";
            etiqueta = "config";
            break;
        case "EXPORTACION":
            clases = "text-estado-ambar bg-[rgb(var(--ambar-rgb)/0.12)] border-[rgb(var(--ambar-rgb)/0.3)]";
            etiqueta = "exportación";
            break;
        default:
            clases = "text-muted bg-[rgb(var(--tinta-rgb)/0.05)] border-[rgb(var(--tinta-rgb)/0.12)]";
            etiqueta = accion;
    }
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-medium border ${clases}`}>
            {etiqueta}
        </span>
    );
}

/** Detalle JSON chico → "clave: valor · clave: valor". Si no parsea, se
    muestra el texto tal cual (nunca se oculta información de auditoría). */
function formatoDetalle(detalle: string | null): string {
    if (!detalle) return "—";
    try {
        const obj = JSON.parse(detalle) as Record<string, unknown>;
        return Object.entries(obj)
            .map(([k, v]) => `${k}: ${String(v)}`)
            .join(" · ");
    } catch {
        return detalle;
    }
}

/** Fecha/hora legible es-CO (solo formatea el ISO que llegó del API). */
function formatoFechaHora(iso: string): string {
    const fecha = new Date(iso);
    if (Number.isNaN(fecha.getTime())) return iso;
    return fecha.toLocaleString("es-CO", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

/** Latencia tal cual llegó; null se dice, no se inventa. */
function formatoLatencia(ms: number | null): string {
    if (ms === null) return "—";
    return ms >= 1000 ? `${(ms / 1000).toLocaleString("es-CO", { maximumFractionDigits: 1 })} s` : `${ms} ms`;
}

/** Traza completa de una consulta: carga perezosa al expandir la fila.
    Reusa GET /api/bi/consultas/[id]; el 403 de tenancy se anuncia honesto. */
function DetalleConsulta({ id }: { id: string }) {
    const [detalle, setDetalle] = useState<ConsultaDetalle | null>(null);
    const [estadoHttp, setEstadoHttp] = useState<number | null>(null);

    useEffect(() => {
        let vivo = true;
        fetch(`/api/bi/consultas/${id}`, { credentials: "include" })
            .then(async (res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return (await res.json()) as ConsultaDetalle;
            })
            .then((d) => {
                if (vivo) setDetalle(d);
            })
            .catch((e: unknown) => {
                if (!vivo) return;
                const m = e instanceof Error && /^HTTP (\d+)$/.exec(e.message);
                setEstadoHttp(m ? Number(m[1]) : 0);
            });
        return () => {
            vivo = false;
        };
    }, [id]);

    if (estadoHttp !== null) {
        return (
            <p className="text-muted text-[13px]">
                {estadoHttp === 403
                    ? "La traza completa de esta consulta está protegida: solo la ve quien la hizo (defensa tenancy del API de detalle)."
                    : "No se pudo cargar la traza de esta consulta."}
            </p>
        );
    }
    if (!detalle) {
        return <p className="text-muted text-[13px]">Cargando traza…</p>;
    }

    return (
        <div className="flex flex-col gap-3 text-[13px]">
            <div>
                <span className="text-muted">Pregunta completa: </span>
                <span className="whitespace-pre-wrap">{detalle.preguntaNL}</span>
            </div>
            <div>
                <span className="text-muted">Respuesta: </span>
                <span className="whitespace-pre-wrap">
                    {detalle.respuestaTexto ?? "(sin respuesta registrada en la bitácora)"}
                </span>
            </div>
            {detalle.error && (
                <div className="aviso-honesto-ambar rounded-[10px] border px-3 py-2">
                    Error registrado: {detalle.error}
                </div>
            )}
            {detalle.sqlGenerado && (
                <details className="bb-sql">
                    <summary>Ver SQL validado</summary>
                    <pre>{detalle.sqlGenerado}</pre>
                </details>
            )}
            {detalle.pasos && detalle.pasos.length > 0 ? (
                <div className="bb-pasos">
                    {detalle.pasos.map((p, i) => (
                        <div key={`${p.paso}-${i}`} className="bb-paso">
                            <span className="bb-paso-ms">+{p.ms} ms</span>
                            <span className="bb-paso-nombre">{p.paso}</span>
                            {p.detalle && <span className="bb-paso-detalle">{p.detalle}</span>}
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-muted">Esta consulta no tiene pasos registrados.</p>
            )}
        </div>
    );
}

export default function BitacoraPanel() {
    const [tipo, setTipo] = useState<TipoBitacora>("chat");
    const [desde, setDesde] = useState("");
    const [hasta, setHasta] = useState("");
    const [estado, setEstado] = useState("");
    const [accion, setAccion] = useState("");
    const [pagina, setPagina] = useState(1);
    const [data, setData] = useState<RespuestaBitacora | null>(null);
    const [cargando, setCargando] = useState(true);
    const [fallo, setFallo] = useState<string | null>(null);
    const [expandida, setExpandida] = useState<string | null>(null);

    /* Carga real contra el API: los query params son exactamente los filtros
       activos (T1). Sin setState sincrónico en el effect: los flags se
       actualizan en las ramas del fetch o en los handlers de filtro. */
    useEffect(() => {
        let vivo = true;
        const params = new URLSearchParams();
        params.set("tipo", tipo);
        if (desde) params.set("desde", desde);
        if (hasta) params.set("hasta", hasta);
        if (tipo === "chat" && estado) params.set("estado", estado);
        if (tipo === "eventos" && accion) params.set("accion", accion);
        params.set("pagina", String(pagina));

        fetch(`/api/bi/bitacora?${params.toString()}`, { credentials: "include" })
            .then(async (res) => {
                if (res.status === 401) throw new Error("sesion");
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return (await res.json()) as RespuestaBitacora;
            })
            .then((d) => {
                if (!vivo) return;
                setData(d);
                setFallo(null);
                setCargando(false);
            })
            .catch((e: unknown) => {
                if (!vivo) return;
                setFallo(e instanceof Error && e.message === "sesion" ? MENSAJE_SESION_VENCIDA : MENSAJE_ERROR_CARGA);
                setData(null);
                setCargando(false);
            });
        return () => {
            vivo = false;
        };
    }, [tipo, desde, hasta, estado, accion, pagina]);

    /* Todo cambio de filtro vuelve a la página 1 (los setState van en el
       handler del evento, nunca sincrónicos dentro del effect). */
    function cambiarTipo(valor: TipoBitacora) {
        setCargando(true);
        setPagina(1);
        setExpandida(null);
        setEstado("");
        setAccion("");
        setTipo(valor);
    }
    function cambiarDesde(valor: string) {
        setCargando(true);
        setPagina(1);
        setExpandida(null);
        setDesde(valor);
    }
    function cambiarHasta(valor: string) {
        setCargando(true);
        setPagina(1);
        setExpandida(null);
        setHasta(valor);
    }
    function cambiarEstado(valor: string) {
        setCargando(true);
        setPagina(1);
        setExpandida(null);
        setEstado(valor);
    }
    function cambiarAccion(valor: string) {
        setCargando(true);
        setPagina(1);
        setExpandida(null);
        setAccion(valor);
    }
    function irAPagina(n: number) {
        setCargando(true);
        setExpandida(null);
        setPagina(n);
    }

    return (
        <section
            className="glass anim-entrada p-6"
            style={{ "--anim-retardo": "80ms" } as React.CSSProperties}
            aria-label="Bitácora de BI"
        >
            {/* ======= Selector de vista (Chat / Eventos) ======= */}
            <div className="flex flex-wrap gap-1.5 mb-5" role="group" aria-label="Vista de la bitácora">
                {TIPOS.map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        onClick={() => cambiarTipo(t.id)}
                        aria-pressed={tipo === t.id}
                        className={
                            tipo === t.id
                                ? "px-4 py-1.5 rounded-full text-[13px] font-semibold text-estado-pino bg-[rgb(var(--pino-rgb)/0.14)] transition-colors"
                                : "px-4 py-1.5 rounded-full text-[13px] text-muted border border-[rgb(var(--tinta-rgb)/0.1)] transition-colors hover:bg-[rgb(var(--tinta-rgb)/0.06)]"
                        }
                    >
                        {t.etiqueta}
                    </button>
                ))}
            </div>

            {/* ======= Filtros ======= */}
            <div className="flex flex-wrap items-end gap-4 mb-5">
                <label className="flex flex-col gap-1 text-[12.5px] text-muted">
                    Desde
                    <input
                        type="date"
                        value={desde}
                        onChange={(e) => cambiarDesde(e.target.value)}
                        className="bb-fecha"
                        aria-label="Filtrar desde fecha"
                    />
                </label>
                <label className="flex flex-col gap-1 text-[12.5px] text-muted">
                    Hasta
                    <input
                        type="date"
                        value={hasta}
                        onChange={(e) => cambiarHasta(e.target.value)}
                        className="bb-fecha"
                        aria-label="Filtrar hasta fecha"
                    />
                </label>
                {tipo === "chat" && (
                    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por estado">
                        {FILTROS_ESTADO.map((f) => (
                            <button
                                key={f.id || "todos"}
                                type="button"
                                onClick={() => cambiarEstado(f.id)}
                                aria-pressed={estado === f.id}
                                className={
                                    estado === f.id
                                        ? "px-3.5 py-1.5 rounded-full text-[12.5px] font-semibold text-estado-pino bg-[rgb(var(--pino-rgb)/0.14)] transition-colors"
                                        : "px-3.5 py-1.5 rounded-full text-[12.5px] text-muted border border-[rgb(var(--tinta-rgb)/0.1)] transition-colors hover:bg-[rgb(var(--tinta-rgb)/0.06)]"
                                }
                            >
                                {f.etiqueta}
                            </button>
                        ))}
                    </div>
                )}
                {tipo === "eventos" && (
                    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por acción">
                        {FILTROS_ACCION.map((f) => (
                            <button
                                key={f.id || "todas"}
                                type="button"
                                onClick={() => cambiarAccion(f.id)}
                                aria-pressed={accion === f.id}
                                className={
                                    accion === f.id
                                        ? "px-3.5 py-1.5 rounded-full text-[12.5px] font-semibold text-estado-pino bg-[rgb(var(--pino-rgb)/0.14)] transition-colors"
                                        : "px-3.5 py-1.5 rounded-full text-[12.5px] text-muted border border-[rgb(var(--tinta-rgb)/0.1)] transition-colors hover:bg-[rgb(var(--tinta-rgb)/0.06)]"
                                }
                            >
                                {f.etiqueta}
                            </button>
                        ))}
                    </div>
                )}
                {data && (
                    <span className="ml-auto text-[12.5px] text-muted">
                        {data.total} {tipo === "chat" ? (data.total === 1 ? "consulta" : "consultas") : (data.total === 1 ? "evento" : "eventos")}
                    </span>
                )}
            </div>

            {/* ======= Estados de carga / error / vacío (honestos) ======= */}
            {cargando && <p className="text-muted text-[13.5px] py-6 text-center">Cargando bitácora…</p>}
            {!cargando && fallo && (
                <p className="aviso-honesto-ambar rounded-[12px] border px-4 py-3 text-[13.5px]">{fallo}</p>
            )}
            {!cargando && !fallo && data && data.filas.length === 0 && (
                <p className="text-muted text-[13.5px] py-6 text-center">
                    {tipo === "chat"
                        ? "No hay consultas registradas con estos filtros."
                        : "No hay eventos registrados con estos filtros."}
                </p>
            )}

            {/* ======= Tabla Chat ======= */}
            {!cargando && !fallo && data && data.tipo === "chat" && data.filas.length > 0 && (
                <>
                    <div className="overflow-x-auto">
                        <table className="bb-tabla">
                            <thead>
                                <tr>
                                    <th>Pregunta</th>
                                    <th>Estado</th>
                                    <th>Latencia</th>
                                    <th>Cache</th>
                                    <th>Fecha</th>
                                    <th>
                                        <span className="sr-only">Traza</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.filas.map((f) => (
                                    <Fragment key={f.id}>
                                        <tr>
                                            <td className="bb-pregunta" title={f.preguntaNL}>
                                                {f.preguntaNL}
                                            </td>
                                            <td>
                                                <PildoraEstado estado={f.estado} />
                                            </td>
                                            <td className="whitespace-nowrap">{formatoLatencia(f.latenciaMs)}</td>
                                            <td>
                                                {f.fuenteCache ? (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-medium border border-[rgb(var(--tinta-rgb)/0.08)] bg-[rgb(var(--papel-rgb)/0.6)]">
                                                        ⚡ cache
                                                    </span>
                                                ) : (
                                                    <span className="text-muted">—</span>
                                                )}
                                            </td>
                                            <td className="whitespace-nowrap" title={f.creadoEn}>
                                                {formatoFechaHora(f.creadoEn)}
                                            </td>
                                            <td>
                                                <button
                                                    type="button"
                                                    onClick={() => setExpandida(expandida === f.id ? null : f.id)}
                                                    aria-expanded={expandida === f.id}
                                                    className="bb-traza-boton"
                                                >
                                                    {expandida === f.id ? "Ocultar traza" : "Ver traza"}
                                                </button>
                                            </td>
                                        </tr>
                                        {expandida === f.id && (
                                            <tr className="bb-detalle-fila">
                                                <td colSpan={6}>
                                                    <DetalleConsulta id={f.id} />
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* ======= Paginación ======= */}
                    <div className="flex items-center justify-between mt-5 text-[13px]">
                        <span className="text-muted">
                            Página {data.pagina} de {data.paginas}
                        </span>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                disabled={data.pagina <= 1}
                                onClick={() => irAPagina(data.pagina - 1)}
                                className="px-4 py-1.5 rounded-full border border-[rgb(var(--tinta-rgb)/0.1)] transition-colors hover:bg-[rgb(var(--tinta-rgb)/0.06)] disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                ← Anterior
                            </button>
                            <button
                                type="button"
                                disabled={data.pagina >= data.paginas}
                                onClick={() => irAPagina(data.pagina + 1)}
                                className="px-4 py-1.5 rounded-full border border-[rgb(var(--tinta-rgb)/0.1)] transition-colors hover:bg-[rgb(var(--tinta-rgb)/0.06)] disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Siguiente →
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* ======= Tabla Eventos ======= */}
            {!cargando && !fallo && data && data.tipo === "eventos" && data.filas.length > 0 && (
                <>
                    <div className="overflow-x-auto">
                        <table className="bb-tabla">
                            <thead>
                                <tr>
                                    <th>Evento</th>
                                    <th>Email</th>
                                    <th>Detalle</th>
                                    <th>Fecha</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.filas.map((f) => (
                                    <tr key={f.id}>
                                        <td>
                                            <PildoraAccion accion={f.accion} />
                                        </td>
                                        <td className="whitespace-nowrap">{f.email}</td>
                                        <td className="bb-detalle-evento" title={f.detalle ?? undefined}>
                                            {formatoDetalle(f.detalle)}
                                        </td>
                                        <td className="whitespace-nowrap" title={f.creadoEn}>
                                            {formatoFechaHora(f.creadoEn)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* ======= Paginación ======= */}
                    <div className="flex items-center justify-between mt-5 text-[13px]">
                        <span className="text-muted">
                            Página {data.pagina} de {data.paginas}
                        </span>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                disabled={data.pagina <= 1}
                                onClick={() => irAPagina(data.pagina - 1)}
                                className="px-4 py-1.5 rounded-full border border-[rgb(var(--tinta-rgb)/0.1)] transition-colors hover:bg-[rgb(var(--tinta-rgb)/0.06)] disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                ← Anterior
                            </button>
                            <button
                                type="button"
                                disabled={data.pagina >= data.paginas}
                                onClick={() => irAPagina(data.pagina + 1)}
                                className="px-4 py-1.5 rounded-full border border-[rgb(var(--tinta-rgb)/0.1)] transition-colors hover:bg-[rgb(var(--tinta-rgb)/0.06)] disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Siguiente →
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* Estilos propios del panel (mismo lenguaje que el chat).
                Sin animaciones: no requieren regla reduced-motion adicional. */}
            <style>{`
                .bb-fecha { border-radius: var(--radio-input); border: 1px solid rgb(var(--tinta-rgb) / 0.12); background: rgb(var(--tinta-rgb) / 0.04); padding: 7px 12px; font-size: 13px; color: rgb(var(--tinta-rgb)); outline: none; transition: border-color 0.2s, box-shadow 0.2s; }
                .bb-fecha:focus { border-color: rgb(var(--pino-rgb)); box-shadow: 0 0 0 2px rgb(var(--pino-rgb) / 0.3); }
                .bb-tabla { width: 100%; border-collapse: collapse; font-size: 13.5px; }
                .bb-tabla th { text-align: left; font-size: 12px; font-weight: 600; color: rgb(var(--tinta-muted-rgb)); padding: 8px 12px; border-bottom: 1px solid rgb(var(--tinta-rgb) / 0.1); }
                .bb-tabla td { padding: 10px 12px; border-bottom: 1px solid rgb(var(--tinta-rgb) / 0.06); vertical-align: middle; }
                .bb-pregunta { max-width: 340px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .bb-detalle-evento { max-width: 340px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: rgb(var(--tinta-muted-rgb)); }
                .bb-traza-boton { font-size: 12px; color: rgb(var(--tinta-muted-rgb)); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; transition: color 0.2s; white-space: nowrap; }
                .bb-traza-boton:hover { color: rgb(var(--pino-rgb)); }
                .bb-detalle-fila td { background: rgb(var(--tinta-rgb) / 0.03); padding: 14px 16px; }
                .bb-sql summary { cursor: pointer; font-size: 12.5px; color: rgb(var(--tinta-muted-rgb)); user-select: none; }
                .bb-sql pre { margin-top: 8px; padding: 14px 16px; border-radius: 10px; background: #0b1311; color: #9fe8cf; font-size: 12.5px; line-height: 1.6; overflow-x: auto; white-space: pre; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
                .bb-pasos { display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border-radius: 10px; border: 1px solid rgb(var(--tinta-rgb) / 0.08); background: rgb(var(--tinta-rgb) / 0.03); }
                .bb-paso { display: flex; align-items: baseline; gap: 8px; font-size: 12.5px; }
                .bb-paso-ms { flex-shrink: 0; min-width: 64px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; color: rgb(var(--tinta-subtle-rgb)); }
                .bb-paso-nombre { font-weight: 600; color: rgb(var(--tinta-rgb)); }
                .bb-paso-detalle { color: rgb(var(--tinta-muted-rgb)); overflow-wrap: anywhere; }
            `}</style>
        </section>
    );
}
