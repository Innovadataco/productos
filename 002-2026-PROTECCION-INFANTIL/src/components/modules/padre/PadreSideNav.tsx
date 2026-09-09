"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PADRE_NAV_ITEMS, type PadreNavItem } from "@/lib/nav-items";

/**
 * SPEC-231 (002-PI-131): navegación lateral del área del padre, patrón
 * ColegioSideNav/AdminNav (menú vertical limpio, estado activo, color cielo).
 * El área padre no usa permisos granulares por módulo: el proxy controla por rol.
 *
 * SPEC-607 (diseño final, design/expediente-final-mockup.html): 6 entradas;
 * «Reportar» y «Ayuda profesional» son grupos colapsables con chevron que
 * nacen EXPANDIDOS (la acción crítica queda a un clic, I-38). Cuando la ruta
 * activa cae dentro de un grupo, el padre se pinta en cielo y el hijo activo
 * lleva la pastilla llena.
 */
export function PadreSideNav() {
    const pathname = usePathname();
    const raiz = PADRE_NAV_ITEMS[0]?.href;
    const esActivo = (href: string) =>
        href !== "#" && (pathname === href || (href !== raiz && (pathname?.startsWith(href + "/") ?? false)));
    const grupoConActivo = (item: PadreNavItem) => (item.children ?? []).some((hijo) => esActivo(hijo.href));

    // Los grupos nacen expandidos; acá solo se guarda cuál colapsó el usuario.
    const [colapsados, setColapsados] = useState<string[]>([]);
    const alternar = (label: string) =>
        setColapsados((lista) => (lista.includes(label) ? lista.filter((l) => l !== label) : [...lista, label]));

    return (
        <nav className="hidden w-64 flex-shrink-0 flex-col border-r border-cielo/20 bg-cielo/5 backdrop-blur-xl sm:flex">
            <div className="border-b border-cielo/20 p-6">
                <h1 className="text-lg font-bold text-body">Mi protección</h1>
                <p className="mt-1 text-xs text-subtle">Área del padre</p>
            </div>
            <ul className="flex-1 space-y-1 p-3">
                {PADRE_NAV_ITEMS.map((item, indice) => {
                    const Icon = ICONS[item.label] ?? InicioIcon;
                    if (!item.children) {
                        const active = esActivo(item.href);
                        return (
                            <li key={item.label}>
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
                    }

                    const expandido = !colapsados.includes(item.label);
                    const conActivo = grupoConActivo(item);
                    const panelId = `padre-nav-grupo-${indice}`;
                    return (
                        <li key={item.label}>
                            <button
                                type="button"
                                aria-expanded={expandido}
                                aria-controls={panelId}
                                onClick={() => alternar(item.label)}
                                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                                    conActivo ? "text-cielo" : "text-muted hover:bg-cielo/10 hover:text-cielo"
                                }`}
                            >
                                <Icon className="h-4 w-4" />
                                <span className="flex-1 text-left">{item.label}</span>
                                <svg
                                    className={`h-3.5 w-3.5 transition-transform ${expandido ? "rotate-180" : ""}`}
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                    viewBox="0 0 24 24"
                                    aria-hidden="true"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                                </svg>
                            </button>
                            {expandido && (
                                <ul id={panelId} className="ml-5 space-y-1 border-l border-cielo/20 pl-3">
                                    {item.children.map((hijo) => {
                                        const active = esActivo(hijo.href);
                                        return (
                                            <li key={hijo.href}>
                                                <Link
                                                    href={hijo.href}
                                                    className={`block rounded-xl px-3 py-2 text-sm font-medium transition ${
                                                        active
                                                            ? "bg-cielo text-white shadow-lg shadow-cielo/25"
                                                            : "text-muted hover:bg-cielo/10 hover:text-cielo"
                                                    }`}
                                                    aria-current={active ? "page" : undefined}
                                                >
                                                    {hijo.label}
                                                </Link>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}

const ICONS: Record<string, (props: { className?: string }) => React.JSX.Element> = {
    "Inicio": InicioIcon,
    "A quién protejo": ProtejoIcon,
    "A quién vigilo": VigiloIcon,
    "Reportar": ReportarIcon,
    "Ayuda profesional": AyudaIcon,
    "Mi perfil": PerfilIcon,
};

function InicioIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.125 1.125 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
        </svg>
    );
}

function ProtejoIcon({ className }: { className?: string }) {
    // SPEC-607: ícono de personas (el menor y su círculo familiar).
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
    );
}

function VigiloIcon({ className }: { className?: string }) {
    // SPEC-607: ícono de ojo (las cuentas que el padre vigila).
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
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

function AyudaIcon({ className }: { className?: string }) {
    // SPEC-607: ícono de corazón (ayuda profesional), como en el diseño aprobado.
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
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
