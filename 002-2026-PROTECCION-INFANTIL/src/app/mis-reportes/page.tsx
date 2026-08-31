"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { MisReportesList } from "@/components/modules/MisReportesList";
import { GlassCard } from "@/components/ui/GlassCard";
import { ErrorState } from "@/components/ui/ErrorState";
import { Cargando } from "@/components/ui/Cargando";
import { homeParaRol } from "@/lib/auth/home-para-rol";

// SPEC-319: roles con panel propio que NO deben ver la lista de reportes del padre.
// Este es un GUARD por lista explícita, NO la fuente única de landing: `/mis-reportes`
// es una página legítima del PARENT (su lista de reportes), así que PARENT NO se
// incluye — entra sin rebote. Ojo: NO derivar la condición de `homeParaRol(rol) !==`
// ruta actual, porque bajo Decisión A (PARENT→/dashboard/padre) eso expulsaría al
// padre de su propia página y loopearía a un rol desconocido (cuyo default ES
// /mis-reportes). Condición = esta lista; destino = homeParaRol(rol).
const ROLES_CON_PANEL_PROPIO = ["ADMIN", "OPERADOR", "COMITE_VALIDACION", "SCHOOL_ADMIN", "COMITE_CONVIVENCIA"];

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
    ranking: { totalReportes: number } | null;
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

        // SPEC-319: rebote de roles con panel propio (incl. COMITE_CONVIVENCIA, que
        // antes faltaba y por eso el comité se quedaba acá y disparaba el fetch de
        // padre → 403 → ErrorState). PARENT no está en la lista: ve su lista de reportes.
        if (ROLES_CON_PANEL_PROPIO.includes(user.rol)) {
            router.push(homeParaRol(user.rol));
            return;
        }

        setIsLoading(true);
        setError("");
        fetch("/api/reportes/mis-reportes?page=1&pageSize=25", { credentials: "include" })
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
            <main className="mx-auto max-w-3xl px-4 py-12 text-center">
                <Cargando />
            </main>
        );
    }

    return (
        <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-body">Mis reportes</h1>
                <p className="mt-1 text-sm text-muted">Consulta el estado de los reportes que has realizado.</p>
            </div>

            {isLoading ? (
                <div className="glass rounded-2xl p-8 text-center animate-pulse">
                    <Cargando texto="Cargando reportes..." />
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
        </main>
    );
}
