import { Suspense } from "react";
import { IaDocsPanel } from "@/components/modules/ia/IaDocsPanel";
import { IaPlayground } from "@/components/modules/ia/IaPlayground";
import { IaModelSelector } from "@/components/modules/ia/IaModelSelector";
import { IaEvalManager } from "@/components/modules/ia/IaEvalManager";
import { RubricaTab } from "@/components/modules/ia/RubricaTab";
import ConfigPanel from "@/components/modules/ConfigPanel";
import type { SandboxOverrides } from "@/lib/ai/sandbox";
import { IA_TABS } from "@/lib/nav-items";
import { esDestinoPermitidoPorRol } from "@/lib/proxy";
import { modulosPermitidosParaRol, verificarAccesoPagina } from "@/lib/permisos-modulos";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";

interface PageProps {
    searchParams: Promise<{ tab?: string } & Record<string, string | undefined>>;
}

function parseOverrides(params: Record<string, string | undefined>): SandboxOverrides {
    const overrides: SandboxOverrides = {};
    const keys: (keyof Pick<SandboxOverrides, "temperatura" | "umbral_presencia" | "rag_top_k">)[] = [
        "temperatura",
        "umbral_presencia",
        "rag_top_k",
    ];
    for (const key of keys) {
        const raw = params[key];
        if (raw === undefined) continue;
        const num = parseFloat(raw);
        if (Number.isFinite(num)) overrides[key] = num;
    }
    if (params.modelos) {
        try {
            const parsed = JSON.parse(params.modelos);
            if (Array.isArray(parsed) && parsed.every((m) => typeof m === "string" && m.length > 0)) {
                overrides.modelos = parsed;
            }
        } catch {
            // Ignorar JSON inválido
        }
    }
    return overrides;
}

export default async function CentroControlIAPage({ searchParams }: PageProps) {
    const acceso = await verificarAccesoPagina("centro_control_ia");
    if (!acceso.permitido || !acceso.rol) {
        return <SinAccesoModulo />;
    }

    // Tabs filtradas por submódulo (spec 086, corrección 3) ∧ predicado del proxy
    // (D-41, SPEC-126: la puerta tiene la última palabra sobre si se pinta).
    const permitidos = await modulosPermitidosParaRol(acceso.rol);
    const tabsVisibles = IA_TABS.filter(
        (t) => (t.modulo === null || permitidos.has(t.modulo)) && esDestinoPermitidoPorRol(acceso.rol, "/dashboard/admin/ia")
    );

    const params = await searchParams;
    const activeTab = tabsVisibles.some((t) => t.key === params.tab) ? params.tab! : (tabsVisibles[0]?.key ?? "documentacion");
    const initialOverrides = parseOverrides(params);

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-body">Centro de Control IA</h1>
                    <p className="text-sm text-muted">Explorá, probá y ajustá el pipeline de clasificación sin afectar datos reales.</p>
                </div>
                <span className="self-start rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-800 dark:bg-sky-950/50 dark:text-sky-300">
                    Solo admins
                </span>
            </div>

            <div className="border-b border-slate-200 dark:border-slate-700">
                <nav className="-mb-px flex gap-6" aria-label="Tabs">
                    {tabsVisibles.map((tab) => {
                        const isActive = activeTab === tab.key;
                        return (
                            <a
                                key={tab.key}
                                href={`/dashboard/admin/ia?tab=${tab.key}`}
                                className={`inline-flex items-center border-b-2 px-1 py-3 text-sm font-medium transition ${
                                    isActive
                                        ? "border-sky-500 text-sky-600 dark:border-cyan-400 dark:text-cyan-400"
                                        : "border-transparent text-muted hover:border-slate-300 hover:text-body dark:hover:border-slate-600"
                                }`}
                            >
                                {tab.label}
                            </a>
                        );
                    })}
                </nav>
            </div>

            <Suspense fallback={<div className="text-muted">Cargando...</div>}>
                {activeTab === "documentacion" && <IaDocsPanel />}
                {activeTab === "playground" && (
                    <div className="space-y-6">
                        <IaModelSelector />
                        <IaPlayground initialOverrides={initialOverrides} />
                    </div>
                )}
                {activeTab === "simulacion" && <IaEvalManager />}
                {activeTab === "rubrica" && <RubricaTab />}
                {activeTab === "configuracion" && <ConfigPanel />}
            </Suspense>
        </div>
    );
}
