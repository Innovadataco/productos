"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { MisReportesList } from "@/components/modules/MisReportesList";
import { ConsultaEnriquecidaClient } from "@/components/modules/ConsultaEnriquecidaClient";
import { GlassCard } from "@/components/ui/GlassCard";
import { ErrorState } from "@/components/ui/ErrorState";

type MisReporteItem = {
    id: string;
    identificador: string;
    plataforma: string;
    estadoVisual: string;
    badge: "warning" | "success" | "muted";
    mensaje: string;
    slaHoras: number;
    numeroSeguimiento: string | null;
    ciudad: string;
    pais: string;
    esAnonimo: boolean;
    creadoEn: string;
    clasificacion: { categoria: string; categoriaLabel: string; categoriaGrupo: string; confianza: number } | null;
    ranking: { score: number; nivelRiesgo: "BAJO" | "MEDIO" | "ALTO"; totalReportes: number } | null;
};

export function DashboardUsuarioClient() {
    const { user, isLoading: authLoading } = useAuth();
    const router = useRouter();
    const [items, setItems] = useState<MisReporteItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            router.push("/login");
            return;
        }

        setIsLoading(true);
        setError("");
        fetch("/api/reportes/mis-reportes?page=1&pageSize=10", { credentials: "include" })
            .then(async (res) => {
                if (res.status === 401) {
                    router.push("/login");
                    return;
                }
                if (!res.ok) throw new Error("Error al cargar reportes");
                const data = await res.json();
                setItems(data.items || []);
            })
            .catch((err) => setError(err instanceof Error ? err.message : "Error"))
            .finally(() => setIsLoading(false));
    }, [authLoading, user, router]);

    if (authLoading || (!user && isLoading)) {
        return (
            <main className="mx-auto max-w-6xl px-4 py-12 text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-accent" />
                <p className="mt-3 text-sm text-subtle">Cargando...</p>
            </main>
        );
    }

    return (
        <main className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-body">Panel de reportes</h1>
                <p className="mt-1 text-sm text-muted">
                    Consulta el estado de tus reportes y busca información agregada de cualquier identificador.
                </p>
            </div>

            <div className="space-y-8">
                <section>
                    <h2 className="text-lg font-semibold text-body mb-3">Mis reportes</h2>
                    {isLoading ? (
                        <div className="glass rounded-2xl p-8 text-center animate-pulse">
                            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-accent" />
                            <p className="mt-3 text-sm text-subtle">Cargando reportes...</p>
                        </div>
                    ) : error ? (
                        <ErrorState
                            title="No pudimos cargar tus reportes"
                            description="Ocurrió un problema al consultar la información. Intenta recargar la página."
                            onRetry={() => window.location.reload()}
                        />
                    ) : (
                        <MisReportesList items={items} />
                    )}
                </section>

                <section>
                    <h2 className="text-lg font-semibold text-body mb-3">Consulta enriquecida</h2>
                    <ConsultaEnriquecidaClient />
                </section>
            </div>
        </main>
    );
}
