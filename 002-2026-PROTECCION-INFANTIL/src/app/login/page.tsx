"use client";

import { useState } from "react";
import Link from "next/link";
import { LoginForm } from "@/components/modules/LoginForm";
import { useAuth } from "@/lib/contexts/AuthContext";
import { GlassCard } from "@/components/ui/GlassCard";
import { Alerta } from "@/components/ui/Alerta";
import { homeParaRol } from "@/lib/auth/home-para-rol";

export default function LoginPage() {
    const { login } = useAuth();
    const [error, setError] = useState("");

    const handleLogin = async (email: string, password: string) => {
        const { ok, user, error: serverError } = await login(email, password);
        if (!ok) {
            // SPEC-119: si el servidor explica el motivo (servicio vencido, cuenta
            // desactivada), se muestra tal cual; si no, genérico de credenciales.
            setError(serverError || "Credenciales incorrectas. Verifica tu email y contraseña.");
            return;
        }

        const redirectTo =
            typeof window !== "undefined" && window.location.search
                ? new URLSearchParams(window.location.search).get("redirect")
                : null;

        if (user?.debeCambiarPassword) {
            window.location.href = "/cambiar-password";
            return;
        }

        // SPEC-319: fuente única rol→home (antes había una copia local que omitía
        // COMITE_CONVIVENCIA y mandaba OPERADOR a /dashboard/admin/operadores).
        const target = redirectTo || homeParaRol(user?.rol);

        // Navegación completa para evitar quedarse pegado en login por problemas de router cliente
        window.location.href = target;
    };

    return (
        <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-12">
            <div className="w-full max-w-md animate-fadeIn">
                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-bold text-body">
                        <span className="text-gradient">Bienvenido</span>
                    </h1>
                    <p className="mt-2 text-sm text-muted">Accede a tu panel de reportes</p>
                </div>

                <GlassCard>
                    <LoginForm onLogin={handleLogin} />
                    {error && (
                        <Alerta tono="error" className="mt-4 text-center">
                            {error}
                        </Alerta>
                    )}
                </GlassCard>

                <p className="mt-6 text-center text-sm text-muted">
                    ¿No tienes cuenta?{" "}
                    <Link href="/registro/inicio" className="font-semibold text-accent hover:underline">
                        Regístrate
                    </Link>
                </p>
            </div>
        </main>
    );
}
