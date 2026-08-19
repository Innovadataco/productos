"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { COMITE_NAV_TABS } from "@/lib/nav-items";
import { esDestinoPermitidoPorRol } from "@/lib/proxy";

// D-41 (SPEC-126, decisión ZEUS): ningún menú decide permisos por su cuenta.
// El módulo de BD decide QUÉ se ofrece y el predicado del proxy tiene la ÚLTIMA
// palabra sobre si se pinta (misma regla que NavHeader.tsx: esDestinoPermitidoPorRol
// con el rol del usuario; aquí el rol llega del padre servidor, que lo deriva del
// mismo JWT del que salen los módulos). Sin esto, un COMITE_VALIDACION con los
// módulos "comite"/"comite_auditoria" veía tabs que la puerta redirige (I-39).
export function ComiteSubNav({ rol, modulosPermitidos }: { rol: string; modulosPermitidos: string[] }) {
    const pathname = usePathname();
    const permitidos = new Set(modulosPermitidos);
    const visibleTabs = COMITE_NAV_TABS.filter(
        (tab) => permitidos.has(tab.modulo) && esDestinoPermitidoPorRol(rol, tab.href)
    );
    return (
        <nav className="mb-6 flex min-h-[52px] flex-wrap items-start gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
            {visibleTabs.map((tab) => {
                const active = pathname === tab.href || pathname?.startsWith(tab.href + "/");
                return (
                    <Link
                        key={tab.href}
                        href={tab.href}
                        className={`inline-flex min-h-9 items-center rounded-lg px-4 py-2 text-sm font-semibold transition ${
                            active
                                ? "bg-pino text-white shadow"
                                : "text-muted hover:bg-slate-100 hover:text-body dark:hover:bg-slate-800/60"
                        }`}
                    >
                        {tab.label}
                    </Link>
                );
            })}
        </nav>
    );
}
