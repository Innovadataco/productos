import { Suspense } from "react";
import type { Metadata } from "next";
import { SeguimientoClient } from "@/components/modules/SeguimientoClient";
import { Cargando } from "@/components/ui/Cargando";

export const metadata: Metadata = {
    title: "Seguimiento",
    description:
        "Consulta el estado de un reporte comunitario con su número de seguimiento en Protección Infantil.",
    alternates: {
        canonical: "/seguimiento",
    },
    robots: {
        index: false,
        follow: true,
    },
    openGraph: {
        type: "article",
        url: "/seguimiento",
        title: "Seguimiento de reporte — Protección Infantil",
        description:
            "Consulta el estado de un reporte comunitario con su número de seguimiento.",
    },
};

export default function SeguimientoPage() {
    return (
        <Suspense
            fallback={
                <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
                    <div className="glass rounded-2xl p-8 text-center">
                        <Cargando />
                    </div>
                </main>
            }
        >
            <SeguimientoClient />
        </Suspense>
    );
}
