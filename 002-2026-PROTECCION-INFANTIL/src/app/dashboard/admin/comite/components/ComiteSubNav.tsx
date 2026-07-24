"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { COMITE_NAV_TABS } from "@/lib/nav-items";

export function ComiteSubNav({ modulosPermitidos }: { modulosPermitidos: string[] }) {
    const pathname = usePathname();
    const permitidos = new Set(modulosPermitidos);
    const visibleTabs = COMITE_NAV_TABS.filter((tab) => permitidos.has(tab.modulo));
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
