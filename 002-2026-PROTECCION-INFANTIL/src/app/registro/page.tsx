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
        const valRes = await fetch("/api/auth/verificar/validar", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: data.email, codigo: data.codigo }),
        });
        if (!valRes.ok) {
            const json = await valRes.json().catch(() => null);
            throw new Error(json?.error?.message || "Código inválido o expirado");
        }
        const valJson = await valRes.json();

        const res = await fetch("/api/auth/verificar/completar", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                token: valJson.token,
                password: data.password,
                nombre: data.nombre,
            }),
        });
        if (!res.ok) {
            const json = await res.json().catch(() => null);
            throw new Error(json?.error?.message || "Error al crear cuenta");
        }
        await login(data.email, data.password);
        router.push("/mis-reportes");
    };

    return (
        <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-12">
            <div className="w-full max-w-md animate-fadeIn">
                <div className="mb-6 text-center">
                    <h1 className="text-2xl font-bold text-body">Crear cuenta</h1>
                    <p className="mt-1 text-sm text-muted">
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
                    {error && (
                        <div className="mt-3 rounded-xl bg-red-50 dark:bg-red-950/30 p-3 text-center text-sm text-red-600 dark:text-red-400">
                            {error}
                        </div>
                    )}
                </GlassCard>

                <p className="mt-4 text-center text-sm text-muted">
                    ¿Ya tienes cuenta?{" "}
                    <Link href="/login" className="font-medium text-accent hover:underline">
                        Inicia sesión
                    </Link>
                </p>
            </div>
        </main>
    );
}
