"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
    { href: "/dashboard/admin", label: "Bandeja de reportes" },
    { href: "/dashboard/admin/estadisticas", label: "Dashboard" },
];

export function AdminNav() {
    const pathname = usePathname();

    return (
        <nav className="w-64 flex-shrink-0 border-r border-white/20 bg-white/70 backdrop-blur-lg">
            <div className="p-6 border-b border-white/20">
                <h1 className="text-lg font-bold text-slate-800">Administración</h1>
                <p className="text-xs text-slate-500 mt-1">Protección infantil</p>
            </div>
            <ul className="p-3 space-y-1">
                {links.map((link) => {
                    const active = pathname === link.href || pathname?.startsWith(link.href + "/");
                    return (
                        <li key={link.href}>
                            <Link
                                href={link.href}
                                className={`block rounded-xl px-4 py-3 text-sm font-medium transition ${active
                                    ? "bg-primary-600 text-white shadow-md"
                                    : "text-slate-600 hover:bg-white/60 hover:text-slate-900"
                                    }`}
                            >
                                {link.label}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
