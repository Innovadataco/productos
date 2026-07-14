"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function RecuperarForm() {
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = email.trim().toLowerCase();
        if (!trimmed || !trimmed.includes("@")) {
            setError("Ingresa un correo electrónico válido.");
            return;
        }
        setError("");
        setIsLoading(true);
        try {
            const res = await fetch("/api/auth/recuperar/solicitar", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: trimmed }),
            });
            if (!res.ok) {
                const json = await res.json().catch(() => null);
                throw new Error(json?.error?.message || "Error al solicitar recuperación");
            }
            setSuccess(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo enviar la solicitud. Intenta de nuevo.");
        } finally {
            setIsLoading(false);
        }
    };

    if (success) {
        return (
            <div className="text-center">
                <p className="text-sm text-slate-700">
                    Si el email está registrado, recibirás un enlace para restablecer tu contraseña.
                </p>
                <p className="mt-2 text-sm text-slate-500">Revisa tu bandeja de entrada y carpeta de spam.</p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <Input
                label="Correo electrónico"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" isLoading={isLoading} className="w-full">
                Enviar enlace de recuperación
            </Button>
        </form>
    );
}
