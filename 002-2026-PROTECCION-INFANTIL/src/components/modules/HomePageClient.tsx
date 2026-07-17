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

export function HomePageClient() {
    const { data, isLoading, error, request } = useApi<Record<string, unknown>>();
    const [buscado, setBuscado] = useState(false);

    const handleSearch = async (identificador: string) => {
        setBuscado(true);
        await request(`/api/consulta?identificador=${encodeURIComponent(identificador)}`);
    };

    return (
        <main className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
            <LandingHero />

            <section id="consultar" className="mt-10 scroll-mt-28">
                <div className="mb-6 text-center">
                    <h2 className="text-2xl font-bold text-body">Consulta un identificador</h2>
                    <p className="mt-2 text-sm text-muted">
                        Ingresa un número, nick o usuario para conocer reportes comunitarios sin importar la plataforma.
                    </p>
                </div>

                <GlassCard className="mb-6">
                    <ConsultaForm onSearch={handleSearch} />
                </GlassCard>

                {isLoading && (
                    <div className="glass rounded-2xl p-8 text-center animate-pulse">
                        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-accent" />
                        <p className="mt-3 text-sm text-subtle">Consultando...</p>
                    </div>
                )}

                {error && (
                    <div className="glass rounded-2xl p-6 text-center">
                        <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
                    </div>
                )}

                {!isLoading && buscado && data && (
                    <ConsultaResultado data={data as Parameters<typeof ConsultaResultado>[0]["data"]} />
                )}

                {!isLoading && buscado && !data && !error && (
                    <div className="glass rounded-2xl p-8 text-center">
                        <p className="text-subtle text-sm">No se encontraron datos.</p>
                    </div>
                )}
            </section>

            <LandingFeatures />
            <CanalesOficiales />
            <LandingFooter />
        </main>
    );
}
