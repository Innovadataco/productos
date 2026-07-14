"use client";

import { useState } from "react";
import { ConsultaForm } from "@/components/modules/ConsultaForm";
import { ConsultaResultado } from "@/components/modules/ConsultaResultado";
import { CanalesOficiales } from "@/components/modules/CanalesOficiales";
import { useApi } from "@/lib/hooks/useApi";
import { GlassCard } from "@/components/ui/GlassCard";

export default function HomePage() {
    const { data, isLoading, error, request } = useApi<Record<string, unknown>>();
    const [buscado, setBuscado] = useState(false);

    const handleSearch = async (identificador: string, plataforma: string) => {
        setBuscado(true);
        await request(`/api/consulta?identificador=${encodeURIComponent(identificador)}&plataforma=${encodeURIComponent(plataforma)}`);
    };

    return (
        <main className="mx-auto max-w-3xl px-4 py-8 sm:py-16">
            <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                    Protección Infantil
                </h1>
                <p className="mt-3 text-base text-slate-600">
                    Consulta reportes comunitarios sobre identificadores de riesgo
                </p>
            </div>

            <GlassCard className="mb-6">
                <ConsultaForm onSearch={handleSearch} />
            </GlassCard>

            {isLoading && (
                <div className="glass rounded-2xl p-8 text-center">
                    <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
                    <p className="mt-3 text-sm text-slate-500">Consultando...</p>
                </div>
            )}

            {error && (
                <div className="glass rounded-2xl p-6 text-center">
                    <p className="text-red-600 text-sm">{error}</p>
                </div>
            )}

            {!isLoading && buscado && data && (
                <ConsultaResultado data={data as Parameters<typeof ConsultaResultado>[0]["data"]} />
            )}

            {!isLoading && buscado && !data && !error && (
                <div className="glass rounded-2xl p-8 text-center">
                    <p className="text-slate-500 text-sm">No se encontraron datos.</p>
                </div>
            )}

            <CanalesOficiales />
        </main>
    );
}