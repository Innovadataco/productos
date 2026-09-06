import type { Metadata } from "next";
import { PublicDashboard } from "@/components/modules/PublicDashboard";

export const metadata: Metadata = {
    title: "Dashboard público",
    description:
        "Estadísticas agregadas sobre cuentas reportadas visibles públicamente: total de reportes y distribución por plataforma, país y categoría.",
    alternates: {
        canonical: "/dashboard-publico",
    },
    openGraph: {
        type: "website",
        url: "/dashboard-publico",
        title: "Dashboard público — Protección Infantil",
        description:
            "Estadísticas agregadas sobre cuentas reportadas visibles públicamente.",
    },
};

export default function DashboardPublicoPage() {
    return (
        <main className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
            <PublicDashboard />
        </main>
    );
}
