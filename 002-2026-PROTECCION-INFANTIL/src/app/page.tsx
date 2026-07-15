"use client";

import { useState } from "react";
import { ConsultaForm } from "@/components/modules/ConsultaForm";
import { ConsultaResultado } from "@/components/modules/ConsultaResultado";
import { CanalesOficiales } from "@/components/modules/CanalesOficiales";
import { LandingHero } from "@/components/modules/LandingHero";
import { LandingFeatures } from "@/components/modules/LandingFeatures";
import { LandingFooter } from "@/components/modules/LandingFooter";
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
        <main className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
            <LandingHero />

            <section id="consultar" className="mt-8 scroll-mt-24">
                <div className="mb-6 text-center">
                    <h2 className="text-2xl font-bold text-slate-900">Consulta un identificador</h2>
                    <p className="mt-2 text-sm text-slate-600">
                        Ingresa un número, nick o usuario y la plataforma para conocer reportes comunitarios.
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
            </section>

            <LandingFeatures />
            <CanalesOficiales />
            <LandingFooter />
        </main>
    );
}
