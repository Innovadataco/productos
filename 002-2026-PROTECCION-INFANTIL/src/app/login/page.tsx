"use client";

import { useState } from "react";
import Link from "next/link";
import { LoginForm } from "@/components/modules/LoginForm";
import { useAuth } from "@/lib/contexts/AuthContext";
import { GlassCard } from "@/components/ui/GlassCard";

export default function LoginPage() {
    const { login } = useAuth();
    const [error, setError] = useState("");

    const handleLogin = async (email: string, password: string) => {
        const { ok, user } = await login(email, password);
        if (!ok) {
            setError("Credenciales incorrectas. Verifica tu email y contraseña.");
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

        const getRoleHome = (rol: string | undefined) => {
            if (rol === "ADMIN" || rol === "SCHOOL_ADMIN") return "/dashboard/admin";
            if (rol === "OPERADOR") return "/dashboard/admin/operadores";
            if (rol === "COMITE_VALIDACION") return "/dashboard/admin/comite";
            return "/mis-reportes";
        };

        const target = redirectTo || getRoleHome(user?.rol);

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
                        <div className="mt-4 rounded-xl bg-red-50 dark:bg-red-950/30 p-3 text-center text-sm text-red-600 dark:text-red-400">
                            {error}
                        </div>
                    )}
                </GlassCard>

                <p className="mt-6 text-center text-sm text-muted">
                    ¿No tienes cuenta?{" "}
                    <Link href="/registro" className="font-semibold text-accent hover:underline">
                        Regístrate
                    </Link>
                </p>
            </div>
        </main>
    );
}
