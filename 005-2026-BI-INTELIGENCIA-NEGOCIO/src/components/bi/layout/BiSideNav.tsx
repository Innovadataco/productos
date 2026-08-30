"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Section = { label: string; href: string; emoji: string };

const SECTIONS: Section[] = [
    { label: "Home", href: "/dashboard", emoji: "🏠" },
    { label: "Dashboards", href: "/dashboard/dashboards", emoji: "📊" },
    { label: "Chat NL→SQL", href: "/chat", emoji: "💬" },
    { label: "Configuración", href: "/dashboard/configuracion", emoji: "⚙️" },
];

export function BiSideNav() {
    const pathname = usePathname();
    return (
        <nav aria-label="Navegación BI" className="p-4">
            <div className="mb-6">
                <p className="text-sm font-semibold text-slate-600">BI · IDC</p>
            </div>
            <ul className="space-y-1">
                {SECTIONS.map((s) => {
                    const isActive = pathname === s.href;
                    const base =
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors";
                    const cls = isActive
                        ? `${base} bg-sky-50 font-semibold text-sky-700`
                        : `${base} text-slate-700 hover:bg-slate-100`;
                    return (
                        <li key={s.href}>
                            <Link
                                href={s.href}
                                className={cls}
                                aria-current={isActive ? "page" : undefined}
                                data-testid={`sidenav-${s.href}`}
                            >
                                <span aria-hidden="true">{s.emoji}</span>
                                <span>{s.label}</span>
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
