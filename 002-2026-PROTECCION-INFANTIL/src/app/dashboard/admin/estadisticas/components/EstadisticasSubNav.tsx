"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { esDestinoPermitidoPorRol } from "@/lib/proxy";

/**
 * SPEC-179 (I-59): sub-nav del área Estadísticas del admin. Engancha los
 * tableros nuevos (Operación de SPEC-171, Motor de SPEC-172) a la navegación —
 * antes solo se alcanzaban por URL directa. Los hrefs literales se parsean en
 * `subnavsFijos()` (scripts/arch/lib/nav-fuentes.ts) para la aserción B.
 */
const tabs = [
    { href: "/dashboard/admin/estadisticas/operacion", label: "Operación" },
    { href: "/dashboard/admin/estadisticas/operacion?tab=clasificacion", label: "Clasificación" },
    { href: "/dashboard/admin/estadisticas/operacion?tab=logs", label: "Logs" },
    { href: "/dashboard/admin/estadisticas/operacion?tab=colegios", label: "Colegios" },
    { href: "/dashboard/admin/estadisticas/operacion?tab=sesiones", label: "Sesiones" },
    { href: "/dashboard/admin/estadisticas/motor", label: "Motor" },
    { href: "/dashboard/admin/estadisticas/salud-motor", label: "Salud motor" },
];

export function EstadisticasSubNav() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { user } = useAuth();

    const tabQuery = searchParams?.get("tab");
    const esTabClasificacion = pathname === "/dashboard/admin/estadisticas/operacion" && tabQuery === "clasificacion";
    const esTabLogs = pathname === "/dashboard/admin/estadisticas/operacion" && tabQuery === "logs";
    const esTabColegios = pathname === "/dashboard/admin/estadisticas/operacion" && tabQuery === "colegios";
    const esTabSesiones = pathname === "/dashboard/admin/estadisticas/operacion" && tabQuery === "sesiones";

    const visibles = tabs.filter((tab) => esDestinoPermitidoPorRol(user?.rol, tab.href.split("?")[0]));

    return (
        <nav className="mb-6 flex flex-wrap gap-2 border-b border-tinta/15 pb-3" aria-label="Secciones de estadísticas">
            {visibles.map((tab) => {
                let activo: boolean;
                if (tab.href.includes("?tab=clasificacion")) {
                    activo = esTabClasificacion;
                } else if (tab.href.includes("?tab=logs")) {
                    activo = esTabLogs;
                } else if (tab.href.includes("?tab=colegios")) {
                    activo = esTabColegios;
                } else if (tab.href.includes("?tab=sesiones")) {
                    activo = esTabSesiones;
                } else {
                    activo = pathname === tab.href && !esTabClasificacion && !esTabLogs && !esTabColegios && !esTabSesiones;
                }
                return (
                    <Link
                        key={tab.href}
                        href={tab.href}
                        aria-current={activo ? "page" : undefined}
                        className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                            activo ? "bg-pino text-white shadow" : "text-muted hover:bg-tinta/10 hover:text-body"
                        }`}
                    >
                        {tab.label}
                    </Link>
                );
            })}
        </nav>
    );
}
