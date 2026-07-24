"use client";

import { useState } from "react";
import { CanalesOficiales } from "@/components/modules/CanalesOficiales";
import { LandingHero, type ResultadoConsulta } from "@/components/modules/LandingHero";
import { LandingFooter } from "@/components/modules/LandingFooter";
import { useApi } from "@/lib/hooks/useApi";

/** Clave de sessionStorage para transportar el RPT sin exponerlo en la URL (spec 091-US2). */
export const RPT_STORAGE_KEY = "seguimiento.rpt";

export function HomePageClient() {
    const { data, isLoading, error, request } = useApi<Record<string, unknown>>();
    const [buscado, setBuscado] = useState(false);

    const handleSearch = async (identificador: string) => {
        setBuscado(true);
        // Spec 091-US1: el identificador viaja en el cuerpo, NUNCA en la URL.
        await request("/api/consulta", {
            method: "POST",
            body: JSON.stringify({ identificador }),
        });
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
