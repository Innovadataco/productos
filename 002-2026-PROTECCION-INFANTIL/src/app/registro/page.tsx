"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RegistroForm } from "@/components/modules/RegistroForm";
import { VerificacionForm } from "@/components/modules/VerificacionForm";
import { useAuth } from "@/lib/contexts/AuthContext";
import { GlassCard } from "@/components/ui/GlassCard";

export default function RegistroPage() {
    const { login } = useAuth();
    const router = useRouter();
    const [step, setStep] = useState<"email" | "verificar">("email");
    const [email, setEmail] = useState("");
    const [error, setError] = useState("");

    const handleSolicitarCodigo = async (emailValue: string) => {
        const res = await fetch("/api/auth/verificar/solicitar", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: emailValue }),
        });
        if (!res.ok) {
            const json = await res.json().catch(() => null);
            throw new Error(json?.error?.message || "Error al solicitar código");
        }
        setEmail(emailValue);
        setStep("verificar");
    };

    const handleCompletar = async (data: {
        email: string;
        codigo: string;
        password: string;
        nombre: string;
    }) => {
        const res = await fetch("/api/auth/verificar/completar", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        if (!res.ok) {
            const json = await res.json().catch(() => null);
            throw new Error(json?.error?.message || "Error al crear cuenta");
        }
        // Login automático tras registro
        await login(data.email, data.password);
        router.push("/mis-reportes");
    };

    return (
        <main className="mx-auto max-w-md px-4 py-12">
            <div className="mb-6 text-center">
                <h1 className="text-2xl font-bold text-slate-900">Crear cuenta</h1>
                <p className="mt-1 text-sm text-slate-600">
                    {step === "email"
                        ? "Ingresa tu email para recibir un código de verificación"
                        : "Verifica tu correo electrónico"}
                </p>
            </div>

            <GlassCard>
                {step === "email" ? (
                    <RegistroForm onSolicitarCodigo={handleSolicitarCodigo} />
                ) : (
                    <VerificacionForm email={email} onCompletar={handleCompletar} />
                )}
                {error && <p className="mt-3 text-sm text-red-600 text-center">{error}</p>}
            </GlassCard>

            <p className="mt-4 text-center text-sm text-slate-600">
                ¿Ya tienes cuenta?{" "}
                <Link href="/login" className="font-medium text-primary-600 hover:underline">
                    Inicia sesión
                </Link>
            </p>
        </main>
    );
}