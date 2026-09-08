"use client";

/**
 * SPEC-340 (A-68 §3.3-bis) — el texto sensible, tapado por defecto.
 *
 * El agresor puede vivir en la misma casa; miradas ajenas en lugares públicos.
 * El texto NUNCA llega en el listado: este componente lo PIDE a la única ruta
 * que lo entrega (con autoridad de servidor). Acá solo vive la ergonomía:
 *  - tapado por defecto, con «Revelar texto · se ocultó por tu seguridad»,
 *  - se vuelve a tapar solo a los N minutos (reloj del cliente),
 *  - si el servidor responde STEP_UP_REQUERIDO, se pide la contraseña
 *    (SPEC-340) o, en cuentas OAuth que no tienen contraseña (SPEC-592,
 *    `metodos: ["codigo_email"]`), un código temporal enviado a su correo.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

interface TextoSensibleProps {
    reporteId: string;
    /** Minutos hasta re-taparse solo (parámetro padre.texto.retapado_minutos). */
    retapadoMinutos?: number;
}

type Estado =
    | "tapado"
    | "cargando"
    | "revelado"
    | "pide_password"
    | "ofrece_codigo"
    | "pide_codigo";

interface ErrorStepUp {
    message?: string;
    code?: string;
    metodos?: string[];
}

export function TextoSensible({ reporteId, retapadoMinutos = 10 }: TextoSensibleProps) {
    const [estado, setEstado] = useState<Estado>("tapado");
    const [texto, setTexto] = useState<string | null>(null);
    const [password, setPassword] = useState("");
    const [codigo, setCodigo] = useState("");
    const [error, setError] = useState("");
    const [enviando, setEnviando] = useState(false);
    const relojRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const tapar = useCallback(() => {
        setTexto(null);
        setEstado("tapado");
        setError("");
    }, []);

    useEffect(() => () => {
        if (relojRef.current) clearTimeout(relojRef.current);
    }, []);

    const armarRetapado = useCallback(() => {
        if (relojRef.current) clearTimeout(relojRef.current);
        relojRef.current = setTimeout(tapar, retapadoMinutos * 60 * 1000);
    }, [retapadoMinutos, tapar]);

    const pedirTexto = useCallback(async () => {
        setEstado("cargando");
        setError("");
        try {
            const res = await fetch(`/api/padre/reportes/${reporteId}/texto`, { credentials: "include" });
            if (res.status === 403) {
                const json = (await res.json().catch(() => null)) as { error?: ErrorStepUp } | null;
                if (json?.error?.code === "STEP_UP_REQUERIDO") {
                    // SPEC-592: cuentas OAuth (sin contraseña) reciben
                    // `metodos: ["codigo_email"]` y avanzan por correo.
                    setEstado(json.error.metodos?.includes("codigo_email") ? "ofrece_codigo" : "pide_password");
                    return;
                }
            }
            if (!res.ok) throw new Error("No pudimos traer el texto. Intenta de nuevo.");
            const { texto: t } = await res.json();
            setTexto(t);
            setEstado("revelado");
            armarRetapado();
        } catch (err) {
            setError(err instanceof Error ? err.message : "No pudimos traer el texto.");
            setEstado("tapado");
        }
    }, [reporteId, armarRetapado]);

    const confirmarPassword = useCallback(async () => {
        setEnviando(true);
        setError("");
        try {
            const res = await fetch("/api/padre/step-up", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password }),
            });
            if (!res.ok) {
                const json = await res.json().catch(() => null);
                setError(json?.error?.message ?? "Esa no es tu contraseña. Inténtalo otra vez, con calma.");
                return;
            }
            setPassword("");
            await pedirTexto();
        } finally {
            setEnviando(false);
        }
    }, [password, pedirTexto]);

    const enviarCodigo = useCallback(async () => {
        setEnviando(true);
        setError("");
        try {
            const res = await fetch("/api/padre/step-up/codigo", {
                method: "POST",
                credentials: "include",
            });
            if (!res.ok) {
                const json = await res.json().catch(() => null);
                setError(json?.error?.message ?? "No pudimos enviar el código. Intenta de nuevo.");
                return;
            }
            setEstado("pide_codigo");
        } finally {
            setEnviando(false);
        }
    }, []);

    const confirmarCodigo = useCallback(async () => {
        if (!codigo.trim()) return;
        setEnviando(true);
        setError("");
        try {
            const res = await fetch("/api/padre/step-up/verificar", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ codigo: codigo.trim() }),
            });
            if (!res.ok) {
                const json = await res.json().catch(() => null);
                setError(json?.error?.message ?? "Código incorrecto o vencido.");
                return;
            }
            setCodigo("");
            await pedirTexto();
        } finally {
            setEnviando(false);
        }
    }, [codigo, pedirTexto]);

    if (estado === "revelado" && texto !== null) {
        return (
            <div>
                <p className="whitespace-pre-wrap text-sm text-body">{texto}</p>
                <button type="button" onClick={tapar} className="mt-1 text-xs text-muted underline-offset-2 hover:underline">
                    Ocultar
                </button>
            </div>
        );
    }

    if (estado === "ofrece_codigo" || estado === "pide_codigo") {
        return (
            <div className="space-y-2 rounded-xl border border-tinta/10 bg-papel/60 p-3 dark:border-papel/10 dark:bg-tinta/40">
                <p className="text-sm text-muted">
                    {estado === "pide_codigo"
                        ? "Te enviamos un código a tu correo. Escríbelo aquí para ver el texto:"
                        : "Tu cuenta entró con Google y no tiene contraseña. Podemos enviarte un código a tu correo:"}
                </p>
                {estado === "pide_codigo" && (
                    <input
                        type="text"
                        autoComplete="one-time-code"
                        className="w-full rounded-xl border border-tinta/20 bg-transparent px-3 py-2 text-sm"
                        value={codigo}
                        onChange={(e) => setCodigo(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && void confirmarCodigo()}
                        aria-label="Código del correo"
                    />
                )}
                {error && <p className="text-sm text-ambar">{error}</p>}
                <div className="flex gap-2">
                    {estado === "ofrece_codigo" && (
                        <Button onClick={enviarCodigo} isLoading={enviando} className="flex-1">
                            Enviar código a mi correo
                        </Button>
                    )}
                    {estado === "pide_codigo" && (
                        <>
                            <Button onClick={confirmarCodigo} isLoading={enviando} className="flex-1">
                                Verificar código
                            </Button>
                            <Button variant="ghost" onClick={enviarCodigo} disabled={enviando}>
                                Reenviar
                            </Button>
                        </>
                    )}
                    <Button variant="ghost" onClick={tapar}>
                        Cancelar
                    </Button>
                </div>
            </div>
        );
    }

    if (estado === "pide_password") {
        return (
            <div className="space-y-2 rounded-xl border border-tinta/10 bg-papel/60 p-3 dark:border-papel/10 dark:bg-tinta/40">
                <p className="text-sm text-muted">Por tu seguridad, confirma tu contraseña para ver este texto.</p>
                <input
                    type="password"
                    autoComplete="current-password"
                    className="w-full rounded-xl border border-tinta/20 bg-transparent px-3 py-2 text-sm"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && void confirmarPassword()}
                    aria-label="Tu contraseña"
                />
                {error && <p className="text-sm text-ambar">{error}</p>}
                <div className="flex gap-2">
                    <Button onClick={confirmarPassword} isLoading={enviando} className="flex-1">
                        Revelar
                    </Button>
                    <Button variant="ghost" onClick={tapar}>
                        Cancelar
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div>
            {/* El difuminado es puro decorado: el texto real NO está en el DOM. */}
            <p aria-hidden="true" className="select-none text-sm text-body blur-sm">
                ████████ ████ ████████ ██████ ████ ███████
            </p>
            <button
                type="button"
                onClick={pedirTexto}
                disabled={estado === "cargando"}
                className="mt-1 text-xs font-medium text-pino underline-offset-2 hover:underline"
            >
                {estado === "cargando" ? "Un momento…" : "👁 Revelar texto · se ocultó por tu seguridad"}
            </button>
            {error && <p className="mt-1 text-sm text-ambar">{error}</p>}
        </div>
    );
}
