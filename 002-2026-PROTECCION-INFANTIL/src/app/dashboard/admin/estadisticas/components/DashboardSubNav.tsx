"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
    { href: "/dashboard/admin/estadisticas/operacion", label: "Operación" },
    { href: "/dashboard/admin/estadisticas/clasificacion", label: "Clasificación" },
];

export function DashboardSubNav() {
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
