"use client";

import { useEffect, useState } from "react";
import { ReporteStepPlataforma } from "./ReporteStepPlataforma";
import { ReporteStepDetalle } from "./ReporteStepDetalle";
import { ReporteStepConfirmar } from "./ReporteStepConfirmar";
import { ConfirmacionReporte } from "./ConfirmacionReporte";
import { Button } from "@/components/ui/Button";

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

const ROLES_BLOQUEADOS = ["ADMIN", "OPERADOR", "SCHOOL_ADMIN"];

export function ReporteWizard() {
    const [step, setStep] = useState(1);
    const [user, setUser] = useState<SessionUser>(null);
    const [checkingSession, setCheckingSession] = useState(true);
    const [data, setData] = useState<WizardData>({
        identificador: "",
        plataforma: "",
        otraPlataforma: "",
        ciudad: "",
        pais: "",
        paisId: "",
        ciudadId: "",
        fechaIncidente: "",
        edadVictima: "",
        texto: "",
        esAnonimo: true,
    });
    const [resultado, setResultado] = useState<{ numeroSeguimiento: string } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");

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
                }),
            });
            const json = await res.json().catch(() => null);
            if (!res.ok) {
                setError(json?.error?.message || "Error al enviar el reporte");
                setIsSubmitting(false);
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

    if (user && ROLES_BLOQUEADOS.includes(user.rol)) {
        return (
            <div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-8 dark:border-amber-800/60 dark:bg-amber-950/20">
                <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-100">
                    Las cuentas internas no pueden crear reportes
                </h2>
                <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
                    Para reportar de forma anónima, cierra sesión primero. Tu cuenta interna tiene acceso al panel de administración/operación; los reportes deben crearse desde una cuenta de usuario final o sin iniciar sesión.
                </p>
                <Button className="mt-6" onClick={handleLogout}>
                    Cerrar sesión y reportar
                </Button>
            </div>
        );
    }

    if (resultado) {
        return <ConfirmacionReporte numeroSeguimiento={resultado.numeroSeguimiento} />;
    }

    return (
        <div className="mx-auto max-w-xl">
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
                                    data.texto.length < 20))
                        }
                    >
                        Siguiente
                    </Button>
                )}
            </div>
        </div>
    );
}
