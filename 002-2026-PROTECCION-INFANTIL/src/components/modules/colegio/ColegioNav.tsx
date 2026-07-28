"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { COLEGIO_NAV_ITEMS } from "@/lib/nav-items";
import { ColegioLogoutButton } from "@/components/modules/ColegioLogoutButton";

export function ColegioNav({ modulosPermitidos }: { modulosPermitidos: string[] }) {
    const pathname = usePathname();
    const permitidos = new Set(modulosPermitidos);
    const navItems = COLEGIO_NAV_ITEMS.filter((item) => permitidos.has(item.modulo));

    return (
        <nav className="border-b border-emerald-200/30 bg-emerald-50/40 dark:border-emerald-900/30 dark:bg-emerald-950/20">
            <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
                <div className="flex items-center gap-1 py-3">
                    <div className="flex flex-1 gap-1 overflow-x-auto">
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
                    <div className="flex items-center gap-1">
                        {/* I-33 (SPEC-108): acceso a cambio de contraseña desde el panel del colegio */}
                        <Link
                            href="/cambiar-password"
                            className="whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium text-emerald-800 transition hover:bg-emerald-100 dark:text-emerald-200 dark:hover:bg-emerald-900/40"
                        >
                            Cambiar contraseña
                        </Link>
                        <ColegioLogoutButton label="Cerrar sesión" className="whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/30" />
                    </div>
                </div>
            </div>
        </nav>
    );
}
