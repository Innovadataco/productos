"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { ComiteCuentaDto } from "@/lib/dal/types/comite-convivencia";

interface Props {
    cuenta: ComiteCuentaDto | null;
}

export function ComiteCuentaCard({ cuenta: cuentaInicial }: Props) {
    const [cuenta, setCuenta] = useState<ComiteCuentaDto | null>(cuentaInicial);
    const [email, setEmail] = useState("");
    const [passwordTemporal, setPasswordTemporal] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function crearCuenta(event: React.FormEvent) {
        event.preventDefault();
        setLoading(true);
        setError(null);
        setPasswordTemporal(null);

        try {
            const res = await fetch("/api/colegio/comite/cuenta", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email.trim() }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error?.message || "Error al crear la cuenta");
                return;
            }
            setCuenta(data.cuenta);
            setPasswordTemporal(data.passwordTemporal);
            setEmail("");
        } catch {
            setError("Error de red al crear la cuenta");
        } finally {
            setLoading(false);
        }
    }

    async function regenerarPassword() {
        setLoading(true);
        setError(null);
        setPasswordTemporal(null);

        try {
            const res = await fetch("/api/colegio/comite/cuenta/regenerar-password", { method: "POST" });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error?.message || "Error al regenerar la contraseña");
                return;
            }
            setCuenta(data.cuenta);
            setPasswordTemporal(data.passwordTemporal);
        } catch {
            setError("Error de red al regenerar la contraseña");
        } finally {
            setLoading(false);
        }
    }

    if (!cuenta) {
        return (
            <section className="rounded-2xl glass p-6 md:p-8">
                <h2 className="text-xl font-semibold text-body">Crear cuenta del comité</h2>
                <p className="mt-2 text-sm text-muted">
                    La cuenta es compartida por todos los integrantes del Comité de Convivencia.
                </p>
                <form onSubmit={crearCuenta} className="mt-4 space-y-4">
                    <div>
                        <label htmlFor="email-comite" className="block text-sm font-medium text-body">
                            Email institucional
                        </label>
                        <input
                            id="email-comite"
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="mt-1 w-full rounded-xl glass-input px-4 py-2 text-sm text-body placeholder-subtle ring-accent-input"
                            placeholder="comite@colegio.edu"
                        />
                    </div>
                    {error && <p className="text-sm text-estado-rubi">{error}</p>}
                    {passwordTemporal && (
                        <div className="rounded-xl bg-pino/10 p-4 text-sm text-estado-pino ring-1 ring-pino/30">
                            <p className="font-semibold">Contraseña temporal generada</p>
                            <p className="mt-1 font-mono">{passwordTemporal}</p>
                            <p className="mt-1">Entrégala al comité de forma segura; no se volverá a mostrar.</p>
                        </div>
                    )}
                    <Button type="submit" isLoading={loading}>
                        {loading ? "Creando…" : "Crear cuenta"}
                    </Button>
                </form>
            </section>
        );
    }

    return (
        <section className="rounded-2xl glass p-6 md:p-8">
            <h2 className="text-xl font-semibold text-body">Cuenta del comité</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                    <p className="text-xs uppercase tracking-wide text-muted">Email</p>
                    <p className="font-medium text-body">{cuenta.email}</p>
                </div>
                <div>
                    <p className="text-xs uppercase tracking-wide text-muted">Estado</p>
                    <p className="font-medium text-body">{cuenta.estado}</p>
                </div>
                <div>
                    <p className="text-xs uppercase tracking-wide text-muted">Último acceso</p>
                    <p className="font-medium text-body">{cuenta.ultimaSesion ? new Date(cuenta.ultimaSesion).toLocaleString("es-CO", { timeZone: "America/Bogota" }) : "Nunca"}</p>
                </div>
                <div>
                    <p className="text-xs uppercase tracking-wide text-muted">Creada</p>
                    <p className="font-medium text-body">{new Date(cuenta.creadoEn).toLocaleDateString("es-CO", { timeZone: "America/Bogota" })}</p>
                </div>
            </div>

            {passwordTemporal && (
                <div className="mt-4 rounded-xl bg-pino/10 p-4 text-sm text-estado-pino ring-1 ring-pino/30">
                    <p className="font-semibold">Nueva contraseña temporal</p>
                    <p className="mt-1 font-mono">{passwordTemporal}</p>
                    <p className="mt-1">Entrégala al comité de forma segura; no se volverá a mostrar.</p>
                </div>
            )}
            {error && <p className="mt-4 text-sm text-estado-rubi">{error}</p>}

            <Button type="button" onClick={regenerarPassword} isLoading={loading} className="mt-6">
                {loading ? "Generando…" : "Regenerar contraseña"}
            </Button>
        </section>
    );
}
