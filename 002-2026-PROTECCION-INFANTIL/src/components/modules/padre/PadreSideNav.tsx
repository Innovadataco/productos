"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PADRE_NAV_ITEMS } from "@/lib/nav-items";

/**
 * SPEC-231 (002-PI-131): navegación lateral del área del padre, patrón
 * ColegioSideNav/AdminNav (menú vertical limpio, estado activo, color cielo).
 * Los 7 items son planos (sin grupos expandibles) y siempre visibles: el área
 * padre no usa permisos granulares por módulo en v1; el proxy controla por rol.
 */
export function PadreSideNav() {
    const pathname = usePathname();
    const raiz = PADRE_NAV_ITEMS[0]?.href;
    const esActivo = (href: string) =>
        pathname === href || (href !== raiz && (pathname?.startsWith(href + "/") ?? false));

    return (
        <nav className="hidden w-64 flex-shrink-0 flex-col border-r border-cielo/20 bg-cielo/5 backdrop-blur-xl sm:flex">
            <div className="border-b border-cielo/20 p-6">
                <h1 className="text-lg font-bold text-body">Mi protección</h1>
                <p className="mt-1 text-xs text-subtle">Área del padre</p>
            </div>
            <ul className="flex-1 space-y-1 p-3">
                {PADRE_NAV_ITEMS.map((item) => {
                    const Icon = ICONS[item.href] ?? InicioIcon;
                    const active = esActivo(item.href);
                    return (
                        <li key={item.href}>
                            <Link
                                href={item.href}
                                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                                    active
                                        ? "bg-cielo text-white shadow-lg shadow-cielo/25"
                                        : "text-muted hover:bg-cielo/10 hover:text-cielo"
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

const ICONS: Record<string, (props: { className?: string }) => React.JSX.Element> = {
    "/dashboard/padre": InicioIcon,
    "/dashboard/padre/expedientes": ExpedientesIcon,
    "/mis-reportes": MisReportesIcon, // SPEC-324
    "/dashboard/padre/reportar": ReportarIcon,
    "/dashboard/padre/suscripcion": SuscripcionIcon,
    "/dashboard/padre/circulo-confianza": CirculoConfianzaIcon,
    "/dashboard/padre/notificaciones": NotificacionesIcon,
    "/dashboard/padre/perfil": PerfilIcon,
};

function InicioIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.125 1.125 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
        </svg>
    );
}

function ExpedientesIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V6A2.25 2.25 0 014.5 3.75h15A2.25 2.25 0 0121.75 6v6.75m-19.5 0v6A2.25 2.25 0 004.5 21h15a2.25 2.25 0 002.25-2.25v-6m-19.5 0h19.5" />
        </svg>
    );
}

function MisReportesIcon({ className }: { className?: string }) {
    // SPEC-324: ícono de "lista de documentos" — distinto de Inicio/Expedientes.
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
        </svg>
    );
}

function ReportarIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
        </svg>
    );
}

function SuscripcionIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
        </svg>
    );
}

function CirculoConfianzaIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
        </svg>
    );
}

function NotificacionesIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
    );
}

function PerfilIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0z" />
        </svg>
    );
}
