"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
    { href: "/dashboard/admin/usuarios", label: "Padres" },
    { href: "/dashboard/admin/usuarios/rectores", label: "Rectores" },
    { href: "/dashboard/admin/usuarios/operadores", label: "Operadores" },
    { href: "/dashboard/admin/usuarios/comite", label: "Comité" },
    { href: "/dashboard/admin/usuarios/admins", label: "Admins" },
];

export function UsuariosSubNav() {
    const pathname = usePathname();

    return (
        <nav className="mb-6 flex flex-wrap gap-2 border-b border-tinta/15 pb-3" aria-label="Secciones de usuarios">
            {tabs.map((tab) => {
                const activo = pathname === tab.href;
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
