"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
    { href: "/dashboard/admin/operadores/asignar", label: "Asignar" },
    { href: "/dashboard/admin/operadores/gestion", label: "Gestión" },
    { href: "/dashboard/admin/operadores/modelo", label: "Modelo de asignación" },
    { href: "/dashboard/admin/operadores/auditoria", label: "Auditoría" },
];

export function OperadoresSubNav() {
    const pathname = usePathname();
    return (
        <nav className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            {tabs.map((tab) => {
                const active = pathname === tab.href || pathname?.startsWith(tab.href + "/");
                return (
                    <Link
                        key={tab.href}
                        href={tab.href}
                        className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                            active
                                ? "bg-accent text-white shadow"
                                : "text-muted hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-body"
                        }`}
                    >
                        {tab.label}
                    </Link>
                );
            })}
        </nav>
    );
}
