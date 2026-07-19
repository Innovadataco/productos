"use client";

import { useEffect, useState, Suspense, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { GlassCard } from "@/components/ui/GlassCard";

export default function ApelarPage() {
    return (
        <Suspense fallback={<ApelarSkeleton />}>
            <ApelarContent />
        </Suspense>
    );
}

function ApelarSkeleton() {
    return (
        <main className="mx-auto max-w-xl px-4 py-12">
            <GlassCard className="p-6">
                <p className="text-sm text-muted">Cargando...</p>
            </GlassCard>
        </main>
    );
}

interface EstadoApelacion {
    estado: string;
    tipoVerificacion: string;
    pausaHasta: string | null;
    visibilidadRestaurada: boolean;
    plataformaNombre: string | null;
}

function ApelarContent() {
    const searchParams = useSearchParams();
    const tokenParam = searchParams.get("token");

    const [step, setStep] = useState<"form" | "otp" | "done">(tokenParam ? "done" : "form");
    const [token, setToken] = useState(tokenParam || "");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [estado, setEstado] = useState<EstadoApelacion | null>(null);
    const [form, setForm] = useState({
        identificador: "",
        plataformaClave: "",
        tipoVerificacion: "NICK",
        contacto: "",
        motivoSolicitud: "",
    });

    const cargarEstado = useCallback(async (t: string) => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch(`/api/apelaciones/${t}`, { cache: "no-store" });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error?.message || "Error");
            setEstado(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (tokenParam) {
            void cargarEstado(tokenParam);
        }
    }, [tokenParam, cargarEstado]);

    async function submitForm(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/apelaciones/solicitar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error?.message || "Error");
            setToken(data.token);
            if (data.requiereVerificacion) {
                setStep("otp");
            } else {
                setStep("done");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error");
        } finally {
            setLoading(false);
        }
    }

    async function submitOtp(codigo: string) {
        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/apelaciones/verificar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, codigo }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error?.message || "Error");
            setStep("done");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error");
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="mx-auto max-w-xl px-4 py-12">
            <GlassCard className="p-6">
                <h1 className="text-2xl font-bold text-body">Apelar reporte</h1>
                <p className="mt-2 text-sm text-muted">
                    Este identificador registra reportes de conducta de riesgo. Podés presentar un descargo.
                </p>

                {error && <p className="mt-4 text-sm text-red-600" role="alert">{error}</p>}

                {step === "form" && (
                    <form onSubmit={submitForm} className="mt-6 space-y-4">
                        <Input
                            label="Identificador"
                            value={form.identificador}
                            onChange={(e) => setForm((f) => ({ ...f, identificador: e.target.value }))}
                            required
                        />
                        <Input
                            label="Plataforma"
                            value={form.plataformaClave}
                            onChange={(e) => setForm((f) => ({ ...f, plataformaClave: e.target.value }))}
                            placeholder="whatsapp, instagram, roblox..."
                            required
                        />
                        <Select
                            label="Tipo de verificación"
                            value={form.tipoVerificacion}
                            onChange={(e) => setForm((f) => ({ ...f, tipoVerificacion: e.target.value }))}
                            options={[
                                { value: "NICK", label: "Nick / usuario (sin verificación de titularidad)" },
                                { value: "SMS", label: "Teléfono (OTP SMS)" },
                            ]}
                        />
                        {form.tipoVerificacion === "SMS" && (
                            <Input
                                label="Teléfono"
                                value={form.contacto}
                                onChange={(e) => setForm((f) => ({ ...f, contacto: e.target.value }))}
                                required
                            />
                        )}
                        <div>
                            <label className="block text-sm font-medium text-body">Motivo del descargo</label>
                            <textarea
                                value={form.motivoSolicitud}
                                onChange={(e) => setForm((f) => ({ ...f, motivoSolicitud: e.target.value }))}
                                rows={4}
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 p-3 text-sm text-body placeholder:text-subtle focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900/80 dark:focus:border-cyan-500"
                                required
                                minLength={20}
                                maxLength={2000}
                            />
                        </div>
                        <Button type="submit" isLoading={loading}>Enviar apelación</Button>
                    </form>
                )}

                {step === "otp" && (
                    <OtpForm onSubmit={submitOtp} loading={loading} />
                )}

                {step === "done" && (
                    <div className="mt-6 space-y-4">
                        <div className="rounded-lg bg-green-50 p-4 text-sm text-green-700 dark:bg-green-900/30 dark:text-green-300">
                            Apelación recibida. Guarde este enlace para consultar el estado:
                            <code className="mt-2 block break-all rounded bg-white px-2 py-1 text-xs dark:bg-slate-800">
                                {typeof window !== "undefined" ? `${window.location.origin}/apelar?token=${token}` : ""}
                            </code>
                        </div>
                        {estado && (
                            <div className="rounded-lg border border-slate-200 bg-white/60 p-4 text-sm dark:border-slate-700 dark:bg-slate-900/40">
                                <p className="font-medium text-body">Estado: {estado.estado}</p>
                                {estado.pausaHasta && !estado.visibilidadRestaurada && (
                                    <p className="mt-1 text-muted">
                                        La visibilidad permanece pausada hasta {new Date(estado.pausaHasta).toLocaleDateString()} mientras revisamos tu solicitud.
                                    </p>
                                )}
                                {estado.tipoVerificacion === "NICK" && (
                                    <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">Titularidad no verificada</p>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </GlassCard>
        </main>
    );
}

function OtpForm({ onSubmit, loading }: { onSubmit: (codigo: string) => void; loading: boolean }) {
    const [codigo, setCodigo] = useState("");
    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                onSubmit(codigo);
            }}
            className="mt-6 space-y-4"
        >
            <Input
                label="Código de verificación"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                maxLength={6}
                required
            />
            <Button type="submit" isLoading={loading}>Verificar</Button>
        </form>
    );
}
