"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CanalesOficiales } from "@/components/modules/CanalesOficiales";
import { LandingHero, type ResultadoConsulta } from "@/components/modules/LandingHero";
import { LandingFooter } from "@/components/modules/LandingFooter";
import { useApi } from "@/lib/hooks/useApi";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { GlassCard } from "@/components/ui/GlassCard";

/** Clave de sessionStorage para transportar el RPT sin exponerlo en la URL (spec 091-US2). */
export const RPT_STORAGE_KEY = "seguimiento.rpt";

export function HomePageClient() {
    const { data, isLoading, error, request } = useApi<Record<string, unknown>>();
    const [buscado, setBuscado] = useState(false);
    const [rpt, setRpt] = useState("");
    const router = useRouter();

    function irASeguimiento(e: React.FormEvent) {
        e.preventDefault();
        const numero = rpt.trim();
        if (!numero) return;
        // Privacidad: el número viaja por sessionStorage, no por query string.
        sessionStorage.setItem(RPT_STORAGE_KEY, numero);
        router.push("/seguimiento");
    }

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
            <GlassCard className="mx-auto mt-8 max-w-xl p-5">
                <form onSubmit={irASeguimiento} className="space-y-3">
                    <Input
                        label="Consultar el estado de mi reporte"
                        value={rpt}
                        onChange={(e) => setRpt(e.target.value)}
                        placeholder="RPT-XXXXXX"
                        aria-label="Número de seguimiento de mi reporte"
                    />
                    <Button type="submit" disabled={!rpt.trim()} className="w-full sm:w-auto">
                        Ver estado de mi reporte
                    </Button>
                </form>
            </GlassCard>

            <CanalesOficiales />
            <LandingFooter />
        </main>
    );
}
