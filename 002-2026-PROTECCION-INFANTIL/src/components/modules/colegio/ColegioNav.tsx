"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
    { href: "/dashboard/colegio", label: "Inicio" },
    { href: "/dashboard/colegio/cursos", label: "Cursos" },
    { href: "/dashboard/colegio/cursos/carga", label: "Carga masiva" },
    { href: "/dashboard/colegio/alertas", label: "Alertas" },
    { href: "/dashboard/colegio/estadisticas", label: "Estadísticas" },
    { href: "/dashboard/colegio/auditoria", label: "Auditoría" },
];

export function ColegioNav() {
    const pathname = usePathname();

    return (
        <nav className="border-b border-emerald-200/30 bg-emerald-50/40 dark:border-emerald-900/30 dark:bg-emerald-950/20">
            <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
                <div className="flex gap-1 overflow-x-auto py-3">
                    {navItems.map((item) => {
                        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition ${
                                    active
                                        ? "bg-emerald-600 text-white shadow-sm"
                                        : "text-emerald-800 hover:bg-emerald-100 dark:text-emerald-200 dark:hover:bg-emerald-900/40"
                                }`}
                                aria-current={active ? "page" : undefined}
                            >
                                {item.label}
                            </Link>
                        );
                    })}
                </div>
            </div>
        </nav>
    );
}
