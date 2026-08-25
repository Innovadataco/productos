"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";

export function ActivarForm({ token }: { token: string }) {
    const router = useRouter();
    const [password, setPassword] = useState("");
    const [confirmacion, setConfirmacion] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password.length < 8) {
            setError("La contraseña debe tener al menos 8 caracteres.");
            return;
        }
        if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
            setError("La contraseña debe incluir al menos 1 letra y 1 número.");
            return;
        }
        if (password !== confirmacion) {
            setError("Las contraseñas no coinciden.");
            return;
        }
        setError("");
        setIsLoading(true);
        try {
            const res = await fetch("/api/auth/activar", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, password }),
            });
            const json = await res.json().catch(() => null);
            if (!res.ok) {
                throw new Error(json?.error?.message || "Error al activar la cuenta");
            }
            router.push("/consentimiento");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error al activar la cuenta");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <GlassCard className="w-full max-w-md">
            <form onSubmit={handleSubmit} className="space-y-4">
                <h2 className="text-xl font-semibold text-body">Crea tu contraseña</h2>
                <p className="text-sm text-muted">
                    Define una contraseña segura para acceder al panel del colegio.
                </p>
                <Input
                    label="Contraseña"
                    type="password"
                    placeholder="Mínimo 8 caracteres, 1 letra y 1 número"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
                <Input
                    label="Confirmar contraseña"
                    type="password"
                    placeholder="Repite la contraseña"
                    value={confirmacion}
                    onChange={(e) => setConfirmacion(e.target.value)}
                />
                {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
                <Button type="submit" isLoading={isLoading} className="w-full">
                    Activar cuenta
                </Button>
            </form>
        </GlassCard>
    );
}
