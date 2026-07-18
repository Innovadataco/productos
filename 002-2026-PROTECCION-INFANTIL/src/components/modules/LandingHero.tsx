"use client";

import Link from "next/link";
import { ConsultaForm } from "./ConsultaForm";

function ShieldIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
    );
}

function FlagIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 15s1.5-2 5-2 5 2 8 2 4-1 4-1V3s-1.5 1-4 1-5-2-8-2-5 2-5 2v12z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 22V2" />
        </svg>
    );
}

function SearchIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
        </svg>
    );
}

function UserPlusIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="8.5" cy="7" r="4" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 8v6M23 11h-6" />
        </svg>
    );
}

function ChartBarIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18" />
            <rect x="7" y="10" width="4" height="8" rx="1" />
            <rect x="15" y="6" width="4" height="12" rx="1" />
        </svg>
    );
}

export function LandingHero({ onSearch }: { onSearch: (identificador: string) => void }) {
    return (
        <section className="relative overflow-hidden rounded-[2rem] border border-white/30 dark:border-white/10 bg-gradient-to-br from-sky-500 to-cyan-600 dark:from-sky-600 dark:to-cyan-700 px-6 py-14 text-white shadow-2xl shadow-sky-500/15 dark:shadow-cyan-900/30 sm:py-20">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-3xl animate-pulseSlow" />
                <div className="absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-cyan-300/20 blur-3xl animate-pulseSlow" style={{ animationDelay: "1.5s" }} />
            </div>

            <div className="relative mx-auto max-w-5xl text-center">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md">
                    <ShieldIcon className="h-8 w-8 text-white" />
                </div>

                <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
                    Protege a quienes más importan
                </h1>
                <p className="mx-auto mt-5 max-w-2xl text-base text-sky-50 sm:text-lg leading-relaxed">
                    Consulta y reporta identificadores asociados a conductas de riesgo para menores en plataformas digitales.
                    De forma gratuita, con o sin cuenta.
                </p>

                <div className="mt-10 grid gap-4 sm:grid-cols-[1fr_1.25fr]">
                    <Link
                        href="/reportar"
                        className="group flex flex-col items-start rounded-3xl bg-white p-6 text-left shadow-xl shadow-sky-900/10 transition-all hover:scale-[1.02] hover:shadow-2xl sm:p-8"
                    >
                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-600 transition group-hover:bg-sky-600 group-hover:text-white">
                            <FlagIcon className="h-6 w-6" />
                        </div>
                        <span className="text-xl font-bold text-sky-700 sm:text-2xl">Crear un reporte</span>
                        <span className="mt-1 text-sm font-medium text-sky-600/90">De forma anónima o con tu cuenta</span>
                    </Link>

                    <div className="flex flex-col items-start rounded-3xl border border-white/30 bg-white/10 p-6 text-left backdrop-blur-md sm:p-8">
                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-white">
                            <SearchIcon className="h-6 w-6" />
                        </div>
                        <span className="text-xl font-bold text-white sm:text-2xl">Consultar</span>
                        <span className="mt-1 text-sm font-medium text-white/90">Busca un número, nick o usuario</span>
                        <div className="mt-5 w-full">
                            <ConsultaForm onSearch={onSearch} compact />
                        </div>
                    </div>
                </div>

                <div className="mt-8 flex flex-wrap items-center justify-center gap-6">
                    <Link
                        href="/registro"
                        className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-md transition hover:bg-white/20"
                    >
                        <UserPlusIcon className="h-4 w-4" aria-hidden="true" />
                        Crear una cuenta
                    </Link>
                    <Link
                        href="/dashboard/publico"
                        className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-md transition hover:bg-white/20"
                    >
                        <ChartBarIcon className="h-4 w-4" aria-hidden="true" />
                        Ver estadísticas
                    </Link>
                </div>
            </div>
        </section>
    );
}
