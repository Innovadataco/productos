"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";

export default function CambiarPasswordPage() {
    const { user, isLoading } = useAuth();
    const router = useRouter();
    const [passwordActual, setPasswordActual] = useState("");
    const [passwordNueva, setPasswordNueva] = useState("");
    const [passwordConfirmar, setPasswordConfirmar] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (!isLoading && !user) {
            router.push("/login");
        }
    }, [isLoading, user, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (passwordNueva.length < 8) {
            setError("La nueva contraseña debe tener al menos 8 caracteres.");
            return;
        }
        if (passwordNueva !== passwordConfirmar) {
            setError("Las contraseñas nuevas no coinciden.");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch("/api/auth/cambiar-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ passwordActual, passwordNueva }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error?.message || "Error al cambiar la contraseña");
                return;
            }
            setSuccess(true);
            setTimeout(() => {
                const target = user?.rol === "ADMIN" || user?.rol === "SCHOOL_ADMIN"
                    ? "/dashboard/admin"
                    : user?.rol === "OPERADOR"
                    ? "/dashboard/admin"
                    : "/mis-reportes";
                window.location.href = target;
            }, 1200);
        } catch {
            setError("Error de red. Intentá de nuevo.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading || !user) {
        return (
            <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-accent" />
            </main>
        );
    }

    return (
        <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-12">
            <div className="w-full max-w-md animate-fadeIn">
                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-bold text-body">
                        <span className="text-gradient">Cambiar contraseña</span>
                    </h1>
                    <p className="mt-2 text-sm text-muted">
                        {user.debeCambiarPassword
                            ? "Debés cambiar tu contraseña temporal antes de continuar."
                            : "Actualizá tu contraseña de acceso."}
                    </p>
                </div>

                <GlassCard>
                    {success ? (
                        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 p-4 text-center text-sm text-emerald-700 dark:text-emerald-300">
                            Contraseña actualizada. Redirigiendo...
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <Input
                                label="Contraseña actual"
                                type="password"
                                value={passwordActual}
                                onChange={(e) => setPasswordActual(e.target.value)}
                                required
                                autoComplete="current-password"
                            />
                            <Input
                                label="Nueva contraseña"
                                type="password"
                                value={passwordNueva}
                                onChange={(e) => setPasswordNueva(e.target.value)}
                                required
                                autoComplete="new-password"
                            />
                            <Input
                                label="Confirmar nueva contraseña"
                                type="password"
                                value={passwordConfirmar}
                                onChange={(e) => setPasswordConfirmar(e.target.value)}
                                required
                                autoComplete="new-password"
                            />
                            {error && (
                                <p className="rounded-xl bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-600 dark:text-red-400">
                                    {error}
                                </p>
                            )}
                            <Button type="submit" isLoading={isSubmitting} className="w-full">
                                Guardar contraseña
                            </Button>
                        </form>
                    )}
                </GlassCard>
            </div>
        </main>
    );
}
