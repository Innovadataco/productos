"use client";

import { useState } from "react";
import { CanalesOficiales } from "@/components/modules/CanalesOficiales";
import { LandingHero, type ResultadoConsulta } from "@/components/modules/LandingHero";
import { LandingFooter } from "@/components/modules/LandingFooter";
import { useApi } from "@/lib/hooks/useApi";

export function HomePageClient() {
    const { data, isLoading, error, request } = useApi<Record<string, unknown>>();
    const [buscado, setBuscado] = useState(false);

    const handleSearch = async (identificador: string) => {
        setBuscado(true);
        await request(`/api/consulta?identificador=${encodeURIComponent(identificador)}`);
    };

    return (
        <main className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
            <LandingHero
                onSearch={handleSearch}
                data={data as ResultadoConsulta | null}
                isLoading={isLoading}
                error={error}
                buscado={buscado}
            />
            <CanalesOficiales />
            <LandingFooter />
        </main>
    );
}
