"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type RolNav = "ADMIN" | "SCHOOL_ADMIN" | "OPERADOR" | "COMITE_VALIDACION";

const allLinks = [
    { href: "/dashboard/admin", label: "Bandeja de reportes", icon: InboxIcon, roles: ["ADMIN", "SCHOOL_ADMIN", "OPERADOR"] as RolNav[] },
    { href: "/dashboard/admin/comite", label: "Comité", icon: ScaleIcon, roles: ["ADMIN", "SCHOOL_ADMIN", "COMITE_VALIDACION"] as RolNav[] },
    { href: "/dashboard/admin/estadisticas", label: "Dashboard", icon: ChartIcon, roles: ["ADMIN", "SCHOOL_ADMIN"] as RolNav[] },
    { href: "/dashboard/admin/ia", label: "Centro de Control IA", icon: BrainIcon, roles: ["ADMIN", "SCHOOL_ADMIN"] as RolNav[] },
    { href: "/dashboard/admin/operadores", label: "Operadores", icon: UsersIcon, roles: ["ADMIN", "SCHOOL_ADMIN"] as RolNav[] },
    { href: "/dashboard/admin/anti-abuso", label: "Anti-abuso", icon: ShieldIcon, roles: ["ADMIN", "SCHOOL_ADMIN"] as RolNav[] },
    { href: "/dashboard/admin/apelaciones", label: "Apelaciones", icon: ScaleIcon, roles: ["ADMIN", "SCHOOL_ADMIN"] as RolNav[] },
    { href: "/dashboard/admin/dataset-entrenamiento", label: "Dataset", icon: DatabaseIcon, roles: ["ADMIN", "SCHOOL_ADMIN"] as RolNav[] },
    { href: "/dashboard/admin/configuracion", label: "Configuración", icon: CogIcon, roles: ["ADMIN", "SCHOOL_ADMIN"] as RolNav[] },
];

export function AdminNav({ rol }: { rol: RolNav }) {
    const pathname = usePathname();
    const links = allLinks.filter((l) => l.roles.includes(rol));
    const titulo = rol === "OPERADOR" ? "Operador" : "Administración";

    return (
        <nav className="hidden w-64 flex-shrink-0 flex-col border-r border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl sm:flex">
            <div className="border-b border-slate-200 dark:border-slate-800 p-6">
                <h1 className="text-lg font-bold text-body">{titulo}</h1>
                <p className="mt-1 text-xs text-subtle">Protección Infantil</p>
            </div>
            <ul className="flex-1 p-3 space-y-1">
                {links.map((link) => {
                    const active = pathname === link.href || pathname?.startsWith(link.href + "/");
                    return (
                        <li key={link.href}>
                            <Link
                                href={link.href}
                                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                                    active
                                        ? "accent-gradient text-white shadow-lg shadow-sky-500/25 dark:shadow-sky-400/20"
                                        : "text-muted hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-body"
                                }`}
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

function InboxIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5 0c0-4.142 3.358-7.5 7.5-7.5h6.75c4.142 0 7.5 3.358 7.5 7.5m-19.5 0v2.25a2.25 2.25 0 002.25 2.25h15a2.25-2.25V13.5m-19.5 0h19.5" />
        </svg>
    );
}

function ChartIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
    );
}

function DatabaseIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
        </svg>
    );
}

function CogIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.212 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
    );
}

function BrainIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
        </svg>
    );
}

function ShieldIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
        </svg>
    );
}

function ScaleIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18m-3-9h6m-9.75-6.75 1.5-1.5 1.5 1.5m10.5-1.5-1.5-1.5-1.5 1.5M3.75 9.75l1.5 7.5h13.5l1.5-7.5M3.75 9.75h16.5" />
        </svg>
    );
}

function UsersIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.295-2.158-.81-3.05M15 19.128h.003M12 14a4 4 0 1 0-8 0 4 4 0 0 0 8 0Zm0 0h.003M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
    );
}
