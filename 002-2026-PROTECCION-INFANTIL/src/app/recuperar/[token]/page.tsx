"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { RestablecerForm } from "@/components/modules/RestablecerForm";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";

export default function RecuperarTokenPage() {
    const params = useParams();
    const token = typeof params.token === "string" ? params.token : "";

    const [status, setStatus] = useState<"loading" | "valid" | "invalid">(
        token ? "loading" : "invalid"
    );

    useEffect(() => {
        if (!token) return;
        fetch(`/api/auth/recuperar/validar?token=${encodeURIComponent(token)}`, { credentials: "include" })
            .then((res) => {
                if (res.ok) {
                    setStatus("valid");
                } else {
                    setStatus("invalid");
                }
            })
            .catch(() => setStatus("invalid"));
    }, [token]);

    return (
        <main className="mx-auto max-w-md px-4 py-12">
            <div className="mb-6 text-center">
                <h1 className="text-2xl font-bold text-slate-900">Restablecer contraseña</h1>
                <p className="mt-1 text-sm text-slate-600">
                    {status === "valid"
                        ? "Ingresa tu nueva contraseña."
                        : status === "invalid"
                        ? "El enlace no es válido o ha expirado."
                        : "Verificando enlace..."}
                </p>
            </div>

            <GlassCard>
                {status === "loading" && (
                    <div className="flex justify-center py-8">
                        <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
                    </div>
                )}
                {status === "valid" && <RestablecerForm token={token} />}
                {status === "invalid" && (
                    <div className="space-y-4 text-center">
                        <p className="text-sm text-slate-700">
                            El enlace de recuperación es inválido, ya fue usado o expiró.
                        </p>
                        <Link href="/recuperar">
                            <Button variant="outline" className="w-full">
                                Solicitar nuevo enlace
                            </Button>
                        </Link>
                    </div>
                )}
            </GlassCard>

            <p className="mt-4 text-center text-sm text-slate-600">
                <Link href="/login" className="font-medium text-primary-600 hover:underline">
                    Volver a iniciar sesión
                </Link>
            </p>
        </main>
    );
}
