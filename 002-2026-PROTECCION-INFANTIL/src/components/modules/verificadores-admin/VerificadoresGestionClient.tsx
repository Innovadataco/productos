"use client";

/**
 * SPEC-435 · Panel del admin para cuentas VERIFICADOR.
 *
 * Un verificador es un puesto de trabajo aparte con cuenta propia (Jelkin,
 * 04-09: «un perfil como lo es operadores, con su user y pass y módulos»). El
 * admin lo crea acá; el verificador NO se registra solo (a diferencia del
 * profesional). Cuatro acciones por cuenta: restablecer clave, reenviar por
 * correo, dar de baja, reactivar.
 *
 * Contrato Jelkin (repetido en la UI):
 *   · Al crear y al «restablecer», la contraseña temporal SIEMPRE se muestra
 *     una vez en pantalla — el admin la copia y se la pasa al verificador.
 *   · «Reenviar por correo» NUNCA la muestra; si el envío se encoló bien, la
 *     clave viaja solo por correo. Fallback: si el envío falla, la clave cae
 *     de vuelta a pantalla para que el admin no quede atascado.
 */
import { useCallback, useEffect, useState } from "react";

type Estado = "activo" | "inactivo";

interface Verificador {
    id: string;
    email: string;
    nombre: string | null;
    estado: Estado;
    creadoEn: string;
    ultimaSesion: string | null;
}

type Mensaje = { tipo: "ok" | "error"; texto: string; secreto?: string; secretoLabel?: string } | null;

function fmt(iso: string | null): string {
    if (!iso) return "—";
    return new Date(iso).toISOString().slice(0, 16).replace("T", " ");
}

export function VerificadoresGestionClient() {
    const [items, setItems] = useState<Verificador[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [mensaje, setMensaje] = useState<Mensaje>(null);
    const [processing, setProcessing] = useState<Record<string, string>>({});
    const [nuevoAbierto, setNuevoAbierto] = useState(false);

    const cargar = useCallback(async () => {
        setError(null);
        try {
            const res = await fetch("/api/admin/verificadores", { credentials: "include" });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = (await res.json()) as { verificadores: Verificador[] };
            setItems(json.verificadores);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    }, []);

    useEffect(() => { void cargar(); }, [cargar]);

    async function accion(id: string, nombreAccion: string, method: "POST" | "PATCH", url: string, body?: unknown) {
        setProcessing((p) => ({ ...p, [id]: nombreAccion }));
        setMensaje(null);
        try {
            const res = await fetch(url, {
                method,
                credentials: "include",
                ...(body ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}),
            });
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
            await cargar();
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
        <div className="mx-auto max-w-5xl space-y-6">
            <header className="anim-entrada">
                <p className="microetiqueta">Verificación</p>
                <h1 className="titular-h1 mt-1">Gestión de verificadores</h1>
                <p className="cuerpo text-subtle mt-2">
                    El verificador es un puesto de trabajo aparte. Desde acá se crean sus cuentas —
                    llegan con acceso <em className="palabra-estado">solo</em> a la Verificación de
                    profesionales, nada más.
                </p>
                <div className="mt-4">
                    <button
                        type="button"
                        onClick={() => setNuevoAbierto(true)}
                        className="rounded-full bg-pino px-4 py-2 text-sm font-medium text-white transition hover:bg-pino/90"
                    >
                        Nuevo verificador
                    </button>
                </div>
            </header>

            {nuevoAbierto && (
                <NuevoVerificadorForm
                    onCerrar={() => setNuevoAbierto(false)}
                    onCreado={(m) => {
                        setMensaje(m);
                        setNuevoAbierto(false);
                        void cargar();
                    }}
                />
            )}

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
                    <p className="titular-seccion mb-2">Sin verificadores</p>
                    <p className="cuerpo text-subtle">Cree la primera cuenta con el botón de arriba.</p>
                </div>
            )}
            {items && items.length > 0 && (
                <ul className="space-y-2">
                    {items.map((v, i) => (
                        <li
                            key={v.id}
                            className="glass rounded-2xl p-4 anim-entrada"
                            style={{ animationDelay: `${i * 30}ms` }}
                        >
                            <div className="flex flex-wrap items-baseline justify-between gap-3">
                                <div>
                                    <p className="font-semibold text-body">{v.nombre ?? "(sin nombre)"}</p>
                                    <p className="font-mono text-xs text-subtle">{v.email}</p>
                                </div>
                                <span
                                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                                        v.estado === "activo"
                                            ? "bg-pino/10 text-estado-pino"
                                            : "bg-tinta/10 text-subtle"
                                    }`}
                                >
                                    {v.estado}
                                </span>
                            </div>
                            <p className="mt-2 text-xs text-subtle">
                                Creada <span className="cifra">{fmt(v.creadoEn)}</span> · Último login <span className="cifra">{fmt(v.ultimaSesion)}</span>
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                <BotonAccion
                                    disabled={!!processing[v.id]}
                                    onClick={() => void accion(v.id, "reset", "POST", `/api/admin/verificadores/${v.id}/restablecer-password`)}
                                >
                                    {processing[v.id] === "reset" ? "Restableciendo…" : "Restablecer contraseña"}
                                </BotonAccion>
                                <BotonAccion
                                    disabled={!!processing[v.id]}
                                    onClick={() => void accion(v.id, "reenviar", "POST", `/api/admin/verificadores/${v.id}/reenviar-email`)}
                                >
                                    {processing[v.id] === "reenviar" ? "Reenviando…" : "Reenviar por correo"}
                                </BotonAccion>
                                {v.estado === "activo" ? (
                                    <BotonAccion
                                        variante="neutral"
                                        disabled={!!processing[v.id]}
                                        onClick={() => void accion(v.id, "baja", "PATCH", `/api/admin/verificadores/${v.id}/estado`, { estado: "inactivo" })}
                                    >
                                        {processing[v.id] === "baja" ? "Dando de baja…" : "Dar de baja"}
                                    </BotonAccion>
                                ) : (
                                    <BotonAccion
                                        variante="neutral"
                                        disabled={!!processing[v.id]}
                                        onClick={() => void accion(v.id, "reactivar", "PATCH", `/api/admin/verificadores/${v.id}/estado`, { estado: "activo" })}
                                    >
                                        {processing[v.id] === "reactivar" ? "Reactivando…" : "Reactivar"}
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

function NuevoVerificadorForm({
    onCerrar,
    onCreado,
}: {
    onCerrar: () => void;
    onCreado: (m: NonNullable<Mensaje>) => void;
}) {
    const [email, setEmail] = useState("");
    const [nombre, setNombre] = useState("");
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setEnviando(true);
        try {
            const res = await fetch("/api/admin/verificadores", {
                method: "POST",
                credentials: "include",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ email, nombre }),
            });
            const json = (await res.json().catch(() => ({}))) as {
                mensaje?: string;
                passwordTemporal?: string;
                error?: { message?: string };
            };
            if (!res.ok) throw new Error(json.error?.message ?? `HTTP ${res.status}`);
            onCreado({
                tipo: "ok",
                texto: json.mensaje ?? "Verificador creado",
                ...(json.passwordTemporal ? { secreto: json.passwordTemporal, secretoLabel: "Contraseña temporal" } : {}),
            });
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setEnviando(false);
        }
    }

    return (
        <form onSubmit={submit} className="glass rounded-2xl p-4 space-y-3 anim-entrada">
            <p className="microetiqueta">Nueva cuenta</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                    <span className="text-xs text-subtle">Nombre</span>
                    <input
                        type="text"
                        required
                        minLength={2}
                        maxLength={100}
                        value={nombre}
                        onChange={(e) => setNombre(e.target.value)}
                        className="mt-1 w-full rounded-full border border-tinta/15 bg-tinta/[0.03] px-4 py-2 text-sm text-body focus:outline-none focus:ring-2 focus:ring-cielo"
                    />
                </label>
                <label className="block">
                    <span className="text-xs text-subtle">Email</span>
                    <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="mt-1 w-full rounded-full border border-tinta/15 bg-tinta/[0.03] px-4 py-2 text-sm text-body focus:outline-none focus:ring-2 focus:ring-cielo"
                    />
                </label>
            </div>
            {error && <p className="cuerpo text-estado-rubi">{error}</p>}
            <div className="flex gap-2">
                <button
                    type="submit"
                    disabled={enviando}
                    className="rounded-full bg-pino px-4 py-2 text-sm font-medium text-white transition hover:bg-pino/90 disabled:opacity-50"
                >
                    {enviando ? "Creando…" : "Crear cuenta"}
                </button>
                <button
                    type="button"
                    onClick={onCerrar}
                    disabled={enviando}
                    className="rounded-full bg-tinta/5 px-4 py-2 text-sm font-medium text-body transition hover:bg-tinta/10 disabled:opacity-50"
                >
                    Cancelar
                </button>
            </div>
        </form>
    );
}

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
