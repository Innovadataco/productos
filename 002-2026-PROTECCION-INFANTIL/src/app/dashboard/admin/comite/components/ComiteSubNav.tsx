"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { RolUsuario } from "@prisma/client";

const tabs = [
    { href: "/dashboard/admin/comite", label: "Bandeja" },
    { href: "/dashboard/admin/comite/gestion", label: "Gestión" },
    { href: "/dashboard/admin/comite/auditoria", label: "Auditoría" },
];

const ADMIN_COMITE_TABS = new Set(["/dashboard/admin/comite/gestion", "/dashboard/admin/comite/auditoria"]);

function puedeVerTab(rol: RolUsuario, href: string) {
    if (rol === "SCHOOL_ADMIN") return false;
    if (rol === "ADMIN") return true;
    return !ADMIN_COMITE_TABS.has(href);
}

export function ComiteSubNav({ rol }: { rol: RolUsuario }) {
    const pathname = usePathname();
    const visibleTabs = tabs.filter((tab) => puedeVerTab(rol, tab.href));
    return (
        <nav className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
            {visibleTabs.map((tab) => {
                const active = pathname === tab.href || pathname?.startsWith(tab.href + "/");
                return (
                    <Link
                        key={tab.href}
                        href={tab.href}
                        className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                            active
                                ? "bg-accent text-white shadow"
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
