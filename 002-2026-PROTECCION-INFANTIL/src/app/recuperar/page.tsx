"use client";

import Link from "next/link";
import { RecuperarForm } from "@/components/modules/RecuperarForm";
import { GlassCard } from "@/components/ui/GlassCard";

export default function RecuperarPage() {
    return (
        <main className="mx-auto max-w-md px-4 py-12">
            <div className="mb-6 text-center">
                <h1 className="text-2xl font-bold text-slate-900">Recuperar contraseña</h1>
                <p className="mt-1 text-sm text-slate-600">
                    Ingresa tu email y te enviaremos un enlace para restablecerla.
                </p>
            </div>

            <GlassCard>
                <RecuperarForm />
            </GlassCard>

            <p className="mt-4 text-center text-sm text-slate-600">
                ¿Recordaste tu contraseña?{" "}
                <Link href="/login" className="font-medium text-primary-600 hover:underline">
                    Inicia sesión
                </Link>
            </p>
        </main>
    );
}
