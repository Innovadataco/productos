"use client";

import Link from "next/link";
import { useAuth } from "@/lib/contexts/AuthContext";
import { resetOnboarding } from "@/lib/onboarding";

export function NavHeader() {
    const { user, isLoading, logout } = useAuth();

    return (
        <header className="glass sticky top-0 z-50 border-b border-white/20">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
                <Link href="/" className="text-lg font-bold tracking-tight text-slate-900">
                    Protección Infantil
                </Link>

                <nav className="flex items-center gap-4">
                    <Link
                        href="/reportar"
                        className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition"
                    >
                        Reportar
                    </Link>

                    {isLoading ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-primary-600" />
                    ) : user ? (
                        <div className="flex items-center gap-3">
                            <Link
                                href="/mis-reportes"
                                className="text-sm font-medium text-slate-600 hover:text-slate-900 transition hidden sm:inline"
                            >
                                Mis reportes
                            </Link>
                            <span className="text-sm text-slate-700 hidden sm:inline">
                                {user.nombre}
                            </span>
                            <button
                                onClick={() => {
                                    resetOnboarding();
                                    window.location.reload();
                                }}
                                className="text-sm font-medium text-slate-600 hover:text-slate-900 transition hidden sm:inline"
                                title="Repetir tour de bienvenida"
                            >
                                Tour
                            </button>
                            <button
                                onClick={logout}
                                className="text-sm font-medium text-slate-600 hover:text-slate-900 transition"
                            >
                                Cerrar sesión
                            </button>
                        </div>
                    ) : (
                        <Link
                            href="/login"
                            className="text-sm font-medium text-slate-600 hover:text-slate-900 transition"
                        >
                            Iniciar sesión
                        </Link>
                    )}
                </nav>
            </div>
        </header>
    );
}