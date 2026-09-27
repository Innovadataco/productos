import type { Metadata } from "next";
import { PublicDashboard } from "@/components/modules/PublicDashboard";

export const metadata: Metadata = {
    // SPEC-743: el título casa con el rótulo del enlace del menú («Estadísticas públicas»),
    // antes «Dashboard público» (techie, y no coincidía con cómo se nombra el destino).
    title: "Estadísticas públicas",
    description:
        "Estadísticas agregadas sobre cuentas reportadas visibles públicamente: total de reportes y distribución por plataforma, país y categoría.",
    alternates: {
        canonical: "/dashboard-publico",
    },
    openGraph: {
        type: "website",
        url: "/dashboard-publico",
        title: "Estadísticas públicas — Protección Infantil",
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
