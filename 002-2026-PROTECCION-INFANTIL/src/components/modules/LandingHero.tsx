"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConsultaForm } from "./ConsultaForm";
import { formatPlataformasResumen } from "@/lib/plataforma";
import { RPT_STORAGE_KEY } from "./HomePageClient";

type Ubicacion = { pais: string; ciudad?: string; fecha?: string };
type Plataforma = { id: string; nombre: string; total: number };

export type ResultadoConsulta = {
    identificador: string;
    tieneReportes: boolean;
    totalReportes?: number;
    reportesAutenticados?: number;
    reportesAnonimos?: number;
    ultimoReporte?: string | null;
    actividad?: "baja" | "alta";
    plataformas?: Plataforma[];
    ubicaciones?: Ubicacion[];
    mensaje?: string;
};

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

function formatearFecha(fecha?: string | null): string {
    if (!fecha) return "";
    try {
        return new Date(fecha).toLocaleDateString("es-LA", { day: "2-digit", month: "2-digit", year: "numeric" });
    } catch {
        return fecha;
    }
}

function EyeSlashIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 0 1-4.006 4.853M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L12 12" />
        </svg>
    );
}

function UserIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0zM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
        </svg>
    );
}

export function LandingHero({
    onSearch,
    data,
    isLoading,
    error,
    buscado,
}: {
    onSearch: (identificador: string) => void;
    data: ResultadoConsulta | null;
    isLoading: boolean;
    error: string | null;
    buscado: boolean;
}) {
    const router = useRouter();
    const [rpt, setRpt] = useState("");

    function irASeguimiento(e: React.FormEvent) {
        e.preventDefault();
        const numero = rpt.trim();
        if (!numero) return;
        // El RPT viaja por sessionStorage, nunca por query string (spec 091-US2).
        sessionStorage.setItem(RPT_STORAGE_KEY, numero);
        router.push("/seguimiento");
    }

    const resultado = data as ResultadoConsulta | null;

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
                    <div className="flex flex-col items-start rounded-3xl bg-white p-6 text-left shadow-xl shadow-sky-900/10 sm:p-8">
                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-600">
                            <FlagIcon className="h-6 w-6" />
                        </div>
                        <span className="text-xl font-bold text-sky-700 sm:text-2xl">Crear un reporte</span>
                        <span className="mt-1 text-sm font-medium text-sky-600/90">Elige cómo deseas reportar</span>
                        <div className="mt-5 flex w-full flex-col gap-3">
                            <Link
                                href="/reportar"
                                className="group inline-flex items-center justify-center gap-2 rounded-2xl accent-gradient px-5 py-3 text-sm font-bold text-white shadow-lg shadow-sky-500/25 transition hover:brightness-110"
                            >
                                <EyeSlashIcon className="h-5 w-5" aria-hidden="true" />
                                Reportar anónimo
                            </Link>
                            <Link
                                href="/login?redirect=/reportar"
                                className="group inline-flex items-center justify-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-5 py-3 text-sm font-bold text-sky-700 transition hover:bg-sky-100"
                            >
                                <UserIcon className="h-5 w-5" aria-hidden="true" />
                                Reportar con mi cuenta
                            </Link>

                            {/* Spec 091-B: re-consulta del propio reporte, discreta, dentro de la tarjeta */}
                            <form onSubmit={irASeguimiento} className="mt-4 border-t border-sky-200/60 pt-4">
                                <label htmlFor="rpt-input" className="text-xs font-medium text-sky-700">
                                    ¿Ya reportaste? Consulta el estado de tu reporte
                                </label>
                                <div className="mt-1.5 flex gap-2">
                                    <input
                                        id="rpt-input"
                                        type="text"
                                        value={rpt}
                                        onChange={(e) => setRpt(e.target.value)}
                                        placeholder="RPT-XXXXXX"
                                        className="w-full rounded-xl border border-sky-200 bg-white/80 px-3 py-2 text-sm text-sky-900 placeholder:text-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
                                    />
                                    <button
                                        type="submit"
                                        disabled={!rpt.trim()}
                                        className="rounded-xl bg-sky-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-sky-700 disabled:opacity-50"
                                    >
                                        Ver estado
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>

                    <div className="flex flex-col items-start rounded-3xl border border-white/30 bg-white/10 p-6 text-left backdrop-blur-md sm:p-8">
                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-white">
                            <SearchIcon className="h-6 w-6" aria-hidden="true" />
                        </div>
                        <span className="text-xl font-bold text-white sm:text-2xl">Consultar</span>
                        <span className="mt-1 text-sm font-medium text-white/90">Busca un número, nick o usuario</span>
                        <div className="mt-5 w-full">
                            <ConsultaForm onSearch={onSearch} compact />
                        </div>

                        {(isLoading || error || buscado) && (
                            <div className="mt-5 w-full border-t border-white/20 pt-5">
                                {isLoading && (
                                    <div className="flex flex-col items-center py-4">
                                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                        <p className="mt-2 text-sm text-white/90">Consultando...</p>
                                    </div>
                                )}

                                {error && (
                                    <p className="rounded-xl bg-red-500/20 px-4 py-3 text-sm text-white">{error}</p>
                                )}

                                {!isLoading && buscado && !error && !resultado?.tieneReportes && (
                                    <p className="text-sm text-white/90">
                                        {resultado?.mensaje || "Sin reportes registrados para este identificador."}
                                    </p>
                                )}

                                {!isLoading && resultado?.tieneReportes && (
                                    <div className="space-y-3">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-sm font-semibold text-white">{resultado.identificador}</span>
                                            <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium text-white">
                                                {resultado.totalReportes} reportes
                                            </span>
                                            <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium text-white">
                                                Actividad {resultado.actividad ?? "baja"} de reportes
                                            </span>
                                        </div>

                                        <div className="space-y-2 text-sm text-white/90">
                                            {!!resultado.plataformas?.length && (
                                                <p>{formatPlataformasResumen(resultado.plataformas, resultado.totalReportes)}</p>
                                            )}
                                            {/* Anónimo: ubicación SOLO por países (spec 089-US5) */}
                                            {!!resultado.ubicaciones?.length && (
                                                <p>
                                                    {resultado.ubicaciones.length > 1 ? "Países" : "País"}:{" "}
                                                    {resultado.ubicaciones.map((u) => u.pais).join(", ")}
                                                </p>
                                            )}
                                            <p className="text-xs text-white/80">
                                                Total: {resultado.totalReportes} · Autenticados: {resultado.reportesAutenticados ?? 0} · Anónimos: {resultado.reportesAnonimos ?? 0}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}
