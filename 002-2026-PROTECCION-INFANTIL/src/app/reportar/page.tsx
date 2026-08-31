import type { Metadata } from "next";
import { ReporteWizard } from "@/components/modules/ReporteWizard";
import { CanalesOficiales } from "@/components/modules/CanalesOficiales";

export const metadata: Metadata = {
    title: "Reportar",
    description:
        "Reporta de forma anónima o autenticada identificadores asociados a conductas de riesgo para menores en plataformas digitales.",
    alternates: {
        canonical: "/reportar",
    },
    openGraph: {
        type: "article",
        url: "/reportar",
        title: "Reportar — Protección Infantil",
        description:
            "Reporta identificadores asociados a conductas de riesgo para menores en plataformas digitales.",
    },
};

export default async function ReportarPage({
    searchParams,
}: {
    searchParams: Promise<{ identificador?: string }>;
}) {
    // F3 (N-5): el CTA del estado vacío de la consulta prellena el identificador
    // (sanitizado: máx 100 chars, igual que el límite del esquema de la API).
    const { identificador } = await searchParams;
    const identificadorInicial = typeof identificador === "string" ? identificador.slice(0, 100) : undefined;
    // SPEC-324: el CTA "reportar de nuevo a este identificador" de /seguimiento
    // NO pasa por acá — su identificador llega por sessionStorage y lo lee el
    // propio wizard, porque no puede quedar en la URL (spec 091-US2 / 093-US4).

    return (
        <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
            <div className="mb-8 text-center">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                    Reporta una situación de riesgo
                </h1>
                <p className="mt-2 text-sm text-slate-600">
                    Tu reporte es anónimo y nos ayuda a prevenir riesgos para menores. Completa los pasos con calma.
                </p>
            </div>

            <ReporteWizard identificadorInicial={identificadorInicial} />
            <CanalesOficiales />
        </main>
    );
}