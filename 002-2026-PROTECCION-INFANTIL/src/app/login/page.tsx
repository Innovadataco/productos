"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoginForm } from "@/components/modules/LoginForm";
import { useAuth } from "@/lib/contexts/AuthContext";
import { GlassCard } from "@/components/ui/GlassCard";

export default function LoginPage() {
    const { login } = useAuth();
    const router = useRouter();
    const [error, setError] = useState("");

    const handleLogin = async (email: string, password: string) => {
        const ok = await login(email, password);
        if (ok) {
            router.push("/mis-reportes");
        } else {
            setError("Credenciales incorrectas. Verifica tu email y contraseña.");
        }
    };

    return (
        <main className="mx-auto max-w-md px-4 py-12">
            <div className="mb-6 text-center">
                <h1 className="text-2xl font-bold text-slate-900">Iniciar sesión</h1>
                <p className="mt-1 text-sm text-slate-600">Accede a tu panel de reportes</p>
            </div>

            <GlassCard>
                <LoginForm onLogin={handleLogin} />
                {error && <p className="mt-3 text-sm text-red-600 text-center">{error}</p>}
            </GlassCard>

            <p className="mt-4 text-center text-sm text-slate-600">
                ¿No tienes cuenta?{" "}
                <Link href="/registro" className="font-medium text-primary-600 hover:underline">
                    Regístrate
                </Link>
            </p>
        </main>
    );
}