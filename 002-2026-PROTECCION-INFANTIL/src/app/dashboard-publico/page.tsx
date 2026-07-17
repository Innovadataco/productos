import type { Metadata } from "next";
import { PublicDashboard } from "@/components/modules/PublicDashboard";

export const metadata: Metadata = {
    title: "Dashboard público",
    description:
        "Estadísticas agregadas sobre identificadores reportados visibles públicamente: total de reportes, distribución por plataforma, nivel de riesgo y score promedio.",
    alternates: {
        canonical: "/dashboard-publico",
    },
    openGraph: {
        type: "website",
        url: "/dashboard-publico",
        title: "Dashboard público — Protección Infantil",
        description:
            "Estadísticas agregadas sobre identificadores reportados visibles públicamente.",
    },
};

export default function DashboardPublicoPage() {
    return (
        <main className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
            <PublicDashboard />
        </main>
    );
}
