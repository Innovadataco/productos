"use client";

import Link from "next/link";

export function LandingHero() {
    return (
        <section className="relative overflow-hidden rounded-[2rem] border border-white/30 dark:border-white/10 bg-gradient-to-br from-sky-500 to-cyan-600 dark:from-sky-600 dark:to-cyan-700 px-6 py-16 text-white shadow-2xl shadow-sky-500/15 dark:shadow-cyan-900/30 sm:py-24">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-3xl animate-pulseSlow" />
                <div className="absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-cyan-300/20 blur-3xl animate-pulseSlow" style={{ animationDelay: "1.5s" }} />
            </div>

            <div className="relative mx-auto max-w-3xl text-center">
                <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">
                    Protege a quienes más importan
                </h1>
                <p className="mx-auto mt-6 max-w-2xl text-base text-sky-50 sm:text-lg leading-relaxed">
                    Consulta reportes comunitarios sobre identificadores de riesgo en plataformas digitales.
                    Reporta de forma anónima o autenticada conductas que afecten a menores.
                </p>

                <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                    <Link
                        href="/reportar"
                        className="inline-flex rounded-2xl bg-white px-7 py-3.5 text-sm font-bold text-sky-600 shadow-lg transition hover:bg-sky-50 hover:scale-[1.02]"
                    >
                        Hacer un reporte
                    </Link>
                    <Link
                        href="#consultar"
                        className="inline-flex rounded-2xl border border-white/30 bg-white/10 px-7 py-3.5 text-sm font-bold text-white backdrop-blur-md transition hover:bg-white/20"
                    >
                        Consultar un identificador
                    </Link>
                </div>
            </div>
        </section>
    );
}
