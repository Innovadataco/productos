"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { COLEGIO_NAV_ITEMS } from "@/lib/nav-items";
import { esDestinoPermitidoPorRol } from "@/lib/proxy";

/**
 * SPEC-129 (C3): navegación lateral del área del colegio, patrón AdminNav
 * (menú vertical limpio, estado activo, filtro D-41: módulo ∧ predicado).
 * Reemplaza a ColegioNav (tabs horizontales + acciones sueltas).
 * "Cambiar contraseña" y "Cerrar sesión" viven SOLO en el menú del header.
 */
export function ColegioSideNav({ rol, modulosPermitidos }: { rol: string; modulosPermitidos: string[] }) {
    const pathname = usePathname();
    const permitidos = new Set(modulosPermitidos);
    const links = COLEGIO_NAV_ITEMS.filter(
        (item) => permitidos.has(item.modulo) && esDestinoPermitidoPorRol(rol, item.href)
    ).map((item) => ({ ...item, icon: ICONS[item.href] ?? InicioIcon }));

    return (
        <nav className="hidden w-64 flex-shrink-0 flex-col border-r border-emerald-200/40 bg-emerald-50/50 backdrop-blur-xl sm:flex dark:border-emerald-900/30 dark:bg-emerald-950/20">
            <div className="border-b border-emerald-200/40 p-6 dark:border-emerald-900/30">
                <h1 className="text-lg font-bold text-body">Mi colegio</h1>
                <p className="mt-1 text-xs text-subtle">Panel institucional</p>
            </div>
            <ul className="flex-1 space-y-1 p-3">
                {links.map((link) => {
                    // La raíz ("/dashboard/colegio") solo activa con match exacto; si no,
                    // coincidiría con TODAS las subrutas (misma regla que AdminNav).
                    const active =
                        pathname === link.href ||
                        (link.href !== "/dashboard/colegio" && (pathname?.startsWith(link.href + "/") ?? false));
                    return (
                        <li key={link.href}>
                            <Link
                                href={link.href}
                                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                                    active
                                        ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/25"
                                        : "text-emerald-900/70 hover:bg-emerald-100 hover:text-emerald-900 dark:text-emerald-200/70 dark:hover:bg-emerald-900/40 dark:hover:text-emerald-100"
                                }`}
                                aria-current={active ? "page" : undefined}
                            >
                                <link.icon className="h-4 w-4" />
                                {link.label}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}

const ICONS: Record<string, (props: { className?: string }) => React.JSX.Element> = {
    "/dashboard/colegio": InicioIcon,
    "/dashboard/colegio/cursos": CursosIcon,
    "/dashboard/colegio/cursos/unificado": CargaIcon,
    "/dashboard/colegio/alertas": AlertasIcon,
    "/dashboard/colegio/estadisticas": EstadisticasIcon,
    "/dashboard/colegio/auditoria": AuditoriaIcon,
};

function InicioIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.125 1.125 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
        </svg>
    );
}

function CursosIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
        </svg>
    );
}

function CargaIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
    );
}

function AlertasIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
    );
}

function EstadisticasIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
    );
}

function AuditoriaIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
    );
}
