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
    searchParams: Promise<{ identificador?: string; bloqueado?: string }>;
}) {
    // F3 (N-5): el CTA del estado vacío de la consulta prellena el identificador
    // (sanitizado: máx 100 chars, igual que el límite del esquema de la API).
    const { identificador, bloqueado } = await searchParams;
    const identificadorInicial = typeof identificador === "string" ? identificador.slice(0, 100) : undefined;
    // SPEC-324: `?bloqueado=1` viene del CTA "reportar de nuevo a este
    // identificador" de /seguimiento. Es una garantía de UX (que el evento quede
    // pegado al mismo identificador), no un control de seguridad: el backend
    // valida el identificador que reciba, venga como venga.
    const identificadorBloqueado = bloqueado === "1" && Boolean(identificadorInicial);

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

            <ReporteWizard
                identificadorInicial={identificadorInicial}
                identificadorBloqueado={identificadorBloqueado}
            />
            <CanalesOficiales />
        </main>
    );
}