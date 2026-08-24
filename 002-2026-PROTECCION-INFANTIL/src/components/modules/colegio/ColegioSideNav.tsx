"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState } from "react";
import { COLEGIO_NAV_ITEMS, COMITE_COLEGIO_NAV_ITEMS } from "@/lib/nav-items";
import type { NavItem } from "@/lib/nav-items";
import { esDestinoPermitidoPorRol } from "@/lib/proxy";

/**
 * SPEC-129 (C3): navegación lateral del área del colegio, patrón AdminNav
 * (menú vertical limpio, estado activo, filtro D-41: módulo ∧ predicado).
 * Reemplaza a ColegioNav (tabs horizontales + acciones sueltas).
 * "Cambiar contraseña" y "Cerrar sesión" viven SOLO en el menú del header.
 * SPEC-173 (FASE-C): el rol COMITE_CONVIVENCIA usa su propio menú reducido
 * (COMITE_COLEGIO_NAV_ITEMS) y el rector tiene un nodo expandible "Usuarios".
 */
export function ColegioSideNav({ rol, modulosPermitidos }: { rol: string; modulosPermitidos: string[] }) {
    const pathname = usePathname();
    const permitidos = new Set(modulosPermitidos);
    const items = rol === "COMITE_CONVIVENCIA" ? COMITE_COLEGIO_NAV_ITEMS : COLEGIO_NAV_ITEMS;
    // La raíz del menú (primer ítem) solo se marca activa con match exacto; si no,
    // coincidiría con TODAS las subrutas (misma regla que AdminNav).
    const raiz = items[0]?.href;
    const esVisible = (item: NavItem) => permitidos.has(item.modulo) && esDestinoPermitidoPorRol(rol, item.href);
    const esActivo = (href: string) =>
        pathname === href || (href !== raiz && (pathname?.startsWith(href + "/") ?? false));

    return (
        <nav className="hidden w-64 flex-shrink-0 flex-col border-r border-emerald-200/40 bg-emerald-50/50 backdrop-blur-xl sm:flex dark:border-emerald-900/30 dark:bg-emerald-950/20">
            <div className="border-b border-emerald-200/40 p-6 dark:border-emerald-900/30">
                <h1 className="text-lg font-bold text-body">Mi colegio</h1>
                <p className="mt-1 text-xs text-subtle">Panel institucional</p>
            </div>
            <ul className="flex-1 space-y-1 p-3">
                {items.map((item) => {
                    if (item.children) {
                        const hijos = item.children.filter(esVisible);
                        if (!permitidos.has(item.modulo) || hijos.length === 0) return null;
                        return <GrupoExpandible key={item.label} item={item} hijos={hijos} esActivo={esActivo} />;
                    }
                    if (!esVisible(item)) return null;
                    const Icon = ICONS[item.href] ?? InicioIcon;
                    const active = esActivo(item.href);
                    return (
                        <li key={item.href}>
                            <Link
                                href={item.href}
                                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                                    active
                                        ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/25"
                                        : "text-emerald-900/70 hover:bg-emerald-100 hover:text-emerald-900 dark:text-emerald-200/70 dark:hover:bg-emerald-900/40 dark:hover:text-emerald-100"
                                }`}
                                aria-current={active ? "page" : undefined}
                            >
                                <Icon className="h-4 w-4" />
                                {item.label}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}

/**
 * Nodo padre expandible ("Usuarios"): botón con aria-expanded/aria-controls e
 * hijos indentados. Auto-expandido cuando la ruta activa cae en un hijo
 * (profesores o integrantes del comité); el toggle del usuario tiene prioridad.
 */
function GrupoExpandible({
    item,
    hijos,
    esActivo,
}: {
    item: NavItem;
    hijos: NavItem[];
    esActivo: (href: string) => boolean;
}) {
    const idLista = useId();
    const [toggleUsuario, setToggleUsuario] = useState<boolean | null>(null);
    const abierto = toggleUsuario ?? hijos.some((hijo) => esActivo(hijo.href));
    const IconPadre = ICONS[item.href] ?? UsuariosIcon;

    return (
        <li>
            <button
                type="button"
                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-emerald-900/70 transition hover:bg-emerald-100 hover:text-emerald-900 dark:text-emerald-200/70 dark:hover:bg-emerald-900/40 dark:hover:text-emerald-100"
                aria-expanded={abierto}
                aria-controls={idLista}
                onClick={() => setToggleUsuario(!abierto)}
            >
                <IconPadre className="h-4 w-4" />
                {item.label}
                <ChevronIcon className={`ml-auto h-3 w-3 transition-transform ${abierto ? "rotate-180" : ""}`} />
            </button>
            {abierto && (
                <ul id={idLista} className="mt-1 space-y-1">
                    {hijos.map((hijo) => {
                        const Icon = ICONS[hijo.href] ?? InicioIcon;
                        const active = esActivo(hijo.href);
                        return (
                            <li key={hijo.href}>
                                <Link
                                    href={hijo.href}
                                    className={`flex items-center gap-3 rounded-xl py-2.5 pl-11 pr-4 text-sm font-semibold transition ${
                                        active
                                            ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/25"
                                            : "text-emerald-900/70 hover:bg-emerald-100 hover:text-emerald-900 dark:text-emerald-200/70 dark:hover:bg-emerald-900/40 dark:hover:text-emerald-100"
                                    }`}
                                    aria-current={active ? "page" : undefined}
                                >
                                    <Icon className="h-4 w-4" />
                                    {hijo.label}
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            )}
        </li>
    );
}

const ICONS: Record<string, (props: { className?: string }) => React.JSX.Element> = {
    "/dashboard/colegio": InicioIcon,
    "/dashboard/colegio/cursos": CursosIcon,
    "/dashboard/colegio/profesores": ProfesoresIcon,
    "/dashboard/colegio/alertas": AlertasIcon,
    "/dashboard/colegio/estadisticas": EstadisticasIcon,
    "/dashboard/colegio/configuracion": ConfiguracionIcon,
    "/dashboard/colegio/auditoria": AuditoriaIcon,
    "#": UsuariosIcon,
    "/dashboard/colegio/comite": ComiteIcon,
    "/dashboard/colegio/comite/casos": ComiteCasosIcon,
    "/dashboard/colegio/comite/integrantes": ComiteIntegrantesIcon,
    "/dashboard/colegio/comite/estadisticas": ComiteEstadisticasIcon,
    // SPEC-211 (002-PI-111): ícono del ítem Suscripción (tarjeta, igual que el área padre).
    "/dashboard/colegio/suscripcion": SuscripcionIcon,
};

function SuscripcionIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
        </svg>
    );
}

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

function ProfesoresIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
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

function ConfiguracionIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
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

function UsuariosIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
    );
}

function ComiteIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
        </svg>
    );
}

function ComiteCasosIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
        </svg>
    );
}

function ComiteIntegrantesIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 019.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
        </svg>
    );
}

function ComiteEstadisticasIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
        </svg>
    );
}

function ChevronIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
    );
}
