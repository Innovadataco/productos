"use client";

/**
 * SPEC-421 · Gestión de profesionales — dos tabs:
 *   1. Cuentas: listar/buscar + restablecer clave + desactivar/reactivar.
 *   2. Solicitudes: enlaces de registro pendientes + reenviar (URL en pantalla
 *      si el correo no salió).
 *
 * Diseño: tokens de globals.css. Instrument Serif titulares. DM Mono etiquetas.
 * Motion suave con `anim-entrada`.
 */
import { useCallback, useEffect, useMemo, useState } from "react";

type Estado = "activo" | "inactivo";

interface Profesional {
    id: string;
    email: string;
    nombre: string | null;
    estado: Estado;
    debeCambiarPassword: boolean;
    creadoEn: string;
    ultimaSesion: string | null;
}

interface Solicitud {
    id: string;
    email: string;
    creadoEn: string;
    expiraEn: string;
}

type Mensaje = { tipo: "ok" | "error"; texto: string; secreto?: string; secretoLabel?: string } | null;

function fmt(iso: string | null): string {
    if (!iso) return "—";
    return new Date(iso).toISOString().slice(0, 16).replace("T", " ");
}

export function ProfesionalesGestionClient() {
    const [tab, setTab] = useState<"cuentas" | "solicitudes">("cuentas");

    return (
        <div className="mx-auto max-w-5xl space-y-6">
            <header className="anim-entrada">
                <p className="microetiqueta">Red de Apoyo</p>
                <h1 className="titular-h1 mt-1">Gestión de profesionales</h1>
                <p className="cuerpo text-subtle mt-2">
                    El profesional se registra <em className="palabra-estado">él mismo</em>. Desde acá
                    lo destrabás cuando el correo falla — restablecer contraseña o reenviar el enlace
                    con la URL en pantalla para copiar a mano.
                </p>
                <div className="mt-4 flex gap-2">
                    <TabButton activo={tab === "cuentas"} onClick={() => setTab("cuentas")}>Cuentas</TabButton>
                    <TabButton activo={tab === "solicitudes"} onClick={() => setTab("solicitudes")}>Solicitudes pendientes</TabButton>
                </div>
            </header>
            {tab === "cuentas" ? <TabCuentas /> : <TabSolicitudes />}
        </div>
    );
}

function TabButton({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                activo ? "bg-pino text-white shadow" : "bg-tinta/5 text-body hover:bg-tinta/10"
            }`}
        >
            {children}
        </button>
    );
}

// ─────────────────────────── Tab 1 · Cuentas ──────────────────────────

function TabCuentas() {
    const [items, setItems] = useState<Profesional[] | null>(null);
    const [q, setQ] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [mensaje, setMensaje] = useState<Mensaje>(null);
    const [processing, setProcessing] = useState<Record<string, string>>({});

    const cargar = useCallback(async (query: string) => {
        setError(null);
        try {
            const url = query
                ? `/api/admin/profesionales?q=${encodeURIComponent(query)}`
                : "/api/admin/profesionales";
            const res = await fetch(url, { credentials: "include" });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = (await res.json()) as { items: Profesional[] };
            setItems(json.items);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    }, []);

    useEffect(() => {
        void cargar("");
    }, [cargar]);

    async function accion(id: string, nombreAccion: string, method: "POST" | "DELETE", url: string) {
        setProcessing((p) => ({ ...p, [id]: nombreAccion }));
        setMensaje(null);
        try {
            const res = await fetch(url, { method, credentials: "include" });
            const json = (await res.json().catch(() => ({}))) as {
                mensaje?: string;
                passwordTemporal?: string;
                emailEnviado?: boolean;
                error?: { message?: string };
            };
            if (!res.ok) throw new Error(json.error?.message ?? `HTTP ${res.status}`);
            setMensaje({
                tipo: "ok",
                texto: json.mensaje ?? "Listo",
                ...(json.passwordTemporal ? { secreto: json.passwordTemporal, secretoLabel: "Contraseña temporal" } : {}),
            });
            await cargar(q);
        } catch (e) {
            setMensaje({ tipo: "error", texto: e instanceof Error ? e.message : String(e) });
        } finally {
            setProcessing((p) => {
                const nuevo = { ...p };
                delete nuevo[id];
                return nuevo;
            });
        }
    }

    return (
        <div className="space-y-4 anim-entrada">
            <div className="flex gap-2">
                <input
                    className="flex-1 rounded-full border border-tinta/15 bg-tinta/[0.03] px-4 py-2 text-sm text-body focus:outline-none focus:ring-2 focus:ring-cielo"
                    placeholder="Buscar por email o nombre…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") void cargar(q); }}
                />
                <button
                    type="button"
                    className="rounded-full bg-pino px-4 py-2 text-sm font-medium text-white transition hover:bg-pino/90"
                    onClick={() => void cargar(q)}
                >Buscar</button>
            </div>

            {mensaje && <MensajeBanner mensaje={mensaje} onClose={() => setMensaje(null)} />}

            {error && (
                <div className="glass rounded-2xl p-4 text-body">
                    <p className="cuerpo text-estado-rubi">No pudimos cargar la lista: {error}</p>
                </div>
            )}
            {!items && !error && (
                <div className="animate-pulse space-y-2">
                    {[0, 1, 2].map((i) => <div key={i} className="glass h-16 rounded-2xl" />)}
                </div>
            )}
            {items && items.length === 0 && (
                <div className="glass rounded-3xl p-10 text-center">
                    <p className="titular-seccion mb-2">Sin cuentas</p>
                    <p className="cuerpo text-subtle">Cuando un profesional complete el registro, aparece acá.</p>
                </div>
            )}
            {items && items.length > 0 && (
                <ul className="space-y-2">
                    {items.map((p, i) => (
                        <li
                            key={p.id}
                            className="glass rounded-2xl p-4 anim-entrada"
                            style={{ animationDelay: `${i * 30}ms` }}
                        >
                            <div className="flex flex-wrap items-baseline justify-between gap-3">
                                <div>
                                    <p className="font-semibold text-body">{p.nombre ?? "(sin nombre)"}</p>
                                    <p className="font-mono text-xs text-subtle">{p.email}</p>
                                </div>
                                <span
                                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                                        p.estado === "activo"
                                            ? "bg-pino/10 text-estado-pino"
                                            : "bg-tinta/10 text-subtle"
                                    }`}
                                >
                                    {p.estado}
                                </span>
                            </div>
                            <p className="mt-2 text-xs text-subtle">
                                Creada <span className="cifra">{fmt(p.creadoEn)}</span> · Último login <span className="cifra">{fmt(p.ultimaSesion)}</span>
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                <BotonAccion
                                    disabled={!!processing[p.id]}
                                    onClick={() => void accion(p.id, "reset", "POST", `/api/admin/profesionales/${p.id}/restablecer-password`)}
                                >
                                    {processing[p.id] === "reset" ? "Restableciendo…" : "Restablecer contraseña"}
                                </BotonAccion>
                                {p.estado === "activo" ? (
                                    <BotonAccion
                                        variante="ambar"
                                        disabled={!!processing[p.id]}
                                        onClick={() => void accion(p.id, "baja", "DELETE", `/api/admin/profesionales/${p.id}`)}
                                    >
                                        {processing[p.id] === "baja" ? "Dando de baja…" : "Dar de baja"}
                                    </BotonAccion>
                                ) : (
                                    <BotonAccion
                                        variante="pino"
                                        disabled={!!processing[p.id]}
                                        onClick={() => void accion(p.id, "reactivar", "POST", `/api/admin/profesionales/${p.id}/reactivar`)}
                                    >
                                        {processing[p.id] === "reactivar" ? "Reactivando…" : "Reactivar"}
                                    </BotonAccion>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

// ─────────────────────── Tab 2 · Solicitudes pendientes ────────────────

function TabSolicitudes() {
    const [items, setItems] = useState<Solicitud[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [mensaje, setMensaje] = useState<Mensaje>(null);
    const [processing, setProcessing] = useState<string | null>(null);

    const cargar = useCallback(async () => {
        setError(null);
        try {
            const res = await fetch("/api/admin/profesionales/solicitudes", { credentials: "include" });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = (await res.json()) as { items: Solicitud[] };
            setItems(json.items);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    }, []);

    useEffect(() => { void cargar(); }, [cargar]);

    async function reenviar(email: string) {
        setProcessing(email);
        setMensaje(null);
        try {
            const res = await fetch("/api/admin/profesionales/solicitudes/reenviar", {
                method: "POST",
                credentials: "include",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ email }),
            });
            const json = (await res.json().catch(() => ({}))) as {
                mensaje?: string;
                enlace?: string;
                emailEnviado?: boolean;
                error?: { message?: string };
            };
            if (!res.ok) throw new Error(json.error?.message ?? `HTTP ${res.status}`);
            setMensaje({
                tipo: "ok",
                texto: json.mensaje ?? "Listo",
                ...(json.enlace ? { secreto: json.enlace, secretoLabel: "Enlace de registro" } : {}),
            });
            await cargar();
        } catch (e) {
            setMensaje({ tipo: "error", texto: e instanceof Error ? e.message : String(e) });
        } finally {
            setProcessing(null);
        }
    }

    const totalTexto = useMemo(() => {
        if (!items) return "";
        return items.length === 1 ? "1 solicitud" : `${items.length} solicitudes`;
    }, [items]);

    return (
        <div className="space-y-4 anim-entrada">
            {mensaje && <MensajeBanner mensaje={mensaje} onClose={() => setMensaje(null)} />}
            {error && <p className="cuerpo text-estado-rubi">No pudimos cargar las solicitudes: {error}</p>}
            {!items && !error && (
                <div className="animate-pulse space-y-2">
                    {[0, 1].map((i) => <div key={i} className="glass h-16 rounded-2xl" />)}
                </div>
            )}
            {items && items.length === 0 && (
                <div className="glass rounded-3xl p-10 text-center">
                    <p className="titular-seccion mb-2">Sin solicitudes pendientes</p>
                    <p className="cuerpo text-subtle">Cuando un profesional pida crear cuenta y su enlace siga vivo, aparece acá.</p>
                </div>
            )}
            {items && items.length > 0 && (
                <>
                    <p className="microetiqueta">{totalTexto} en la cola</p>
                    <ul className="space-y-2">
                        {items.map((s, i) => (
                            <li
                                key={s.id}
                                className="glass rounded-2xl p-4 anim-entrada"
                                style={{ animationDelay: `${i * 30}ms` }}
                            >
                                <div className="flex flex-wrap items-baseline justify-between gap-3">
                                    <p className="font-mono text-sm text-body">{s.email}</p>
                                    <p className="text-xs text-subtle">
                                        Pedido <span className="cifra">{fmt(s.creadoEn)}</span> · Vence <span className="cifra">{fmt(s.expiraEn)}</span>
                                    </p>
                                </div>
                                <div className="mt-3">
                                    <BotonAccion
                                        disabled={processing === s.email}
                                        onClick={() => void reenviar(s.email)}
                                    >
                                        {processing === s.email ? "Reenviando…" : "Reenviar enlace"}
                                    </BotonAccion>
                                </div>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </div>
    );
}

// ─────────────────────────── Piezas compartidas ───────────────────────

function BotonAccion({
    onClick,
    disabled,
    variante = "neutral",
    children,
}: {
    onClick: () => void;
    disabled?: boolean;
    variante?: "neutral" | "pino" | "ambar";
    children: React.ReactNode;
}) {
    const cls =
        variante === "pino"
            ? "bg-pino text-white hover:bg-pino/90"
            : variante === "ambar"
                ? "bg-ambar text-white hover:bg-ambar/90"
                : "bg-tinta/5 text-body hover:bg-tinta/10";
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${cls}`}
        >
            {children}
        </button>
    );
}

function MensajeBanner({ mensaje, onClose }: { mensaje: NonNullable<Mensaje>; onClose: () => void }) {
    return (
        <div
            role="status"
            className={`rounded-2xl p-4 anim-entrada ${
                mensaje.tipo === "ok" ? "bg-pino/10 text-estado-pino" : "bg-rubi/10 text-estado-rubi"
            }`}
        >
            <div className="flex items-start justify-between gap-3">
                <p className="cuerpo">{mensaje.texto}</p>
                <button type="button" onClick={onClose} className="text-xs text-subtle hover:text-body" aria-label="Cerrar aviso">✕</button>
            </div>
            {mensaje.secreto && (
                <div className="mt-3 rounded-xl bg-tinta/5 p-3">
                    <p className="microetiqueta">{mensaje.secretoLabel ?? "Secreto"} · se muestra una sola vez</p>
                    <p className="mt-1 break-all font-mono text-sm text-body">{mensaje.secreto}</p>
                </div>
            )}
        </div>
    );
}
