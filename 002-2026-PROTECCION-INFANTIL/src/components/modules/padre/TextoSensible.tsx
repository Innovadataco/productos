"use client";

/**
 * SPEC-606 (2026-09-09) — el texto sensible, tapado por defecto, se revela con
 * un CÓDIGO DE 6 DÍGITOS enviado al correo del padre (step-up sin contraseña).
 *
 * El agresor puede vivir en la misma casa; miradas ajenas en lugares públicos.
 * El texto NUNCA llega en el listado: este componente lo PIDE a la única ruta
 * que lo entrega (con autoridad de servidor). Acá solo vive la ergonomía:
 *  - tapado por defecto, con «Revelar texto · se ocultó por tu seguridad»;
 *  - si el servidor responde STEP_UP_REQUERIDO, se pide el código al correo
 *    (automático) y se muestran las 6 casillas con el correo enmascarado, la
 *    cuenta regresiva de la vigencia (10:00) y «Reenviar código» con cooldown;
 *  - al verificar, el texto se revela con un anillo de cuenta regresiva y se
 *    vuelve a tapar solo a los N minutos (reloj del cliente);
 *  - cada solicitud y cada verificación quedan auditadas en el servidor
 *    (SPEC-606; nunca el código ni el texto).
 *
 * SPEC-340 dejó el tapado y el retapado; SPEC-592 estrenó el código para
 * cuentas OAuth; SPEC-606 lo vuelve el ÚNICO camino (la vía por contraseña se
 * eliminó: las cuentas Google no tienen clave y el código es estándar).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

interface TextoSensibleProps {
    reporteId: string;
    /** Minutos hasta re-taparse solo (parámetro padre.texto.retapado_minutos). */
    retapadoMinutos?: number;
}

type Estado = "tapado" | "cargando" | "pide_codigo" | "revelado";

const CASILLAS = 6;

interface RespuestaCodigo {
    vigenciaMinutos?: number;
    cooldownSegundos?: number;
    correoEnmascarado?: string;
    error?: { message?: string; reintentaEnSegundos?: number; correoEnmascarado?: string };
}

/** mm:ss para la vigencia del código y el anillo del retapado. */
function reloj(totalSeg: number): string {
    const m = Math.floor(totalSeg / 60);
    const s = totalSeg % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
}

export function TextoSensible({ reporteId, retapadoMinutos = 10 }: TextoSensibleProps) {
    const [estado, setEstado] = useState<Estado>("tapado");
    const [texto, setTexto] = useState<string | null>(null);
    const [digitos, setDigitos] = useState<string[]>(() => Array<string>(CASILLAS).fill(""));
    const [correoEnmascarado, setCorreoEnmascarado] = useState("");
    const [error, setError] = useState("");
    const [enviando, setEnviando] = useState(false);
    const [venceSeg, setVenceSeg] = useState(0);
    const [cooldownSeg, setCooldownSeg] = useState(0);
    const [restanteSeg, setRestanteSeg] = useState(0);
    const casillasRef = useRef<Array<HTMLInputElement | null>>([]);
    const retapadoDeadlineRef = useRef(0);

    const retapadoTotalSeg = Math.max(1, Math.round(retapadoMinutos * 60));

    const tapar = useCallback(() => {
        setTexto(null);
        setEstado("tapado");
        setError("");
        setDigitos(Array<string>(CASILLAS).fill(""));
    }, []);

    // Cuentas regresivas del panel del código (vigencia 10:00 + cooldown de reenvío).
    useEffect(() => {
        if (estado !== "pide_codigo") return;
        const id = setInterval(() => {
            setVenceSeg((v) => Math.max(0, v - 1));
            setCooldownSeg((c) => Math.max(0, c - 1));
        }, 1000);
        return () => clearInterval(id);
    }, [estado]);

    // Anillo del retapado: reloj del cliente contra un deadline absoluto; al
    // llegar a cero el texto se tapa solo (parámetro padre.texto.retapado_minutos).
    useEffect(() => {
        if (estado !== "revelado") return;
        const id = setInterval(() => {
            const resta = Math.max(0, Math.round((retapadoDeadlineRef.current - Date.now()) / 1000));
            setRestanteSeg(resta);
            if (resta <= 0) tapar();
        }, 1000);
        return () => clearInterval(id);
    }, [estado, tapar]);

    /**
     * Pide el código al correo. «inicial»: viene del 403 del texto (un fallo
     * devuelve al estado tapado). «reenvio»: viene del botón (un fallo deja el
     * panel como está, solo muestra el error).
     */
    const prepararCodigo = useCallback(async (modo: "inicial" | "reenvio") => {
        setEnviando(true);
        setError("");
        try {
            const res = await fetch("/api/padre/step-up/codigo", { method: "POST", credentials: "include" });
            const json = (await res.json().catch(() => null)) as RespuestaCodigo | null;
            if (res.status === 429 && typeof json?.error?.reintentaEnSegundos === "number") {
                // Ya hay un código camino al correo (p. ej. pedido desde otro
                // reporte): el MISMO sirve — casillas listas y reenvío con cooldown.
                setCorreoEnmascarado(json.error.correoEnmascarado ?? "");
                setCooldownSeg(json.error.reintentaEnSegundos);
                setVenceSeg(0);
                setEstado("pide_codigo");
                return;
            }
            if (!res.ok) {
                setError(json?.error?.message ?? "No pudimos enviar el código. Intenta de nuevo.");
                if (modo === "inicial") setEstado("tapado");
                return;
            }
            setCorreoEnmascarado(json?.correoEnmascarado ?? "");
            setVenceSeg((json?.vigenciaMinutos ?? 10) * 60);
            setCooldownSeg(json?.cooldownSegundos ?? 60);
            setDigitos(Array<string>(CASILLAS).fill(""));
            setEstado("pide_codigo");
            setTimeout(() => casillasRef.current[0]?.focus(), 50);
        } catch {
            setError("No pudimos enviar el código. Revisa tu conexión e intenta de nuevo.");
            if (modo === "inicial") setEstado("tapado");
        } finally {
            setEnviando(false);
        }
    }, []);

    const pedirTexto = useCallback(async () => {
        setEstado("cargando");
        setError("");
        try {
            const res = await fetch(`/api/padre/reportes/${reporteId}/texto`, { credentials: "include" });
            if (res.status === 403) {
                const json = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
                if (json?.error?.code === "STEP_UP_REQUERIDO") {
                    // SPEC-606: el código al correo es el único camino, para toda cuenta.
                    await prepararCodigo("inicial");
                    return;
                }
            }
            if (!res.ok) throw new Error("No pudimos traer el texto. Intenta de nuevo.");
            const { texto: t } = await res.json();
            setTexto(t);
            retapadoDeadlineRef.current = Date.now() + retapadoTotalSeg * 1000;
            setRestanteSeg(retapadoTotalSeg);
            setEstado("revelado");
        } catch (err) {
            setError(err instanceof Error ? err.message : "No pudimos traer el texto.");
            setEstado("tapado");
        }
    }, [reporteId, retapadoTotalSeg, prepararCodigo]);

    const confirmarCodigo = useCallback(async () => {
        const codigo = digitos.join("");
        if (codigo.length !== CASILLAS || enviando) return;
        setEnviando(true);
        setError("");
        try {
            const res = await fetch("/api/padre/step-up/verificar", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ codigo }),
            });
            if (!res.ok) {
                const json = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
                setError(json?.error?.message ?? "Código incorrecto o vencido.");
                setDigitos(Array<string>(CASILLAS).fill(""));
                casillasRef.current[0]?.focus();
                return;
            }
            setDigitos(Array<string>(CASILLAS).fill(""));
            await pedirTexto();
        } finally {
            setEnviando(false);
        }
    }, [digitos, enviando, pedirTexto]);

    const escribirDigito = (indice: number, valor: string) => {
        const limpio = valor.replace(/\D/g, "").slice(-1);
        setDigitos((prev) => {
            const copia = [...prev];
            copia[indice] = limpio;
            return copia;
        });
        if (limpio && indice < CASILLAS - 1) casillasRef.current[indice + 1]?.focus();
    };

    const teclaDigito = (indice: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Backspace") {
            e.preventDefault();
            setDigitos((prev) => {
                const copia = [...prev];
                if (copia[indice]) {
                    copia[indice] = "";
                } else if (indice > 0) {
                    copia[indice - 1] = "";
                    casillasRef.current[indice - 1]?.focus();
                }
                return copia;
            });
        } else if (e.key === "ArrowLeft" && indice > 0) {
            casillasRef.current[indice - 1]?.focus();
        } else if (e.key === "ArrowRight" && indice < CASILLAS - 1) {
            casillasRef.current[indice + 1]?.focus();
        } else if (e.key === "Enter") {
            void confirmarCodigo();
        }
    };

    const pegarCodigo = (e: React.ClipboardEvent<HTMLInputElement>) => {
        const pegado = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, CASILLAS);
        if (!pegado) return;
        e.preventDefault();
        setDigitos(() => {
            const copia = Array<string>(CASILLAS).fill("");
            for (let i = 0; i < pegado.length; i++) copia[i] = pegado.charAt(i);
            return copia;
        });
        casillasRef.current[Math.min(pegado.length, CASILLAS - 1)]?.focus();
    };

    if (estado === "revelado" && texto !== null) {
        const fraccion = Math.max(0, Math.min(1, restanteSeg / retapadoTotalSeg));
        const perimetro = 2 * Math.PI * 19;
        return (
            <div>
                <div className="mb-2 flex items-center gap-3">
                    <span
                        className="relative inline-flex h-[46px] w-[46px] flex-none items-center justify-center"
                        role="timer"
                        aria-label={`Quedan ${reloj(restanteSeg)} de lectura`}
                    >
                        <svg width="46" height="46" viewBox="0 0 46 46" className="absolute inset-0 -rotate-90">
                            <circle cx="23" cy="23" r="19" fill="none" strokeWidth="3.5" className="stroke-tinta/15" />
                            <circle
                                cx="23"
                                cy="23"
                                r="19"
                                fill="none"
                                strokeWidth="3.5"
                                strokeLinecap="round"
                                className="stroke-pino transition-[stroke-dashoffset] duration-1000 ease-linear"
                                strokeDasharray={perimetro}
                                strokeDashoffset={perimetro * (1 - fraccion)}
                            />
                        </svg>
                        <span className="text-[11px] font-semibold tabular-nums text-body">{reloj(restanteSeg)}</span>
                    </span>
                    <p className="text-xs text-muted">
                        ⏳ Quedan {reloj(restanteSeg)} de lectura; al terminar, el texto se vuelve a ocultar.{" "}
                        <span className="font-medium text-body">Cada revelado queda auditado</span> en tu historial de
                        seguridad.
                    </p>
                </div>
                <p className="whitespace-pre-wrap text-sm text-body">{texto}</p>
                <button
                    type="button"
                    onClick={tapar}
                    className="mt-1 text-xs text-muted underline-offset-2 hover:underline"
                >
                    Ocultar
                </button>
            </div>
        );
    }

    if (estado === "pide_codigo") {
        const completo = digitos.every((d) => d !== "");
        return (
            <div
                className="space-y-3 rounded-xl border border-tinta/10 bg-superficie-1 p-4 dark:border-tinta/12"
                role="dialog"
                aria-label="Código de verificación enviado a tu correo"
            >
                <div>
                    <p className="text-sm font-semibold text-body">Te enviamos un código</p>
                    <p className="text-sm text-muted">
                        Escribe las 6 cifras que enviamos a{" "}
                        <span className="font-medium text-body">{correoEnmascarado || "tu correo"}</span>.
                        {venceSeg > 0 ? (
                            <>
                                {" "}
                                El código vence en{" "}
                                <span className="font-medium tabular-nums text-body" role="timer">
                                    {reloj(venceSeg)}
                                </span>
                                .
                            </>
                        ) : (
                            " Si no te llega o ya venció, pide uno nuevo."
                        )}
                    </p>
                </div>
                <div className="flex gap-2" onPaste={pegarCodigo}>
                    {digitos.map((digito, i) => (
                        <input
                            // Índice estable: las 6 casillas nacen y mueren juntas.
                            key={i}
                            ref={(el) => {
                                casillasRef.current[i] = el;
                            }}
                            type="text"
                            inputMode="numeric"
                            autoComplete={i === 0 ? "one-time-code" : "off"}
                            maxLength={1}
                            className="h-11 w-10 rounded-xl border border-tinta/20 bg-transparent text-center text-lg font-semibold text-body"
                            value={digito}
                            onChange={(e) => escribirDigito(i, e.target.value)}
                            onKeyDown={(e) => teclaDigito(i, e)}
                            aria-label={`Dígito ${i + 1} de 6`}
                        />
                    ))}
                </div>
                {error && <p className="text-sm text-ambar">{error}</p>}
                <div className="flex flex-wrap items-center gap-2">
                    <Button onClick={confirmarCodigo} isLoading={enviando} disabled={!completo} className="flex-1">
                        Confirmar
                    </Button>
                    <Button
                        variant="ghost"
                        onClick={() => void prepararCodigo("reenvio")}
                        disabled={enviando || cooldownSeg > 0}
                    >
                        {cooldownSeg > 0 ? `Reenviar código (${cooldownSeg} s)` : "Reenviar código"}
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
            <p className="mt-1 text-xs text-muted">Solo tú puedes revelarlo, con un código que llega a tu correo.</p>
            {error && <p className="mt-1 text-sm text-ambar">{error}</p>}
        </div>
    );
}
