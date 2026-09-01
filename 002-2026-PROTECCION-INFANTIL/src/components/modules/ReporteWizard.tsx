"use client";

import { useEffect, useState } from "react";
import { ReporteStepPlataforma } from "./ReporteStepPlataforma";
import { ReporteStepDetalle } from "./ReporteStepDetalle";
import { ReporteStepConfirmar } from "./ReporteStepConfirmar";
import { ConfirmacionReporte } from "./ConfirmacionReporte";
import { ReporteBloqueoRol } from "./ReporteBloqueoRol";
import { Button } from "@/components/ui/Button";
import { useMinTextoReporte } from "./use-min-texto-reporte";
import { tomarHandoffReportar, guardarBorradorReporte, leerBorradorReporte, borrarBorradorReporte } from "@/lib/reportar-handoff";

type WizardData = {
    identificador: string;
    plataforma: string;
    otraPlataforma: string;
    ciudad: string;
    pais: string;
    paisId: string;
    ciudadId: string;
    fechaIncidente: string;
    edadVictima: string;
    texto: string;
    esAnonimo: boolean;
};

type SessionUser = {
    id: string;
    email: string;
    nombre: string | null;
    rol: string;
} | null;

// SPEC-314 (002-PI-214): guard preventivo simétrico al backend (route.ts:41).
// Los 5 roles internos no pueden generar reportes desde su cuenta institucional
// (anti-fraude · esos roles revisan/validan · no reportan).
const ROLES_BLOQUEADOS = ["ADMIN", "OPERADOR", "SCHOOL_ADMIN", "COMITE_VALIDACION", "COMITE_CONVIVENCIA"];

// SPEC-295 (002-PI-196 · I-146): destino post-envío cuando el padre reporta
// desde su panel autenticado. La ruta pública sigue mostrando ConfirmacionReporte.
const REDIRECT_PADRE_POST_ENVIO = "/mis-reportes"; // SPEC-317: ruta real; /dashboard/padre/mis-reportes no existe

export function ReporteWizard({
    modoAutenticado = false,
}: {
    modoAutenticado?: boolean;
} = {}) {
    const [step, setStep] = useState(1);
    const [user, setUser] = useState<SessionUser>(null);
    const [checkingSession, setCheckingSession] = useState(true);
    // Las dos pantallas que mandan al padre acá con un identificador ya escrito
    // (/seguimiento en SPEC-324 y la consulta vacía en F3 N-5) lo entregan por
    // sessionStorage — el identificador NUNCA viaja en la URL (spec 091-US2 /
    // 093-US4). Llave de un solo uso: se lee y se borra al montar. Solo
    // /seguimiento pide `fijar`, porque ahí el padre viene a agregar un evento
    // sobre ESE identificador; el prellenado de la consulta vacía es editable.
    const [handoff] = useState(() => tomarHandoffReportar());
    const identificadorFijado = handoff?.fijar ? handoff.identificador : null;
    const [data, setData] = useState<WizardData>(() => {
        const vacio: WizardData = {
            identificador: handoff?.identificador ?? "",
            plataforma: "",
            otraPlataforma: "",
            ciudad: "",
            pais: "",
            paisId: "",
            ciudadId: "",
            fechaIncidente: "",
            edadVictima: "",
            texto: "",
            // SPEC-295: en modo autenticado el default es NO anónimo — el padre
            // reporta con su identidad. Checkbox opcional para volver a anónimo.
            esAnonimo: !modoAutenticado,
        };
        // A-70 · B1(d): el relato NO se pierde. Jelkin escribió el reporte
        // completo, el envío falló con 400 y al recargar quedó la pantalla en
        // blanco. El borrador vive en sessionStorage (misma pestaña, se borra
        // al enviar bien) y el handoff manda sobre lo guardado si viene uno.
        const guardado = leerBorradorReporte();
        if (!guardado) return vacio;
        return {
            ...vacio,
            ...guardado,
            ...(handoff?.identificador ? { identificador: handoff.identificador } : {}),
            esAnonimo: vacio.esAnonimo,
        };
    });
    // A-70 · B1(d): autoguardado del borrador en cada cambio. Solo los campos
    // del formulario — nunca `esAnonimo` (lo decide el modo de la pantalla).
    useEffect(() => {
        const { esAnonimo: _descartado, ...campos } = data;
        void _descartado;
        guardarBorradorReporte(campos);
    }, [data]);

    const [resultado, setResultado] = useState<{ numeroSeguimiento: string } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    // SPEC-323 (T007/US1): oferta de vinculación cuando el padre duplica un reporte reciente.
    const [oferta, setOferta] = useState<{ reporteExistenteId: string; identificador: string } | null>(null);
    const [reportePrevioId, setReportePrevioId] = useState<string | null>(null);
    // SPEC-314 (002-PI-214): fallback reactivo · si el backend rechaza con 403 FORBIDDEN
    // (rol nuevo agregado al backend sin actualizar ROLES_BLOQUEADOS del frontend), se
    // muestra el mismo card de bloqueo con 2 CTAs.
    const [bloqueadoPorBackend, setBloqueadoPorBackend] = useState(false);
    // I-14: la longitud mínima del texto es un parámetro (reportes.spam.min_text_length),
    // no un literal — el botón Siguiente obedece el mismo valor que el backend.
    const minTexto = useMinTextoReporte();

    const update = (partial: Partial<WizardData>) => setData((d) => ({ ...d, ...partial }));

    useEffect(() => {
        fetch("/api/me", { credentials: "include" })
            .then(async (res) => {
                if (res.ok) {
                    const data = await res.json().catch(() => null);
                    if (data && !data.error) {
                        setUser({ id: data.id, email: data.email, nombre: data.nombre, rol: data.rol });
                    }
                }
            })
            .catch(() => {
                // Sin sesión: flujo anónimo normal
            })
            .finally(() => setCheckingSession(false));
    }, []);

    async function handleLogout() {
        await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
        window.location.reload();
    }

    const handleSubmit = async () => {
        setIsSubmitting(true);
        setError("");
        try {
            const res = await fetch("/api/reportes", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    identificador: data.identificador,
                    plataforma: data.plataforma,
                    otraPlataforma: data.otraPlataforma,
                    texto: data.texto,
                    fechaIncidente: data.fechaIncidente
                        ? new Date(data.fechaIncidente).toISOString()
                        : new Date().toISOString(),
                    ciudad: data.ciudad,
                    pais: data.pais,
                    paisId: data.paisId || null,
                    ciudadId: data.ciudadId === "otra" ? null : (data.ciudadId || null),
                    edadVictima: data.edadVictima ? Number(data.edadVictima) : undefined,
                    // SPEC-323 (US1): señal de vinculación intencional (presente solo en el 2º reporte).
                    ...(reportePrevioId ? { reportePrevioId } : {}),
                }),
            });
            const json = await res.json().catch(() => null);
            if (!res.ok) {
                // SPEC-314 (002-PI-214): 403 FORBIDDEN del backend por rol interno → mostrar
                // card de bloqueo reactivo con las 2 CTAs de escape (defense-in-depth).
                if (res.status === 403 && json?.error?.code === "FORBIDDEN") {
                    setBloqueadoPorBackend(true);
                    setIsSubmitting(false);
                    return;
                }
                setError(json?.error?.message || "Error al enviar el reporte");
                setIsSubmitting(false);
                return;
            }
            // SPEC-323 (US1): el backend detecta duplicado reciente del padre → ofrece vinculación.
            if (json?.oferta === true) {
                setOferta({ reporteExistenteId: json.reporteExistenteId, identificador: json.identificador });
                setIsSubmitting(false);
                return;
            }
            // SPEC-295 (002-PI-196 · I-146): en modo autenticado, redirect al
            // listado del padre en vez de mostrar ConfirmacionReporte inline.
            // A-70 · B1(d): enviado con éxito → el borrador ya no hace falta.
            borrarBorradorReporte();
            if (modoAutenticado) {
                window.location.href = REDIRECT_PADRE_POST_ENVIO;
                return;
            }
            setResultado({ numeroSeguimiento: json.reporte.numeroSeguimiento });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error de conexión");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (checkingSession) {
        return (
            <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white/70 p-8 text-center backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/60">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-accent" />
                <p className="mt-3 text-sm text-muted">Verificando sesión...</p>
            </div>
        );
    }

    // SPEC-314 (002-PI-214): guard preventivo (rol conocido) o fallback reactivo (403 backend).
    if ((user && ROLES_BLOQUEADOS.includes(user.rol)) || bloqueadoPorBackend) {
        return <ReporteBloqueoRol onLogoutAndRetry={handleLogout} />;
    }

    if (resultado) {
        return <ConfirmacionReporte numeroSeguimiento={resultado.numeroSeguimiento} />;
    }

    // SPEC-323 (T007/US1): tarjeta de oferta de vinculación.
    if (oferta) {
        return (
            <div className="mx-auto max-w-xl rounded-2xl border border-ambar/30 bg-ambar/10 p-8 text-center">
                <p className="text-lg font-semibold text-tinta">
                    Ya reportaste este identificador recientemente
                </p>
                <p className="mt-2 text-sm text-tinta/80">
                    <span className="font-mono font-bold">{oferta.identificador}</span> ya tiene un reporte tuyo en el sistema.
                    ¿Querés agregar otro evento al mismo caso?
                </p>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                    <Button
                        onClick={() => {
                            setReportePrevioId(oferta.reporteExistenteId);
                            update({ identificador: oferta.identificador });
                            setStep(1);
                            setOferta(null);
                        }}
                    >
                        Sí, agregar otro evento
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => {
                            setOferta(null);
                            setError("");
                        }}
                    >
                        Cancelar
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-xl">
            {/* SPEC-340 (A-68 §2.1): el banner "Reportando como <nombre> <correo>"
                de SPEC-295 se retiró — Jelkin: no es necesario. La identidad sigue
                derivándose de la sesión en el backend; nada cambia en los datos. */}
            <div className="mb-6 flex items-center justify-between">
                {[1, 2, 3].map((s) => (
                    <div key={s} className="flex flex-1 items-center">
                        <div
                            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition ${s <= step
                                ? "bg-primary-600 text-white"
                                : "bg-slate-200 text-slate-500"
                            }`}
                        >
                            {s}
                        </div>
                        {s < 3 && (
                            <div
                                className={`mx-2 h-1 flex-1 rounded transition ${s < step ? "bg-primary-600" : "bg-slate-200"
                                }`}
                            />
                        )}
                    </div>
                ))}
            </div>

            {step === 1 && (
                <ReporteStepPlataforma
                    identificador={data.identificador}
                    plataforma={data.plataforma}
                    otraPlataforma={data.otraPlataforma}
                    identificadorBloqueado={reportePrevioId !== null || identificadorFijado !== null}
                    onChange={(v: { identificador: string; plataforma: string; otraPlataforma: string }) => update(v)}
                />
            )}
            {step === 2 && (
                <ReporteStepDetalle
                    ciudad={data.ciudad}
                    pais={data.pais}
                    fechaIncidente={data.fechaIncidente}
                    paisId={data.paisId}
                    ciudadId={data.ciudadId}
                    edadVictima={data.edadVictima}
                    texto={data.texto}
                    onChange={(v) => update(v)}
                />
            )}
            {step === 3 && (
                <ReporteStepConfirmar
                    data={data}
                    onSubmit={handleSubmit}
                    isSubmitting={isSubmitting}
                    error={error}
                />
            )}

            <div className="mt-6 flex justify-between">
                {step > 1 && (
                    <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
                        Atrás
                    </Button>
                )}
                {step < 3 && (
                    <Button
                        className="ml-auto"
                        onClick={() => setStep((s) => s + 1)}
                        disabled={
                            (step === 1 && (!data.identificador.trim() || !data.plataforma)) ||
                            (step === 2 &&
                                (!data.paisId ||
                                    !data.ciudadId ||
                                    (data.ciudadId === "otra" && !data.ciudad) ||
                                    data.texto.length < minTexto))
                        }
                    >
                        Siguiente
                    </Button>
                )}
            </div>
        </div>
    );
}
