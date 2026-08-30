"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { RegistroForm } from "@/components/modules/RegistroForm";
import { VerificacionForm } from "@/components/modules/VerificacionForm";
import { useAuth } from "@/lib/contexts/AuthContext";
import { GlassCard } from "@/components/ui/GlassCard";
import { Alerta } from "@/components/ui/Alerta";

// SPEC-314 (002-PI-214): destinos permitidos post-registro. Se restringe a rutas internas
// que empiezan por "/" para evitar open redirect (regla defensiva).
function destinoSeguro(returnTo: string | null): string {
    if (!returnTo) return "/mis-reportes";
    if (!returnTo.startsWith("/") || returnTo.startsWith("//")) return "/mis-reportes";
    return returnTo;
}

// SPEC-314 (002-PI-214): default export envuelve en Suspense porque `useSearchParams()`
// requiere boundary durante prerender (Next.js 15+).
export default function RegistroPage() {
    return (
        <Suspense fallback={null}>
            <RegistroPageContent />
        </Suspense>
    );
}

function RegistroPageContent() {
    const { login } = useAuth();
    const router = useRouter();
    // SPEC-314 (002-PI-214): soporta `?returnTo=<ruta>` para que el CTA B del ReporteWizard
    // devuelva al usuario al formulario de reportar tras crear su cuenta PARENT.
    const searchParams = useSearchParams();
    const returnTo = destinoSeguro(searchParams.get("returnTo"));
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
        nombre?: string;
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
        router.push(returnTo);
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
                        <Alerta tono="error" className="mt-3 text-center">
                            {error}
                        </Alerta>
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
