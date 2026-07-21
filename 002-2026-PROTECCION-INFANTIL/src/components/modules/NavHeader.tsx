"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Tooltip } from "@/components/ui/Tooltip";

export function NavHeader() {
    const { user, isLoading, logout } = useAuth();
    const [open, setOpen] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === "Escape") setOpen(false);
        }
        if (open) {
            document.addEventListener("mousedown", handleClickOutside);
            document.addEventListener("keydown", handleKeyDown);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [open]);

    const initials = user
        ? (user.nombre?.[0] || user.email[0]).toUpperCase()
        : "";

    const esEmpleado = user?.rol === "ADMIN" || user?.rol === "OPERADOR" || user?.rol === "COMITE_VALIDACION";

    const headerBorderClass = user?.rol === "ADMIN"
        ? "border-b-amber-500/40 dark:border-b-amber-400/30"
        : user?.rol === "OPERADOR"
        ? "border-b-violet-500/40 dark:border-b-violet-400/30"
        : user?.rol === "COMITE_VALIDACION"
        ? "border-b-emerald-500/40 dark:border-b-emerald-400/30"
        : "border-b-white/40 dark:border-b-white/10";

    const avatarClass = user?.rol === "ADMIN"
        ? "bg-amber-500"
        : user?.rol === "OPERADOR"
        ? "bg-violet-500"
        : user?.rol === "COMITE_VALIDACION"
        ? "bg-emerald-500"
        : "accent-gradient";

    const rolBadgeClass = user?.rol === "ADMIN"
        ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
        : user?.rol === "OPERADOR"
        ? "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"
        : user?.rol === "COMITE_VALIDACION"
        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
        : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";

    const dashboardHref = user?.rol === "SCHOOL_ADMIN"
        ? "/dashboard/colegio"
        : user?.rol === "PARENT"
        ? "/dashboard"
        : "/dashboard-publico";

    return (
        <header className={`fixed top-0 left-0 right-0 z-50 glass ${headerBorderClass}`}>
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
                <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight text-body">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg accent-gradient text-white shadow-md">
                        <ShieldIcon className="h-4 w-4" />
                    </span>
                    <span className="text-gradient">Protección</span>
                    <span className="hidden sm:inline">Infantil</span>
                </Link>

                <nav className="flex items-center gap-2 sm:gap-3">
                    <ThemeToggle />

                    <Link
                        href={dashboardHref}
                        className="hidden sm:inline-flex rounded-xl glass-input px-4 py-2 text-sm font-semibold text-body hover:bg-white/70 dark:hover:bg-slate-800/70 transition"
                    >
                        Dashboard
                    </Link>

                    {isLoading ? (
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-sky-500" />
                    ) : user ? (
                        <div className="relative" ref={dropdownRef}>
                            <button
                                onClick={() => setOpen((v) => !v)}
                                className="flex min-h-[44px] items-center gap-2 rounded-xl glass-input px-2.5 py-2 text-sm font-medium text-body hover:bg-white/70 dark:hover:bg-slate-800/70 transition"
                                aria-expanded={open}
                                aria-haspopup="true"
                                aria-label="Menú de usuario"
                            >
                                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white ${avatarClass}`}>
                                    {initials}
                                </span>
                                <span className="hidden sm:inline max-w-[10rem] truncate">{user.nombre || user.email}</span>
                                <ChevronIcon className={`h-4 w-4 text-subtle transition ${open ? "rotate-180" : ""}`} />
                            </button>

                            {open && (
                                <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 shadow-2xl">
                                    <div className="border-b border-slate-100 dark:border-slate-800 px-3 py-2">
                                        <p className="text-sm font-semibold text-body truncate">{user.nombre || user.email}</p>
                                        <div className="mt-1 flex items-center gap-2">
                                            <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${rolBadgeClass}`}>
                                                {user.rol.toLowerCase()}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="py-1">
                                        {user.rol === "ADMIN" && (
                                            <>
                                                <NavDropdownLink href="/dashboard/admin" onClick={() => setOpen(false)}>
                                                    Panel de administración
                                                </NavDropdownLink>
                                                <NavDropdownLink href="/dashboard/admin/configuracion" onClick={() => setOpen(false)}>
                                                    Configuración
                                                </NavDropdownLink>
                                            </>
                                        )}
                                        {user.rol === "SCHOOL_ADMIN" && (
                                            <NavDropdownLink href="/dashboard/colegio" onClick={() => setOpen(false)}>
                                                Mi colegio
                                            </NavDropdownLink>
                                        )}
                                        {user.rol === "OPERADOR" && (
                                            <NavDropdownLink href="/dashboard/admin" onClick={() => setOpen(false)}>
                                                Mis casos
                                            </NavDropdownLink>
                                        )}
                                        {user.rol === "COMITE_VALIDACION" && (
                                            <NavDropdownLink href="/dashboard/admin/comite" onClick={() => setOpen(false)}>
                                                Mi bandeja
                                            </NavDropdownLink>
                                        )}
                                        {!esEmpleado && (
                                            <>
                                                <NavDropdownLink href="/dashboard" onClick={() => setOpen(false)}>
                                                    Mi panel
                                                </NavDropdownLink>
                                                <NavDropdownLink href="/dashboard/circulo-confianza" onClick={() => setOpen(false)}>
                                                    Círculo de Confianza
                                                </NavDropdownLink>
                                                <NavDropdownLink href="/mis-reportes" onClick={() => setOpen(false)}>
                                                    Mis reportes
                                                </NavDropdownLink>
                                            </>
                                        )}
                                        <hr className="my-1 border-slate-100 dark:border-slate-800" />
                                        <button
                                            onClick={async () => {
                                                setOpen(false);
                                                await logout();
                                                window.location.href = "/";
                                            }}
                                            className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                                        >
                                            Cerrar sesión
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <Link
                            href="/login"
                            className="rounded-xl glass-input px-4 py-2 text-sm font-semibold text-body hover:bg-white/70 dark:hover:bg-slate-800/70 transition"
                        >
                            Iniciar sesión
                        </Link>
                    )}

                    <Tooltip content="Menú">
                        <button
                            className="sm:hidden inline-flex h-11 w-11 items-center justify-center rounded-xl glass-input text-body"
                            onClick={() => setMobileOpen((v) => !v)}
                            aria-label="Menú"
                        >
                            {mobileOpen ? <XIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
                        </button>
                    </Tooltip>
                </nav>
            </div>

            {mobileOpen && (
                <div className="sm:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 shadow-lg">
                    <div className="flex flex-col gap-2">
                        <MobileLink href="/" onClick={() => setMobileOpen(false)}>Inicio</MobileLink>
                        <MobileLink href="/dashboard-publico" onClick={() => setMobileOpen(false)}>Dashboard</MobileLink>
                        {user ? (
                            <>
                                {!esEmpleado && (
                                    <>
                                        <MobileLink href="/dashboard" onClick={() => setMobileOpen(false)}>Mi panel</MobileLink>
                                        <MobileLink href="/dashboard/circulo-confianza" onClick={() => setMobileOpen(false)}>Círculo de Confianza</MobileLink>
                                        <MobileLink href="/mis-reportes" onClick={() => setMobileOpen(false)}>Mis reportes</MobileLink>
                                    </>
                                )}
                                {user.rol === "ADMIN" && (
                                    <>
                                        <MobileLink href="/dashboard/admin" onClick={() => setMobileOpen(false)}>Panel admin</MobileLink>
                                        <MobileLink href="/dashboard/admin/configuracion" onClick={() => setMobileOpen(false)}>Configuración</MobileLink>
                                    </>
                                )}
                                {user.rol === "SCHOOL_ADMIN" && (
                                    <MobileLink href="/dashboard/colegio" onClick={() => setMobileOpen(false)}>Mi colegio</MobileLink>
                                )}
                                {user.rol === "OPERADOR" && (
                                    <MobileLink href="/dashboard/admin" onClick={() => setMobileOpen(false)}>Mis casos</MobileLink>
                                )}
                                {user.rol === "COMITE_VALIDACION" && (
                                    <MobileLink href="/dashboard/admin/comite" onClick={() => setMobileOpen(false)}>Mi bandeja</MobileLink>
                                )}
                                <button
                                    onClick={async () => {
                                        setMobileOpen(false);
                                        await logout();
                                        window.location.href = "/";
                                    }}
                                    className="text-left text-sm font-medium text-red-600 dark:text-red-400 px-3 py-2"
                                >
                                    Cerrar sesión
                                </button>
                            </>
                        ) : (
                            <MobileLink href="/login" onClick={() => setMobileOpen(false)}>Iniciar sesión</MobileLink>
                        )}
                    </div>
                </div>
            )}
        </header>
    );
}

function NavDropdownLink({
    href,
    onClick,
    children,
}: {
    href: string;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <Link
            href={href}
            onClick={onClick}
            className="block rounded-lg px-3 py-2 text-sm text-body hover:bg-sky-50 dark:hover:bg-sky-950/30 hover:text-accent transition"
        >
            {children}
        </Link>
    );
}

function MobileLink({
    href,
    onClick,
    children,
}: {
    href: string;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <Link
            href={href}
            onClick={onClick}
            className="block rounded-lg px-3 py-2 text-sm font-medium text-body hover:bg-slate-100 dark:hover:bg-slate-800/60 transition"
        >
            {children}
        </Link>
    );
}

function ShieldIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
    );
}

function ChevronIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
    );
}

function MenuIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
    );
}

function XIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
    );
}
