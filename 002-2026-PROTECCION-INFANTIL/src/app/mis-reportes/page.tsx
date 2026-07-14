"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { MisReportesList } from "@/components/modules/MisReportesList";
import { GlassCard } from "@/components/ui/GlassCard";

type MisReporteItem = {
    id: string;
    identificador: string;
    plataforma: string;
    estadoVisual: string;
    numeroSeguimiento: string | null;
    ciudad: string;
    pais: string;
    esAnonimo: boolean;
    creadoEn: string;
    clasificacion: { categoria: string; categoriaLabel: string; confianza: number } | null;
    ranking: { score: number; nivelRiesgo: "BAJO" | "MEDIO" | "ALTO"; totalReportes: number } | null;
};

export default function MisReportesPage() {
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

        fetch("/api/reportes/mis-reportes?page=1&pageSize=25", { credentials: "include" })
            .then(async (res) => {
                if (!res.ok) throw new Error("Error al cargar reportes");
                const data = await res.json();
                setItems(data.items || []);
            })
            .catch((err) => setError(err instanceof Error ? err.message : "Error"))
            .finally(() => setIsLoading(false));
    }, [authLoading, user, router]);

    if (authLoading || (!user && isLoading)) {
        return (
            <main className="mx-auto max-w-3xl px-4 py-12 text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
                <p className="mt-3 text-sm text-slate-500">Cargando...</p>
            </main>
        );
    }

    return (
        <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-900">Mis reportes</h1>
                <p className="mt-1 text-sm text-slate-600">
                    Consulta el estado de los reportes que has realizado.
                </p>
            </div>

            {isLoading ? (
                <div className="glass rounded-2xl p-8 text-center">
                    <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
                    <p className="mt-3 text-sm text-slate-500">Cargando reportes...</p>
                </div>
            ) : error ? (
                <GlassCard className="text-center">
                    <p className="text-red-600 text-sm">{error}</p>
                </GlassCard>
            ) : (
                <MisReportesList items={items} />
            )}
        </main>
    );
}